"""Unit tests for Czech bank email QR payment listener and cache."""
import imaplib
import os
import sys
import unittest
from datetime import datetime, timedelta
from email.message import EmailMessage
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import services.email_payment_listener as email_listener
from services.email_payment_listener import (
    EmailPaymentListenerThread,
    PaymentCache,
    parse_bank_email,
    start_email_listener_from_env,
)


def _build_rfc822_email(subject: str, plain_body: str, html_body: str = None) -> bytes:
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = "noreply@banka.cz"
    msg["To"] = "pokladna@example.cz"
    msg.set_content(plain_body)
    if html_body is not None:
        msg.add_alternative(html_body, subtype="html")
    return msg.as_bytes()


class TestPaymentCache(unittest.TestCase):
    """Tests for thread-safe in-memory payment TTL cache."""

    def test_add_get_trim_and_ttl_expiry(self):
        cache = PaymentCache(ttl_seconds=60)
        cache.add_payment(" 12345 ", 250.5, "Příchozí platba")

        entry = cache.get_payment("12345")
        self.assertIsNotNone(entry)
        self.assertEqual(entry["amount"], 250.5)
        self.assertEqual(entry["subject"], "Příchozí platba")

        self.assertIsNone(cache.get_payment("99999"))

        cache._cache["12345"]["timestamp"] = datetime.now() - timedelta(seconds=61)
        self.assertIsNone(cache.get_payment("12345"))
        self.assertNotIn("12345", cache._cache)

    def test_cleanup_removes_only_expired(self):
        cache = PaymentCache(ttl_seconds=60)
        cache.add_payment("OLD", 100.0)
        cache.add_payment("FRESH", 200.0)
        cache._cache["OLD"]["timestamp"] = datetime.now() - timedelta(seconds=120)

        cache.cleanup()

        self.assertNotIn("OLD", cache._cache)
        self.assertIsNotNone(cache.get_payment("FRESH"))


class TestParseBankEmail(unittest.TestCase):
    """Tests for Czech bank notification email parser."""

    def test_parse_czech_bank_formats(self):
        cases = [
            (
                "ČSOB Info: Příchozí úhrada",
                "Variabilní symbol: 20260001\nČástka: 250,00 CZK",
                {"variable_symbol": "20260001", "amount": 250.0},
            ),
            (
                "Fio banka - pohyb na účtu",
                "Var. sym.: 881122\nSuma: 1 250,50 Kč",
                {"variable_symbol": "881122", "amount": 1250.5},
            ),
            (
                "QR Platba",
                "X-VS: 98765\nAmount: 99.90 CZK",
                {"variable_symbol": "98765", "amount": 99.9},
            ),
            (
                "Oznámení VS: 42",
                "Připsáno 350,00 CZK na účet",
                {"variable_symbol": "42", "amount": 350.0},
            ),
        ]
        for subject, body, expected in cases:
            with self.subTest(subject=subject):
                self.assertEqual(parse_bank_email(subject, body), expected)

    def test_rejects_incomplete_or_unrelated_emails(self):
        self.assertIsNone(parse_bank_email("Příjem", "Částka: 500,00 CZK bez symbolu"))
        self.assertIsNone(parse_bank_email("Variabilní symbol: 12345", "Žádná suma"))
        self.assertIsNone(parse_bank_email("Týdenní zpravodaj", "Novinky v katalogu bez platby"))


