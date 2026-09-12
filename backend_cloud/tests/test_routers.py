"""
Tests for backend_cloud routers wired to SnapshotService.
Verifies all endpoints return HTTP 200 and expected schema both when snapshot DB
is absent/empty and when populated.
"""

import os
import sys
import tempfile
import sqlite3
import unittest
from datetime import datetime, timezone

# Ensure backend_cloud is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from main import app

try:
    from backend_cloud.snapshot_service import snapshot_service
except ImportError:
    from snapshot_service import snapshot_service

client = TestClient(app)


class TestRoutersMissingSnapshot(unittest.TestCase):
    """Verifies that all router endpoints return HTTP 200 and valid schemas when snapshot is missing."""

    def setUp(self):
        self.orig_db_path = snapshot_service.db_path
        self.non_existent_path = os.path.join(tempfile.gettempdir(), "missing_snapshot_for_routers.db")
        if os.path.exists(self.non_existent_path):
            os.remove(self.non_existent_path)
        snapshot_service.db_path = self.non_existent_path

    def tearDown(self):
        snapshot_service.db_path = self.orig_db_path

    def test_dashboard_health(self):
        res = client.get("/api/v1/dashboard/health")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertFalse(data["available"])
        self.assertEqual(data["file_size"], 0)
        self.assertIn("error", data)

    def test_dashboard_kpi(self):
        res = client.get("/api/v1/dashboard/kpi")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        expected_keys = [
            "gross_revenue",
            "net_revenue",
            "realized_gross_profit",
            "margin_percent",
            "margins",
            "receipt_count",
            "total_receipt_count",
            "aov",
            "cash_drawer_balance",
            "last_sync_time",
        ]
        for k in expected_keys:
            self.assertIn(k, data)
        self.assertEqual(data["gross_revenue"], "0.00")
        self.assertEqual(data["net_revenue"], "0.00")
        self.assertEqual(data["receipt_count"], 0)
        self.assertEqual(data["cash_drawer_balance"], "0.00")

    def test_dashboard_payment_splits(self):
        res = client.get("/api/v1/dashboard/payment-splits")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        expected_keys = ["cash", "card", "qr", "split", "total"]
        for k in expected_keys:
            self.assertIn(k, data)
        self.assertEqual(data["total"], "0.00")

    def test_dashboard_zreports(self):
        res = client.get("/api/v1/dashboard/zreports")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIsInstance(data, list)
        self.assertEqual(len(data), 0)

    def test_analytics_top_profit(self):
        res = client.get("/api/v1/analytics/top-profit")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIsInstance(data, list)
        self.assertEqual(len(data), 0)

    def test_analytics_volume_drivers(self):
        res = client.get("/api/v1/analytics/volume-drivers")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIsInstance(data, list)
        self.assertEqual(len(data), 0)

    def test_analytics_dead_stock(self):
        res = client.get("/api/v1/analytics/dead-stock")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIsInstance(data, list)
        self.assertEqual(len(data), 0)

    def test_analytics_heatmap(self):
        res = client.get("/api/v1/analytics/heatmap")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIsInstance(data, dict)
        days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
        for d in days:
            self.assertIn(d, data)
            self.assertEqual(len(data[d]), 24)
            self.assertEqual(data[d], [0] * 24)

    def test_analytics_margin_alerts(self):
        res = client.get("/api/v1/analytics/margin-alerts")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIsInstance(data, list)
        self.assertEqual(len(data), 0)

    def test_catalog_empty(self):
        res = client.get("/api/v1/catalog")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("items", data)
        self.assertIn("total", data)
        self.assertEqual(data["items"], [])
        self.assertEqual(data["total"], 0)


