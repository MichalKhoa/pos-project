import os
import re
import email
import imaplib
import threading
import time
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

logger = logging.getLogger("pos-email-listener")


class PaymentCache:
    """In-memory thread-safe TTL cache for received bank payments."""
    def __init__(self, ttl_seconds: int = 1800):  # Keep cached payments for 30 minutes
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.Lock()
        self.ttl = ttl_seconds

    def add_payment(self, variable_symbol: str, amount: float, raw_subject: str = ""):
        with self._lock:
            vs = str(variable_symbol).strip()
            self._cache[vs] = {
                "amount": float(amount),
                "timestamp": datetime.now(),
                "subject": raw_subject
            }
            logger.info(f"✅ Real-time QR payment cached: VS={vs}, Amount={amount} CZK")

    def get_payment(self, variable_symbol: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            vs = str(variable_symbol).strip()
            payment = self._cache.get(vs)
            if not payment:
                return None
            
            # Check TTL
            if datetime.now() - payment["timestamp"] > timedelta(seconds=self.ttl):
                del self._cache[vs]
                return None
            
            return payment

    def cleanup(self):
        with self._lock:
            now = datetime.now()
            expired = [vs for vs, data in self._cache.items() if now - data["timestamp"] > timedelta(seconds=self.ttl)]
            for vs in expired:
                del self._cache[vs]


payment_cache = PaymentCache()


def parse_bank_email(subject: str, body: str) -> Optional[Dict[str, Any]]:
    """
    Parses Czech bank notification email for Variable Symbol and Amount.
    Supports ČSOB, Fio, KB, Air Bank, Raiffeisenbank.
    """
    text = f"{subject}\n{body}"

    # 1. Extract Variable Symbol (X-VS or VS or Variabilní symbol)
    vs_match = re.search(r'(?:Variabilní\s+symbol|VS|Var\.?\s*sym\.?|X-VS)[\s:]*(\d{1,10})', text, re.IGNORECASE)
    if not vs_match:
        return None

    variable_symbol = vs_match.group(1).strip()

    # 2. Extract Amount (e.g. Částka: 250,00 CZK, Částka 250.00 Kč)
    amount_match = re.search(r'(?:Částka|Castka|Suma|Amount)[\s:]*([\d\s]+(?:[.,]\d{1,2})?)\s*(?:CZK|Kč)?', text, re.IGNORECASE)
    if not amount_match:
        # Fallback regex for standalone amount format like "250,00 CZK" or "250.00 Kč"
        amount_match = re.search(r'([\d\s]+[.,]\d{2})\s*(?:CZK|Kč)', text)

    if not amount_match:
        return None

    raw_amount = amount_match.group(1).replace(" ", "").replace(",", ".")
    try:
        amount = float(raw_amount)
    except ValueError:
        return None

    return {
        "variable_symbol": variable_symbol,
        "amount": amount
    }


class EmailPaymentListenerThread(threading.Thread):
    """
    Background worker thread monitoring an IMAP inbox (Seznam.cz, Gmail, etc.)
    for incoming bank payment notifications.
    """
    def __init__(self, username: str, password: str, imap_server: str = "imap.seznam.cz", port: int = 993, check_interval_seconds: int = 3):
        super().__init__(daemon=True)
        self.username = username
        self.password = password
        self.imap_server = imap_server
        self.port = port
        self.interval = check_interval_seconds
        self.running = False

    def run(self):
        self.running = True
        logger.info(f"📧 Starting Bank Email Listener thread on {self.imap_server}:{self.port} for: {self.username}")

        while self.running:
            try:
                mail = imaplib.IMAP4_SSL(self.imap_server, self.port)
                mail.login(self.username, self.password)
                mail.select("INBOX")

                # Search UNSEEN (unread) emails
                # Can be filtered specifically by bank sender (e.g. 'UNSEEN FROM "oznameni@csob.cz"')
                status, messages = mail.search(None, 'UNSEEN')
                
                if status == 'OK' and messages[0]:
                    email_ids = messages[0].split()
                    for e_id in email_ids:
                        res, msg_data = mail.fetch(e_id, '(RFC822)')
                        for response_part in msg_data:
                            if isinstance(response_part, tuple):
                                msg = email.message_from_bytes(response_part[1])
                                subject = msg.get("Subject", "")

                                # Extract email body text
                                body = ""
                                if msg.is_multipart():
                                    for part in msg.walk():
                                        if part.get_content_type() == "text/plain":
                                            body = part.get_payload(decode=True).decode('utf-8', errors='ignore')
                                            break
                                else:
                                    body = msg.get_payload(decode=True).decode('utf-8', errors='ignore')

                                parsed = parse_bank_email(subject, body)
                                if parsed:
                                    payment_cache.add_payment(
                                        parsed["variable_symbol"],
                                        parsed["amount"],
                                        subject
                                    )

                mail.close()
                mail.logout()

            except Exception as e:
                logger.debug(f"IMAP listener check loop: {e}")

            payment_cache.cleanup()
            time.sleep(self.interval)

    def stop(self):
        self.running = False


_active_listener: Optional[EmailPaymentListenerThread] = None


def start_email_listener_from_env():
    """
    Initializes and starts the email listener background thread if IMAP environment
    variables or configuration are set.
    Environment variables:
      - BANK_EMAIL_USER (e.g. parents@seznam.cz)
      - BANK_EMAIL_PASS (App password from Seznam)
      - BANK_EMAIL_SERVER (default: imap.seznam.cz)
    """
    global _active_listener

    username = os.getenv("BANK_EMAIL_USER", "").strip()
    password = os.getenv("BANK_EMAIL_PASS", "").strip()
    server = os.getenv("BANK_EMAIL_SERVER", "imap.seznam.cz").strip()

    if not username or not password:
        logger.info("ℹ️ Bank email listener not configured (BANK_EMAIL_USER / BANK_EMAIL_PASS env empty). Direct IMAP listener disabled.")
        return None

    if _active_listener and _active_listener.is_alive():
        logger.info("Bank email listener thread is already running.")
        return _active_listener

    _active_listener = EmailPaymentListenerThread(
        username=username,
        password=password,
        imap_server=server
    )
    _active_listener.start()
    return _active_listener
