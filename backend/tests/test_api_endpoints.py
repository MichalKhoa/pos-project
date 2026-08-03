import os
import sys
import unittest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Ensure backend root directory is in sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from main import app
from database import Base, get_db

# Create an in-memory SQLite database using StaticPool for multi-thread test isolation
TEST_DATABASE_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


class TestAPIEndpoints(unittest.TestCase):
    """Integration & Endpoint unit tests for FastAPI Backend."""

    def setUp(self):
        Base.metadata.create_all(bind=test_engine)
        self.client = TestClient(app)

    def tearDown(self):
        Base.metadata.drop_all(bind=test_engine)

    def test_root_endpoint(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "ONLINE")
        self.assertIn("Himmel POS", data["app"])

    def test_store_config_get_and_post(self):
        # GET default config
        res = self.client.get("/api/v1/config")
        self.assertEqual(res.status_code, 200)
        cfg = res.json()
        self.assertEqual(cfg["defaultLanguage"], "cs")
        self.assertEqual(cfg["storeName"], "Himmel Home s.r.o.")

        # POST update config
        update_data = {
            "storeName": "New Test Store s.r.o.",
            "defaultLanguage": "vi",
            "defaultVat": 12,
            "cashierPin": "5678"
        }
        res_post = self.client.post("/api/v1/config", json=update_data)
        self.assertEqual(res_post.status_code, 200)
        self.assertEqual(res_post.json()["status"], "SUCCESS")

        # Verify updated GET values
        res_updated = self.client.get("/api/v1/config")
        updated_cfg = res_updated.json()
        self.assertEqual(updated_cfg["storeName"], "New Test Store s.r.o.")
        self.assertEqual(updated_cfg["defaultLanguage"], "vi")
        self.assertEqual(updated_cfg["defaultVat"], 12)

    def test_pin_verification_and_puk_recovery(self):
        # Set PIN to 4321
        self.client.post("/api/v1/config", json={"cashierPin": "4321"})

        # Verify incorrect PIN
        res_fail = self.client.post("/api/v1/config/verify-pin", json={"pin": "0000"})
        self.assertEqual(res_fail.status_code, 401)

        # Verify correct PIN
        res_ok = self.client.post("/api/v1/config/verify-pin", json={"pin": "4321"})
        self.assertEqual(res_ok.status_code, 200)
        self.assertTrue(res_ok.json()["valid"])

        # Recover PIN with PUK
        res_puk = self.client.post("/api/v1/config/verify-puk", json={"puk": "HIMMEL-RECOVERY-99"})
        self.assertEqual(res_puk.status_code, 200)

        # Verify PIN has been reset to default '1234'
        res_reset_pin = self.client.post("/api/v1/config/verify-pin", json={"pin": "1234"})
        self.assertEqual(res_reset_pin.status_code, 200)

    def test_catalog_categories_and_presets(self):
        # Create category
        cat_payload = {"id": "cat-test-1", "name": "Nápoje", "position": 0}
        res_cat = self.client.post("/api/v1/catalog/categories", json=cat_payload)
        self.assertEqual(res_cat.status_code, 201)

        # List categories
        res_cats = self.client.get("/api/v1/catalog/categories")
        self.assertEqual(res_cats.status_code, 200)
        cats = res_cats.json()
        self.assertTrue(any(c["id"] == "cat-test-1" for c in cats))

        # Create preset
        preset_payload = {
            "id": "preset-test-1",
            "name": "Káva Espresso",
            "price": 65.0,
            "category": "cat-test-1",
            "vat": 21,
            "color": "#3b82f6"
        }
        res_preset = self.client.post("/api/v1/catalog/presets", json=preset_payload)
        self.assertEqual(res_preset.status_code, 201)

        # List presets
        res_presets = self.client.get("/api/v1/catalog/presets")
        self.assertEqual(res_presets.status_code, 200)
        presets = res_presets.json()
        self.assertTrue(any(p["id"] == "preset-test-1" for p in presets))

        # Delete preset
        res_del_preset = self.client.delete("/api/v1/catalog/presets/preset-test-1")
        self.assertEqual(res_del_preset.status_code, 200)

        # Delete category
        res_del_cat = self.client.delete("/api/v1/catalog/categories/cat-test-1")
        self.assertEqual(res_del_cat.status_code, 200)

    def test_sales_creation_and_refund(self):
        sale_payload = {
            "id": "sale-1001",
            "items": [
                {"name": "Položka 1", "price": 100.0, "quantity": 2, "vat": 21}
            ],
            "totalAmount": 200.0,
            "paymentMethod": "cash",
            "tenderedAmount": 200.0,
            "changeDue": 0.0,
            "taxSummary": {
                "21": {"base": 165.29, "vat": 34.71, "total": 200.0}
            }
        }

        # Create sale transaction
        res_sale = self.client.post("/api/v1/sales/", json=sale_payload)
        self.assertIn(res_sale.status_code, (200, 201))
        sale_data = res_sale.json()
        self.assertIn("receipt_number", sale_data)
        sale_id = sale_data["sale_id"]

        # Fetch sales history
        res_hist = self.client.get("/api/v1/sales")
        self.assertEqual(res_hist.status_code, 200)
        sales = res_hist.json()
        self.assertEqual(len(sales), 1)

        # Process refund
        refund_payload = {
            "refund_status": "FULL",
            "refunded_amount": 200.0
        }
        res_refund = self.client.put(f"/api/v1/sales/{sale_id}/refund-status", json=refund_payload)
        self.assertEqual(res_refund.status_code, 200)
        refund_res = res_refund.json()
        self.assertEqual(refund_res["status"], "UPDATED")

    def test_eet_status_and_queue(self):
        res_status = self.client.get("/api/v1/eet/status")
        self.assertEqual(res_status.status_code, 200)
        data = res_status.json()
        self.assertIn("environment", data)

        res_queue = self.client.post("/api/v1/eet/process-queue")
        self.assertEqual(res_queue.status_code, 200)

    def test_payment_terminal_and_qr_endpoints(self):
        # QR string generation
        res_qr = self.client.post("/api/v1/payments/generate-qr-string", json={"amount": 150.0, "variableSymbol": "20260001"})
        self.assertEqual(res_qr.status_code, 200)
        self.assertIn("spd_string", res_qr.json())

        # Terminal config GET
        res_cfg = self.client.get("/api/v1/payments/terminal/config")
        self.assertEqual(res_cfg.status_code, 200)
        self.assertIn("enabled", res_cfg.json())

        # Terminal pay POST
        res_pay = self.client.post("/api/v1/payments/terminal/pay", json={"amount": 150.0, "variableSymbol": "20260001"})
        self.assertEqual(res_pay.status_code, 200)

        # Terminal reconcile POST
        res_rec = self.client.post("/api/v1/payments/terminal/reconcile")
        self.assertEqual(res_rec.status_code, 200)

    def test_eet_disabled_mode(self):
        # 1. Check default eetEnabled in config (should be False)
        res_cfg = self.client.get("/api/v1/config")
        self.assertEqual(res_cfg.status_code, 200)
        self.assertFalse(res_cfg.json().get("eetEnabled"))

        # 2. Disable EET explicitly
        res_save = self.client.post("/api/v1/config", json={"eetEnabled": False})
        self.assertEqual(res_save.status_code, 200)

        # 3. Create sale with EET disabled
        sale_payload = {
            "id": "sale-no-eet-1",
            "receiptNumber": "2026-000099",
            "timestamp": "2026-08-01T23:40:00Z",
            "totalAmount": 100.0,
            "paymentMethod": "cash",
            "taxSummary": {},
            "items": [{"name": "Položka 1", "price": 100.0, "quantity": 1, "vat": 21}]
        }
        res_sale = self.client.post("/api/v1/sales/", json=sale_payload)
        self.assertEqual(res_sale.status_code, 201)
        data_sale = res_sale.json()
        self.assertEqual(data_sale.get("eet_status"), "DISABLED")
        self.assertIsNone(data_sale.get("fik"))

        # 4. Check EET status endpoint reflects eet_enabled=False and pending_offline_sales=0
        res_eet_stat = self.client.get("/api/v1/eet/status")
        self.assertEqual(res_eet_stat.status_code, 200)
        self.assertFalse(res_eet_stat.json().get("eet_enabled"))
        self.assertEqual(res_eet_stat.json().get("pending_offline_sales"), 0)

        # 5. Check process queue returns EET_DISABLED
        res_proc = self.client.post("/api/v1/eet/process-queue")
        self.assertEqual(res_proc.status_code, 200)
        self.assertEqual(res_proc.json().get("status"), "EET_DISABLED")


if __name__ == "__main__":
    unittest.main(verbosity=2)