class TestRoutersEmptyZeroByteSnapshot(unittest.TestCase):
    """Verifies that all router endpoints return HTTP 200 when snapshot is a 0-byte file."""

    def setUp(self):
        self.orig_db_path = snapshot_service.db_path
        self.zero_file = tempfile.NamedTemporaryFile(delete=False)
        self.zero_file.close()
        snapshot_service.db_path = self.zero_file.name

    def tearDown(self):
        snapshot_service.db_path = self.orig_db_path
        if os.path.exists(self.zero_file.name):
            try:
                os.remove(self.zero_file.name)
            except OSError:
                pass

    def test_all_endpoints_with_zero_byte_db(self):
        health_res = client.get("/api/v1/dashboard/health")
        self.assertEqual(health_res.status_code, 200)
        self.assertFalse(health_res.json()["available"])

        kpi_res = client.get("/api/v1/dashboard/kpi")
        self.assertEqual(kpi_res.status_code, 200)
        self.assertEqual(kpi_res.json()["gross_revenue"], "0.00")

        splits_res = client.get("/api/v1/dashboard/payment-splits")
        self.assertEqual(splits_res.status_code, 200)

        zreports_res = client.get("/api/v1/dashboard/zreports")
        self.assertEqual(zreports_res.status_code, 200)

        catalog_res = client.get("/api/v1/catalog")
        self.assertEqual(catalog_res.status_code, 200)
        self.assertEqual(catalog_res.json()["total"], 0)

        profit_res = client.get("/api/v1/analytics/top-profit")
        self.assertEqual(profit_res.status_code, 200)

        volume_res = client.get("/api/v1/analytics/volume-drivers")
        self.assertEqual(volume_res.status_code, 200)

        dead_res = client.get("/api/v1/analytics/dead-stock")
        self.assertEqual(dead_res.status_code, 200)

        heat_res = client.get("/api/v1/analytics/heatmap")
        self.assertEqual(heat_res.status_code, 200)

        margin_res = client.get("/api/v1/analytics/margin-alerts")
        self.assertEqual(margin_res.status_code, 200)


