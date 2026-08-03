import unittest
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from database import SessionLocal, init_db_schema
from models import SaleModel, SaleItemModel, PresetModel
from routers.sales import generate_next_receipt_number

class TestSales(unittest.TestCase):
    def test_vat_and_cart_discount_calculations(self):
        price_gross = 100.0
        vat_rate = 21
        net_price = round(price_gross / (1 + vat_rate / 100.0), 2)
        tax_amount = round(price_gross - net_price, 2)

        self.assertEqual(net_price, 82.64)
        self.assertEqual(tax_amount, 17.36)
        self.assertEqual(round(net_price + tax_amount, 2), 100.0)

    def test_atomic_receipt_numbering(self):
        db = SessionLocal()
        try:
            init_db_schema()
            r1 = generate_next_receipt_number(db, 2026)
            r2 = generate_next_receipt_number(db, 2026)

            num1 = int(r1.split("-")[1])
            num2 = int(r2.split("-")[1])

            self.assertTrue(r1.startswith("2026-"))
            self.assertTrue(r2.startswith("2026-"))
            self.assertEqual(num2, num1 + 1)
        finally:
            db.close()

if __name__ == "__main__":
    unittest.main()
