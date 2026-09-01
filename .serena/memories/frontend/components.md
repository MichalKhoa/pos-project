# Frontend Components & Architecture

Directory: `/src/components`

## Views (Top-Level Code-Split Tabs)
- `RegisterView.jsx` (within `App.jsx`): Touch register screen.
- `PresetsCatalogView.jsx`: Tile and category manager with color pickers and icon mappings.
- `InventoryView.jsx`: Real-time stock list, batch stock-in, low-stock threshold triggers, and stock adjustment logs.
- `CustomerDisplayView.jsx`: Real-time LCD customer-facing display.
- `SalesHistoryView.jsx`: Sales ledger and statistical analytics view. Decomposed into modular domain subcomponents in `/src/components/history/`:
  - `SalesMetricsCards.jsx`: KPI metric cards (Total, Cash, Card, Txn Count, AOV).
  - `SalesPeriodBar.jsx`: Preset chips (Today/Yesterday/Week/Month/Year/Custom), `< >` stepper navigation, and calendar triggers.
  - `SalesAnalyticsCharts.jsx`: Tax rate breakdown, category sales share, and weekday sales distribution.
  - `SalesLedgerTable.jsx`: Paginated receipt ledger table with search, document type filter, refund triggers, and pagination.
- `SettingsView.jsx`: POS system configuration coordinator. Decomposed into modular domain subcomponents in `/src/components/settings/`:
  - `StoreProfileSection.jsx`: Store identification, address, IČO/DIČ, default VAT, IBAN, and high-legibility toggle.
  - `PrinterSection.jsx`: Thermal ESC/POS receipt printing (58mm vs 80mm), margin ruler test, auto-print toggles.
  - `TerminalSection.jsx`: ČSOB Move 3500 terminal TCP IP/port/TID setup, ping connectivity test, and daily reconciliation.
  - `SecuritySection.jsx`: Admin mode toggle, Admin PIN verification and update, cashier PIN, and inactivity auto-lock.
  - `BackupSection.jsx`: JSON backup export/import, Litestream SQLite WAL replication monitor, and EET toggle.

## Core Register Components
- `Cart.jsx`: Active shopping basket with swipe-to-delete, item discount popover, line quantity modifier, and parking slots.
- `QuickPresetGrid.jsx`: Fast product tile touch grid with category horizontal scroll.
- `ManualKeypad.jsx`: Touch numeric pad with decimal entry, quick quantity multiplier (+1x / -1x return mode), and touch ergonomics.
- `Navbar.jsx`: Register top bar with clock, network/backend status, cart drawer toggle, lock button, and view navigation.

## Modals & Popovers
- `PaymentModal.jsx`: Multi-tender payment orchestrator (Cash, Card terminal TCP, QR code 2s polling, Split payment).
- `ReceiptModal.jsx`: Vector receipt preview with live thermal print trigger.
- `AdminPinModal.jsx`: 4–8 digit PIN authentication pad for protected actions.
- `TouchCalendarModal.jsx` & `TouchDateRangeModal.jsx`: Touch-friendly date and range pickers for POS screens.
- `ItemDiscountModal.jsx`: Line-item discount percentage and fixed amount modal.
