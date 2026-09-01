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

if __name__ == "__main__":
    unittest.main()
