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
- `SalesHistoryView.jsx`: Streamlined sales ledger view dedicated 100% to receipt lookup, search, reprint, and refunds with full viewport height fitting 15–20 receipts on a single screen without vertical clutter. Decomposed into `/src/components/history/`:
  - `SalesPeriodBar.jsx`: Preset chips (Today/Yesterday/Week/Month/Year/Custom), `< >` stepper navigation, and calendar triggers.
  - `SalesLedgerTable.jsx`: Paginated receipt ledger table with search, document type filter, refund triggers, and pagination (default 15 rows/page).
- `AnalyticsView.jsx`: Dedicated top-level analytics dashboard tab with financial KPI cards, time period selector, CSV export, and visual chart breakdowns. Decomposed into `/src/components/history/`:
  - `SalesPeriodBar.jsx`: Period filters (Today, Yesterday, Week, Month, Year, Custom) with stepper navigation and calendar triggers.
  - `SalesAnalyticsCharts.jsx`: Visual POS dashboard featuring top 4 KPI cards (Gross, Netto/VAT, Receipts/AOV, Payments), Top 8 Best-Selling Products ranking (#1–#8 with volume bars), Hourly Rush-Hour chart (07:00–22:00 with peak rush highlight), visual multi-segment payment split bar (Cash vs Card vs QR), category sales volume bars, and official Czech VAT tax table (21%, 12%, 0%).
- `SettingsView.jsx`: POS system configuration coordinator. Decomposed into modular domain subcomponents in `/src/components/settings/`:
  - `StoreProfileSection.jsx`: Store identification, address, IČO/DIČ, default VAT, IBAN, and high-legibility toggle.
  - `PrinterSection.jsx`: Thermal ESC/POS receipt printing (58mm vs 80mm), margin ruler test, auto-print toggles.
  - `TerminalSection.jsx`: ČSOB Move 3500 terminal TCP IP/port/TID setup, ping connectivity test, and daily reconciliation.
  - `SecuritySection.jsx`: Admin mode toggle, Admin PIN verification and update, cashier PIN, and inactivity auto-lock.
  - `BackupSection.jsx`: JSON backup export/import, Litestream SQLite WAL replication monitor, and EET toggle.

## Core Register Components
- `Cart.jsx`: Active shopping basket (420px width) with memoized totals (`calculateCartTotals`), active item selection, note badges, line quantity modifier, and parking slots. Decomposed into `/src/components/cart/`:
  - `CartItemInspector.jsx`: Floating side-docked inspector drawer overlapping the Presets column adjacent to Cart. Allows instant quantity modification (+1, +2, +5, +10, stepper), quick discounts (-5%, -10%, -20%, -50%), price override, item notes/modifiers, and item deletion without blocking modals.
- `QuickPresetGrid.jsx`: Fast product tile touch grid coordinator with `useMemo` memoized search & category filtering. Includes Density Switcher (Compact `S`, Standard `M`, Large `L`). Decomposed into `/src/components/presets/`:
  - `CategoryFilterBar.jsx`: Touch-scrollable category filter pills with arrow controls.
  - `PresetTileCard.jsx`: Product tile card with visual icon/photo badge, quick multiplier, and edit handles.
  - `OpenPriceModal.jsx`: Numeric touch popover for open-price items and return items.
  - `src/hooks/usePresetDragDrop.js`: Drag-and-drop tile reordering and keyboard arrow shifting.
- `ManualKeypad.jsx`: Touch numeric pad coordinator with `touch-action: manipulation` zero-delay keys. Decomposed into `/src/components/keypad/`:
  - `KeypadStepperBar.jsx`: Touch quantity stepper (`[-1 ks]`, Multiplier Display / Reset, `[+1 ks]`). Decreasing below 1 activates return mode (`-1×`, `-2×`).
  - `KeypadNumberGrid.jsx`: 4×4 animated numeric touch grid (`7-8-9-⌫`, `4-5-6-C`, `1-2-3-,`, `0-00-±-×`), and custom product/return insertion button.
  - `KeypadVatSelector.jsx`: Czech VAT rate chips (21%, 12%, 0%) and quick `±` sign toggle.
  - `ParkedCartsDrawer.jsx`: Park/Hold active cart, restore held orders, and cash drawer trigger.
  - `ShiftStatsWidget.jsx`: Live mini-card displaying today's shift revenue, cash/card breakdown, receipt count, and quick link to Sales History.
- `Navbar.jsx`: Register top bar with clock, network/backend status, cart drawer toggle, lock button, and view navigation tabs (`[ 🛒 Pokladna ] [ 📦 Sklad ] [ 🏷️ Katalog ] [ 📜 Historie ] [ 📊 Analytika ] [ ⚙️ Nastavení ]`).

## Active Custom Hooks in `/src/hooks/`
- `useCart.js`: Active shopping cart state, discounts, `updateItemDetails`, and item modifiers.
- `usePresetDragDrop.js`: Drag-and-drop preset ordering.
- `usePosKeyboardShortcuts.js`: Hardware keyboard listener for fast numeric keypad checkout.
