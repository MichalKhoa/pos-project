# Frontend Components & Architecture

Directory: `/src/components`

## Views (Top-Level Code-Split Tabs)
- `App.jsx`: Main register shell coordinator. Uses `useMemo` for cart subtotal. Subcomponents & hooks:
  - `src/components/app/AppModals.jsx`: Centralized modal and portal coordinator.
  - `src/hooks/usePosKeyboardShortcuts.js`: Hardware numpad & shortcut keybindings.
  - `src/hooks/usePosCatalog.js`: Category & preset state and CRUD handlers.
  - `src/hooks/useOfflineSync.js`: EET offline queue monitoring and synchronization.
  - `src/hooks/useAutoLock.js`: User activity tracking and register auto-lock.
- `ReceiptModal.jsx`: Thermal and A4 receipt preview and reprint modal. HTML generator: `src/utils/receiptHtmlGenerator.js`.
- `PresetsCatalogView.jsx`: Tile and category manager with color pickers and icon mappings.
- `InventoryView.jsx`: Stock management with `useMemo` filters, touch preset decoupling (`presetFilter`: all/pinned/unpinned), and inventory valuation (`onTogglePin`). Subcomponents in `/src/components/inventory/`:
  - `InventoryMetricsBar.jsx`: Stock valuation (retail and purchase cost) and health KPIs (Healthy/Low/Out of Stock).
  - `InventoryStockTable.jsx`: Filterable data table with 1-tap 📌 pin toggle, preset filter tabs (All/Pinned/Warehouse), `+5`/`+10` adjustment buttons, cost price, and barcode input.
  - `StockKeypadModal.jsx`: Touch numeric pad for fast stock quantity adjustment.
- `CustomerDisplayView.jsx`: Real-time LCD customer-facing display.
- `SalesHistoryView.jsx`: Sales ledger for receipt lookup, search, reprint, refunds with 2-pane Master-Detail layout (`useSalesPeriodFilter`). Subcomponents in `/src/components/history/`:
  - `ReceiptInspectorPanel.jsx`: Left pane live thermal receipt preview with reprint & refund triggers.
  - `SalesPeriodBar.jsx`: Preset chips (Today/Yesterday/Week/Month/Year/Custom), `< >` steppers, calendar triggers.
  - `SalesLedgerTable.jsx`: Paginated receipt ledger table (search, doc filter, refund triggers, active highlight, 15 rows/page).
- `AnalyticsView.jsx`: Financial KPI cards, period selector, CSV export, chart breakdowns (`useSalesPeriodFilter`). Subcomponents in `/src/components/history/`:
  - `SalesPeriodBar.jsx`: Period filters with stepper navigation.
  - `SalesAnalyticsCharts.jsx`: 4 KPI cards (Gross, Netto/VAT, Receipts/AOV, Payments), Top 8 Products ranking, Rush-Hour chart (07:00–22:00), payment split bar (Cash/Card/QR), category sales volume bars, Czech VAT table (21%, 12%, 0%).
  - `MultiPeriodComparison.jsx`: Side-by-side comparative dashboard at bottom of Analytics for Last 30 Days, Last 12 Weeks, Last 12 Months with volume bars, averages, and transaction counts (`src/utils/periodAggregator.js`).
- `SettingsView.jsx`: Master-Detail sidebar (`.settings-view-container`), left 250px vertical rail, right 2-column grid (`.settings-grid-layout`), auto-save (`saveConfigField` onBlur, `saveConfigBatch` onChange) with toast (`.settings-save-toast`). Subcomponents in `/src/components/settings/`:
  - `StoreProfileSection.jsx`: Left: identity, address, IČO/DIČ. Right: default VAT 21%/12%/0%, IBAN for QR, language bar.
  - `LayoutSection.jsx`: Left: preset columns Auto/3/4/5/6, button size S/M/L, style left-stripe/color-fill/modern-card/modern-glass, showPresetVat toggle, catalog shortcut. Right: cart position left/right, cart item style elevated-card/divided-row/rounded-tile, high-legibility mode, button animation mode (instant vs animated), customer LCD title & auto-sleep.
  - `PrinterSection.jsx`: Left: device selector + live badges. Right: 58mm vs 80mm selector, auto-print switch, drawer kick pulse, drawer status. Links to ReceiptSection for design.
  - `ReceiptSection.jsx`: Dedicated receipt customizer with 5 cards (Oddělovače & Písmo, Hlavička & Údaje, Položky & DPH, Okraje & Kódování, QR & Patička) including separator spacing, custom header text, item VAT/discount toggles, and sticky live thermal paper preview (`ReceiptPreviewPaper.jsx`) with snug 80mm/58mm selector, interactive scenario toolbar (Normal/Refund, Cash/Card/Split/QR, EET simulation, QR demo, Copy 1/2 switcher) and test print trigger.

  - `TerminalSection.jsx`: Left: Manual vs Automated ČSOB/Ingenico Move 3500 selector. Right: network IP/port/TID, ping test, daily reconciliation.
  - `SecuritySection.jsx`: Left: Admin mode toggle card, Admin PIN modal trigger. Right: cashier PIN, inactivity auto-lock selector.
  - `BackupSection.jsx`: Left: JSON backup export/import, database reset. Right: Litestream replication status, update checker, EET 2.0 toggle.
  - `DiagnosticsSection.jsx`: Left: live thermal paper receipt preview with store header, VAT, SPD QR, footer, test buttons. Right: hardware checklist (backend, printer, drawer, terminal, LCD, EET) + shift sales summary with 1-tap thermal daily report.

