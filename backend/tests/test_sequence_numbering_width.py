"""Receipt/invoice/write-off/inventory sequence numbers all use a 7-digit, non-overflowing width."""
import re
import sys
import os
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from database import SessionLocal, init_db_schema
from routers.sales import generate_next_receipt_number, generate_next_invoice_number
from routers.stock import generate_next_write_off_number, generate_next_audit_number


class SequenceWidthTests(unittest.TestCase):
    def setUp(self):
        init_db_schema()
        self.db = SessionLocal()

    def tearDown(self):
        self.db.rollback()
        self.db.close()

    def test_receipt_number_is_seven_digits(self):
        num = generate_next_receipt_number(self.db, 2098)
        self.assertRegex(num, r"^2098-\d{7}$")

    def test_invoice_number_is_seven_digits(self):
        num = generate_next_invoice_number(self.db, 2098)
        self.assertRegex(num, r"^FA-2098-\d{7}$")

    def test_write_off_number_is_seven_digits(self):
        num = generate_next_write_off_number(self.db, 2098)
        self.assertRegex(num, r"^ODP-2098-\d{7}$")

    def test_inventory_audit_number_is_seven_digits(self):
        num = generate_next_audit_number(self.db, 2098)
        self.assertRegex(num, r"^INV-2098-\d{7}$")


if __name__ == "__main__":
    unittest.main()
