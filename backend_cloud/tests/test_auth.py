import unittest
from fastapi.testclient import TestClient
import os
import sys

# Ensure backend_cloud is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# For test stability
os.environ["POS_ADMIN_USER"] = "testadmin"
os.environ["POS_ADMIN_PASSWORD"] = "testpass"
os.environ["POS_CLOUD_SECRET_KEY"] = "possecret123"
os.environ["POS_TOTP_SECRET"] = "JBSWY3DPEHPK3PXP" # Mock secret

from main import app
import pyotp

client = TestClient(app)

class TestAuth(unittest.TestCase):
    def test_health_check(self):
        response = client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

    def test_login_success_without_totp(self):
        response = client.post(
            "/api/v1/auth/login",
            data={"username": "testadmin", "password": "testpass"}
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("access_token", response.json())
        self.assertEqual(response.json()["token_type"], "bearer")

    def test_login_failure_wrong_password(self):
        response = client.post(
            "/api/v1/auth/login",
            data={"username": "testadmin", "password": "wrongpassword"}
        )
        self.assertEqual(response.status_code, 401)
        
    def test_totp_setup(self):
        response = client.get("/api/v1/auth/totp/setup")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("uri", data)
        self.assertIn("secret", data)
        self.assertEqual(data["secret"], os.environ["POS_TOTP_SECRET"])

if __name__ == "__main__":
    unittest.main()
