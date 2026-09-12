# Database & Persistence

SQLite persistence layer located at `backend/data/pos_store.db`.

## Models (`/backend/models.py`)
- **Monetary Precision**: All currency/financial columns use `Numeric(10, 2)` mapped to `DECIMAL(10, 2)` in SQLite to prevent IEEE 754 binary floating point drift on SQL sums/aggregations. Physical units (`quantity`, `stock_quantity`, `min_stock_alert`) remain `Float`.
- `SaleModel`: Stores sale ID, timestamp, total amount (`Numeric(10, 2)`), payment method (cash/card/qr/split), status (`COMPLETED_ONLINE`, `OFFLINE_PENDING`, etc.), tax totals, BKP, PKP, FIK, receipt number, refund status (`NONE`, `PARTIAL`, `FULL`), original receipt number, refund reason, refunded amount (`Numeric(10, 2)`), `eet_retry_count`. Has `items = relationship("SaleItemModel", ..., lazy="selectin")` for automatic eager loading in JSON responses (`SaleResponseSchema`).
- `SaleItemModel`: Individual line items linked to `SaleModel` foreign key (`name`, `quantity: float = 1.0`, `price: Numeric(10, 2)`, `vat_rate`, `discount_percent: Numeric(10, 2)`). Preserved immutably as static snapshots; not foreign-key constrained to presets. Supports decimal quantities (kg) with 3-decimal precision.
- `CategoryModel` (`categories` table): Product categories with `position` and natural loss norm (`natural_loss_norm: float = 0.0` for § 25 ZoÚ loss norms).
- `PresetModel` (`presets` table): Stock quantity (`stock_quantity: float = 0.0`), tracking flag (`track_stock`), min stock alert level (`min_stock_alert: float = 5.0`), EAN barcode (`barcode`), touch register visibility flag (`show_in_presets: bool = True`), retail price (`price: Numeric(10, 2)`), and cost valuation price (`cost_price: Numeric(10, 2)`). Has cascade relationship to `StockMovementModel`.
- `StockMovementModel` (`stock_movements` table): Stock movement ledger (§ 7b ZDP) tracking inventory adjustments, sales deductions, returns, receipts (`RECEIPT`, `SALE`, `RETURN`, `WRITE_OFF`, `ADJUSTMENT`), unit purchase costs (`unit_cost: Numeric(10, 2)`), supplier IČO/name, document reference, and notes. Linked via foreign key with `ON DELETE CASCADE` to `PresetModel`.
- `WriteOffSequenceModel` (`write_off_sequences` table): Atomic yearly sequence counter (`year`, `last_seq`) for write-off protocol numbering (`ODP-YYYY-XXXX`).
- `StockWriteOffModel` (`stock_write_offs` table) & `StockWriteOffItemModel` (`stock_write_off_items` table): Liquidation and write-off protocols (§ 25 ZoÚ / § 77, 78 ZDPH), storing protocol number, reason (`EXSPIRACE`, `ZKAZA`, `ROZBITI`, `KRADEZ`, `OTHER`), responsible person, notes, total cost vs retail amounts (`Numeric(10, 2)`), tax-deductible flag, and VAT adjustment requirement.
- `EetAuditLogModel` (`eet_audit_logs` table): Complete audit log of EET retry submissions and response codes.
- `StoreConfigModel`: Store details (name, IČO, DIČ, address, `bank_account_iban`), customer display greeting/title (`customer_display_title`), auto-sleep settings (`customer_display_auto_sleep`, `customer_display_standby_delay`), `preset_grid_columns` ('auto', '3', '4', '5', '6'), `preset_density` ('compact', 'standard', 'large'), `preset_button_style` ('left-stripe', 'color-fill'), `show_preset_vat` (non-VAT merchant tile setting), EET config (certificate path, Fernet AES-256 encrypted password, environment, provozovna, pokladna), printer config, security lock config, ČSOB terminal settings, receipt styling & layout, and Cloud Staging sync configuration (`cloud_staging_enabled: bool = False`, `cloud_staging_url: str`, `cloud_staging_token: str`, `cloud_staging_last_sync: str`, `cloud_staging_last_status: str`, `cloud_staging_last_count: int = 0`).
- `AppliedSyncEventModel` (`applied_sync_events` table): Remote staging idempotency audit table storing `idempotency_key` (UUIDv4, UNIQUE), `event_type` (`INTAKE`, `PRICE_CHANGE`, `PRODUCT`), `entity_id`, and `applied_at` ISO-8601 timestamp. Prevents duplicate intake or multi-recalculation of VAP.
- `ReceiptSequenceModel` & `InvoiceSequenceModel`: Yearly sequence counters (`year`, `last_seq`) for receipt numbers (`YYYY-XXXXXX`) and invoice numbers (`FA-YYYY-XXXX`). Operates with `.with_for_update()` and `db.flush()` inside transaction boundaries to ensure aborted sales do not create illegal sequence gaps.

