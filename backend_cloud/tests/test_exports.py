"""
Tests for backend_cloud/routers/exports.py.
Validates live Czech VAT return (DPH), DPFO (§ 7b income/expense overview),
Stormware POHODA 2.0 XML dataPack export, and CSV export.
Tested with:
- Missing snapshot DB
- Empty snapshot DB (tables exist, 0 rows)
- Populated snapshot DB (sales, items, VAT tiers, refunds, date filtering)
"""

import os
import sys
import io
import csv
import tempfile
import sqlite3
import unittest
import xml.etree.ElementTree as ET
from decimal import Decimal

# Ensure backend_cloud is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from main import app

try:
    from backend_cloud.snapshot_service import snapshot_service
except ImportError:
    from snapshot_service import snapshot_service

client = TestClient(app)

POHODA_DAT_NS = "{http://www.stormware.cz/schema/version_2/data.xsd}"
POHODA_INV_NS = "{http://www.stormware.cz/schema/version_2/invoice.xsd}"
POHODA_TYP_NS = "{http://www.stormware.cz/schema/version_2/type.xsd}"


class TestExportsMissingSnapshot(unittest.TestCase):
    """Verifies exports endpoints return HTTP 200 with safe fallbacks when snapshot DB is missing."""

    def setUp(self):
        self.orig_db_path = snapshot_service.db_path
        self.non_existent_path = os.path.join(tempfile.gettempdir(), "missing_snapshot_for_exports.db")
        if os.path.exists(self.non_existent_path):
            try:
                os.remove(self.non_existent_path)
            except OSError:
                pass
        snapshot_service.db_path = self.non_existent_path

    def tearDown(self):
        snapshot_service.db_path = self.orig_db_path

    def test_dph_missing_snapshot(self):
        res = client.get("/api/v1/exports/dph")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        expected_keys = ["base_21", "tax_21", "base_12", "tax_12", "base_0", "tax_0", "total_tax"]
        for k in expected_keys:
            self.assertIn(k, data)
            self.assertEqual(data[k], "0.00")

    def test_dpfo_missing_snapshot(self):
        res = client.get("/api/v1/exports/dpfo")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("total_income", data)
        self.assertIn("expenses", data)
        self.assertIn("tax_base", data)
        self.assertEqual(data["total_income"], "0.00")
        self.assertEqual(data["expenses"], "0.00")
        self.assertEqual(data["tax_base"], "0.00")

    def test_pohoda_missing_snapshot(self):
        res = client.get("/api/v1/exports/pohoda")
        self.assertEqual(res.status_code, 200)
        self.assertIn("application/xml", res.headers.get("content-type", ""))
        self.assertIn('attachment; filename="pohoda_export.xml"', res.headers.get("content-disposition", ""))

        root = ET.fromstring(res.text)
        self.assertEqual(root.tag, f"{POHODA_DAT_NS}dataPack")
        self.assertEqual(root.attrib.get("version"), "2.0")
        items = root.findall(f"{POHODA_DAT_NS}dataPackItem")
        self.assertEqual(len(items), 0)

    def test_csv_missing_snapshot(self):
        res = client.get("/api/v1/exports/csv")
        self.assertEqual(res.status_code, 200)
        self.assertIn("text/csv", res.headers.get("content-type", ""))
        self.assertIn('attachment; filename="sales_export.csv"', res.headers.get("content-disposition", ""))

        reader = csv.reader(io.StringIO(res.text))
        rows = list(reader)
        self.assertGreaterEqual(len(rows), 1)
        self.assertEqual(rows[0], ["receipt_number", "timestamp", "payment_method", "total_amount", "tax"])
        self.assertEqual(len(rows[1:]), 0)


