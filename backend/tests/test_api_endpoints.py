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

if __name__ == "__main__":
    unittest.main()
