"""Epson hardware layer: job reset, barcode selector, drawer, SPAYD, margins, Win32 fallback (Batch H phase 3)."""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from escpos_helpers import DEFAULT_SALE, print_sale, receipt_lines
from services.escpos_service import Win32SpoolerRawFallback, build_spayd_payload, drawer_pin_from

NO_BARCODE = {"receiptShowBarcode": False}


class JobLifecycleTests(unittest.TestCase):
    def test_job_starts_with_esc_at_then_charcode(self):
        _, printer = print_sale()
        out = printer.output
        self.assertEqual(out[:2], b"\x1b@")
        self.assertGreater(out.index(b"\x1bt"), 0)

    def test_job_ends_with_esc_at_after_the_cut(self):
        _, printer = print_sale()
        self.assertTrue(printer.output.endswith(b"\x1b@"))
        self.assertLess(printer.output.rindex(b"\x1dV\x41\x02"), len(printer.output) - 2)


class BarcodeTests(unittest.TestCase):
    def test_barcode_data_carries_the_B_selector(self):
        _, printer = print_sale()
        self.assertIn(("{B" + DEFAULT_SALE["receiptNumber"]).encode(), printer.output)


class DrawerTests(unittest.TestCase):
    def test_open_drawer_false_sends_no_pulse(self):
        _, printer = print_sale({"paymentMethod": "cash"}, {}, open_drawer=False)
        self.assertNotIn(b"\x1bp", printer.output)

    def test_default_pin_sends_pin_2_pulse(self):
        _, printer = print_sale({"paymentMethod": "cash"})
        self.assertIn(b"\x1bp\x00", printer.output)

    def test_drawer_pin_5_sends_pin_1_pulse(self):
        _, printer = print_sale({"paymentMethod": "cash"}, {"drawerPin": 5})
        self.assertIn(b"\x1bp\x01", printer.output)
        self.assertNotIn(b"\x1bp\x00", printer.output)


class DrawerPinFromTests(unittest.TestCase):
    def test_string_five_is_still_pin_five(self):
        self.assertEqual(drawer_pin_from({"drawerPin": "5"}), 5)

    def test_missing_or_bad_value_defaults_to_pin_two(self):
        self.assertEqual(drawer_pin_from({}), 2)
        self.assertEqual(drawer_pin_from({"drawerPin": "nope"}), 2)


class SpaydPayloadTests(unittest.TestCase):
    def test_amount_is_absolute(self):
        payload = build_spayd_payload("CZ1234", -150.5, "2026-000005", "Store")
        self.assertIn("AM:150.50", payload)
        self.assertNotIn("-150.50", payload)

    def test_message_is_ascii_upper_without_star(self):
        payload = build_spayd_payload("CZ1234", 50, "2026-01", "Himmel * Žel.")
        msg = payload.split("MSG:")[1]
        self.assertNotIn("*", msg)
        self.assertEqual(msg, msg.upper())
        msg.encode("ascii")  # raises if any non-ASCII survived


class SpaydReceiptTests(unittest.TestCase):
    IBAN_CFG = {"receiptQrCodeType": "spayd", "bankAccountIban": "CZ1234567890123456789012"}

    def test_spayd_qr_skipped_on_refund(self):
        _, printer = print_sale({"totalAmount": -100, "isRefund": True}, self.IBAN_CFG)
        self.assertNotIn(b"SPD*1.0", printer.output)

    def test_spayd_qr_uses_native_renderer_for_a_sale(self):
        _, printer = print_sale({"totalAmount": 100}, self.IBAN_CFG)
        self.assertIn(b"\x1d(k", printer.output)


class MarginClampTests(unittest.TestCase):
    def test_top_margin_clamped_to_five(self):
        def leading_blanks(printer):
            n = 0
            for line in receipt_lines(printer):
                if line != "":
                    break
                n += 1
            return n

        _, p0 = print_sale({}, {**NO_BARCODE, "receiptTopMargin": 0})
        _, p9 = print_sale({}, {**NO_BARCODE, "receiptTopMargin": 9})
        self.assertEqual(leading_blanks(p9) - leading_blanks(p0), 5)

    def test_bottom_margin_clamped_to_five(self):
        def trailing_newlines(printer):
            idx = printer.output.index(b"\x1dV\x41\x02")
            before = printer.output[:idx]
            n = 0
            while before[-1:] == b"\n":
                n += 1
                before = before[:-1]
            return n

        _, p0 = print_sale({}, {**NO_BARCODE, "receiptBottomMargin": 0})
        _, p9 = print_sale({}, {**NO_BARCODE, "receiptBottomMargin": 9})
        self.assertEqual(trailing_newlines(p9) - trailing_newlines(p0), 5)


class Win32CharcodeTests(unittest.TestCase):
    """Win32SpoolerRawFallback: charcode stores the slot and the encoding text() then uses."""

    def test_cp852_sets_slot_18_and_encodes_cp852(self):
        printer = Win32SpoolerRawFallback("Test")
        sent = []
        printer._raw = sent.append
        printer.charcode("CP852")
        self.assertEqual(sent[-1], b"\x1bt\x12")
        printer.text("Kč")
        self.assertEqual(sent[-1], "Kč".encode("cp852"))

    def test_cp1250_sets_slot_45_and_encodes_cp1250(self):
        printer = Win32SpoolerRawFallback("Test")
        sent = []
        printer._raw = sent.append
        printer.charcode("CP1250")
        self.assertEqual(sent[-1], b"\x1bt-")
        printer.text("Kč")
        self.assertEqual(sent[-1], "Kč".encode("cp1250"))


if __name__ == "__main__":
    unittest.main()
