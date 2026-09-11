"""
Backend unit tests for FIN-C1: recalculate_sale_totals().
Mirrors the tax.js calculateCartTotals spec exactly (gross-down, per-item rounding).
"""
import sys, os, unittest
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from routers.sales import recalculate_sale_totals, SaleItemSchema, CreateSaleSchema

def _make_sale(items_data, cart_discount=0.0, total_amount=0.0):
    items = [SaleItemSchema(**d) for d in items_data]
    return CreateSaleSchema(
        id="test-id",
        totalAmount=total_amount,
        cartDiscountPercent=cart_discount,
        paymentMethod="cash",
        taxSummary={},
        items=items,
    )

class TestRecalculateSaleTotals(unittest.TestCase):

    def test_single_item_21pct(self):
        sale = _make_sale([{"name": "A", "price": 121.0, "quantity": 1, "vat": 21}])
        total, ts = recalculate_sale_totals(sale)
        self.assertEqual(total, 121.0)
        self.assertEqual(ts[21]["gross"], 121.0)
        self.assertEqual(ts[21]["net"], 100.0)
        self.assertEqual(ts[21]["tax"], 21.0)

    def test_cart_discount(self):
        sale = _make_sale(
            [{"name": "A", "price": 121.0, "quantity": 1, "vat": 21},
             {"name": "B", "price": 79.0, "quantity": 1, "vat": 21}],
            cart_discount=10.0,
        )
        total, ts = recalculate_sale_totals(sale)
        self.assertEqual(total, 180.0)
        self.assertAlmostEqual(ts[21]["gross"], 180.0, places=2)

    def test_mixed_vat_tiers(self):
        sale = _make_sale([
            {"name": "A", "price": 121.0, "quantity": 1, "vat": 21},
            {"name": "B", "price": 112.0, "quantity": 1, "vat": 12},
            {"name": "C", "price": 50.0,  "quantity": 1, "vat": 0},
        ])
        total, ts = recalculate_sale_totals(sale)
        self.assertEqual(total, 283.0)
        self.assertIn(21, ts); self.assertIn(12, ts); self.assertIn(0, ts)
        self.assertEqual(ts[21]["net"], 100.0)
        self.assertEqual(ts[12]["net"], 100.0)
        self.assertEqual(ts[0]["net"],  50.0)

    def test_refund_negative_qty(self):
        sale = _make_sale([{"name": "A", "price": 121.0, "quantity": -1, "vat": 21}])
        total, ts = recalculate_sale_totals(sale)
        self.assertEqual(total, -121.0)
        self.assertEqual(ts[21]["gross"], -121.0)
        self.assertEqual(ts[21]["net"],   -100.0)
        self.assertEqual(ts[21]["tax"],    -21.0)

    def test_item_discount_percent(self):
        sale = _make_sale([
            {"name": "A", "price": 242.0, "quantity": 1, "vat": 21, "discount_percent": 50.0}
        ])
        total, ts = recalculate_sale_totals(sale)
        self.assertEqual(total, 121.0)
        self.assertEqual(ts[21]["gross"], 121.0)
        self.assertEqual(ts[21]["net"],   100.0)
        self.assertEqual(ts[21]["tax"],    21.0)

if __name__ == "__main__":
    unittest.main()
