"""
Contract test: the sale payloads the register sends (golden fixtures in tests/fixtures/sales)
must be accepted by POST /api/v1/sales/ and stored with the expected values.
The same fixtures are checked on the frontend in src/__tests__/sale_payload.test.js.

Fixtures may list known bugs under "knownBugs":
  backend             -> POST is currently rejected or stores wrong totals (see audit finding)
  backendTaxSummary   -> stored tax_summary differs from the exact half-up reference
The test then EXPECTS the check to fail. When a fix makes it pass, the test fails with
"bug fixed", which tells you to delete the knownBugs entry from the fixture.
"""
import glob
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient

from database import SessionLocal, init_db_schema
from main import app
from models import SaleModel, SaleItemModel

FIXTURE_DIR = os.path.join(os.path.dirname(__file__), "fixtures", "sales")


def _load_fixtures():
    out = []
    for path in sorted(glob.glob(os.path.join(FIXTURE_DIR, "*.json"))):
        with open(path, encoding="utf-8") as f:
            out.append(json.load(f))
    return out


def _purge(db, sale_id):
    db.query(SaleItemModel).filter(SaleItemModel.sale_id == sale_id).delete()
    db.query(SaleModel).filter(SaleModel.id == sale_id).delete()
    db.commit()


class TestSaleContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db_schema()
        cls.client = TestClient(app)

    def _post(self, fx):
        res = self.client.post("/api/v1/sales/", json=fx["payload"])
        self.assertEqual(res.status_code, 201, f"{fx['name']}: POST rejected: {res.text[:200]}")
        self.assertEqual(res.json().get("status"), "SUCCESS")

    def _check_stored_values(self, fx, db):
        sale = db.query(SaleModel).filter(SaleModel.id == fx["payload"]["id"]).first()
        self.assertIsNotNone(sale, f"{fx['name']}: sale not stored")
        self.assertAlmostEqual(float(sale.total_amount), fx["expectedServer"]["total_amount"], places=2)
        rows = db.query(SaleItemModel).filter(SaleItemModel.sale_id == sale.id).all()
        stored = {r.item_id: float(r.quantity) for r in rows}
        for exp in fx["expectedServer"]["items"]:
            self.assertAlmostEqual(stored.get(exp["item_id"]), exp["quantity"], places=3)

    def _check_tax_summary(self, fx, db):
        sale = db.query(SaleModel).filter(SaleModel.id == fx["payload"]["id"]).first()
        self.assertEqual(sale.tax_summary, fx["payload"]["taxSummary"],
                         f"{fx['name']}: stored tax_summary differs from reference")

    def _expect(self, known, check, *args):
        """Run check; if `known` is set the check must fail, otherwise it must pass."""
        if known:
            with self.assertRaises(AssertionError, msg=f"bug fixed ({known}): remove it from the fixture"):
                check(*args)
        else:
            check(*args)

    def test_fixtures_are_accepted_and_stored(self):
        fixtures = _load_fixtures()
        self.assertGreaterEqual(len(fixtures), 8)
        for fx in fixtures:
            with self.subTest(fixture=fx["name"]):
                db = SessionLocal()
                try:
                    _purge(db, fx["payload"]["id"])
                    known = fx.get("knownBugs", {})
                    self._expect(known.get("backend"), self._post, fx)
                    if not known.get("backend"):
                        db.expire_all()
                        self._check_stored_values(fx, db)
                        self._expect(known.get("backendTaxSummary"), self._check_tax_summary, fx, db)
                finally:
                    _purge(db, fx["payload"]["id"])
                    db.close()


if __name__ == "__main__":
    unittest.main()
