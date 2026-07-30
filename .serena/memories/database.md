# Database & Persistence

SQLite persistence layer located at `backend/pos_store.db`.

## Models (`/backend/models.py`)
- `SaleModel`: Stores sale ID, timestamp, total amount, payment method (cash/card/qr/split), status (`COMPLETED_ONLINE`, `OFFLINE_PENDING`, etc.), tax totals, BKP, PKP, FIK, receipt number, refund status (`NONE`, `PARTIAL`, `FULL`), original receipt number, refund reason, refunded amount.
- `SaleItemModel`: Individual line items linked to `SaleModel` foreign key (`name`, `quantity`, `unit_price`, `vat_rate`, `discount_percent`).
- `StoreConfigModel`: Store details (name, IC, DIC, address), EET configuration (certificate path, password, environment, provozovna, pokladna), printer config (interface, address, paper width 58/80/A4, direct HW print flag), security lock config (cashier PIN, auto-lock timeout), CSOB terminal settings.
- `CatalogPresetModel`: Catalog categories and fast-select items.

## Schema Auto-Migration Engine (`/backend/main.py`)
- On startup, `main.py` runs idempotent `ALTER TABLE ... ADD COLUMN` statements across existing SQLite databases (`MIGRATIONS` array).
- Guarantees backward compatibility when pulling updated images or using older `pos_store.db` files.

## Invariants
- Configuration is loaded directly from SQLite DB on startup (`GET /api/v1/config`) and synchronized to `localStorage`.
- Sales transactions are immutable once committed; refunds generate reversing records.

## Related Memories
- Backend structure: `mem:backend/core`