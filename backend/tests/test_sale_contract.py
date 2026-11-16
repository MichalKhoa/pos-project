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
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from database import SessionLocal
from models import SaleModel, SaleItemModel
from tests.temp_db import TempDbTestCase

FIXTURE_DIR = os.path.join(os.path.dirname(__file__), "fixtures", "sales")


def _load_fixtures():
    out = []
    for path in sorted(glob.glob(os.path.join(FIXTURE_DIR, "*.json"))):
        with open(path, encoding="utf-8") as f:
            out.append(json.load(f))
    return out


class TestSaleContract(TempDbTestCase):
    def _check_stored_values(self, fx, db):
        sale = db.query(SaleModel).filter(SaleModel.id == fx["payload"]["id"]).first()
        self.assertIsNotNone(sale, f"{fx['name']}: sale not stored")
        self.assertAlmostEqual(float(sale.total_amount), fx["expectedServer"]["total_amount"], places=2)
        self.assertAlmostEqual(float(sale.cash_rounding or 0), fx["expectedServer"]["cash_rounding"], places=2)
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

    def _sale(self, sid, items, total, tendered, **extra):
        return {"id": sid, "receiptNumber": f"G-{sid}", "timestamp": "2026-11-16T10:00:00.000Z",
                "items": items, "totalAmount": total, "paymentMethod": "card",
                "tenderedAmount": tendered, "changeDue": 0, "taxSummary": {}, **extra}

    def test_rejects_zero_quantity_line(self):
        item = {"id": "z1", "name": "Jablka", "price": 42, "quantity": 0, "vat": 12, "discount_percent": 0}
        res = self.client.post("/api/v1/sales/", json=self._sale("guard-zero-qty", [item], 0, 14.7))
        self.assertEqual(res.status_code, 422)
        self.assertEqual(res.json()["detail"]["code"], "ZERO_QUANTITY")

    def test_rejects_paid_sale_that_computes_to_zero(self):
        item = {"id": "z2", "name": "Nulova cena", "price": 0, "quantity": 1, "vat": 12, "discount_percent": 0}
        res = self.client.post("/api/v1/sales/", json=self._sale("guard-zero-total", [item], 0, 14.7))
        self.assertEqual(res.status_code, 422)
        self.assertEqual(res.json()["detail"]["code"], "ZERO_TOTAL")

    def test_allows_free_sale_with_nothing_tendered(self):
        item = {"id": "z3", "name": "Vzorek", "price": 0, "quantity": 1, "vat": 12, "discount_percent": 0}
        res = self.client.post("/api/v1/sales/", json=self._sale("guard-free", [item], 0, 0))
        self.assertEqual(res.status_code, 201, res.text)

    def test_stores_three_by_one_third_kg(self):
        item = {"id": "z4", "name": "Syr", "price": 100, "quantity": 0.333, "vat": 12, "discount_percent": 0}
        res = self.client.post("/api/v1/sales/", json=self._sale("frac-333", [item], 33.3, 33.3))
        self.assertEqual(res.status_code, 201, res.text)
        db = SessionLocal()
        try:
            row = db.query(SaleItemModel).filter(SaleItemModel.sale_id == "frac-333").one()
            self.assertAlmostEqual(float(row.quantity), 0.333, places=3)
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()