## Core Register Components
- `Cart.jsx`: Shopping basket (420px width), memoized totals (`calculateCartTotals`), active selection, note badges, line modifier, configurable `cartItemStyle` (`elevated-card`, `divided-row`, `rounded-tile`), header action chips (`.clear-cart-btn`), 38px steppers, bottom cash drawer button. Subcomponents in `/src/components/cart/`:
  - `CartItemInspector.jsx`: Side-docked inspector drawer overlapping Presets column. Instant quantity (+1, +2, +5, +10, stepper), discounts (-5%, -10%, -20%, -50%), price override, item notes/modifiers, deletion.
- `QuickPresetGrid.jsx`: Fast product tile touch grid with `useMemo` search/category filters. Category pills, search; edit mode toolbar with category management (`.preset-edit-cat-btn`), drag-to-delete Trash Can dropzone (`.preset-trash-dropzone`), "Hotovo" exit. Subcomponents in `/src/components/presets/`:
  - `CategoryFilterBar.jsx`: Wrapping category filter pills (`flex-wrap: wrap`). Edit mode: drag-and-drop reorder (`onReorderCategories`), tap pill to edit, `+ Spravovat kategorie` action chip.
  - `PresetTileCard.jsx`: 4 selectable styles (`style-left-stripe` 4.5px left border on dark slate, `style-color-fill` authentic color with white `#ffffff` typography, `style-modern-card` gradient with top accent rim, `style-modern-glass` translucent glassmorphism with glow), corner icon (`.preset-corner-icon`), corner VAT text (`.preset-vat-text`). Edit mode: dashed border, tap to edit modal, drag reorder/delete.
  - `PresetModal.jsx`: 1000px studio modal. Left: details, Open Price toggle, store default VAT auto-selection, stock tracking toggle, USB barcode listener. Right: live `PresetTileCard` preview, 28-color palette + eyedropper, 100+ Lucide icons with search, photo upload.
  - `OpenPriceModal.jsx`: Numeric touch popover for open-price presets and returns (compact price card, inline backspace, 38px stepper, 44px 4×4 numpad grid, 44px submit/cancel).
  - `src/hooks/usePresetDragDrop.js`: Drag-and-drop tile reordering and keyboard arrow shifting.
- `ManualKeypad.jsx`: Touch numeric pad (`touch-action: manipulation`). Three floating card boxes in `.pos-col-left`: top Keypad card (`.keypad-card-box` 46px keys, 36px name input, inline backspace on readout) and two bottom-docked cards (`marginTop: 'auto'`) separating Parked Carts (`.keypad-parked-box`) and Shift Summary (`.keypad-stats-box`). Subcomponents in `/src/components/keypad/`:
  - `KeypadStepperBar.jsx`: 38px quantity stepper (`ChevronDown` `-1`, `ChevronUp` `+1`), `{itemMultiplier}×` badge. Stepping < 1 enters return mode (`-1×`, `-2×`); unified with `±` toggle.
  - `KeypadNumberGrid.jsx`: 4×4 numeric touch grid (`7-8-9-⌫`, `4-5-6-C`, `1-2-3-,`, `0-00-±-×`), `±` return toggle, custom product/return button.
  - `KeypadVatSelector.jsx`: Czech VAT chips (21%, 12%, 0%) with 36px touch height.
  - `ParkedCartsDrawer.jsx`: Standalone floating card (`.pos-card-box.keypad-parked-box`) holding active carts and restoring parked orders.
  - `ShiftStatsWidget.jsx`: Floating card (`.pos-card-box`: variant `'card'` for left column under keypad, variant `'slim'` for center column under presets as an independent card box) with shift revenue, cash/card split, receipt count, and compact 1-tap thermal daily report trigger.
