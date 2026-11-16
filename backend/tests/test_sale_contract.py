"""
Contract test: the sale payloads the register sends (golden fixtures in tests/fixtures/sales)
must be accepted by POST /api/v1/sales/ and stored with the expected values.
The same fixtures are checked on the frontend in src/__tests__/sale_payload.test.js.

The test runs against a throw-away SQLite file, never the store database, so it
cannot burn receipt numbers or trigger EET submission.

Fixtures may list known bugs under "knownBugs":
  backend             -> POST must be rejected with 422 TOTAL_MISMATCH (audit F-001)
  backendTaxSummary   -> stored tax_summary must differ from the exact half-up reference (F-028)
The test then EXPECTS exactly that symptom. When a fix removes it, the test fails with
"bug fixed", which tells you to delete the knownBugs entry from the fixture.
Any other failure (500, other 4xx, missing sale) still fails the test.
"""
import glob
import json
import os
import shutil
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from sqlalchemy import create_engine

from database import SessionLocal, Base
from main import app
from models import SaleModel, SaleItemModel

FIXTURE_DIR = os.path.join(os.path.dirname(__file__), "fixtures", "sales")


def _load_fixtures():
    out = []
    for path in sorted(glob.glob(os.path.join(FIXTURE_DIR, "*.json"))):
        with open(path, encoding="utf-8") as f:
            out.append(json.load(f))
    return out


class TestSaleContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Rebind the shared session factory to a temp DB; routers read SessionLocal per request.
        cls._tmp = tempfile.mkdtemp(prefix="sale_contract_")
        cls._orig_engine = SessionLocal.kw["bind"]
        cls._engine = create_engine(
            f"sqlite:///{os.path.join(cls._tmp, 'test.db')}",
            connect_args={"check_same_thread": False},
        )
        import models  # noqa: F401  (register tables)
        Base.metadata.create_all(bind=cls._engine)
        SessionLocal.configure(bind=cls._engine)
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        SessionLocal.configure(bind=cls._orig_engine)
        cls._engine.dispose()
        shutil.rmtree(cls._tmp, ignore_errors=True)

    def _check_stored_values(self, fx, db):
        sale = db.query(SaleModel).filter(SaleModel.id == fx["payload"]["id"]).first()
        self.assertIsNotNone(sale, f"{fx['name']}: sale not stored")
        self.assertAlmostEqual(float(sale.total_amount), fx["expectedServer"]["total_amount"], places=2)
        rows = db.query(SaleItemModel).filter(SaleItemModel.sale_id == sale.id).all()
        stored = {r.item_id: float(r.quantity) for r in rows}
        for exp in fx["expectedServer"]["items"]:
            self.assertAlmostEqual(stored.get(exp["item_id"]), exp["quantity"], places=3)
        return sale

    def test_fixtures_are_accepted_and_stored(self):
        fixtures = _load_fixtures()
        self.assertGreaterEqual(len(fixtures), 8)
        for fx in fixtures:
            with self.subTest(fixture=fx["name"]):
                known = fx.get("knownBugs", {})
                res = self.client.post("/api/v1/sales/", json=fx["payload"])
                if known.get("backend"):
                    self.assertEqual(res.status_code, 422,
                                     f"bug fixed or changed ({known['backend']}): got {res.status_code}; remove knownBugs.backend")
                    self.assertIn("TOTAL_MISMATCH", res.text)
                    continue
                self.assertEqual(res.status_code, 201, f"{fx['name']}: POST rejected: {res.text[:200]}")
                self.assertEqual(res.json().get("status"), "SUCCESS")
                db = SessionLocal()
                try:
                    sale = self._check_stored_values(fx, db)
                    if known.get("backendTaxSummary"):
                        self.assertNotEqual(sale.tax_summary, fx["payload"]["taxSummary"],
                                            f"bug fixed ({known['backendTaxSummary']}): remove knownBugs.backendTaxSummary")
                    else:
                        self.assertEqual(sale.tax_summary, fx["payload"]["taxSummary"],
                                         f"{fx['name']}: stored tax_summary differs from reference")
                finally:
                    db.close()


if __name__ == "__main__":
    unittest.main()
