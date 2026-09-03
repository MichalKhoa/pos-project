import unittest
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from main import app

class TestApiEndpoints(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_root_endpoint(self):
        res = self.client.get("/")
        self.assertEqual(res.status_code, 200)

    def test_status_endpoint(self):
        res = self.client.get("/api/v1/status")
        self.assertEqual(res.status_code, 200)
        json_data = res.json()
        self.assertEqual(json_data["status"], "ONLINE")

    def test_system_health_endpoint(self):
        res = self.client.get("/api/v1/config/system/health")
        self.assertEqual(res.status_code, 200)
        json_data = res.json()
        self.assertIn(json_data["status"], ["HEALTHY", "DEGRADED"])
        self.assertIn("database", json_data)
        self.assertEqual(json_data["database"]["integrity"], "ok")

    def test_config_endpoint(self):
        res = self.client.get("/api/v1/config")
        self.assertEqual(res.status_code, 200)
        json_data = res.json()
        self.assertIn("storeName", json_data)

    def test_categories_reorder(self):
        # Fetch existing categories
        res = self.client.get("/api/v1/catalog/categories")
        self.assertEqual(res.status_code, 200)
        cats = res.json()
        self.assertTrue(len(cats) > 0)
        
        # Reverse order and call reorder endpoint
        reversed_cats = list(reversed(cats))
        reorder_res = self.client.put("/api/v1/catalog/categories/reorder", json={"categories": reversed_cats})
        self.assertEqual(reorder_res.status_code, 200)
        self.assertEqual(reorder_res.json()["status"], "SUCCESS")

    def test_print_daily_summary_endpoint(self):
        payload = {
            "summaryData": {
                "date": "03.09.2026",
                "time": "21:00",
                "totalRevenue": 1500.0,
                "cashAmount": 1000.0,
                "cardAmount": 500.0,
                "salesCount": 10
            },
            "storeConfig": {
                "storeName": "Test Shop",
                "street": "Testovaci 1",
                "city": "Praha"
            },
            "openDrawer": False
        }
        res = self.client.post("/api/v1/printer/print-daily-summary", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data.get("success"))
        self.assertIn(data.get("status"), ["PRINTED", "SIMULATED"])

    def test_preset_show_in_presets_and_toggle_pin(self):
        # Create a new preset with showInPresets=False (barcode-only item)
        preset_id = "test-inv-item-01"
        payload = {
            "id": preset_id,
            "name": "Barcode Only Chips",
            "price": 45.0,
            "category": "all",
            "vat": 21,
            "showInPresets": False,
            "costPrice": 25.0,
            "barcode": "8594001234567",
            "trackStock": True,
            "stockQuantity": 100
        }
        create_res = self.client.post("/api/v1/catalog/presets", json=payload)
        self.assertEqual(create_res.status_code, 201)
        created_data = create_res.json()
        self.assertFalse(created_data["showInPresets"])
        self.assertEqual(created_data["costPrice"], 25.0)

        # Barcode endpoint finds it
        bc_res = self.client.get("/api/v1/catalog/barcode/8594001234567")
        self.assertEqual(bc_res.status_code, 200)
        self.assertEqual(bc_res.json()["name"], "Barcode Only Chips")
        self.assertFalse(bc_res.json()["showInPresets"])

        # Toggle pin to register
        pin_res = self.client.patch(f"/api/v1/catalog/presets/{preset_id}/toggle-pin")
        self.assertEqual(pin_res.status_code, 200)
        self.assertTrue(pin_res.json()["showInPresets"])

        # Toggle back to unpinned
        unpin_res = self.client.patch(f"/api/v1/catalog/presets/{preset_id}/toggle-pin")
        self.assertEqual(unpin_res.status_code, 200)
        self.assertFalse(unpin_res.json()["showInPresets"])

        # Cleanup
        del_res = self.client.delete(f"/api/v1/catalog/presets/{preset_id}")
        self.assertEqual(del_res.status_code, 200)

    def test_bulk_save_presets(self):
        items = [
            {
                "id": "bulk-test-item-1",
                "name": "Bulk Item 1",
                "price": 100.0,
                "category": "general",
                "vat": 21,
                "stockQuantity": 50,
                "costPrice": 60.0,
                "trackStock": True,
                "barcode": "999111222333"
            },
            {
                "id": "bulk-test-item-2",
                "name": "Bulk Item 2",
                "price": 200.0,
                "category": "general",
                "vat": 12,
                "stockQuantity": 30,
                "costPrice": 120.0,
                "trackStock": True,
                "barcode": "999111222444"
            }
        ]
        res = self.client.post("/api/v1/catalog/presets/bulk", json=items)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "SUCCESS")
        self.assertEqual(res.json()["savedCount"], 2)

        # Cleanup
        self.client.delete("/api/v1/catalog/presets/bulk-test-item-1")
        self.client.delete("/api/v1/catalog/presets/bulk-test-item-2")

if __name__ == "__main__":
    unittest.main()

