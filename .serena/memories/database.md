# Database & Persistence

SQLite persistence layer located at `backend/pos_store.db`.

## Models (`/backend/models.py`)
- `SaleModel`: Stores sale ID, timestamp, total amount, payment method (cash/card/qr/split), status (`COMPLETED_ONLINE`, `OFFLINE_PENDING`, etc.), tax totals, BKP, PKP, FIK, receipt number.
- `SaleItemModel`: Individual line items linked to `SaleModel` foreign key (`name`, `quantity`, `unit_price`, `vat_rate`, `discount_percent`).
- `StoreConfigModel`: Store details (name, IC, DIC, address), EET configuration (certificate path, password, environment, provozovna, pokladna), printer config.
- `CatalogPresetModel`: Catalog categories and fast-select items.

## Invariants
- Frontend stores catalog configuration in `localStorage` as fallback, while syncing with backend database.
- Sales transactions are immutable once committed; refunds generate reversing records.

## Related Memories
- Backend structure: `mem:backend/core`