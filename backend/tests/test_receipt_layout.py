"""Column layout and wrapping on the thermal receipt (Batch H phase 1)."""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from escpos_helpers import assert_fits, print_sale, receipt_lines
from services.escpos_service import format_item_row, label_value_rows, receipt_columns, wrap_text

# (paper, font, columns) -> line width the printer code uses
WIDTH_CASES = [
    ("58", "standard", 28), ("58", "standard", 30), ("58", "standard", 32),
    ("58", "compact", 35), ("58", "compact", 42),
    ("80", "standard", 40), ("80", "standard", 42), ("80", "standard", 48),
    ("80", "compact", 56), ("80", "compact", 64),
    ("A4", "standard", 80),
]
LONG_NAME = "Čerstvý celozrnný chléb Šumava s kmínem a slunečnicovými semínky 1 kg"
STORE = {
    "storeName": "Velmi dlouhý název prodejny s.r.o. Praha Vinohrady",
    "street": "Náměstí Míru 1234/56",
    "city": "120 00 Praha 2 - Vinohrady",
    "ico": "12345678",
    "dic": "CZ12345678",
    "receiptStorePhone": "+420 123 456 789",
    "receiptStoreEmail": "info@velmidlouhadomena-prodejna.example.cz",
    "receiptCustomHeader": "Otevřeno denně od 7:00 do 22:00, nonstop automat",
    "receiptFooterLines": "Děkujeme za váš nákup a těšíme se na vaši další návštěvu u nás",
    "eetEnabled": True,
    "receiptQrCodeType": "none",
    "receiptShowBarcode": False,
}


def store_for(paper, font, cols):
    return {**STORE, "printerPaperWidth": paper, "receiptFontSize": font, "receiptLineColumns": cols}


ITEMS = {
    "plain": [{"name": "Rohlik", "price": 3.5, "quantity": 2, "vat": 12}],
    "weighted": [{"name": "Salám", "price": 89.9, "quantity": 0.35, "vat": 12, "isWeighted": True, "unit": "kg"}],
    "long": [{"name": LONG_NAME, "price": 42, "quantity": 1, "vat": 12}],
    "big_price": [{"name": "Televize", "price": 1234567.89, "quantity": 1, "vat": 21}],
    "discount": [{"name": "Káva", "price": 120, "quantity": 1, "vat": 21, "discountPercent": 10}],
    "refund": [{"name": "Rohlik", "price": 3.5, "quantity": -2, "vat": 12}],
}


class ColumnWidthTests(unittest.TestCase):
    ALL_WIDTHS = [28, 30, 32, 35, 40, 42, 48, 56, 64, 80]

    def test_retail_columns_fill_the_line(self):
        for lw in self.ALL_WIDTHS:
            name_w, qty_w, price_w = receipt_columns(lw, "retail")
            self.assertEqual(name_w + qty_w + price_w + 2, lw, lw)
            self.assertGreaterEqual(name_w, 10, lw)

    def test_invoice_columns_fill_the_line(self):
        for lw in self.ALL_WIDTHS:
            name_w, qty_w, vat_w, price_w = receipt_columns(lw, "invoice")
            gaps = 3 if vat_w else 2
            self.assertEqual(name_w + qty_w + vat_w + price_w + gaps, lw, lw)
            self.assertGreaterEqual(name_w, 10, lw)

    def test_tax_recap_columns_fill_the_line(self):
        for lw in self.ALL_WIDTHS:
            rate_w, net_w, tax_w, gross_w = receipt_columns(lw, "tax_recap")
            gaps = 3 if gross_w else 2
            self.assertEqual(rate_w + net_w + tax_w + gross_w + gaps, lw, lw)
            self.assertGreaterEqual(net_w, 10, lw)

    def test_widths_that_exist_today_do_not_change(self):
        self.assertEqual(receipt_columns(32, "retail"), (15, 5, 10))
        self.assertEqual(receipt_columns(48, "retail"), (26, 7, 13))
        self.assertEqual(receipt_columns(64, "retail"), (42, 7, 13))
        self.assertEqual(receipt_columns(32, "invoice"), (14, 5, 0, 11))
        self.assertEqual(receipt_columns(48, "invoice"), (20, 5, 5, 15))
        self.assertEqual(receipt_columns(64, "invoice"), (34, 6, 6, 15))
        self.assertEqual(receipt_columns(32, "tax_recap"), (6, 12, 12, 0))
        self.assertEqual(receipt_columns(48, "tax_recap"), (8, 12, 12, 13))
        self.assertEqual(receipt_columns(64, "tax_recap"), (10, 16, 16, 19))


