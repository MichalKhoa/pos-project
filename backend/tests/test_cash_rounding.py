"""Cash rounding contract (audit F-001): the till rounds cash to whole koruna.
The server accepts that, stores the exact total in total_amount and the difference in
cash_rounding, and the Z-report counts the drawer cash as exact total + rounding."""
import os
import sys
import unittest
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from database import SessionLocal
from models import SaleModel
from tests.temp_db import TempDbTestCase


def sale(sid, price, client_total, method="cash", rounding=0.0, vat=21):
    return {
        "id": sid, "receiptNumber": f"CR-{sid}", "paymentMethod": method,
        # +1 s: the sale must not be older than the shift opened a moment earlier
        "timestamp": (datetime.now(timezone.utc) + timedelta(seconds=1)).strftime("%Y-%m-%dT%H:%M:%S.000Z"),
        "items": [{"id": f"i-{sid}", "name": "Zbozi", "price": price, "quantity": 1, "vat": vat, "discount_percent": 0}],
        "totalAmount": client_total, "cashRounding": rounding,
        "tenderedAmount": client_total, "changeDue": 0, "taxSummary": {},
    }


class TestCashRounding(TempDbTestCase):
    def _post(self, payload):
        return self.client.post("/api/v1/sales/", json=payload)

    def _stored(self, sid):
        db = SessionLocal()
        try:
            row = db.query(SaleModel).filter(SaleModel.id == sid).one()
            return float(row.total_amount), float(row.cash_rounding)
        finally:
            db.close()

    def test_rounds_up(self):
        self.assertEqual(self._post(sale("up", 11.5, 12, rounding=0.5)).status_code, 201)
        self.assertEqual(self._stored("up"), (11.5, 0.5))

    def test_rounds_down(self):
        self.assertEqual(self._post(sale("down", 11.49, 11, rounding=-0.49)).status_code, 201)
        self.assertEqual(self._stored("down"), (11.49, -0.49))

    def test_exact_total_has_no_rounding(self):
        self.assertEqual(self._post(sale("exact", 12, 12)).status_code, 201)
        self.assertEqual(self._stored("exact"), (12.0, 0.0))

    def test_server_derives_rounding_not_client(self):
        # client claims rounding 0 but sends 12 for 11.50: server stores the real difference
        self.assertEqual(self._post(sale("derive", 11.5, 12, rounding=0)).status_code, 201)
        self.assertEqual(self._stored("derive"), (11.5, 0.5))

    def test_rejects_cash_total_more_than_half_koruna_off(self):
        res = self._post(sale("far", 11.5, 13, rounding=1.5))
        self.assertEqual(res.status_code, 422)
        self.assertEqual(res.json()["detail"]["code"], "TOTAL_MISMATCH")

    def test_rejects_cash_total_that_is_not_whole(self):
        self.assertEqual(self._post(sale("frac", 11.5, 11.7)).status_code, 422)

    def test_cash_refund_goes_back_rounded_like_the_sale(self):
        # 3.50 sale paid as 4; its storno refunds -4: exact -3.50 plus rounding -0.50
        refund = sale("ref", -3.5, -4, rounding=-0.5)
        refund["isRefund"] = True
        refund["items"][0].update({"price": 3.5, "quantity": -1})
        res = self._post(refund)
        self.assertEqual(res.status_code, 201, res.text)
        self.assertEqual(self._stored("ref"), (-3.5, -0.5))

    def test_card_refund_is_not_rounded(self):
        refund = sale("refcard", -3.5, -4, method="card")
        refund["isRefund"] = True
        refund["items"][0].update({"price": 3.5, "quantity": -1})
        res = self._post(refund)
        self.assertEqual(res.status_code, 422)
        self.assertEqual(res.json()["detail"]["code"], "TOTAL_MISMATCH")

    def test_cash_sale_and_its_refund_leave_the_drawer_unchanged(self):
        before = self.client.get("/api/v1/cash/current-shift").json()
        self.assertEqual(self._post(sale("pair-s", 3.5, 4, rounding=0.5)).status_code, 201)
        refund = sale("pair-r", 3.5, -4, rounding=-0.5)
        refund["isRefund"] = True
        refund["items"][0]["quantity"] = -1
        self.assertEqual(self._post(refund).status_code, 201)
        after = self.client.get("/api/v1/cash/current-shift").json()
        self.assertAlmostEqual(after["expected_cash"] - before["expected_cash"], 0.0, places=2)
        self.assertAlmostEqual(after["total_cash_sales"] - before["total_cash_sales"], 4.0, places=2)
        self.assertAlmostEqual(after["total_cash_refunds"] - before["total_cash_refunds"], 4.0, places=2)

    def test_rejects_rounded_total_for_card(self):
        res = self._post(sale("card", 11.5, 12, method="card"))
        self.assertEqual(res.status_code, 422)
        self.assertEqual(res.json()["detail"]["code"], "TOTAL_MISMATCH")

    def test_z_report_cash_includes_rounding(self):
        before = self.client.get("/api/v1/cash/current-shift").json()
        for s in (sale("z1", 11.5, 12, rounding=0.5), sale("z2", 11.49, 11, rounding=-0.49), sale("z3", 12, 12)):
            self.assertEqual(self._post(s).status_code, 201)
        after = self.client.get("/api/v1/cash/current-shift").json()
        self.assertAlmostEqual(after["total_cash_sales"] - before["total_cash_sales"], 35.0, places=2)
        self.assertAlmostEqual(after["cash_rounding_total"] - before["cash_rounding_total"], 0.01, places=2)
        self.assertAlmostEqual(after["expected_cash"] - before["expected_cash"], 35.0, places=2)

    def test_shift_data_carries_the_numbers_the_register_widget_shows(self):
        before = self.client.get("/api/v1/cash/current-shift").json()
        for s in (sale("w1", 11.5, 12, rounding=0.5), sale("w2", 100, 100, method="card"), sale("w3", 20, 20, method="qr")):
            self.assertEqual(self._post(s).status_code, 201)
        after = self.client.get("/api/v1/cash/current-shift").json()
        delta = lambda k: round(after[k] - before[k], 2)
        self.assertEqual(delta("receipts_count"), 3)
        self.assertEqual(delta("total_revenue"), 131.5)   # exact totals, no rounding
        self.assertEqual(delta("card_sales"), 100.0)
        self.assertEqual(delta("qr_sales"), 20.0)
        self.assertEqual(delta("total_cash_sales"), 12.0)  # drawer: 11.50 + 0.50 rounding
        self.assertEqual(after["refunds_count"], before["refunds_count"])


if __name__ == "__main__":
    unittest.main()