class TestEmailPaymentListenerThread(unittest.TestCase):
    """Synchronous loop tests for IMAP polling, reconnect, and env startup."""

    def setUp(self):
        email_listener.payment_cache._cache.clear()
        email_listener._active_listener = None

    def tearDown(self):
        email_listener.payment_cache._cache.clear()
        email_listener._active_listener = None

    @patch("services.email_payment_listener.time.sleep")
    @patch("services.email_payment_listener.imaplib.IMAP4_SSL")
    def test_fetches_plain_and_multipart_unseen_emails(self, mock_imap_cls, mock_sleep):
        fresh_cache = PaymentCache(ttl_seconds=1800)
        listener = EmailPaymentListenerThread("user@seznam.cz", "secret", check_interval_seconds=1)
        mock_sleep.side_effect = lambda _secs: listener.stop()

        raw_plain = _build_rfc822_email(
            "Banka platba",
            "Variabilní symbol: 1001\nČástka: 149,50 CZK",
        )
        raw_multi = _build_rfc822_email(
            "Multipart platba VS: 1002",
            "Částka: 420,00 Kč",
            html_body="<p>Částka: 420,00 Kč</p>",
        )

        mock_mail = MagicMock()
        mock_mail.search.return_value = ("OK", [b"1 2"])
        mock_mail.fetch.side_effect = [
            ("OK", [(b"1 (RFC822)", raw_plain)]),
            ("OK", [(b"2 (RFC822)", raw_multi)]),
        ]
        mock_imap_cls.return_value = mock_mail

        with patch.object(email_listener, "payment_cache", fresh_cache):
            listener.run()

        mock_mail.login.assert_called_once_with("user@seznam.cz", "secret")
        mock_mail.select.assert_called_once_with("INBOX")
        mock_mail.noop.assert_called_once()
        mock_mail.search.assert_called_once_with(None, "UNSEEN")
        self.assertEqual(mock_mail.fetch.call_count, 2)
        mock_mail.logout.assert_called_once()

        self.assertEqual(fresh_cache.get_payment("1001")["amount"], 149.5)
        self.assertEqual(fresh_cache.get_payment("1002")["amount"], 420.0)

    @patch("services.email_payment_listener.time.sleep")
    @patch("services.email_payment_listener.imaplib.IMAP4_SSL")
    def test_noop_failure_triggers_reconnect_cleanup(self, mock_imap_cls, mock_sleep):
        listener = EmailPaymentListenerThread("user@seznam.cz", "secret", check_interval_seconds=1)
        mock_sleep.side_effect = lambda _secs: listener.stop()

        mock_mail = MagicMock()
        mock_mail.noop.side_effect = imaplib.IMAP4.abort("connection dropped")
        mock_imap_cls.return_value = mock_mail

        listener.run()

        mock_mail.close.assert_called_once()
        mock_mail.logout.assert_called_once()
        mock_mail.search.assert_not_called()

    @patch("services.email_payment_listener.time.sleep")
    @patch("services.email_payment_listener.imaplib.IMAP4_SSL")
    def test_login_error_handled_gracefully(self, mock_imap_cls, mock_sleep):
        listener = EmailPaymentListenerThread("user@seznam.cz", "secret", check_interval_seconds=1)
        mock_sleep.side_effect = lambda _secs: listener.stop()
        mock_imap_cls.side_effect = OSError("IMAP down")

        listener.run()

        mock_sleep.assert_called_once_with(1)

    def test_start_email_listener_from_env(self):
        with patch.dict(os.environ, {"BANK_EMAIL_USER": "", "BANK_EMAIL_PASS": ""}, clear=False):
            self.assertIsNone(start_email_listener_from_env())

        env = {
            "BANK_EMAIL_USER": "shop@seznam.cz",
            "BANK_EMAIL_PASS": "app-pw",
            "BANK_EMAIL_SERVER": "imap.example.cz",
        }
        with patch.dict(os.environ, env, clear=False):
            with patch.object(EmailPaymentListenerThread, "start") as mock_start, \
                 patch.object(EmailPaymentListenerThread, "is_alive", return_value=True):
                first = start_email_listener_from_env()
                self.assertIsNotNone(first)
                self.assertEqual(first.username, "shop@seznam.cz")
                self.assertEqual(first.imap_server, "imap.example.cz")
                mock_start.assert_called_once()

                second = start_email_listener_from_env()
                self.assertIs(second, first)
                mock_start.assert_called_once()


if __name__ == "__main__":
    unittest.main()