class WrapTextTests(unittest.TestCase):
    def test_wraps_at_word_boundaries(self):
        self.assertEqual(wrap_text("aaa bbb ccc", 7), ["aaa bbb", "ccc"])

    def test_long_word_is_split(self):
        self.assertEqual(wrap_text("x" * 10, 4), ["xxxx", "xxxx", "xx"])

    def test_keeps_leading_indent_on_every_line(self):
        self.assertEqual(wrap_text("  aaa bbb ccc", 9), ["  aaa bbb", "  ccc"])

    def test_empty_gives_no_lines(self):
        self.assertEqual(wrap_text("", 10), [])
        self.assertEqual(wrap_text("   ", 10), [])

    def test_honours_newlines(self):
        self.assertEqual(wrap_text("aa\nbb", 10), ["aa", "bb"])


class ItemRowTests(unittest.TestCase):
    def test_short_name_is_one_line(self):
        rows = format_item_row("Rohlik", "2", "7 Kč", (15, 5, 10), 32)
        self.assertEqual(len(rows), 1)
        self.assertEqual("".join(rows[0]), f"{'Rohlik':<15} {'2':^5} {'7 Kč':>10}")

    def test_long_name_wraps_and_totals_stay_on_last_line(self):
        rows = format_item_row(LONG_NAME, "1", "42 Kč", (15, 5, 10), 32)
        self.assertGreater(len(rows), 1)
        for left, right in rows[:-1]:
            self.assertEqual(right, "")
        self.assertTrue("".join(rows[-1]).endswith("42 Kč"))
        for left, right in rows:
            self.assertLessEqual(len(left + right), 32)

    def test_wide_numbers_never_overflow(self):
        rows = format_item_row("Televize", "0.350kg", "1234567.89 Kč", (15, 5, 10), 32)
        for left, right in rows:
            self.assertLessEqual(len(left + right), 32)
        self.assertIn("1234567.89 Kč", "".join("".join(r) for r in rows))

    def test_label_value_rows_fit_and_align(self):
        self.assertEqual(label_value_rows("Celkem:", "10 Kč", 20), ["Celkem:" + " " * 8 + "10 Kč"])
        rows = label_value_rows("Forma úhrady:", "KOMBINOVANÁ (Uhrazeno)", 28)
        for row in rows:
            self.assertLessEqual(len(row), 28)


class SnapshotTests(unittest.TestCase):
    """Short non-weighted rows print exactly as before at 32, 48 and 64 columns."""

    def test_item_row_and_total_unchanged(self):
        for paper, font, cols, name_w, qty_w, price_w in [("58", "standard", 32, 15, 5, 10), ("80", "standard", 48, 26, 7, 13), ("80", "compact", 64, 42, 7, 13)]:
            with self.subTest(cols=cols):
                _, printer = print_sale(None, {"printerPaperWidth": paper, "receiptFontSize": font, "receiptLineColumns": cols, "receiptShowBarcode": False})
                lines = receipt_lines(printer)
                self.assertIn(f"{'Rohlik':<{name_w}} {'1':^{qty_w}} {'3.50 Kč':>{price_w}}", lines)
                self.assertIn(f"CELKEM K ÚHRADĚ:{' ' * (cols - 16 - 7)}3.50 Kč", lines)


class ReceiptMatrixTests(unittest.TestCase):
    def test_every_line_fits_for_every_width_and_item_kind(self):
        for paper, font, cols in WIDTH_CASES:
            width = 80 if paper == "A4" else cols
            for kind, items in ITEMS.items():
                for invoice in (False, True):
                    sale = {
                        "items": items,
                        "totalAmount": -7.0 if kind == "refund" else 1500000.0,
                        "isRefund": kind == "refund",
                        "originalReceiptNumber": "2026-000001" if kind == "refund" else None,
                        "refundReason": "Vrácení zboží v zákonné lhůtě podle zákona" if kind == "refund" else None,
                        "paymentMethod": "split",
                        "splitDetails": {"cash": 1000000.0, "card": 500000.0},
                        "taxSummary": {
                            "21": {"rate": 21, "net": 1239669.42, "tax": 260330.58, "gross": 1500000.0},
                        },
                        "fik": "e5b7a120-192a-4318-9710-d5a23f4b8219-03",
                        "bkp": "A4C7B2E8-89F1D36A-11094477-5CD0A7B4-C3E9AF21",
                        "isInvoice": invoice,
                        "invoiceNumber": "FV-2026-000123" if invoice else None,
                        "customerName": "Firma s velmi dlouhým názvem a.s. Brno",
                        "customerAddress": "Ulice Dlouhá 12/345, 602 00 Brno-střed",
                        "customerIco": "87654321",
                        "customerDic": "CZ87654321",
                        "cashier": "Tereza Nováková-Svobodová",
                    }
                    with self.subTest(paper=paper, font=font, cols=cols, kind=kind, invoice=invoice):
                        res, printer = print_sale(sale, store_for(paper, font, cols))
                        self.assertTrue(res["success"], res)
                        assert_fits(self, receipt_lines(printer), width)


if __name__ == "__main__":
    unittest.main()