class TestExportsEmptyDatabase(unittest.TestCase):
    """Verifies exports endpoints with an existing, initialized database with 0 sales."""

    @classmethod
    def setUpClass(cls):
        cls.tmp_file = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        cls.db_path = cls.tmp_file.name
        cls.tmp_file.close()

        conn = sqlite3.connect(cls.db_path)
        cur = conn.cursor()
        cur.execute("CREATE TABLE sales (id TEXT PRIMARY KEY, receipt_number TEXT, timestamp TEXT, total_amount REAL, payment_method TEXT, split_details TEXT, tax_summary TEXT, is_refund INTEGER DEFAULT 0, refunded_amount REAL DEFAULT 0.0, is_invoice INTEGER DEFAULT 0, invoice_number TEXT, customer_ico TEXT, customer_dic TEXT, customer_name TEXT, customer_address TEXT);")
        cur.execute("CREATE TABLE sale_items (id INTEGER PRIMARY KEY AUTOINCREMENT, sale_id TEXT, item_id TEXT, name TEXT, price REAL, quantity REAL, vat INTEGER DEFAULT 21);")
        cur.execute("CREATE TABLE presets (id TEXT PRIMARY KEY, name TEXT, price REAL, cost_price REAL, vat INTEGER, category TEXT, stock_quantity REAL, track_stock INTEGER, barcode TEXT);")
        conn.commit()
        conn.close()

    @classmethod
    def tearDownClass(cls):
        if os.path.exists(cls.db_path):
            try:
                os.remove(cls.db_path)
            except OSError:
                pass

    def setUp(self):
        self.orig_db_path = snapshot_service.db_path
        snapshot_service.db_path = self.db_path

    def tearDown(self):
        snapshot_service.db_path = self.orig_db_path

    def test_dph_empty_db(self):
        res = client.get("/api/v1/exports/dph")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["base_21"], "0.00")
        self.assertEqual(data["total_tax"], "0.00")

    def test_dpfo_empty_db(self):
        res = client.get("/api/v1/exports/dpfo")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["total_income"], "0.00")
        self.assertEqual(data["expenses"], "0.00")
        self.assertEqual(data["tax_base"], "0.00")

    def test_pohoda_empty_db(self):
        res = client.get("/api/v1/exports/pohoda")
        self.assertEqual(res.status_code, 200)
        root = ET.fromstring(res.text)
        self.assertEqual(root.tag, f"{POHODA_DAT_NS}dataPack")
        self.assertEqual(root.attrib.get("version"), "2.0")
        items = root.findall(f"{POHODA_DAT_NS}dataPackItem")
        self.assertEqual(len(items), 0)

    def test_csv_empty_db(self):
        res = client.get("/api/v1/exports/csv")
        self.assertEqual(res.status_code, 200)
        rows = list(csv.reader(io.StringIO(res.text)))
        self.assertEqual(rows[0], ["receipt_number", "timestamp", "payment_method", "total_amount", "tax"])
        self.assertEqual(len(rows[1:]), 0)


