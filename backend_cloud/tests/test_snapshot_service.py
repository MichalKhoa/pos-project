"""
Tests for Resilient Decimal-Safe SQLite Snapshot Reader (SnapshotService).
Validates missing files, 0-byte files, corrupted files, and populated database calculations.
"""

import os
import sys
import tempfile
import sqlite3
import unittest
from datetime import datetime

# Ensure backend_cloud is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from snapshot_service import (
    SnapshotService,
    to_dec,
    round_dec,
    format_dec,
    is_available,
    check_health,
    get_kpi_summary,
    get_payment_splits,
    get_zreports,
    get_catalog,
    get_top_profit,
    get_volume_drivers,
    get_dead_stock,
    get_margin_alerts,
    get_hourly_heatmap,
    get_dph_summary,
    get_pohoda_records,
)


class TestSnapshotServiceMissingFile(unittest.TestCase):
    """Verifies safe degradation when pos_store.db is missing."""

    def setUp(self):
        self.non_existent_path = os.path.join(tempfile.gettempdir(), "missing_never_exists.db")
        if os.path.exists(self.non_existent_path):
            os.remove(self.non_existent_path)
        self.service = SnapshotService(self.non_existent_path)

    def test_is_available_returns_false(self):
        self.assertFalse(self.service.is_available())

    def test_check_health_reports_error(self):
        health = self.service.check_health()
        self.assertFalse(health["available"])
        self.assertEqual(health["file_size"], 0)
        self.assertIn("does not exist", health["error"])

    def test_safe_defaults_returned_for_all_queries(self):
        kpi = self.service.get_kpi_summary()
        self.assertEqual(kpi["gross_revenue"], "0.00")
        self.assertEqual(kpi["net_revenue"], "0.00")
        self.assertEqual(kpi["receipt_count"], 0)
        self.assertEqual(kpi["cash_drawer_balance"], "0.00")

        splits = self.service.get_payment_splits()
        self.assertEqual(splits["cash"], "0.00")
        self.assertEqual(splits["total"], "0.00")

        self.assertEqual(self.service.get_zreports(), [])
        self.assertEqual(self.service.get_catalog(), {"items": [], "total": 0})
        self.assertEqual(self.service.get_top_profit(), [])
        self.assertEqual(self.service.get_volume_drivers(), [])
        self.assertEqual(self.service.get_dead_stock(), [])
        self.assertEqual(self.service.get_margin_alerts(), [])

        heatmap = self.service.get_hourly_heatmap()
        self.assertIn("monday", heatmap)
        self.assertEqual(len(heatmap["monday"]), 24)
        self.assertEqual(sum(heatmap["monday"]), 0)

        dph = self.service.get_dph_summary()
        self.assertEqual(dph["total_gross"], "0.00")
        self.assertEqual(self.service.get_pohoda_records(), [])


class TestSnapshotServiceZeroByteFile(unittest.TestCase):
    """Verifies that an empty (0-byte) file is detected as unavailable."""

    def setUp(self):
        self.temp_file = tempfile.NamedTemporaryFile(delete=False)
        self.temp_file.close()
        self.service = SnapshotService(self.temp_file.name)

    def tearDown(self):
        if os.path.exists(self.temp_file.name):
            try:
                os.remove(self.temp_file.name)
            except OSError:
                pass

    def test_is_available_returns_false_for_zero_bytes(self):
        self.assertFalse(self.service.is_available())

    def test_check_health_reports_zero_bytes(self):
        health = self.service.check_health()
        self.assertFalse(health["available"])
        self.assertEqual(health["file_size"], 0)
        self.assertIn("0 bytes", health["error"])

    def test_queries_return_safe_defaults(self):
        self.assertEqual(self.service.get_kpi_summary()["gross_revenue"], "0.00")
        self.assertEqual(self.service.get_catalog()["total"], 0)
        self.assertEqual(self.service.get_zreports(), [])


