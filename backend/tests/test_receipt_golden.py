"""Golden-file text snapshots of the receipt design (Batch H phase 5, decision 12).

One fixed sale, decoded to plain text at three widths. A later design change shows up here
as a readable diff; review the new file as text before it goes to paper.
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from escpos_helpers import print_sale, receipt_lines

FIXTURES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures", "receipts")

SALE = {
    "receiptNumber": "2026-000123",
    "timestamp": "2026-11-16T14:05:09",
    "cashier": "Jana",
    "paymentMethod": "cash",
    "tenderedAmount": 12,
    "changeDue": 0,
    "totalAmount": 12.0,
    "cashRounding": 0.5,
    "taxSummary": {
        "12": {"rate": 12, "net": 59.46, "tax": 7.14, "gross": 66.6},
        "21": {"rate": 21, "net": 42.64, "tax": 8.96, "gross": 51.6},
    },
    "items": [
        {"name": "Rohlik tukovy", "price": 3.9, "quantity": 3, "vat": 12},
        {"name": "Mleko polotucne 1,5% trvanlive 1l Madeta", "price": 29.9, "quantity": 1, "vat": 12},
        {"name": "Salam Vysocina", "price": 89.9, "quantity": 0.35, "unit": "kg", "vat": 12},
        {"name": "Cola 0,5l", "price": 28.8, "quantity": 2, "vat": 21, "discountPercent": 10},
    ],
}

STORE = {
    "storeName": "Potraviny Novak",
    "street": "Hlavni 12",
    "city": "110 00 Praha 1",
    "ico": "12345678",
    "dic": "CZ12345678",
    "registerNo": "Pokladna #01",
    "idProvozovny": "11",
}


class GoldenFileTests(unittest.TestCase):
    def _golden(self, name, paper_width, font_size, cols):
        _, printer = print_sale(SALE, {**STORE, "printerPaperWidth": paper_width,
                                        "receiptFontSize": font_size, "receiptLineColumns": cols})
        actual = "\n".join(receipt_lines(printer))
        path = os.path.join(FIXTURES_DIR, name)
        if not os.path.exists(path):
            with open(path, "w") as f:
                f.write(actual)
            self.skipTest(f"created golden file {name}; review it as text, then re-run")
        with open(path) as f:
            expected = f.read()
        self.assertEqual(actual, expected, f"{name} design changed; review the diff, then update the golden file")

    def test_standard_48(self):
        self._golden("standard_48.txt", "80", "standard", 48)

    def test_standard_32(self):
        self._golden("standard_32.txt", "58", "standard", 32)

    def test_compact_64(self):
        self._golden("compact_64.txt", "80", "compact", 64)


if __name__ == "__main__":
    unittest.main()
