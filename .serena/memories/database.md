# Database & Persistence

SQLite persistence layer located at `backend/data/pos_store.db`.

## Models (`/backend/models.py`)
- `SaleModel`: Stores sale ID, timestamp, total amount, payment method (cash/card/qr/split), status (`COMPLETED_ONLINE`, `OFFLINE_PENDING`, etc.), tax totals, BKP, PKP, FIK, receipt number, refund status (`NONE`, `PARTIAL`, `FULL`), original receipt number, refund reason, refunded amount, `eet_retry_count`.
- `SaleItemModel`: Individual line items linked to `SaleModel` foreign key (`name`, `quantity`, `unit_price`, `vat_rate`, `discount_percent`).
- `PresetModel` (`presets` table): Stock quantity (`stock_quantity`), tracking flag (`track_stock`), min stock alert level (`min_stock_alert`), and EAN barcode (`barcode`).
- `EetAuditLogModel` (`eet_audit_logs` table): Complete audit log of EET retry submissions and response codes.
- `StoreConfigModel`: Store details (name, IČO, DIČ, address, `bank_account_iban`), customer display greeting/title (`customer_display_title`), auto-sleep settings (`customer_display_auto_sleep`, `customer_display_standby_delay`), `show_preset_vat` (non-VAT merchant tile setting), EET config (certificate path, Fernet AES-256 encrypted password, environment, provozovna, pokladna), printer config, security lock config, ČSOB terminal settings.
- `ReceiptSequenceModel`: Atomic yearly sequence counters (`year`, `last_seq`) ensuring duplicate-safe receipt numbers (`YYYY-XXXXXX`).

## Dynamic Auto-Migration & Self-Healing (`/backend/database.py`)
- **Dynamic Auto-Migration (`init_db_schema()`)**: Uses `sqlalchemy.inspect(engine)` on startup to compare Python models against physical SQLite tables. Automatically detects and executes `ALTER TABLE {table} ADD COLUMN {col} {type} DEFAULT ...` for any newly added model columns without manual migration lists.
- **Directory Security**: Database housed in `backend/data/pos_store.db` with `0o700` restricted directory permissions and legacy DB path auto-migration.
- **WAL & Concurrency**: Enabled `PRAGMA journal_mode = WAL;`, `PRAGMA foreign_keys = ON;`, `PRAGMA busy_timeout = 15000;`.
- **Self-Healing**: Startup `PRAGMA quick_check;` and 15-minute periodic `PRAGMA wal_checkpoint(PASSIVE);` daemon.
- **Atomic Transactions**: `atomic_transaction(db)` context manager wrapping checkout and stock deduction.
- **Automated Backups**: SQLite online backup API (`sqlite3.Connection.backup()`), ZIP compression, and 30-day auto-purge in `backend/services/backup_service.py`.

## Invariants & Calculations
- Configuration is loaded directly from SQLite DB on startup (`GET /api/v1/config`) and synchronized to `localStorage`.
- Sales transactions are immutable once committed; refunds generate reversing records with optional item restocking.
- All monetary calculations use 2 decimal places rounding (`roundCZK` / `round_currency`) to prevent binary float representation errors.
