# Frontend Components & Architecture

Directory: `/src/components`

## Views (Top-Level Code-Split Tabs)
- `App.jsx`: Main register shell coordinator. Uses `useMemo` for cart subtotal calculations. Decomposed into:
  - `src/components/app/AppModals.jsx`: Centralized modal and portal coordinator.
  - `src/hooks/usePosKeyboardShortcuts.js`: Hardware numpad and shortcut keybindings.
  - `src/hooks/usePosCatalog.js`: Category & preset state and CRUD handlers.
  - `src/hooks/useOfflineSync.js`: EET offline queue monitoring and synchronization.
  - `src/hooks/useAutoLock.js`: User activity tracking and register auto-lock.
- `ReceiptModal.jsx`: Thermal and A4 receipt preview and reprint modal. Browser print HTML generation isolated in `src/utils/receiptHtmlGenerator.js`.
- `PresetsCatalogView.jsx`: Tile and category manager with color pickers and icon mappings.
- `InventoryView.jsx`: Stock management coordinator with `useMemo` memoized catalog filters and inventory valuation metrics. Decomposed into modular domain subcomponents in `/src/components/inventory/`:
  - `InventoryMetricsBar.jsx`: Stock valuation and health KPIs (Healthy/Low/Out of Stock).
  - `InventoryStockTable.jsx`: Filterable data table with quick `+5`/`+10` adjustment buttons and barcode input.
  - `StockKeypadModal.jsx`: Touch numeric pad for fast inventory quantity adjustment.
- `CustomerDisplayView.jsx`: Real-time LCD customer-facing display.
- `SalesHistoryView.jsx`: Streamlined sales ledger view dedicated 100% to receipt lookup, search, reprint, and refunds with a 2-pane Master-Detail layout. Uses `useSalesPeriodFilter`. Decomposed into `/src/components/history/`:
  - `ReceiptInspectorPanel.jsx`: Left pane displaying live thermal receipt paper preview with instant reprint and refund action triggers.
  - `SalesPeriodBar.jsx`: Preset chips (Today/Yesterday/Week/Month/Year/Custom), `< >` stepper navigation, and calendar triggers.
  - `SalesLedgerTable.jsx`: Paginated receipt ledger table with search, document type filter, refund triggers, active row highlight, and pagination (default 15 rows/page).