class TestSnapshotServiceCorruptedFile(unittest.TestCase):
    """Verifies that corrupted files trigger PRAGMA quick_check failure and safe degradation."""

    def setUp(self):
        self.temp_file = tempfile.NamedTemporaryFile(delete=False)
        self.temp_file.write(b"NOT A SQLITE FILE - TOTAL CORRUPTION CORRUPTION CORRUPTION" * 20)
        self.temp_file.close()
        self.service = SnapshotService(self.temp_file.name)

    def tearDown(self):
        if os.path.exists(self.temp_file.name):
            try:
                os.remove(self.temp_file.name)
            except OSError:
                pass

    def test_is_available_returns_false(self):
        self.assertFalse(self.service.is_available())

    def test_check_health_reports_corruption(self):
        health = self.service.check_health()
        self.assertFalse(health["available"])
        self.assertIsNotNone(health["error"])
        self.assertGreater(health["file_size"], 0)

    def test_queries_return_safe_defaults_without_throwing(self):
        self.assertEqual(self.service.get_kpi_summary()["gross_revenue"], "0.00")
        self.assertEqual(self.service.get_payment_splits()["total"], "0.00")
        self.assertEqual(self.service.get_zreports(), [])
        self.assertEqual(self.service.get_catalog(), {"items": [], "total": 0})
        self.assertEqual(self.service.get_top_profit(), [])
        self.assertEqual(self.service.get_volume_drivers(), [])
        self.assertEqual(self.service.get_dead_stock(), [])
        self.assertEqual(self.service.get_margin_alerts(), [])
        self.assertEqual(self.service.get_pohoda_records(), [])


