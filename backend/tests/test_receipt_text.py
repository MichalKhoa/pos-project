"""Text and content on the thermal receipt: local time, strip mode, cash lines (Batch H phase 2)."""
import os
import sys
import time
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from escpos.printer import Dummy

from escpos_helpers import _CONTROL, print_sale, receipt_lines
from services.escpos_service import ESCPOSPrinterService

NO_BARCODE = {"receiptShowBarcode": False}


@unittest.skipUnless(hasattr(time, "tzset"), "time.tzset is Unix only")
class PragueTimeCase(unittest.TestCase):
    """Run with TZ=Europe/Prague so the expected local times are fixed."""

    def setUp(self):
        self._old_tz = os.environ.get("TZ")
        os.environ["TZ"] = "Europe/Prague"
        time.tzset()

    def tearDown(self):
        if self._old_tz is None:
            os.environ.pop("TZ", None)
        else:
            os.environ["TZ"] = self._old_tz
        time.tzset()


class ReceiptLocalTimeTests(PragueTimeCase):
    def receipt_date_line(self, ts, sale=None):
        _, printer = print_sale({"timestamp": ts, **(sale or {})}, NO_BARCODE)
        return [line for line in receipt_lines(printer) if line.startswith(("Datum", "DUZP"))]

    def test_utc_winter_time_prints_one_hour_later(self):
        self.assertEqual(self.receipt_date_line("2026-11-16T14:00:00Z"), ["Datum a čas: 16.11.2026 15:00:00"])

    def test_utc_summer_time_prints_two_hours_later(self):
        self.assertEqual(self.receipt_date_line("2026-07-16T14:00:00.123Z"), ["Datum a čas: 16.07.2026 16:00:00"])

    def test_naive_timestamp_counts_as_utc(self):
        self.assertEqual(self.receipt_date_line("2026-11-16T14:00:00"), ["Datum a čas: 16.11.2026 15:00:00"])

    def test_invoice_date_and_duzp_are_local(self):
        lines = self.receipt_date_line("2026-11-16T23:30:00Z", {"isInvoice": True, "invoiceNumber": "FV-1"})
        self.assertEqual(len(lines), 2)
        self.assertTrue(lines[0].startswith("Datum vystavení:") and lines[0].endswith("17.11.2026 00:30:00"), lines)
        self.assertTrue(lines[1].endswith("17.11.2026"), lines)


class ProtocolLocalTimeTests(PragueTimeCase):
    def print_protocol(self, method, data):
        service = ESCPOSPrinterService("DUMMY")
        printer = Dummy()
        with patch.object(service, "_get_printer_device", return_value=printer):
            res = getattr(service, method)(data, {"storeName": "Test"})
        self.assertTrue(res["success"], res)
        return receipt_lines(printer)

    def test_write_off_protocol_prints_local_time(self):
        lines = self.print_protocol("print_write_off_protocol", {"timestamp": "2026-11-16T14:00:00", "items": []})
        self.assertIn("Datum: 16.11.2026 15:00", lines)

    def test_inventory_protocol_prints_local_time(self):
        lines = self.print_protocol("print_inventory_protocol", {"timestamp": "2026-11-16T14:00:00Z", "items": []})
        self.assertIn("Datum a čas:  16.11.2026 15:00", lines)


class StripDiacriticsTests(unittest.TestCase):
    SALE = {
        "items": [
            {"name": "Đường trắng", "price": 30, "quantity": 1, "vat": 12},
            {"name": "Salám", "price": 89.9, "quantity": 0.35, "vat": 12, "isWeighted": True, "unit": "kg"},
        ],
        "totalAmount": 61.47,
        "taxSummary": {"12": {"rate": 12, "net": 54.88, "tax": 6.59, "gross": 61.47}},
    }

    def print_stripped(self, sale=None, store=None):
        _, printer = print_sale({**self.SALE, **(sale or {})}, {"stripDiacritics": True, **NO_BARCODE, **(store or {})})
        return printer

    def assert_ascii(self, printer):
        text = _CONTROL.sub(b"", printer.output)
        non_ascii = sorted({b for b in text if b > 0x7F})
        self.assertFalse(non_ascii, f"non-ASCII bytes in strip mode: {non_ascii}")

    def test_retail_output_is_pure_ascii(self):
        self.assert_ascii(self.print_stripped())

    def test_invoice_output_is_pure_ascii(self):
        self.assert_ascii(self.print_stripped({"isInvoice": True, "invoiceNumber": "FV-1"}))

    def test_framed_and_banner_titles_are_pure_ascii(self):
        for style in ("banner", "framed"):
            with self.subTest(style=style):
                self.assert_ascii(self.print_stripped(store={"receiptTitleStyle": style}))

    def test_keeps_multiplication_sign_and_d_with_stroke(self):
        text = "\n".join(receipt_lines(self.print_stripped(), "ascii"))
        self.assertIn("Duong trang", text)
        self.assertIn("0.350 kg x 89.90 Kc", text)
        self.assertIn("== DANOVY DOKLAD c. 2026-000001 ==", text)

    def test_keeps_dashes_quotes_and_euro_from_footer(self):
        printer = self.print_stripped(store={"receiptFooterLines": "Otevřeno 7–22 „denně“ 5 €"})
        self.assertIn('Otevreno 7-22 "denne" 5 EUR', receipt_lines(printer, "ascii"))


class CashLineTests(unittest.TestCase):
    def cash_labels(self, sale):
        _, printer = print_sale({"paymentMethod": "cash", **sale}, NO_BARCODE)
        return [line.split(":")[0] for line in receipt_lines(printer) if line.startswith(("Přijatá", "Vrácená"))]

    def test_cash_sale_with_tendered_prints_both_lines(self):
        self.assertEqual(self.cash_labels({"totalAmount": 4, "tenderedAmount": 10, "changeDue": 6}),
                         ["Přijatá hotovost", "Vrácená hotovost"])

    def test_exact_cash_keeps_zero_change_line(self):
        self.assertEqual(self.cash_labels({"totalAmount": 4, "tenderedAmount": 4, "changeDue": 0}),
                         ["Přijatá hotovost", "Vrácená hotovost"])

    def test_cash_refund_has_no_cash_lines(self):
        refund = {"totalAmount": -4, "isRefund": True, "items": [{"name": "Rohlik", "price": 3.5, "quantity": -1, "vat": 12}]}
        self.assertEqual(self.cash_labels(refund), [])

    def test_reprint_without_tendered_has_no_cash_lines(self):
        self.assertEqual(self.cash_labels({"totalAmount": 4}), [])


class ContactLineTests(unittest.TestCase):
    def test_contacts_are_joined_with_a_bar(self):
        store = {"receiptStorePhone": "+420 123", "receiptStoreEmail": "a@b.cz", **NO_BARCODE}
        _, printer = print_sale(None, store)
        lines = receipt_lines(printer)
        self.assertIn("Tel: +420 123 | Email: a@b.cz", lines)
        self.assertNotIn("?", "\n".join(lines))


if __name__ == "__main__":
    unittest.main()