- `inventory/`:
  - `InventoryMetricsBar.jsx`: Top KPI pill strip (tracked items, valuation, low stock filter chip, out-of-stock badge, CSV export/import triggers, 4px docked health bar).
  - `InventoryStockTable.jsx`: Sticky-header inventory table with 38px touch targets, column sorting, 1-tap pin/unpin to register, stock numpad modal trigger, quick +5/+10/+50 adds, barcode editor.
  - `StockKeypadModal.jsx`: Large touchscreen keypad modal for direct stock count entry.
  - `InventoryImportModal.jsx`: CSV import preview confirmation dialog showing update vs create item counts with sample preview.
  - `BarcodeLabelModal.jsx`: 1-click shelf label printing modal with live SVG barcode preview (EAN-13 / Code-128 via `src/utils/barcodeGenerator.js`), copies selector (1, 2, 5, 10), ESC/POS hardware print trigger, and browser print fallback.
- `PaymentModal.jsx` & `payment/`:
  - `CashPaymentPanel.jsx`: Cash checkout with 6 Czech Banknote cards (100 green, 200 orange, 500 rose, 1000 violet, 2000 teal, 5000 navy), tap tender accumulation, 4 quick coins (5, 10, 20, 50 Kč), 3x4 numpad, change banner (2.5rem, `VRÁTIT / TRẢ LẠI`), audio clicks, greedy coin breakdown (`src/utils/currencyBreakdown.js`), and 1-tap dual completion buttons (`[ ⚡ Dokončit bez tisku ]` vs `[ 🖨️ Dokončit a vytisknout ]`).
  - `CardPaymentPanel.jsx`, `QrPaymentPanel.jsx`, `SplitPaymentPanel.jsx`: Tender panels with dual 1-tap print-on-demand completion buttons (`printReceipt: false` skips ReceiptModal at 0s delay).
- `Navbar.jsx`: Clock, backend status, cart toggle, lock button, 1-click thermal daily summary, navigation tabs (`[ 🛒 Pokladna ] [ 📦 Sklad ] [ 🏷️ Katalog ] [ 📜 Historie ] [ 📊 Analytika ] [ ⚙️ Nastavení ]`).
- `CalendarModal.jsx`, `TouchCalendarModal.jsx`, `TouchDateRangeModal.jsx`: Date modals powered by `src/utils/calendarGrid.js` and `src/utils/czechHolidays.js`.
- `RefundModal.jsx`: Easy item return and storno modal triggered via scanned receipt barcode or Sales History. Features 1-tap quick action buttons (`[+ 1 ks]`, `[- 1 ks]`, `[Vrátit vše]`), remaining refundable quantity tracking (`Zbývá k vrácení: X ks`), maximum limit enforcement preventing over-refunding, header metadata badge (receipt #, timestamp, cashier, payment method), damaged/scrap waste toggle, and full multilingual support (`cs`, `vi`, `en`).
- `UnknownBarcodeModal.jsx`: 5s touch modal on unrecognized barcode at checkout. Quick registration (name, price, VAT, category) + cart insert with multiplier without leaving sales screen.

## Active Custom Hooks in `/src/hooks/`
- `useCart.js`: Active cart state, discounts, `updateItemDetails`, item modifiers.
- `usePresetDragDrop.js`: Drag-and-drop preset ordering.
- `usePosKeyboardShortcuts.js`: Hardware numpad & global USB barcode scanner listener (<70ms burst detection, EAN resolve, `qty * [scan]`, triggers UnknownBarcodeModal).
- `usePosCatalog.js`: Product categories and presets CRUD.
- `useOfflineSync.js`: EET offline queue check and sync handler.
- `useAutoLock.js`: User activity tracking and auto-lock.
- `useSalesPeriodFilter.js`: Shared period range filtering for history and analytics.

## Audio Engine & Touch Feedback (`/src/utils/audio.js`)
- HTML5 Web Audio API synthesized procedural audio cues:
  - `playScanChime()`: Rising tone (1800Hz -> 2400Hz) on item addition/barcode match.
  - `playErrorChime()`: Low buzz warning (220Hz -> 160Hz sawtooth) on error.
  - `playSuccessChime()`: Two-tone chime (880Hz / 1760Hz) on checkout/restore/hold.
  - `playCashChime()`: Multi-tone bell chime simulating physical drawer kick.
  - `playDeleteTone()`: Descending sine drop (420Hz -> 140Hz) on item deletion.
  - `playKeypadClick()`: Ultra-short tactile tick (1200Hz, 25ms) on keypad touches.
- Mute toggle in navbar, persisted in `pos_sound_enabled` localStorage.