class TestSnapshotServicePopulated(unittest.TestCase):
    """Verifies financial precision and business logic against a fully populated SQLite snapshot."""

    @classmethod
    def setUpClass(cls):
        cls.temp_file = tempfile.NamedTemporaryFile(delete=False)
        cls.temp_file.close()
        cls.db_path = cls.temp_file.name

        conn = sqlite3.connect(cls.db_path)
        cursor = conn.cursor()

        # Create schema according to backend/models.py
        cursor.execute(
            """
            CREATE TABLE store_config (
                id INTEGER PRIMARY KEY,
                store_name TEXT,
                street TEXT,
                city TEXT,
                ico TEXT,
                dic TEXT,
                cloud_backup_last_sync TEXT
            );
            """
        )
        cursor.execute(
            """
            CREATE TABLE presets (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                price NUMERIC(10, 2) NOT NULL,
                cost_price NUMERIC(10, 2) NOT NULL,
                vat INTEGER DEFAULT 21,
                category TEXT DEFAULT 'custom',
                stock_quantity REAL DEFAULT 0.0,
                track_stock BOOLEAN DEFAULT 0,
                barcode TEXT,
                unit TEXT DEFAULT 'ks',
                margin_coefficient REAL
            );
            """
        )
        cursor.execute(
            """
            CREATE TABLE sales (
                id TEXT PRIMARY KEY,
                receipt_number TEXT NOT NULL,
                timestamp DATETIME NOT NULL,
                total_amount NUMERIC(10, 2) NOT NULL,
                payment_method TEXT NOT NULL,
                split_details TEXT,
                tax_summary TEXT NOT NULL,
                is_refund BOOLEAN DEFAULT 0,
                refunded_amount NUMERIC(10, 2) DEFAULT 0.0,
                is_invoice BOOLEAN DEFAULT 0,
                invoice_number TEXT,
                customer_ico TEXT,
                customer_dic TEXT,
                customer_name TEXT,
                customer_address TEXT
            );
            """
        )
        cursor.execute(
            """
            CREATE TABLE sale_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sale_id TEXT NOT NULL,
                item_id TEXT,
                name TEXT NOT NULL,
                price NUMERIC(10, 2) NOT NULL,
                quantity REAL NOT NULL,
                vat INTEGER NOT NULL
            );
            """
        )
        cursor.execute(
            """
            CREATE TABLE shift_sessions (
                id TEXT PRIMARY KEY,
                shift_number INTEGER,
                opened_at DATETIME NOT NULL,
                closed_at DATETIME,
                opening_cash NUMERIC(10, 2) NOT NULL,
                expected_cash NUMERIC(10, 2) NOT NULL,
                actual_cash NUMERIC(10, 2),
                discrepancy NUMERIC(10, 2),
                is_closed BOOLEAN NOT NULL,
                z_seq INTEGER NOT NULL
            );
            """
        )
        cursor.execute(
            """
            CREATE TABLE cash_movements (
                id TEXT PRIMARY KEY,
                shift_id TEXT,
                movement_type TEXT NOT NULL,
                amount NUMERIC(10, 2) NOT NULL,
                reason TEXT,
                created_at DATETIME NOT NULL
            );
            """
        )

        # Seed store_config
        cursor.execute(
            """
            INSERT INTO store_config (id, store_name, ico, dic, cloud_backup_last_sync)
            VALUES (1, 'VoltFlow Store Praha', '12345678', 'CZ12345678', '2026-09-12T12:00:00Z');
            """
        )

        # Seed presets
        cursor.executemany(
            """
            INSERT INTO presets (id, name, price, cost_price, vat, category, stock_quantity, track_stock, barcode, unit, margin_coefficient)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """,
            [
                ("P1", "Espresso", 50.00, 15.00, 21, "coffee", 100.0, 1, "111", "ks", 1.3),
                ("P2", "Croissant", 45.00, 20.00, 12, "bakery", 50.0, 1, "222", "ks", 1.3),
                ("P3", "Book", 200.00, 120.00, 0, "books", 10.0, 1, "333", "ks", 1.2),
                ("P4", "Dead Widget", 100.00, 60.00, 21, "merch", 8.0, 1, "444", "ks", 1.5),
                ("P5", "Loss Product", 20.00, 25.00, 21, "merch", 10.0, 1, "555", "ks", 0.8),
                ("P6", "Low Margin Product", 100.00, 78.00, 21, "merch", 10.0, 1, "666", "ks", 1.05),
            ],
        )

        # Seed sales:
        # s1: Tuesday 2026-09-08 10:30:00, cash, 95.00 CZK (1 Espresso @ 50 + 1 Croissant @ 45)
        # s2: Tuesday 2026-09-08 11:15:00, card, 200.00 CZK (1 Book @ 200)
        # s3: Wednesday 2026-09-09 14:00:00, split, 95.00 CZK (cash: 45, card: 50)
        # s4: Wednesday 2026-09-09 15:00:00, refund, -50.00 CZK (1 Espresso @ 50 refund)
        cursor.executemany(
            """
            INSERT INTO sales (id, receipt_number, timestamp, total_amount, payment_method, split_details, tax_summary, is_refund, refunded_amount, is_invoice, invoice_number)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """,
            [
                (
                    "s1",
                    "R001",
                    "2026-09-08 10:30:00",
                    95.00,
                    "cash",
                    None,
                    '{"21": {"net": 41.32, "tax": 8.68}, "12": {"net": 40.18, "tax": 4.82}}',
                    0,
                    0.0,
                    0,
                    None,
                ),
                (
                    "s2",
                    "R002",
                    "2026-09-08 11:15:00",
                    200.00,
                    "card",
                    None,
                    '{"0": {"net": 200.00, "tax": 0.00}}',
                    0,
                    0.0,
                    1,
                    "FA-2026-0001",
                ),
                (
                    "s3",
                    "R003",
                    "2026-09-09 14:00:00",
                    95.00,
                    "split",
                    '{"cash": 45.00, "card": 50.00}',
                    '{"21": {"net": 41.32, "tax": 8.68}, "12": {"net": 40.18, "tax": 4.82}}',
                    0,
                    0.0,
                    0,
                    None,
                ),
                (
                    "s4",
                    "R004-REF",
                    "2026-09-09 15:00:00",
                    -50.00,
                    "cash",
                    None,
                    '{"21": {"net": 41.32, "tax": 8.68}}',
                    1,
                    0.0,
                    0,
                    None,
                ),
            ],
        )

        # Seed sale_items
        cursor.executemany(
            """
            INSERT INTO sale_items (sale_id, item_id, name, price, quantity, vat)
            VALUES (?, ?, ?, ?, ?, ?);
            """,
            [
                ("s1", "P1", "Espresso", 50.00, 1.0, 21),
                ("s1", "P2", "Croissant", 45.00, 1.0, 12),
                ("s2", "P3", "Book", 200.00, 1.0, 0),
                ("s3", "P1", "Espresso", 50.00, 1.0, 21),
                ("s3", "P2", "Croissant", 45.00, 1.0, 12),
                ("s4", "P1", "Espresso", 50.00, 1.0, 21),
            ],
        )

        # Seed shift_sessions: shift 1 closed, shift 2 open
        cursor.executemany(
            """
            INSERT INTO shift_sessions (id, shift_number, opened_at, closed_at, opening_cash, expected_cash, actual_cash, discrepancy, is_closed, z_seq)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """,
            [
                ("shift-1", 1, "2026-09-08 08:00:00", "2026-09-08 20:00:00", 1000.00, 1095.00, 1095.00, 0.00, 1, 1),
                ("shift-2", 2, "2026-09-09 08:00:00", None, 1095.00, 0.00, None, None, 0, 2),
            ],
        )

        # Seed cash_movements for shift 2: FLOAT_IN 500.00, PAYOUT 150.00
        cursor.executemany(
            """
            INSERT INTO cash_movements (id, shift_id, movement_type, amount, reason, created_at)
            VALUES (?, ?, ?, ?, ?, ?);
            """,
            [
                ("m1", "shift-2", "FLOAT_IN", 500.00, "Midday cash float", "2026-09-09 09:00:00"),
                ("m2", "shift-2", "PAYOUT", 150.00, "Bakery ingredient delivery", "2026-09-09 12:00:00"),
            ],
        )

        conn.commit()
        conn.close()

        cls.service = SnapshotService(cls.db_path)

    @classmethod
    def tearDownClass(cls):
        if os.path.exists(cls.db_path):
            try:
                os.remove(cls.db_path)
            except OSError:
                pass

    def test_health_check_available(self):
        health = self.service.check_health()
        self.assertTrue(health["available"])
        self.assertIsNone(health["error"])
        self.assertGreater(health["file_size"], 0)
        self.assertEqual(health["last_sync"], "2026-09-12T12:00:00Z")

    def test_kpi_summary_calculations(self):
        kpi = self.service.get_kpi_summary()
        # Gross revenue = (95 + 200 + 95) - 50 = 340.00
        self.assertEqual(kpi["gross_revenue"], "340.00")
        # Net revenue = (81.50 + 200.00 + 81.50) - 41.32 = 321.68
        self.assertEqual(kpi["net_revenue"], "321.68")
        # COGS = (35 + 120 + 35) - 15 = 175.00
        # Realized gross profit = 321.68 - 175.00 = 146.68
        self.assertEqual(kpi["realized_gross_profit"], "146.68")
        # Margin % = (146.68 / 321.68) * 100 = 45.60%
        self.assertEqual(kpi["margin_percent"], "45.60")
        self.assertEqual(kpi["margins"], "45.60")
        # Receipt count = 3 non-refund sales
        self.assertEqual(kpi["receipt_count"], 3)
        self.assertEqual(kpi["total_receipt_count"], 3)
        # AOV = 340.00 / 3 = 113.33
        self.assertEqual(kpi["aov"], "113.33")
        # Live drawer balance for active shift-2:
        # opening (1095) + cash sales (s3 cash part 45) - cash refunds (s4 50) + float_in (500) - payout (150) = 1440.00
        self.assertEqual(kpi["cash_drawer_balance"], "1440.00")

    def test_payment_splits(self):
        splits = self.service.get_payment_splits()
        # Cash: s1 (95) + s3 (45) - s4 (50) = 90.00
        self.assertEqual(splits["cash"], "90.00")
        # Card: s2 (200) + s3 (50) = 250.00
        self.assertEqual(splits["card"], "250.00")
        self.assertEqual(splits["qr"], "0.00")
        self.assertEqual(splits["split"], "0.00")
        self.assertEqual(splits["total"], "340.00")

    def test_zreports(self):
        reports = self.service.get_zreports(limit=10)
        self.assertEqual(len(reports), 2)
        # Ordered by z_seq DESC: shift-2 first, then shift-1
        self.assertEqual(reports[0]["shift_number"], 2)
        self.assertFalse(reports[0]["is_closed"])
        self.assertEqual(reports[1]["shift_number"], 1)
        self.assertTrue(reports[1]["is_closed"])
        self.assertEqual(reports[1]["actual_cash"], "1095.00")

    def test_catalog_query_and_filters(self):
        # All items
        cat = self.service.get_catalog()
        self.assertEqual(cat["total"], 6)
        self.assertEqual(len(cat["items"]), 6)

        # Search filter
        search_res = self.service.get_catalog(search="Espresso")
        self.assertEqual(search_res["total"], 1)
        self.assertEqual(search_res["items"][0]["name"], "Espresso")

        # Category filter
        cat_res = self.service.get_catalog(category="bakery")
        self.assertEqual(cat_res["total"], 1)
        self.assertEqual(cat_res["items"][0]["name"], "Croissant")

        # Pagination
        paged = self.service.get_catalog(limit=2, offset=0)
        self.assertEqual(len(paged["items"]), 2)

    def test_top_profit_and_volume_drivers(self):
        top_profit = self.service.get_top_profit(limit=3)
        self.assertGreater(len(top_profit), 0)
        # Book: profit 80.00, Espresso: 52.64, Croissant: 40.36
        self.assertEqual(top_profit[0]["product"], "Book")
        self.assertEqual(top_profit[0]["profit"], "80.00")

        volume = self.service.get_volume_drivers(limit=3)
        self.assertGreater(len(volume), 0)
        # Espresso (2.0) and Croissant (2.0) should be top
        top_names = [v["product"] for v in volume[:2]]
        self.assertIn("Espresso", top_names)
        self.assertIn("Croissant", top_names)

    def test_dead_stock_identification(self):
        # P4 "Dead Widget" has 8.0 units in stock and zero sales
        as_of = datetime(2026, 9, 12, 12, 0, 0)
        dead = self.service.get_dead_stock(days=1, as_of=as_of)
        dead_names = [d["product"] for d in dead]
        self.assertIn("Dead Widget", dead_names)
        found = next(d for d in dead if d["product"] == "Dead Widget")
        self.assertEqual(found["idle_capital"], "480.00")

    def test_margin_alerts(self):
        alerts = self.service.get_margin_alerts()
        self.assertEqual(len(alerts), 2)
        # P5 Loss Product (negative margin)
        neg = next(a for a in alerts if a["product"] == "Loss Product")
        self.assertEqual(neg["issue"], "NEGATIVE_MARGIN")
        # P6 Low Margin Product (< 10%)
        low = next(a for a in alerts if a["product"] == "Low Margin Product")
        self.assertEqual(low["issue"], "LOW_MARGIN")

    def test_hourly_heatmap(self):
        heatmap = self.service.get_hourly_heatmap()
        # Tuesday (2026-09-08): hour 10 (s1) and hour 11 (s2)
        self.assertEqual(heatmap["tuesday"][10], 1)
        self.assertEqual(heatmap["tuesday"][11], 1)
        # Wednesday (2026-09-09): hour 14 (s3)
        self.assertEqual(heatmap["wednesday"][14], 1)
        # Other hours zero
        self.assertEqual(heatmap["monday"][10], 0)

    def test_dph_summary_and_tax_invariants(self):
        dph = self.service.get_dph_summary()
        # 21%: base 41.32, tax 8.68
        self.assertEqual(dph["base_21"], "41.32")
        self.assertEqual(dph["tax_21"], "8.68")
        # 12%: base 80.36, tax 9.64
        self.assertEqual(dph["base_12"], "80.36")
        self.assertEqual(dph["tax_12"], "9.64")
        # 0%: base 200.00, tax 0.00
        self.assertEqual(dph["base_0"], "200.00")
        self.assertEqual(dph["tax_0"], "0.00")
        # Totals
        self.assertEqual(dph["total_base"], "321.68")
        self.assertEqual(dph["total_tax"], "18.32")
        self.assertEqual(dph["total_gross"], "340.00")
        # Strict Invariant: Base + Tax == Gross
        self.assertEqual(
            to_dec(dph["total_base"]) + to_dec(dph["total_tax"]),
            to_dec(dph["total_gross"]),
        )

    def test_pohoda_records_export(self):
        records = self.service.get_pohoda_records()
        self.assertEqual(len(records), 4)

        invoice_rec = next(r for r in records if r["id"] == "s2")
        self.assertTrue(invoice_rec["is_invoice"])
        self.assertEqual(invoice_rec["invoice_number"], "FA-2026-0001")
        self.assertEqual(invoice_rec["price_none"], "200.00")
        self.assertEqual(len(invoice_rec["items"]), 1)

        refund_rec = next(r for r in records if r["id"] == "s4")
        self.assertTrue(refund_rec["is_refund"])
        self.assertEqual(refund_rec["total_amount"], "-50.00")


if __name__ == "__main__":
    unittest.main()