class TestRoutersPopulatedSnapshot(unittest.TestCase):
    """Verifies all router endpoints against a populated SQLite snapshot."""

    @classmethod
    def setUpClass(cls):
        cls.temp_file = tempfile.NamedTemporaryFile(delete=False)
        cls.temp_file.close()
        cls.db_path = cls.temp_file.name

        conn = sqlite3.connect(cls.db_path)
        cur = conn.cursor()

        # Schema setup
        cur.execute(
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
        cur.execute(
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
        cur.execute(
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
        cur.execute(
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
        cur.execute(
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
        cur.execute(
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

        # Seed data
        cur.execute(
            """
            INSERT INTO store_config (id, store_name, ico, dic, cloud_backup_last_sync)
            VALUES (1, 'VoltFlow Store Praha', '12345678', 'CZ12345678', '2026-09-12T12:00:00Z');
            """
        )

        # Presets:
        # P1: Espresso (category=coffee)
        # P2: Croissant (category=bakery)
        # P3: Dead Stock Coffee Beans (category=coffee, positive stock, no sales)
        # P4: Loss Leader Product (price 100, cost 95, vat 21 -> net 82.64, margin < 0)
        cur.execute(
            """
            INSERT INTO presets (id, name, price, cost_price, vat, category, stock_quantity, track_stock, barcode)
            VALUES
            ('P1', 'Espresso', 60.00, 15.00, 21, 'coffee', 100.0, 1, '8590001'),
            ('P2', 'Butter Croissant', 45.00, 18.00, 12, 'bakery', 50.0, 1, '8590002'),
            ('P3', 'Vintage Arabica 1kg', 850.00, 500.00, 21, 'coffee', 15.0, 1, '8590003'),
            ('P4', 'Loss Leader Mug', 100.00, 95.00, 21, 'merch', 10.0, 1, '8590004');
            """
        )

        # Shift session
        cur.execute(
            """
            INSERT INTO shift_sessions (id, shift_number, opened_at, closed_at, opening_cash, expected_cash, actual_cash, discrepancy, is_closed, z_seq)
            VALUES
            ('shift-1', 1, '2026-09-12 08:00:00', NULL, 3000.00, 3000.00, NULL, NULL, 0, 101);
            """
        )

        # Sales:
        # S1: Cash - Espresso x 2 = 120.00
        cur.execute(
            """
            INSERT INTO sales (id, receipt_number, timestamp, total_amount, payment_method, split_details, tax_summary)
            VALUES ('S1', 'REC-001', '2026-09-12 09:30:00', 120.00, 'cash', NULL,
                    '{"21": {"base": 99.17, "tax": 20.83, "net": 99.17}}');
            """
        )
        cur.execute(
            """
            INSERT INTO sale_items (sale_id, item_id, name, price, quantity, vat)
            VALUES ('S1', 'P1', 'Espresso', 60.00, 2.0, 21);
            """
        )

        # S2: Card - Butter Croissant x 3 = 135.00
        cur.execute(
            """
            INSERT INTO sales (id, receipt_number, timestamp, total_amount, payment_method, split_details, tax_summary)
            VALUES ('S2', 'REC-002', '2026-09-12 10:15:00', 135.00, 'card', NULL,
                    '{"12": {"base": 120.54, "tax": 14.46, "net": 120.54}}');
            """
        )
        cur.execute(
            """
            INSERT INTO sale_items (sale_id, item_id, name, price, quantity, vat)
            VALUES ('S2', 'P2', 'Butter Croissant', 45.00, 3.0, 12);
            """
        )

        # S3: Split - Espresso x 1 + Croissant x 1 = 105.00 (50 cash, 55 card)
        cur.execute(
            """
            INSERT INTO sales (id, receipt_number, timestamp, total_amount, payment_method, split_details, tax_summary)
            VALUES ('S3', 'REC-003', '2026-09-12 11:00:00', 105.00, 'split',
                    '{"cash": 50.00, "card": 55.00}',
                    '{"21": {"base": 49.59, "tax": 10.41, "net": 49.59}, "12": {"base": 40.18, "tax": 4.82, "net": 40.18}}');
            """
        )
        cur.execute(
            """
            INSERT INTO sale_items (sale_id, item_id, name, price, quantity, vat)
            VALUES
            ('S3', 'P1', 'Espresso', 60.00, 1.0, 21),
            ('S3', 'P2', 'Butter Croissant', 45.00, 1.0, 12);
            """
        )

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

    def test_dashboard_health_available(self):
        res = client.get("/api/v1/dashboard/health")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["available"])
        self.assertGreater(data["file_size"], 0)
        self.assertIsNone(data["error"])
        self.assertEqual(data["last_sync"], "2026-09-12T12:00:00Z")

    def test_dashboard_kpi_populated(self):
        res = client.get("/api/v1/dashboard/kpi")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["receipt_count"], 3)
        self.assertEqual(data["gross_revenue"], "360.00")
        self.assertEqual(data["net_revenue"], "309.48")
        # Drawer balance: 3000 (opening) + 120 (S1 cash) + 50 (S3 cash) = 3170.00
        self.assertEqual(data["cash_drawer_balance"], "3170.00")

    def test_dashboard_payment_splits_populated(self):
        res = client.get("/api/v1/dashboard/payment-splits")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        # S1: cash 120, S2: card 135, S3: cash 50 + card 55 -> cash 170, card 190, total 360
        self.assertEqual(data["cash"], "170.00")
        self.assertEqual(data["card"], "190.00")
        self.assertEqual(data["total"], "360.00")

    def test_dashboard_zreports_populated(self):
        res = client.get("/api/v1/dashboard/zreports?limit=10")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIsInstance(data, list)
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["id"], "shift-1")
        self.assertEqual(data[0]["z_seq"], 101)
        self.assertFalse(data[0]["is_closed"])

    def test_analytics_top_profit_populated(self):
        res = client.get("/api/v1/analytics/top-profit?limit=5")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIsInstance(data, list)
        self.assertGreaterEqual(len(data), 2)
        products = [item["product"] for item in data]
        self.assertIn("Espresso", products)
        self.assertIn("Butter Croissant", products)
        # Check structure
        for it in data:
            self.assertIn("product", it)
            self.assertIn("profit", it)
            self.assertIn("quantity", it)
            self.assertIn("revenue", it)

    def test_analytics_volume_drivers_populated(self):
        res = client.get("/api/v1/analytics/volume-drivers?limit=5")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIsInstance(data, list)
        # Croissant sold: S2(3) + S3(1) = 4, Espresso sold: S1(2) + S3(1) = 3
        self.assertEqual(data[0]["product"], "Butter Croissant")
        self.assertEqual(data[0]["quantity"], 4.0)

    def test_analytics_dead_stock_populated(self):
        res = client.get("/api/v1/analytics/dead-stock?days=30")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIsInstance(data, list)
        dead_products = [d["product"] for d in data]
        self.assertIn("Vintage Arabica 1kg", dead_products)

    def test_analytics_heatmap_populated(self):
        res = client.get("/api/v1/analytics/heatmap")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        # 2026-09-12 was Saturday (weekday 5)
        # Transactions at hours 9, 10, 11
        sat_data = data["saturday"]
        self.assertEqual(sat_data[9], 1)
        self.assertEqual(sat_data[10], 1)
        self.assertEqual(sat_data[11], 1)

    def test_analytics_margin_alerts_populated(self):
        res = client.get("/api/v1/analytics/margin-alerts")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIsInstance(data, list)
        alert_products = [a["product"] for a in data]
        self.assertIn("Loss Leader Mug", alert_products)

    def test_catalog_query_and_filtering(self):
        # All items
        res_all = client.get("/api/v1/catalog")
        self.assertEqual(res_all.status_code, 200)
        data_all = res_all.json()
        self.assertEqual(data_all["total"], 4)
        self.assertEqual(len(data_all["items"]), 4)

        # Category filter
        res_cat = client.get("/api/v1/catalog?category=coffee")
        self.assertEqual(res_cat.status_code, 200)
        data_cat = res_cat.json()
        self.assertEqual(data_cat["total"], 2)
        for it in data_cat["items"]:
            self.assertEqual(it["category"], "coffee")

        # Search filter
        res_search = client.get("/api/v1/catalog?search=Croissant")
        self.assertEqual(res_search.status_code, 200)
        data_search = res_search.json()
        self.assertEqual(data_search["total"], 1)
        self.assertEqual(data_search["items"][0]["name"], "Butter Croissant")

        # Barcode search
        res_bc = client.get("/api/v1/catalog?search=8590001")
        self.assertEqual(res_bc.status_code, 200)
        self.assertEqual(res_bc.json()["items"][0]["name"], "Espresso")

        # Limit and offset pagination
        res_page = client.get("/api/v1/catalog?limit=2&offset=0")
        self.assertEqual(res_page.status_code, 200)
        self.assertEqual(len(res_page.json()["items"]), 2)
        self.assertEqual(res_page.json()["total"], 4)

    def test_staging_products_and_catalog_merger(self):
        # 1. Validation test: empty name returns 400
        res_bad = client.post("/api/v1/staging/products", json={"name": ""})
        self.assertEqual(res_bad.status_code, 400)

        # 2. Stage new product
        new_prod_payload = {
            "name": "Staged Club Mate 0.5l",
            "barcode": "2001112223334",
            "retail_price": 49.50,
            "cost_price": 28.00,
            "vat": 21,
            "category": "Nápoje",
            "stock_quantity": 24,
            "track_stock": True,
            "unit": "ks",
        }
        res_create = client.post("/api/v1/staging/products", json=new_prod_payload)
        self.assertEqual(res_create.status_code, 200)
        prod_id = res_create.json()["id"]
        self.assertTrue(prod_id.startswith("PRD-"))

        # 3. Verify it shows up immediately in catalog as is_staged = True
        res_cat = client.get("/api/v1/catalog?search=Club Mate")
        self.assertEqual(res_cat.status_code, 200)
        items = res_cat.json()["items"]
        self.assertTrue(any(it["name"] == "Staged Club Mate 0.5l" and it.get("is_staged") is True for it in items))

        # 4. Verify in GET /staging/pending
        res_pending = client.get("/api/v1/staging/pending")
        self.assertEqual(res_pending.status_code, 200)
        pending_prods = res_pending.json()["products"]
        self.assertTrue(any(p["id"] == prod_id for p in pending_prods))

        # 5. Acknowledge staged product
        res_ack = client.post("/api/v1/staging/ack", json={"product_ids": [prod_id]})
        self.assertEqual(res_ack.status_code, 200)

        # 6. Verify it is no longer pending
        res_pending2 = client.get("/api/v1/staging/pending")
        self.assertFalse(any(p["id"] == prod_id for p in res_pending2.json()["products"]))


if __name__ == "__main__":
    unittest.main()
