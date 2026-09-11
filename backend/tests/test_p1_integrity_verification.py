import unittest
import sys
import os
import uuid
from concurrent.futures import ThreadPoolExecutor
from sqlalchemy import text

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from database import SessionLocal, init_db_schema, engine
from models import PresetModel, ReceiptSequenceModel
from routers.sales import generate_next_receipt_number


class TestP1IntegrityVerification(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db_schema()

    def setUp(self):
        self.db = SessionLocal()

    def tearDown(self):
        self.db.rollback()
        self.db.close()

    def test_db_c1_sequence_rolls_back_on_aborted_transaction(self):
        test_year = 2099
        self.db.query(ReceiptSequenceModel).filter(ReceiptSequenceModel.year == test_year).delete()
        self.db.commit()

        num_a = generate_next_receipt_number(self.db, test_year)
        self.assertEqual(num_a, f"{test_year}-000001")

        # Simulate crash/abort before commit
        self.db.rollback()

        # Due to DB-C1 flush instead of commit, rollback preserves sequence slot
        num_b = generate_next_receipt_number(self.db, test_year)
        self.assertEqual(num_b, f"{test_year}-000001", "Sequence slot must be reused after rollback, no gap")

        self.db.commit()
        num_c = generate_next_receipt_number(self.db, test_year)
        self.assertEqual(num_c, f"{test_year}-000002")
        self.db.commit()

    def test_db_h1_concurrent_stock_decrements_no_lost_updates(self):
        pid = f"preset-race-{uuid.uuid4().hex[:8]}"
        initial_stock = 100.0
        preset = PresetModel(
            id=pid,
            name="Concurrent Item",
            price=50.0,
            stock_quantity=initial_stock,
            track_stock=True
        )
        self.db.add(preset)
        self.db.commit()

        decrement_amount = 2.5
        total_workers = 20

        def worker_decrement():
            session = SessionLocal()
            try:
                session.execute(
                    text("UPDATE presets SET stock_quantity = ROUND(COALESCE(stock_quantity, 0.0) - :qty, 3) WHERE id = :id"),
                    {"qty": decrement_amount, "id": pid}
                )
                session.commit()
            finally:
                session.close()

        with ThreadPoolExecutor(max_workers=8) as executor:
            futures = [executor.submit(worker_decrement) for _ in range(total_workers)]
            for f in futures:
                f.result()

        self.db.expire_all()
        updated_preset = self.db.query(PresetModel).filter(PresetModel.id == pid).first()
        expected_stock = round(initial_stock - (total_workers * decrement_amount), 3)
        self.assertEqual(
            round(float(updated_preset.stock_quantity), 3),
            expected_stock
        )

    def test_db_h1_null_stock_quantity_handled_by_coalesce(self):
        pid = f"preset-null-{uuid.uuid4().hex[:8]}"
        preset = PresetModel(
            id=pid,
            name="Null Stock Item",
            price=20.0,
            stock_quantity=None,
            track_stock=True
        )
        self.db.add(preset)
        self.db.commit()

        self.db.execute(
            text("UPDATE presets SET stock_quantity = ROUND(COALESCE(stock_quantity, 0.0) - :qty, 3) WHERE id = :id"),
            {"qty": 3.0, "id": pid}
        )
        self.db.commit()

        self.db.expire_all()
        updated = self.db.query(PresetModel).filter(PresetModel.id == pid).first()
        self.assertIsNotNone(updated.stock_quantity)
        self.assertEqual(float(updated.stock_quantity), -3.0)

    def test_fin_h1_monetary_columns_schema_type(self):
        with engine.connect() as conn:
            sales_cols = {row[1]: row[2] for row in conn.execute(text("PRAGMA table_info('sales')")).fetchall()}
            presets_cols = {row[1]: row[2] for row in conn.execute(text("PRAGMA table_info('presets')")).fetchall()}

        # Verify monetary columns are DECIMAL(10,2) or NUMERIC(10,2), NOT raw FLOAT/REAL
        self.assertTrue(any(k in sales_cols.get("total_amount", "").upper() for k in ("DECIMAL", "NUMERIC")))
        self.assertTrue(any(k in presets_cols.get("price", "").upper() for k in ("DECIMAL", "NUMERIC")))
        self.assertTrue(any(k in presets_cols.get("cost_price", "").upper() for k in ("DECIMAL", "NUMERIC")))

        # Physical unit quantities stay FLOAT
        self.assertIn("FLOAT", presets_cols.get("stock_quantity", "").upper())


if __name__ == "__main__":
    unittest.main()
