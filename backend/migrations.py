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
    ("sale_items", "quantity", "FLOAT DEFAULT 1.0"),
    # Table: catalog_presets
    ("catalog_presets", "is_open_price", "BOOLEAN DEFAULT 0"),
    ("catalog_presets", "color", "VARCHAR DEFAULT '#3b82f6'"),
    ("catalog_presets", "sort_order", "INTEGER DEFAULT 0"),
    # Table: presets
    ("presets", "stock_quantity", "FLOAT DEFAULT 0.0"),
    ("presets", "track_stock", "BOOLEAN DEFAULT 0"),
    ("presets", "min_stock_alert", "FLOAT DEFAULT 5.0"),
    ("presets", "barcode", "VARCHAR DEFAULT ''"),
    ("presets", "cost_price", "FLOAT DEFAULT 0.0"),
    ("presets", "unit", "VARCHAR DEFAULT 'ks'"),
    ("presets", "is_weighted", "BOOLEAN DEFAULT 0"),
    ("presets", "margin_coefficient", "FLOAT DEFAULT NULL"),
    # Table: categories
    ("categories", "natural_loss_norm", "FLOAT DEFAULT 0.0"),
    # Table: store_config
    ("store_config", "bank_account_iban", "VARCHAR DEFAULT 'CZ6508000000001234567890'"),
    ("store_config", "default_language", "VARCHAR DEFAULT 'cs'"),
    ("store_config", "receipt_show_barcode", "BOOLEAN DEFAULT 1"),
    ("store_config", "default_margin_coefficient", "FLOAT DEFAULT 1.30"),
    # Table: cash_movements
    ("cash_movements", "shift_id", "VARCHAR DEFAULT ''"),
    ("cash_movements", "reason", "VARCHAR DEFAULT ''"),
    # Table: shift_sessions
    ("shift_sessions", "discrepancy", "FLOAT DEFAULT 0.0"),
    ("shift_sessions", "z_seq", "INTEGER DEFAULT 1"),
    # Table: stock_movements
    ("stock_movements", "unit_cost", "FLOAT DEFAULT 0.0"),
    ("stock_movements", "supplier_ico", "VARCHAR DEFAULT ''"),
    ("stock_movements", "supplier_name", "VARCHAR DEFAULT ''"),
    ("stock_movements", "document_ref", "VARCHAR DEFAULT ''"),
    ("stock_movements", "note", "VARCHAR DEFAULT ''"),
    # Table: sales B2B fields
    ("sales", "is_invoice", "BOOLEAN DEFAULT 0"),
    ("sales", "invoice_number", "VARCHAR DEFAULT ''"),
    ("sales", "customer_ico", "VARCHAR DEFAULT ''"),
    ("sales", "customer_dic", "VARCHAR DEFAULT ''"),
    ("sales", "customer_name", "VARCHAR DEFAULT ''"),
    ("sales", "customer_address", "VARCHAR DEFAULT ''"),
]

FLOAT_COLUMN_MIGRATIONS = [
    ("sale_items", "quantity", 1.0),
    ("presets", "stock_quantity", 0.0),
    ("presets", "min_stock_alert", 5.0),
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

        # 4. Safely migrate existing INTEGER columns to FLOAT without data loss
        for table, col, default_val in FLOAT_COLUMN_MIGRATIONS:
            if table in existing_tables:
                try:
                    pragma_res = conn.execute(text(f"PRAGMA table_info('{table}')")).fetchall()
                    col_info = next((row for row in pragma_res if row[1] == col), None)
                    if col_info:
                        current_type = (col_info[2] or "").upper()
                        if "FLOAT" not in current_type and "REAL" not in current_type:
                            temp_col = f"{col}_new_float"
                            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {temp_col} FLOAT DEFAULT {default_val}"))
                            conn.execute(text(f"UPDATE {table} SET {temp_col} = CAST({col} AS FLOAT)"))
                            conn.execute(text(f"ALTER TABLE {table} DROP COLUMN {col}"))
                            conn.execute(text(f"ALTER TABLE {table} RENAME COLUMN {temp_col} TO {col}"))
                            conn.commit()
                            added_columns.append(f"{table}.{col}->FLOAT")
                            logger.info(f"Auto-migrated {table}.{col}: converted {current_type} to FLOAT")
                except Exception as e:
                    logger.warning(f"Could not migrate column {table}.{col} to FLOAT: {e}")

        # 5. Ensure stock_movements has ON DELETE CASCADE on preset_id foreign key
        if "stock_movements" in existing_tables:
            try:
                fks = conn.execute(text("PRAGMA foreign_key_list('stock_movements')")).fetchall()
                has_cascade = any(row[2] == "presets" and (row[6] or "").upper() == "CASCADE" for row in fks)
                if not has_cascade:
                    conn.execute(text("PRAGMA foreign_keys=OFF;"))
                    conn.execute(text("""
                        CREATE TABLE stock_movements_new (
                            id VARCHAR NOT NULL PRIMARY KEY,
                            preset_id VARCHAR NOT NULL REFERENCES presets(id) ON DELETE CASCADE,
                            movement_type VARCHAR NOT NULL,
                            quantity_delta FLOAT NOT NULL,
                            unit_cost FLOAT NOT NULL,
                            supplier_ico VARCHAR,
                            supplier_name VARCHAR,
                            document_ref VARCHAR,
                            note VARCHAR,
                            timestamp DATETIME NOT NULL
                        );
                    """))
                    conn.execute(text("""
                        INSERT INTO stock_movements_new (id, preset_id, movement_type, quantity_delta, unit_cost, supplier_ico, supplier_name, document_ref, note, timestamp)
                        SELECT id, preset_id, movement_type, quantity_delta, unit_cost, supplier_ico, supplier_name, document_ref, note, timestamp FROM stock_movements;
                    """))
                    conn.execute(text("DROP TABLE stock_movements;"))
                    conn.execute(text("ALTER TABLE stock_movements_new RENAME TO stock_movements;"))
                    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_stock_movements_preset_id ON stock_movements (preset_id);"))
                    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_stock_movements_movement_type ON stock_movements (movement_type);"))
                    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_stock_movements_supplier_ico ON stock_movements (supplier_ico);"))
                    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_stock_movements_timestamp ON stock_movements (timestamp);"))
                    conn.execute(text("PRAGMA foreign_keys=ON;"))
                    conn.commit()
                    added_columns.append("stock_movements->ON_DELETE_CASCADE")
                    logger.info("Migrated stock_movements: added ON DELETE CASCADE to foreign key")
            except Exception as e:
                logger.warning(f"Could not migrate stock_movements foreign key: {e}")

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
