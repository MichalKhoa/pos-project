# Frontend Components & Architecture

Directory: `/src/components`

## Views (Top-Level Code-Split Tabs)
- `App.jsx`: Main register shell coordinator. Uses `useMemo` for cart subtotal calculations. Decomposed into:
  - `src/components/app/AppModals.jsx`: Centralized modal and portal coordinator.
  - `src/hooks/usePosKeyboardShortcuts.js`: Hardware numpad and shortcut keybindings.
- `PresetsCatalogView.jsx`: Tile and category manager with color pickers and icon mappings.
- `InventoryView.jsx`: Stock management coordinator with `useMemo` memoized catalog filters and inventory valuation metrics. Decomposed into modular domain subcomponents in `/src/components/inventory/`:
  - `InventoryMetricsBar.jsx`: Stock valuation and health KPIs (Healthy/Low/Out of Stock).
  - `InventoryStockTable.jsx`: Filterable data table with quick `+5`/`+10` adjustment buttons and barcode input.
  - `StockKeypadModal.jsx`: Touch numeric pad for fast inventory quantity adjustment.
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
- `Cart.jsx`: Active shopping basket with memoized totals (`calculateCartTotals`), swipe-to-delete, item discount popover, line quantity modifier, and parking slots.
- `QuickPresetGrid.jsx`: Fast product tile touch grid coordinator with `useMemo` memoized search & category filtering. Decomposed into `/src/components/presets/`:
  - `CategoryFilterBar.jsx`: Touch-scrollable category filter pills with arrow controls.
  - `PresetTileCard.jsx`: Product tile card with visual icon/photo badge, quick multiplier, and edit handles.
  - `OpenPriceModal.jsx`: Numeric touch popover for open-price items and return items.
  - `src/hooks/usePresetDragDrop.js`: Drag-and-drop tile reordering and keyboard arrow shifting.
- `ManualKeypad.jsx`: Touch numeric pad coordinator with `touch-action: manipulation` zero-delay keys. Decomposed into `/src/components/keypad/`:
  - `KeypadNumberGrid.jsx`: 4×4 animated numeric touch grid, quick multiplier (`×N`), and custom product insertion.
  - `KeypadVatSelector.jsx`: Czech VAT rate chips (21%, 12%, 0%) and refund sign toggle (`± Vratka`).
  - `ParkedCartsDrawer.jsx`: Park/Hold active cart, restore held orders, and cash drawer trigger.
- `Navbar.jsx`: Register top bar with clock, network/backend status, cart drawer toggle, lock button, and view navigation.

## Active Custom Hooks in `/src/hooks/`
- `useCart.js`: Active shopping cart state, discounts, and item modifiers.
- `usePresetDragDrop.js`: Drag-and-drop preset ordering.
- `usePosKeyboardShortcuts.js`: Hardware keyboard listener for fast numeric keypad checkout.
