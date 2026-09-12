import os
import sys
import unittest
from fastapi.testclient import TestClient

# Ensure backend_cloud is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import tempfile
import shutil

TEST_DIR = tempfile.mkdtemp()
os.environ["DATA_DIR"] = TEST_DIR

from main import app
from database import init_staging_db
from tests.test_isdoc_parser import SAMPLE_ISDOC_XML

client = TestClient(app)

class TestStaging(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_staging_db()

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(TEST_DIR, ignore_errors=True)


    def test_upload_isdoc_invoice(self):
        files = {
            "file": ("invoice_2026.isdoc", SAMPLE_ISDOC_XML.encode("utf-8"), "application/xml")
        }
        response = client.post("/api/v1/staging/upload-invoice", files=files)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["source"], "ISDOC")
        self.assertEqual(data["invoice_number"], "2026-MAKRO-0042")
        self.assertEqual(len(data["items"]), 2)
        intake_id = data["intake_id"]

        # Verify listed in /intakes
        list_res = client.get("/api/v1/staging/intakes")
        self.assertEqual(list_res.status_code, 200)
        intakes = list_res.json()
        found = next((i for i in intakes if i["id"] == intake_id), None)
        self.assertIsNotNone(found)
        self.assertEqual(found["status"], "PENDING_REVIEW")

        # Approve intake
        approve_res = client.post(f"/api/v1/staging/intakes/{intake_id}/approve", json={
            "total_inc_vat": 1039.2
        })
        self.assertEqual(approve_res.status_code, 200)

        # Check POS pending endpoint
        pending_res = client.get("/api/v1/staging/pending")
        self.assertEqual(pending_res.status_code, 200)
        pending_data = pending_res.json()
        pending_intakes = pending_data["intakes"]
        pos_intake = next((i for i in pending_intakes if i["id"] == intake_id), None)
        self.assertIsNotNone(pos_intake)

        # POS Acknowledge
        ack_res = client.post("/api/v1/staging/ack", json={"intake_ids": [intake_id]})
        self.assertEqual(ack_res.status_code, 200)

        # Confirm no longer in pending
        pending_res2 = client.get("/api/v1/staging/pending")
        self.assertIsNone(next((i for i in pending_res2.json()["intakes"] if i["id"] == intake_id), None))

    def test_upload_image_fallback(self):
        # Mock image bytes
        mock_jpg = b"\xFF\xD8\xFF\xE0\x00\x10JFIF" + b"0" * 100
        files = {
            "file": ("receipt_photo.jpg", mock_jpg, "image/jpeg")
        }
        response = client.post("/api/v1/staging/upload-invoice", files=files)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "success")
        self.assertIn("OCR", data["source"])

if __name__ == "__main__":
    unittest.main()
