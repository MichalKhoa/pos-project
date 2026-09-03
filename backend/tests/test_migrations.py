import unittest
import sys
import os
from sqlalchemy import create_engine, Column, Integer, String, Boolean, Float, text

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from migrations import run_schema_migrations, _get_column_sql_def


class TestMigrations(unittest.TestCase):
    def test_get_column_sql_def(self):
        col_int = Column(Integer, default=42)
        self.assertEqual(_get_column_sql_def(col_int), "INTEGER DEFAULT 42")

        col_bool = Column(Boolean, default=True)
        self.assertEqual(_get_column_sql_def(col_bool), "BOOLEAN DEFAULT 1")

        col_float = Column(Float, default=9.99)
        self.assertEqual(_get_column_sql_def(col_float), "FLOAT DEFAULT 9.99")

        col_str = Column(String, default="test")
        self.assertEqual(_get_column_sql_def(col_str), "VARCHAR DEFAULT 'test'")

    def test_run_schema_migrations_dynamic_add_column(self):
        engine = create_engine("sqlite:///:memory:")

        # Create a mock table missing some columns
        with engine.connect() as conn:
            conn.execute(text("CREATE TABLE store_config (id INTEGER PRIMARY KEY, store_name VARCHAR)"))
            conn.commit()

            # Verify initial column count
            res = conn.execute(text("PRAGMA table_info('store_config')")).fetchall()
            initial_cols = [r[1] for r in res]
            self.assertIn("id", initial_cols)
            self.assertIn("store_name", initial_cols)
            self.assertNotIn("cashier_pin", initial_cols)

        # Run migrations against this engine
        res = run_schema_migrations(engine=engine)
        self.assertEqual(res["status"], "SUCCESS")

        # Verify missing columns were dynamically added
        with engine.connect() as conn:
            res = conn.execute(text("PRAGMA table_info('store_config')")).fetchall()
            updated_cols = [r[1] for r in res]
            self.assertIn("cashier_pin", updated_cols)
            self.assertIn("eet_enabled", updated_cols)

        # Second run should be idempotent with no new columns added
        res2 = run_schema_migrations(engine=engine)
        self.assertEqual(res2["status"], "SUCCESS")
        self.assertEqual(len(res2["added_columns"]), 0)


if __name__ == "__main__":
    unittest.main()
