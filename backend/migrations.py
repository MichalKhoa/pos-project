import os
import sys
import logging
from sqlalchemy import text

# Ensure backend directory is in sys.path for direct CLI invocations
_backend_dir = os.path.dirname(os.path.abspath(__file__))
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

logger = logging.getLogger("pos-migrations")

# Comprehensive Auto-migrations for existing/old SQLite database files (fallback list)
MIGRATIONS = [
    # Table: store_config
    ("store_config", "csob_terminal_enabled", "BOOLEAN DEFAULT 0"),
    ("store_config", "csob_terminal_ip", "VARCHAR DEFAULT ''"),
    ("store_config", "csob_terminal_port", "INTEGER DEFAULT 8888"),
    ("store_config", "csob_terminal_id", "VARCHAR DEFAULT ''"),
    ("store_config", "cashier_pin", "VARCHAR DEFAULT '1234'"),
    ("store_config", "admin_pin", "VARCHAR DEFAULT '1234'"),
    ("store_config", "auto_lock_minutes", "INTEGER DEFAULT 15"),
    ("store_config", "direct_hardware_print", "BOOLEAN DEFAULT 1"),
    ("store_config", "id_provozovny", "VARCHAR DEFAULT '11'"),
    ("store_config", "id_pokl", "VARCHAR DEFAULT '1'"),
    ("store_config", "eet_enabled", "BOOLEAN DEFAULT 0"),
    ("store_config", "eet_cert_path", "VARCHAR DEFAULT ''"),
    ("store_config", "eet_cert_password", "VARCHAR DEFAULT ''"),
    ("store_config", "eet_environment", "VARCHAR DEFAULT 'playground'"),
    ("store_config", "eet_mode", "INTEGER DEFAULT 0"),
    ("store_config", "printer_interface", "VARCHAR DEFAULT 'USB'"),
    ("store_config", "printer_address", "VARCHAR DEFAULT '/dev/usb/lp0'"),
    ("store_config", "printer_paper_width", "VARCHAR DEFAULT '80'"),
    # Table: sales
    ("sales", "cart_discount_percent", "FLOAT DEFAULT 0"),
    ("sales", "split_details", "VARCHAR DEFAULT ''"),
    ("sales", "eic_popl", "VARCHAR DEFAULT ''"),
    ("sales", "id_provozovny", "VARCHAR DEFAULT '11'"),
    ("sales", "id_pokl", "VARCHAR DEFAULT '1'"),
    ("sales", "is_sent_to_eet", "BOOLEAN DEFAULT 1"),
    ("sales", "eet_retry_count", "INTEGER DEFAULT 0"),
    ("sales", "is_refund", "BOOLEAN DEFAULT 0"),
    ("sales", "original_receipt_number", "VARCHAR DEFAULT ''"),
    ("sales", "refund_reason", "VARCHAR DEFAULT ''"),
    ("sales", "refund_status", "VARCHAR DEFAULT 'NONE'"),
    ("sales", "refunded_amount", "FLOAT DEFAULT 0"),
    # Table: sale_items
    ("sale_items", "discount_percent", "FLOAT DEFAULT 0"),
    # Table: catalog_presets
    ("catalog_presets", "is_open_price", "BOOLEAN DEFAULT 0"),
    ("catalog_presets", "color", "VARCHAR DEFAULT '#3b82f6'"),
    ("catalog_presets", "sort_order", "INTEGER DEFAULT 0"),
    # Table: presets
    ("presets", "stock_quantity", "INTEGER DEFAULT 0"),
    ("presets", "track_stock", "BOOLEAN DEFAULT 0"),
    ("presets", "min_stock_alert", "INTEGER DEFAULT 5"),
    ("presets", "barcode", "VARCHAR DEFAULT ''"),
    # Table: store_config
    ("store_config", "bank_account_iban", "VARCHAR DEFAULT 'CZ6508000000001234567890'"),
    ("store_config", "default_language", "VARCHAR DEFAULT 'cs'"),
]