## Dynamic Auto-Migration & Self-Healing (`/backend/database.py`, `/backend/migrations.py`)
- **Dynamic Auto-Migration (`run_schema_migrations()`)**: Compares SQLAlchemy `Base.metadata.tables` with physical SQLite `PRAGMA table_info`. Automatically detects and executes `ALTER TABLE {table} ADD COLUMN {col} {type} DEFAULT ...` for any newly added model columns.
- **Table Recreation Migrations (`migrate_monetary_columns_to_decimal()`)**: SQLite table recreation for existing monetary columns to migrate from legacy `FLOAT` to `DECIMAL(10,2)` with `PRAGMA foreign_keys = OFF / ON` safety.
- **Standalone CLI & Script Integration**: `backend/migrations.py` provides `if __name__ == "__main__":` entry point. Executed automatically before starting backend across all Linux (`.sh`) and Windows (`.bat`) launcher and updater scripts.
- **Directory Security**: Database housed in `backend/data/pos_store.db` with `0o700` restricted directory permissions and legacy DB path auto-migration.
- **WAL & Concurrency**: Enabled `PRAGMA journal_mode = WAL;`, `PRAGMA foreign_keys = ON;`, `PRAGMA busy_timeout = 15000;`.
- **Atomic Stock Mutations**: Stock decrements and refunds use direct atomic SQL `UPDATE presets SET stock_quantity = ROUND(COALESCE(stock_quantity, 0.0) ± :qty, 3) WHERE id = :id` followed by `db.refresh(preset)` to avoid read-modify-write race conditions under concurrent checkouts.
- **Dynamic Hardware PRAGMA Tuning (`backend/services/hardware_profile.py`)**: Sized according to detected physical RAM via `psutil`:
  - Tier 1 (<6 GB RAM): `PRAGMA cache_size = -16384` (16 MB), `PRAGMA mmap_size = 67108864` (64 MB), 200 LRU receipts, 6 mos pre-warm.
  - Tier 2 (6–16 GB RAM): `PRAGMA cache_size = -65536` (64 MB), `PRAGMA mmap_size = 268435456` (256 MB), 1,000 LRU receipts, 12 mos pre-warm.
  - Tier 3 (>16 GB RAM): `PRAGMA cache_size = -131072` (128 MB), `PRAGMA mmap_size = 536870912` (512 MB), 2,500 LRU receipts, 36 mos pre-warm.
  - `PRAGMA temp_store = MEMORY;` applied on connection to accelerate in-memory temporary index and aggregation sorting.
- **Sargable Indexed Date Queries**: Monthly statistics aggregation (`get_daily_sales_stats`) uses boundary comparisons (`timestamp >= start_dt AND timestamp < end_dt`) instead of `strftime()` to utilize index `ix_sales_timestamp` without table scanning.
- **In-Memory Query Caches**:
  - `BoundedTTLReceiptCache`: Thread-safe LRU cache with 600s TTL for receipt and ID lookups, invalidated on refund status updates or new stornos.
  - `MonthlyStatsCache`: Closed past months cached indefinitely (immutable), active month invalidated on new sales/refunds.
- **Self-Healing**: Startup `PRAGMA quick_check;` and 15-minute periodic `PRAGMA wal_checkpoint(PASSIVE);` daemon.
- **Atomic Transactions**: `atomic_transaction(db)` context manager wrapping checkout, intake, and write-offs.
- **Automated Backups & Restore**:
  - Backup creation via SQLite online backup API (`sqlite3.Connection.backup()`), ZIP compression, and 30-day auto-purge in `backend/services/backup_service.py`.
  - Backup listing via `GET /api/v1/system/backups` (`list_backups()`).
  - Safe 1-click restore via `POST /api/v1/system/restore` (`restore_database_from_backup()`) with SQLite `quick_check` integrity verification, connection engine reset, and automatic pre-restore safety snapshot. Restricted to loopback clients.

## Invariants & Calculations
- Configuration is loaded directly from SQLite DB on startup (`GET /api/v1/config`) and synchronized to `localStorage`.
- Sales transactions are immutable once committed; refunds generate reversing records with optional item restocking.
- All monetary calculations use 2 decimal places rounding (`roundCZK` / `round_currency`) to prevent binary float representation errors.