- `AnalyticsView.jsx`: Dedicated top-level analytics dashboard tab with financial KPI cards, time period selector, CSV export, and visual chart breakdowns. Uses `useSalesPeriodFilter`. Decomposed into `/src/components/history/`:
  - `SalesPeriodBar.jsx`: Period filters (Today, Yesterday, Week, Month, Year, Custom) with stepper navigation and calendar triggers.
  - `SalesAnalyticsCharts.jsx`: Visual POS dashboard featuring top 4 KPI cards (Gross, Netto/VAT, Receipts/AOV, Payments), Top 8 Best-Selling Products ranking (#1–#8 with volume bars), Hourly Rush-Hour chart (07:00–22:00 with peak rush highlight), visual multi-segment payment split bar (Cash vs Card vs QR), category sales volume bars, and official Czech VAT tax table (21%, 12%, 0%).
- `SettingsView.jsx`: POS system configuration coordinator with touchscreen-first Master-Detail sidebar layout (`.settings-view-container`), left 250px vertical touch rail (Store, Layout, Hardware, Terminal, Security, System), right scrollable content pane, and automated background saving (`saveConfigField` onBlur, `saveConfigBatch` onChange) with top-right green auto-save toast (`.settings-save-toast`). Decomposed into modular domain subcomponents in `/src/components/settings/`:
  - `StoreProfileSection.jsx`: Dedicated store information in clean cards (corporate identity, street/city address, IČO/DIČ, segmented default VAT 21%/12%/0%, IBAN for QR payments, and register language).
  - `LayoutSection.jsx`: Dedicated register layout & visual presentation in clean cards (segmented preset columns Auto/3/4/5/6, button size S/M/L, button style left-stripe/color-fill, showPresetVat toggle, cart position left/right, high-legibility mode, customer LCD display title & auto-sleep).
  - `PrinterSection.jsx`: Thermal ESC/POS receipt printing (device selector with live connection badges, 58mm vs 80mm segmented selector, auto-print switch, receipt footer, and test cash drawer release trigger).
  - `TerminalSection.jsx`: Payment terminal mode with large touch cards (Manual Mode vs Automated ČSOB / Ingenico Move 3500 TCP IP/port/TID setup, ping connectivity test, and daily reconciliation).
  - `SecuritySection.jsx`: Admin mode toggle card with status pill, Admin PIN change modal trigger, cashier PIN, and inactivity auto-lock selector.
  - `BackupSection.jsx`: JSON backup export/import, database reset, automated Litestream replication status, system update checker, and EET 2.0 toggle card.

## Core Register Components
- `Cart.jsx`: Active shopping basket (420px width) with memoized totals (`calculateCartTotals`), active item selection, note badges, line quantity modifier, and parking slots. Decomposed into `/src/components/cart/`:
  - `CartItemInspector.jsx`: Floating side-docked inspector drawer overlapping the Presets column adjacent to Cart. Allows instant quantity modification (+1, +2, +5, +10, stepper), quick discounts (-5%, -10%, -20%, -50%), price override, item notes/modifiers, and item deletion without blocking modals.
- `QuickPresetGrid.jsx`: Fast product tile touch grid coordinator with `useMemo` memoized search & category filtering. Uncluttered header with direct category pills and search; interactive edit mode toolbar featuring category management button (`.preset-edit-cat-btn`), drag-to-delete Trash Can dropzone (`.preset-trash-dropzone`), and quick "Hotovo" exit. Size (`presetDensity`), style (`presetButtonStyle`), and columns (`presetGridColumns`) configured via Settings -> Zobrazení a Čitelnost. Decomposed into `/src/components/presets/`:
  - `CategoryFilterBar.jsx`: Multi-line wrapping category filter pills (`flex-wrap: wrap`, no horizontal scrolling). In edit mode, pills display edit cues, support drag-and-drop position reordering (`onReorderCategories`), tapping a pill opens category editor directly, and a `+ Spravovat kategorie` action chip allows instant category addition/management.
  - `PresetTileCard.jsx`: Multi-style product tile card without top stripe. Supports 2 core styles (`style-left-stripe` solid 4.5px left border on dark slate tile, `style-color-fill` authentic natural category color tile with crisp white typography `#ffffff` and white icon), borderless top-right corner icon (`.preset-corner-icon`), and subtle bottom-right corner VAT text (`.preset-vat-text`). In edit mode, tiles feature clean dashed amber border, subtle pencil indicator (`Edit3`), full-card tap-to-edit modal trigger, and drag-and-drop reorder/drag-to-delete without overlapping micro-buttons.
  - `PresetModal.jsx`: 1000px wide studio layout modal (Left: Item details, Open Price default with segmented toggle, store default VAT auto-selection, stock tracking off by default, USB hardware barcode scanner auto-fill listener with visual scan confirmation; Right: Live `PresetTileCard` preview, expanded 28-color palette with custom HTML5 eyedropper color picker and HEX code display, 100+ categorized Lucide retail icons with category tabs and real-time name search, and photo upload).
  - `OpenPriceModal.jsx`: Numeric touch popover for open-price items and return items.
  - `src/hooks/usePresetDragDrop.js`: Drag-and-drop tile reordering and keyboard arrow shifting.
- `ManualKeypad.jsx`: Touch numeric pad coordinator with `touch-action: manipulation` zero-delay keys. Unified sign and return handling (stepper strictly positive `>= 1 ks`, `±` controls return mode, subtotal preview strictly negative in return mode). Decomposed into `/src/components/keypad/`:
  - `KeypadStepperBar.jsx`: Touch quantity stepper with prominent chevron buttons (`ChevronDown` `-1`, `ChevronUp` `+1`) and compact static `{itemMultiplier}×` badge. Stepping down below 1 enters negative return mode (`-1×`, `-2×`); unified with `±` toggle without positive flip.
  - `KeypadNumberGrid.jsx`: 4×4 animated numeric touch grid (`7-8-9-⌫`, `4-5-6-C`, `1-2-3-,`, `0-00-±-×`), dedicated `±` return toggle, and custom product/return insertion button.
  - `KeypadVatSelector.jsx`: Czech VAT rate chips (21%, 12%, 0%) with sleek 36px touch height and tactile active-press scale responsiveness.
  - `ParkedCartsDrawer.jsx`: Park/Hold active cart, restore held orders, and cash drawer trigger.
  - `ShiftStatsWidget.jsx`: Live mini-card displaying today's shift revenue, cash/card breakdown, receipt count, quick link to Sales History, and 1-tap "Vytisknout denní tržbu" thermal printer summary trigger.
- `payment/CashPaymentPanel.jsx`: Cash checkout panel with authentic 6 color-coded Czech Banknote cards (100 green, 200 orange, 500 rose, 1000 violet, 2000 teal, 5000 navy), smart single-tap tender accumulation, 4 quick coins (5, 10, 20, 50 Kč), 3x4 numpad, giant hero change banner (2.5rem font, `VRÁTIT / TRẢ LẠI`), tactile audio clicks, and automated greedy coin/banknote breakdown assistant (`src/utils/currencyBreakdown.js`).
- `Navbar.jsx`: Register top bar with clock, network/backend status, cart drawer toggle, lock button, 1-click thermal daily summary trigger, and view navigation tabs (`[ 🛒 Pokladna ] [ 📦 Sklad ] [ 🏷️ Katalog ] [ 📜 Historie ] [ 📊 Analytika ] [ ⚙️ Nastavení ]`).
- `CalendarModal.jsx`, `TouchCalendarModal.jsx`, `TouchDateRangeModal.jsx`: Reusable calendar modals powered by `src/utils/calendarGrid.js` and `src/utils/czechHolidays.js`. (Unreferenced `DateKeypadModal.jsx` pruned).
- `UnknownBarcodeModal.jsx`: Instant 5-second touch modal triggered when an unrecognized barcode is scanned at checkout. Allows quick registration (name, price, VAT, category) and direct insertion into active cart with multiplier without leaving sales screen.

## Active Custom Hooks in `/src/hooks/`
- `useCart.js`: Active shopping cart state, discounts, `updateItemDetails`, and item modifiers.
- `usePresetDragDrop.js`: Drag-and-drop preset ordering.
- `usePosKeyboardShortcuts.js`: Hardware keyboard listener for fast numeric keypad checkout and global USB barcode scanner listener (<70ms burst detection, resolves EAN to presets, handles multiplier `qty * [scan]`, triggers UnknownBarcodeModal on unknown codes).
- `usePosCatalog.js`: Product categories and presets state and CRUD.
- `useOfflineSync.js`: EET offline queue check and sync handler.
- `useAutoLock.js`: Touch/mouse/keyboard activity tracking and auto-lock.
- `useSalesPeriodFilter.js`: Shared period range filtering for history and analytics.

## Audio Engine & Touch Feedback (`/src/utils/audio.js`)
- Synthesizes distinct procedural audio cues using HTML5 Web Audio API without audio asset loading:
  - `playScanChime()`: Crisp rising tone (1800Hz -> 2400Hz) on item addition or barcode match.
  - `playErrorChime()`: Low buzz warning (220Hz -> 160Hz sawtooth) on unknown barcode or failure.
  - `playSuccessChime()`: Harmonious two-tone chime (880Hz / 1760Hz) on checkout completion, restore, or hold.
  - `playCashChime()`: Multi-tone bell chime simulating physical cash drawer kick.
  - `playDeleteTone()`: Descending sine drop (420Hz -> 140Hz) on item deletion or cart wipe.
  - `playKeypadClick()`: Ultra-short tactile tick (1200Hz, 25ms) on keypad touches.
- Mute toggle integrated in top navbar and persisted in `pos_sound_enabled` localStorage.
