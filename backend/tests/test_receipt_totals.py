"""Receipt amounts: cash rounding is shown as its own line (F-016)."""
import os
import sys
import unittest
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.escpos_service import ESCPOSPrinterService, receipt_totals


class ReceiptTotalsTests(unittest.TestCase):
    def test_card_keeps_the_exact_total(self):
        self.assertEqual(receipt_totals({"paymentMethod": "card", "totalAmount": 3.5}), (3.5, 0.0, 3.5))

    def test_local_cash_shape(self):
        sale = {"paymentMethod": "cash", "totalAmount": 12, "cashRounding": 0.5}
        self.assertEqual(receipt_totals(sale), (11.5, 0.5, 12.0))

    def test_server_cash_shape(self):
        sale = {"payment_method": "cash", "total_amount": 11.5, "cash_rounding": 0.5}
        self.assertEqual(receipt_totals(sale), (11.5, 0.5, 12.0))

    def test_exact_cash_total_only(self):
        self.assertEqual(receipt_totals({"paymentMethod": "cash", "totalAmount": 11.5}), (11.5, 0.5, 12.0))

    def test_whole_cash_total_has_no_rounding(self):
        self.assertEqual(receipt_totals({"paymentMethod": "cash", "totalAmount": 12}), (12.0, 0.0, 12.0))

    def test_cash_refund_rounds_away_from_zero(self):
        sale = {"paymentMethod": "cash", "totalAmount": -4, "cashRounding": -0.5}
        self.assertEqual(receipt_totals(sale), (-3.5, -0.5, -4.0))


class ReceiptPrintTests(unittest.TestCase):
    def _print(self, sale):
        service = ESCPOSPrinterService("DUMMY")
        printer = MagicMock()
        with patch.object(service, "_get_printer_device", return_value=printer):
            res = service.print_receipt(
                {"receiptNumber": "2026-000001", "timestamp": "2026-11-16T10:00:00", "taxSummary": {},
                 "items": [{"name": "Rohlik", "price": 3.5, "quantity": 1, "vat": 12}], **sale},
                {"storeName": "Test"},
            )
        self.assertTrue(res["success"])
        return "".join(str(c.args[0]) for c in printer.text.call_args_list if c.args)

    def test_cash_receipt_shows_subtotal_rounding_and_payable(self):
        out = self._print({"paymentMethod": "cash", "totalAmount": 12, "cashRounding": 0.5,
                           "tenderedAmount": 20, "changeDue": 8})
        self.assertIn("Mezisoučet", out)
        self.assertIn("11.50 Kč", out)
        self.assertIn("Zaokrouhlení", out)
        self.assertIn("+0.50 Kč", out)
        self.assertRegex(out, r"CELKEM K ÚHRADĚ:\s+12 Kč")

    def test_server_shape_cash_receipt_prints_the_payable_total(self):
        out = self._print({"payment_method": "cash", "total_amount": 11.5, "cash_rounding": 0.5,
                           "tenderedAmount": 20, "changeDue": 8})
        self.assertRegex(out, r"CELKEM K ÚHRADĚ:\s+12 Kč")

    def test_card_receipt_has_no_rounding_line(self):
        out = self._print({"paymentMethod": "card", "totalAmount": 3.5})
        self.assertNotIn("Zaokrouhlení", out)
        self.assertRegex(out, r"CELKEM K ÚHRADĚ:\s+3\.50 Kč")


if __name__ == "__main__":
    unittest.main()
