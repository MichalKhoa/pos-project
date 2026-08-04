# Frontend Components

UI components located in `/src/components`.

## Views & Layout
- `Navbar.jsx`: Header navigation bar with tabs (`Pokladna`, `Sklad`, `Katalog`, `Historie`, `Nastavení`), backend latency/EET status indicator, language dropdown selector (`CS`, `VI`, `EN`), Quick Lock button, theme toggle, and clock.
- `InventoryView.jsx`: Dedicated top-level `Sklad` view with EAN barcode search, low-stock filter (`Nízká zásoba`), quick stock increment (+5, +10, +50, custom set), min stock alert level, and inline EAN code editor.
- `QuickPresetGrid.jsx`: Category filter buttons, internationalized search bar, edit mode, quantity multiplier (`⚡ 5×`), stock pills (`📦 X ks` - yellow for low stock, orange for $\le 0$), 48px touch color selector, and quick item grid.
- `PresetsCatalogView.jsx`: Full-screen product catalog and category management.
- `SalesHistoryView.jsx`: Sales ledger & analytics with subtabs (`Seznam Účtenek` vs `Analýza a Statistiky`), segmented time range filter (`Dnes`, `Včera`, `Tento týden`, `Tento měsíc`, `Tento rok`, `Vše`, `Vlastní`), stepper navigation controls (`‹` / `›`), QR code payment tracking, CSV export, and EET re-send.
- `SettingsView.jsx`: Store config, printer auto-scanner, paper format selector (58mm/80mm/A4), PIN lock, EET cert, ČSOB terminal setup, backup/restore, and system update.

## Cart, Touch Keypads & Calendar Modals
- `Cart.jsx`: Itemized shopping cart, per-item discount trigger, quantity controls, tax breakdown, pay button.
- `ManualKeypad.jsx`: Touchscreen numeric keypad with `QTY × PRICE` multiplier key (`×` / `*` / `X`) and active multiplier badge.
- `TouchDateRangeModal.jsx`: Dual side-by-side touch calendar modal (`24px` rounded corners) allowing 1-continuous-flow range picking (`OD` to `DO`), glowing start/end highlights, shaded range, and quick preset pills.
- `TouchCalendarModal.jsx`: Touch-screen pop-up calendar modal (`24px` rounded corners) with 50px day touch targets, Monday-Sunday grid, 1-tap Month Grid Picker, 1-tap Year Grid Picker, and `Dnes` shortcut.
- `DateKeypadModal.jsx`: Touch numeric date keypad with instant overwrite mode and real-time live calendar date validation (leap year February checks, max month days).

## Security & Other Modals
- `LockScreenModal.jsx`: Touchscreen 4-digit PIN security lock overlay with physical keyboard support (`0-9`, `Backspace`, `Escape`, `C`), rate limiter, and shake animation.
- `PaymentModal.jsx`: Multi-payment workflow (Cash change calculator, Card terminal, Czech SPD QR code tracking, Split payment).
- `RefundModal.jsx`: Receipt refund modal with itemized selection, partial refund, and "Poškozeno / Likvidace (Ne-naskladňovat)" checkbox.
- `ReceiptModal.jsx`: Receipt & A4 Tax Invoice preview with direct silent thermal hardware printing.
- `audio.js` (`src/utils/audio.js`): Zero-dependency Web Audio API sound manager (barcode scan chime, checkout success sound, error alert) with enable/disable toggle in Settings.

## Component Invariants
- Modal components (`RefundModal.jsx`, `DiscountModal.jsx`, `LockScreenModal.jsx`, `TouchDateRangeModal.jsx`, etc.): MUST define all React hooks unconditionally at top of component before any conditional early returns.
- Modal Styling: Containers use `borderRadius: 24px` (`var(--radius-xl)` equivalent) with high-contrast glassmorphism dark theme.
- Touch UI Targets: Interactive buttons and cards MUST specify `touch-action: manipulation` and `-webkit-touch-callout: none`.
- PWA Support: Service Worker `public/sw.js` and manifest `public/manifest.json` enable `CacheFirst` offline launch.

## Related Memories
- Frontend architecture: `mem:frontend/core`
