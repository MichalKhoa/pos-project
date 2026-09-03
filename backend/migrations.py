import logging
from sqlalchemy import text

logger = logging.getLogger("pos-migrations")

# Comprehensive Auto-migrations for existing/old SQLite database files
MIGRATIONS = [
    # Table: store_config
    ("store_config", "csob_terminal_enabled", "BOOLEAN DEFAULT 0"),
    ("store_config", "csob_terminal_ip", "VARCHAR DEFAULT ''"),
    ("store_config", "csob_terminal_port", "INTEGER DEFAULT 8888"),
    ("store_config", "csob_terminal_id", "VARCHAR DEFAULT ''"),
    ("store_config", "cashier_pin", "VARCHAR DEFAULT '1234'"),
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


def run_schema_migrations(engine):
    """
    Safely execute ALTER TABLE statements for any missing columns in older SQLite databases.
    SAFETY: table/col/col_type are hardcoded tuple constants, never user input.
    """
    with engine.connect() as conn:
        for table, col, col_type in MIGRATIONS:
            try:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"))
                conn.commit()
            except Exception:
                # Column already exists or table doesn't require migration
                pass
