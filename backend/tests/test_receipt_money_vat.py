"""Money and VAT presentation: Decimal line totals, cart discount, non-VAT-payer (Batch H phase 4)."""
import glob
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from escpos_helpers import DEFAULT_SALE, print_sale, receipt_lines
from services.escpos_service import compute_item_line_totals, receipt_totals

FIXTURES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures", "sales")

NON_PAYER = {"receiptVatPayerStatus": "nonpayer"}


class LineTotalDecimalTests(unittest.TestCase):
    def test_matches_decimal_half_up_not_float(self):
        # float(2.675) is stored as 2.67499...; naive float rounding gives 2.67, Decimal HALF_UP gives 2.68.
        totals = compute_item_line_totals([{"price": 2.675, "quantity": 1}])
        self.assertEqual(totals, [2.68])

    def test_printed_receipt_uses_the_decimal_value(self):
        _, printer = print_sale({"items": [{"name": "X", "price": 2.675, "quantity": 1, "vat": 21}],
                                  "totalAmount": 2.68, "taxSummary": {}})
        lines = receipt_lines(printer)
        self.assertTrue(any("2.68 Kč" in line for line in lines))
        self.assertFalse(any("2.67 Kč" in line for line in lines))


class CartDiscountLineSumTests(unittest.TestCase):
    def test_lines_sum_to_the_cart_discounted_total(self):
        items = [
            {"price": 100, "quantity": 1, "vat": 21},
            {"price": 50, "quantity": 1, "vat": 12},
        ]
        totals = compute_item_line_totals(items, cart_discount_percent=10)
        self.assertEqual(totals, [90.0, 45.0])
        self.assertEqual(sum(totals), 135.0)


class NonPayerTests(unittest.TestCase):
    TAX_SALE = {"taxSummary": {"12": {"rate": 12, "net": 3.12, "tax": 0.38, "gross": 3.5}}}

    def test_payer_prints_tax_doklad_title_item_vat_and_recap(self):
        _, printer = print_sale(self.TAX_SALE)
        text = "\n".join(receipt_lines(printer))
        self.assertIn("DAŇOVÝ DOKLAD", text)
        self.assertIn("REKAPITULACE DPH", text)

    def test_non_payer_prints_plain_title_no_item_vat_no_recap(self):
        _, printer = print_sale(self.TAX_SALE, NON_PAYER)
        lines = receipt_lines(printer)
        text = "\n".join(lines)
        self.assertNotIn("DAŇOVÝ DOKLAD", text)
        self.assertIn("ÚČTENKA", text)
        self.assertNotIn("REKAPITULACE DPH", text)
        self.assertFalse(any(line.strip().startswith("DPH ") for line in lines))

    INVOICE_SALE = {"isInvoice": True, "items": [{"name": "Zboží", "price": 100, "quantity": 1, "vat": 21}]}

    def test_payer_invoice_shows_the_vat_rate_column(self):
        _, printer = print_sale(self.INVOICE_SALE)
        self.assertIn("21%", "\n".join(receipt_lines(printer)))

    def test_non_payer_invoice_hides_the_vat_rate_column(self):
        _, printer = print_sale(self.INVOICE_SALE, NON_PAYER)
        self.assertNotIn("21%", "\n".join(receipt_lines(printer)))


class FixtureLineSumTests(unittest.TestCase):
    """Done when: printed lines sum to the printed total for every sale fixture."""

    def test_every_fixture_lines_sum_to_the_printed_total(self):
        for path in sorted(glob.glob(os.path.join(FIXTURES_DIR, "*.json"))):
            with open(path) as f:
                payload = json.load(f)["payload"]
            with self.subTest(fixture=os.path.basename(path)):
                exact_total, _, _ = receipt_totals(payload)
                totals = compute_item_line_totals(payload["items"], payload.get("cartDiscountPercent", 0))
                self.assertAlmostEqual(abs(sum(totals)), abs(exact_total), places=2)


if __name__ == "__main__":
    unittest.main()