class TestExportsPopulatedSnapshot(unittest.TestCase):
    """
    Comprehensive tests with populated snapshot database:
    - S1: 2x Espresso (21% VAT, cash, 120.00 CZK)
    - S2: 3x Butter Croissant (12% VAT, card, 135.00 CZK)
    - S3: 1x Espresso + 1x Croissant (split payment, 105.00 CZK)
    - S4: 1x Newspaper (0% VAT, cash, 30.00 CZK)
    - S5: 1x Espresso Refund (21% VAT, cash refund, -60.00 CZK)
    """

    @classmethod
    def setUpClass(cls):
        cls.tmp_file = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        cls.db_path = cls.tmp_file.name
        cls.tmp_file.close()

        conn = sqlite3.connect(cls.db_path)
        cur = conn.cursor()

        # Presets table
        cur.execute(
            """
            CREATE TABLE presets (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                price REAL NOT NULL,
                cost_price REAL DEFAULT 0.0,
                vat INTEGER DEFAULT 21,
                category TEXT,
                stock_quantity REAL DEFAULT 0.0,
                track_stock INTEGER DEFAULT 1,
                barcode TEXT,
                unit TEXT DEFAULT 'ks',
                margin_coefficient REAL DEFAULT 1.0
            );
            """
        )
        cur.execute(
            """
            INSERT INTO presets (id, name, price, cost_price, vat, category, stock_quantity, track_stock, barcode)
            VALUES
            ('P1', 'Espresso', 60.00, 15.00, 21, 'coffee', 100.0, 1, '8590001'),
            ('P2', 'Butter Croissant', 45.00, 18.00, 12, 'bakery', 50.0, 1, '8590002'),
            ('P3', 'Daily Newspaper', 30.00, 20.00, 0, 'news', 20.0, 1, '8590003');
            """
        )

        # Sales table
        cur.execute(
            """
            CREATE TABLE sales (
                id TEXT PRIMARY KEY,
                receipt_number TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                total_amount REAL NOT NULL,
                payment_method TEXT,
                split_details TEXT,
                tax_summary TEXT,
                is_refund INTEGER DEFAULT 0,
                refunded_amount REAL DEFAULT 0.0,
                is_invoice INTEGER DEFAULT 0,
                invoice_number TEXT,
                customer_ico TEXT,
                customer_dic TEXT,
                customer_name TEXT,
                customer_address TEXT
            );
            """
        )

        # Sale Items table
        cur.execute(
            """
            CREATE TABLE sale_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sale_id TEXT NOT NULL,
                item_id TEXT,
                name TEXT NOT NULL,
                price REAL NOT NULL,
                quantity REAL NOT NULL,
                vat INTEGER DEFAULT 21
            );
            """
        )

        # S1: Cash - Espresso x 2 = 120.00 (Base 21%: 99.17, Tax 21%: 20.83)
        cur.execute(
            """
            INSERT INTO sales (id, receipt_number, timestamp, total_amount, payment_method, split_details, tax_summary, is_refund, refunded_amount)
            VALUES ('S1', 'REC-001', '2026-09-12 09:30:00', 120.00, 'cash', NULL,
                    '{"21": {"base": 99.17, "tax": 20.83, "net": 99.17}}', 0, 0.0);
            """
        )
        cur.execute("INSERT INTO sale_items (sale_id, item_id, name, price, quantity, vat) VALUES ('S1', 'P1', 'Espresso', 60.00, 2.0, 21);")

        # S2: Card - Butter Croissant x 3 = 135.00 (Base 12%: 120.54, Tax 12%: 14.46)
        cur.execute(
            """
            INSERT INTO sales (id, receipt_number, timestamp, total_amount, payment_method, split_details, tax_summary, is_refund, refunded_amount)
            VALUES ('S2', 'REC-002', '2026-09-12 10:15:00', 135.00, 'card', NULL,
                    '{"12": {"base": 120.54, "tax": 14.46, "net": 120.54}}', 0, 0.0);
            """
        )
        cur.execute("INSERT INTO sale_items (sale_id, item_id, name, price, quantity, vat) VALUES ('S2', 'P2', 'Butter Croissant', 45.00, 3.0, 12);")

        # S3: Split - Espresso x 1 + Croissant x 1 = 105.00 (50 cash, 55 card)
        # Base 21%: 49.59, Tax 21%: 10.41, Base 12%: 40.18, Tax 12%: 4.82
        cur.execute(
            """
            INSERT INTO sales (id, receipt_number, timestamp, total_amount, payment_method, split_details, tax_summary, is_refund, refunded_amount)
            VALUES ('S3', 'REC-003', '2026-09-12 11:00:00', 105.00, 'split',
                    '{"cash": 50.00, "card": 55.00}',
                    '{"21": {"base": 49.59, "tax": 10.41, "net": 49.59}, "12": {"base": 40.18, "tax": 4.82, "net": 40.18}}', 0, 0.0);
            """
        )
        cur.execute("INSERT INTO sale_items (sale_id, item_id, name, price, quantity, vat) VALUES ('S3', 'P1', 'Espresso', 60.00, 1.0, 21);")
        cur.execute("INSERT INTO sale_items (sale_id, item_id, name, price, quantity, vat) VALUES ('S3', 'P2', 'Butter Croissant', 45.00, 1.0, 12);")

        # S4: Cash - Daily Newspaper x 1 = 30.00 (Base 0%: 30.00, Tax 0%: 0.00)
        cur.execute(
            """
            INSERT INTO sales (id, receipt_number, timestamp, total_amount, payment_method, split_details, tax_summary, is_refund, refunded_amount)
            VALUES ('S4', 'REC-004', '2026-09-12 14:00:00', 30.00, 'cash', NULL,
                    '{"0": {"base": 30.00, "tax": 0.00, "net": 30.00}}', 0, 0.0);
            """
        )
        cur.execute("INSERT INTO sale_items (sale_id, item_id, name, price, quantity, vat) VALUES ('S4', 'P3', 'Daily Newspaper', 30.00, 1.0, 0);")

        # S5: Cash Refund - Espresso x 1 = -60.00 (Base 21%: -49.59, Tax 21%: -10.41)
        cur.execute(
            """
            INSERT INTO sales (id, receipt_number, timestamp, total_amount, payment_method, split_details, tax_summary, is_refund, refunded_amount)
            VALUES ('S5', 'REC-005', '2026-09-12 16:00:00', 60.00, 'cash', NULL,
                    '{"21": {"base": 49.59, "tax": 10.41, "net": 49.59}}', 1, 60.00);
            """
        )
        cur.execute("INSERT INTO sale_items (sale_id, item_id, name, price, quantity, vat) VALUES ('S5', 'P1', 'Espresso', 60.00, 1.0, 21);")

        conn.commit()
        conn.close()

    @classmethod
    def tearDownClass(cls):
        if os.path.exists(cls.db_path):
            try:
                os.remove(cls.db_path)
            except OSError:
                pass

    def setUp(self):
        self.orig_db_path = snapshot_service.db_path
        snapshot_service.db_path = self.db_path

    def tearDown(self):
        snapshot_service.db_path = self.orig_db_path

    def test_dph_populated(self):
        res = client.get("/api/v1/exports/dph")
        self.assertEqual(res.status_code, 200)
        data = res.json()

        # Expected DPH:
        # 21%: S1 (99.17 / 20.83) + S3 (49.59 / 10.41) - S5 refund (49.59 / 10.41) = base 99.17, tax 20.83
        # 12%: S2 (120.54 / 14.46) + S3 (40.18 / 4.82) = base 160.72, tax 19.28
        # 0%: S4 base 30.00, tax 0.00
        # Total tax: 20.83 + 19.28 + 0.00 = 40.11
        self.assertEqual(data["base_21"], "99.17")
        self.assertEqual(data["tax_21"], "20.83")
        self.assertEqual(data["base_12"], "160.72")
        self.assertEqual(data["tax_12"], "19.28")
        self.assertEqual(data["base_0"], "30.00")
        self.assertEqual(data["tax_0"], "0.00")
        self.assertEqual(data["total_tax"], "40.11")

        # Domain Invariant: Base + VAT strictly equals Total
        base_sum = Decimal(data["base_21"]) + Decimal(data["base_12"]) + Decimal(data["base_0"])
        tax_sum = Decimal(data["tax_21"]) + Decimal(data["tax_12"]) + Decimal(data["tax_0"])
        self.assertEqual(tax_sum, Decimal(data["total_tax"]))
        self.assertEqual(base_sum, Decimal(data["total_base"]))
        self.assertEqual(base_sum + tax_sum, Decimal(data["total_gross"]))

    def test_dph_date_filter(self):
        # Filter strictly between 10:00 and 12:00 -> Only S2 (10:15) and S3 (11:00)
        res = client.get("/api/v1/exports/dph?start_date=2026-09-12%2010:00:00&end_date=2026-09-12%2012:00:00")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["base_21"], "49.59")
        self.assertEqual(data["tax_21"], "10.41")
        self.assertEqual(data["base_12"], "160.72")
        self.assertEqual(data["tax_12"], "19.28")
        self.assertEqual(data["base_0"], "0.00")
        self.assertEqual(data["tax_0"], "0.00")
        self.assertEqual(data["total_tax"], "29.69")

    def test_dpfo_populated(self):
        res = client.get("/api/v1/exports/dpfo")
        self.assertEqual(res.status_code, 200)
        data = res.json()

        # Gross sales (S1..S4) = 120 + 135 + 105 + 30 = 390.00
        # Refunds (S5) = 60.00
        # Total income = 390.00 - 60.00 = 330.00
        self.assertEqual(data["total_income"], "330.00")

        # COGS purchase expenses for non-refund sales:
        # S1: 2 * 15 = 30.00
        # S2: 3 * 18 = 54.00
        # S3: 15 + 18 = 33.00
        # S4: 1 * 20 = 20.00
        # Total expenses = 30 + 54 + 33 + 20 = 137.00
        self.assertEqual(data["expenses"], "137.00")
        self.assertEqual(data["purchase_cost"], "137.00")

        # Tax base = 330.00 - 137.00 = 193.00
        self.assertEqual(data["tax_base"], "193.00")

    def test_dpfo_date_filter(self):
        # Range 10:00 to 12:00 (S2 and S3):
        # Gross sales = 135 + 105 = 240.00, Refunds = 0.00 -> income = 240.00
        # Expenses: S2 (54.00) + S3 (33.00) = 87.00
        # Tax base: 240.00 - 87.00 = 153.00
        res = client.get("/api/v1/exports/dpfo?start_date=2026-09-12%2010:00:00&end_date=2026-09-12%2012:00:00")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["total_income"], "240.00")
        self.assertEqual(data["expenses"], "87.00")
        self.assertEqual(data["tax_base"], "153.00")

    def test_pohoda_xml_populated(self):
        res = client.get("/api/v1/exports/pohoda")
        self.assertEqual(res.status_code, 200)
        self.assertIn("application/xml", res.headers.get("content-type", ""))
        self.assertIn('attachment; filename="pohoda_export.xml"', res.headers.get("content-disposition", ""))

        # Validate with ElementTree
        root = ET.fromstring(res.text)
        self.assertEqual(root.tag, f"{POHODA_DAT_NS}dataPack")
        self.assertEqual(root.attrib.get("version"), "2.0")
        self.assertEqual(root.attrib.get("application"), "VoltFlow POS")

        items = root.findall(f"{POHODA_DAT_NS}dataPackItem")
        self.assertEqual(len(items), 5)

        # Check first item (S1)
        item1 = items[0]
        self.assertEqual(item1.attrib.get("id"), "S1")
        self.assertEqual(item1.attrib.get("version"), "2.0")

        inv = item1.find(f"{POHODA_INV_NS}invoice")
        self.assertIsNotNone(inv)
        header = inv.find(f"{POHODA_INV_NS}invoiceHeader")
        self.assertIsNotNone(header)

        num = header.find(f"{POHODA_INV_NS}number/{POHODA_TYP_NS}numberRequested")
        self.assertIsNotNone(num)
        self.assertEqual(num.text, "REC-001")

        text_el = header.find(f"{POHODA_INV_NS}text")
        self.assertEqual(text_el.text, "Prodejka REC-001")

        pt_el = header.find(f"{POHODA_INV_NS}paymentType/{POHODA_TYP_NS}paymentType")
        self.assertEqual(pt_el.text, "cash")

        p_total = header.find(f"{POHODA_INV_NS}priceTotal")
        self.assertEqual(p_total.text, "120.00")

        # Check line items in detail
        detail = inv.find(f"{POHODA_INV_NS}invoiceDetail")
        self.assertIsNotNone(detail)
        line_items = detail.findall(f"{POHODA_INV_NS}invoiceItem")
        self.assertEqual(len(line_items), 1)
        self.assertEqual(line_items[0].find(f"{POHODA_INV_NS}text").text, "Espresso")

        # Check refund item (S5)
        item5 = items[4]
        inv5 = item5.find(f"{POHODA_INV_NS}invoice")
        hdr5 = inv5.find(f"{POHODA_INV_NS}invoiceHeader")
        self.assertEqual(hdr5.find(f"{POHODA_INV_NS}text").text, "Storno REC-005")

    def test_pohoda_xml_date_filter(self):
        res = client.get("/api/v1/exports/pohoda?start_date=2026-09-12%2010:00:00&end_date=2026-09-12%2012:00:00")
        self.assertEqual(res.status_code, 200)
        root = ET.fromstring(res.text)
        items = root.findall(f"{POHODA_DAT_NS}dataPackItem")
        self.assertEqual(len(items), 2)
        rec_ids = [it.attrib.get("id") for it in items]
        self.assertEqual(rec_ids, ["S2", "S3"])

    def test_csv_populated(self):
        res = client.get("/api/v1/exports/csv")
        self.assertEqual(res.status_code, 200)
        self.assertIn("text/csv", res.headers.get("content-type", ""))
        self.assertIn('attachment; filename="sales_export.csv"', res.headers.get("content-disposition", ""))

        reader = csv.reader(io.StringIO(res.text))
        rows = list(reader)

        # Header check
        self.assertEqual(rows[0], ["receipt_number", "timestamp", "payment_method", "total_amount", "tax"])

        # 5 data rows
        data_rows = rows[1:]
        self.assertEqual(len(data_rows), 5)

        # Row 1: REC-001, 2026-09-12 09:30:00, cash, 120.00, 20.83
        self.assertEqual(data_rows[0][0], "REC-001")
        self.assertEqual(data_rows[0][1], "2026-09-12 09:30:00")
        self.assertEqual(data_rows[0][2], "cash")
        self.assertEqual(data_rows[0][3], "120.00")
        self.assertEqual(data_rows[0][4], "20.83")

        # Row 2: REC-002, 2026-09-12 10:15:00, card, 135.00, 14.46
        self.assertEqual(data_rows[1][0], "REC-002")
        self.assertEqual(data_rows[1][2], "card")
        self.assertEqual(data_rows[1][3], "135.00")
        self.assertEqual(data_rows[1][4], "14.46")

        # Row 3: REC-003, split, 105.00, tax: 10.41 + 4.82 = 15.23
        self.assertEqual(data_rows[2][0], "REC-003")
        self.assertEqual(data_rows[2][2], "split")
        self.assertEqual(data_rows[2][3], "105.00")
        self.assertEqual(data_rows[2][4], "15.23")

        # Row 4: REC-004, cash, 30.00, 0.00
        self.assertEqual(data_rows[3][0], "REC-004")
        self.assertEqual(data_rows[3][3], "30.00")
        self.assertEqual(data_rows[3][4], "0.00")

    def test_csv_date_filter(self):
        res = client.get("/api/v1/exports/csv?start_date=2026-09-12%2010:00:00&end_date=2026-09-12%2012:00:00")
        self.assertEqual(res.status_code, 200)
        reader = csv.reader(io.StringIO(res.text))
        rows = list(reader)
        data_rows = rows[1:]
        self.assertEqual(len(data_rows), 2)
        self.assertEqual(data_rows[0][0], "REC-002")
        self.assertEqual(data_rows[1][0], "REC-003")


if __name__ == "__main__":
    unittest.main()
