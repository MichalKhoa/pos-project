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

    def test_login_json_success(self):
        response = client.post(
            "/api/v1/auth/login",
            json={"username": "testadmin", "password": "testpass"}
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("access_token", response.json())

    def test_login_with_valid_and_invalid_totp(self):
        totp = pyotp.TOTP(os.environ["POS_TOTP_SECRET"])
        valid_code = totp.now()

        # Valid TOTP
        res_ok = client.post(
            "/api/v1/auth/login",
            json={"username": "testadmin", "password": "testpass", "totp_code": valid_code}
        )
        self.assertEqual(res_ok.status_code, 200)

        # Invalid TOTP
        res_bad = client.post(
            "/api/v1/auth/login",
            json={"username": "testadmin", "password": "testpass", "totp_code": "000000"}
        )
        self.assertEqual(res_bad.status_code, 401)
        self.assertIn("Invalid TOTP code", res_bad.json()["detail"])

    def test_totp_verify_endpoint(self):
        totp = pyotp.TOTP(os.environ["POS_TOTP_SECRET"])
        valid_code = totp.now()

        # Valid
        res_ok = client.post("/api/v1/auth/totp/verify", json={"code": valid_code})
        self.assertEqual(res_ok.status_code, 200)
        self.assertEqual(res_ok.json()["status"], "SUCCESS")

        # Invalid
        res_bad = client.post("/api/v1/auth/totp/verify", json={"code": "999999"})
        self.assertEqual(res_bad.status_code, 400)

    def test_pos_mutual_token_auth_on_staging(self):
        os.environ["POS_REQUIRE_MACHINE_AUTH"] = "true"
        try:
            # 1. Without token when secret is required: 403
            res_no_auth = client.get("/api/v1/staging/pending")
            self.assertEqual(res_no_auth.status_code, 403)

            # 2. With wrong token: 403
            res_wrong_auth = client.get(
                "/api/v1/staging/pending",
                headers={"X-Store-Token": "wrong_secret"}
            )
            self.assertEqual(res_wrong_auth.status_code, 403)

            # 3. With valid Bearer token: 200
            res_bearer_ok = client.get(
                "/api/v1/staging/pending",
                headers={"Authorization": f"Bearer {os.environ['POS_CLOUD_SECRET_KEY']}"}
            )
            self.assertEqual(res_bearer_ok.status_code, 200)

            # 4. With valid X-Store-Token header: 200
            res_header_ok = client.get(
                "/api/v1/staging/pending",
                headers={"X-Store-Token": os.environ["POS_CLOUD_SECRET_KEY"]}
            )
            self.assertEqual(res_header_ok.status_code, 200)
        finally:
            os.environ["POS_REQUIRE_MACHINE_AUTH"] = "false"


if __name__ == "__main__":
    unittest.main()