def _get_column_sql_def(col) -> str:
    """Derive SQLite column type and default clause from SQLAlchemy Column object."""
    type_name = type(col.type).__name__.upper()
    if "INT" in type_name:
        sql_type = "INTEGER"
        default = " DEFAULT 0"
        if col.default is not None and hasattr(col.default, "arg") and isinstance(col.default.arg, (int, float)):
            default = f" DEFAULT {int(col.default.arg)}"
        return f"{sql_type}{default}"
    elif "BOOL" in type_name:
        sql_type = "BOOLEAN"
        val = 0
        if col.default is not None and hasattr(col.default, "arg"):
            val = 1 if col.default.arg else 0
        return f"{sql_type} DEFAULT {val}"
    elif any(k in type_name for k in ("FLOAT", "NUMERIC", "DECIMAL")):
        sql_type = "FLOAT"
        default = " DEFAULT 0.0"
        if col.default is not None and hasattr(col.default, "arg") and isinstance(col.default.arg, (int, float)):
            default = f" DEFAULT {col.default.arg}"
        return f"{sql_type}{default}"
    elif any(k in type_name for k in ("DATETIME", "DATE", "TIME")):
        return "DATETIME"
    elif any(k in type_name for k in ("JSON", "TEXT")):
        return "TEXT"
    else:
        sql_type = "VARCHAR"
        default = " DEFAULT ''"
        if col.default is not None and hasattr(col.default, "arg") and isinstance(col.default.arg, str):
            escaped = col.default.arg.replace("'", "''")
            default = f" DEFAULT '{escaped}'"
        return f"{sql_type}{default}"


def run_schema_migrations(engine=None):
    """
    Check for database schema changes and execute SQLite migrations.
    1. Base.metadata.create_all to create any newly introduced tables.
    2. Dynamic reflection comparing Base.metadata.tables columns to SQLite PRAGMA table_info.
    3. Executes ALTER TABLE ADD COLUMN for any missing columns in existing tables.
    4. Executes legacy MIGRATIONS list for backward compatibility.
    """
    if engine is None:
        from database import engine as default_engine
        engine = default_engine

    from database import Base
    import models  # noqa: F401 - ensure all models are registered in Base.metadata

    # 1. Create any brand new tables
    Base.metadata.create_all(bind=engine)

    added_columns = []

    with engine.connect() as conn:
        # Fetch all existing tables in SQLite
        tables_res = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'")).fetchall()
        existing_tables = {row[0] for row in tables_res}

        # 2. Dynamic reflection against Base.metadata
        for table_name, table in Base.metadata.tables.items():
            if table_name not in existing_tables:
                continue

            pragma_res = conn.execute(text(f"PRAGMA table_info('{table_name}')")).fetchall()
            existing_col_names = {row[1] for row in pragma_res}

            for col in table.columns:
                if col.name not in existing_col_names:
                    col_def = _get_column_sql_def(col)
                    try:
                        conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {col.name} {col_def}"))
                        conn.commit()
                        added_columns.append(f"{table_name}.{col.name}")
                        logger.info(f"Auto-migrated {table_name}: added missing column {col.name} ({col_def})")
                        existing_col_names.add(col.name)
                    except Exception as e:
                        logger.warning(f"Could not add column {table_name}.{col.name}: {e}")

        # 3. Fallback explicit migrations list
        for table, col, col_type in MIGRATIONS:
            if table in existing_tables:
                pragma_res = conn.execute(text(f"PRAGMA table_info('{table}')")).fetchall()
                existing_cols = {row[1] for row in pragma_res}
                if col not in existing_cols:
                    try:
                        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"))
                        conn.commit()
                        added_columns.append(f"{table}.{col}")
                        logger.info(f"Applied legacy migration {table}.{col} ({col_type})")
                    except Exception:
                        pass

    if added_columns:
        logger.info(f"Schema migrations completed: {len(added_columns)} columns added: {', '.join(added_columns)}")
    else:
        logger.info("Database schema is fully up to date (no migrations required).")

    return {"status": "SUCCESS", "added_columns": added_columns}


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    print("========================================================")
    print("  Checking database schema & applying migrations...")
    print("========================================================")
    try:
        res = run_schema_migrations()
        if res["added_columns"]:
            print(f"[OK] Migrated {len(res['added_columns'])} missing columns: {', '.join(res['added_columns'])}")
        else:
            print("[OK] Database schema is up to date.")
        print("========================================================")
        sys.exit(0)
    except Exception as exc:
        print(f"[ERROR] Migration failed: {exc}", file=sys.stderr)
        sys.exit(1)
