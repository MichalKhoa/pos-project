# Frontend Components

UI components located in `/src/components`.

## Views & Layout
- `Navbar.jsx`: Header navigation bar with tabs (`Pokladna`, `Sklad`, `Katalog`, `Historie`, `Nastavení`), responsive hamburger slide-down drawer (< 900px) with 1-tap auto-close, backend latency/EET status indicator, language dropdown selector (`CS`, `VI`, `EN`), volume mute toggle (`Volume2` / `VolumeX`), Quick Lock button, theme toggle, and clock.
- `CustomerDisplayView.jsx`: Standalone customer-facing dual screen view (`/#/customer-display`) over local Wi-Fi. Features 3 dynamic states (Active Cart, Czech SPD QR Payment, Payment Success 5s auto-reset countdown), prominent top docked eye-level total bar (`4.2rem` bold font), non-wrapping 175px price columns, compact item count badge, senior-accessible font scaling, customizable store greeting/title (`customerDisplayTitle`), read-only WebSocket listener, and POS-matched slate/white theme.
- `InventoryView.jsx`: Dedicated top-level `Sklad` view with EAN barcode search, low-stock filter (`Nízká zásoba`), quick stock increment (+5, +10, +50, custom set), min stock alert level, and inline EAN code editor.
- `QuickPresetGrid.jsx`: Category filter buttons, internationalized search bar, edit mode, quantity multiplier (`⚡ 5×`), stock pills (`📦 X ks`), 48px touch color selector, quick item grid, and Admin Mode visibility gating for category & catalog edit actions.
- `PresetsCatalogView.jsx`: Full-screen product catalog and category management.
- `SalesHistoryView.jsx`: Sales ledger & analytics with subtabs (`Seznam Účtenek` vs `Analýza a Statistiky`), segmented time range filter (`Dnes`, `Včera`, `Tento týden`, `Tento měsíc`, `Tento rok`, `Vše`, `Vlastní`), stepper controls, QR code payment tracking, CSV export, EET re-send, and Admin Mode gating for test sale deletion.
- `SettingsView.jsx`: Store config, customer display title/greeting input (`customerDisplayTitle`), printer auto-scanner, paper format selector (58mm/80mm/A4), PIN lock, EET cert, ČSOB terminal setup, High-Legibility Mode toggle, 2-step Admin PIN management, backup/restore, and system update.

## Cart, Touch Keypads & Safety Components
- `Cart.jsx`: Itemized shopping cart, per-item discount trigger, quantity controls, single-line high-legibility row layout with 44px+ touch steppers, delete targets, `ClearedCartBanner` 8s countdown restore banner inside empty cart view, tax breakdown, pay button.
- `ToastUndo.jsx`: Floating 4s toast notification overlay (`Přidáno: [Název] — ZPĚT` / `Smazáno: [Název] — ZPĚT`) with animated timer progress bar for 1-tap mistake recovery.
- `CheckoutFlashBanner.jsx`: Full-width fixed top flash banner (`Zaplaceno! [Částka] Kč`) for visual checkout success chimes and error alerts with slide-down CSS animation.
- `ManualKeypad.jsx`: Touchscreen numeric keypad with `QTY × PRICE` multiplier key (`×` / `*` / `X`) and active multiplier badge.
- `TouchDateRangeModal.jsx`: Dual side-by-side touch calendar modal (`24px` rounded corners) allowing 1-continuous-flow range picking (`OD` to `DO`), glowing start/end highlights, shaded range, and quick preset pills.
- `TouchCalendarModal.jsx`: Touch-screen pop-up calendar modal (`24px` rounded corners) with 50px day touch targets, Monday-Sunday grid, 1-tap Month Grid Picker, 1-tap Year Grid Picker, and `Dnes` shortcut.
- `DateKeypadModal.jsx`: Touch numeric date keypad with instant overwrite mode and real-time live calendar date validation.

## Security & Other Modals
- `AdminPinModal.jsx`: Touch-optimized Admin PIN modal with VERIFY mode (gating Settings modification and destructive actions) and 2-step CHANGE_PIN mode (Current PIN -> New PIN -> Confirm).
- `LockScreenModal.jsx`: Touchscreen 4-digit PIN security lock overlay with physical keyboard support (`0-9`, `Backspace`, `Escape`, `C`), rate limiter, and shake animation.
- `ShutdownModal.jsx`: Shift exit & system shutdown confirmation modal with pending EET sales warning count and non-blocking backend shutdown call.
- `PaymentModal.jsx`: Multi-payment workflow (Cash change calculator, Card terminal, Czech SPD QR code tracking, Split payment, real-time Customer Display broadcasting).
- `RefundModal.jsx`: Receipt refund modal with itemized selection, partial refund, and "Poškozeno / Likvidace (Ne-naskladňovat)" checkbox.
- `ReceiptModal.jsx`: Receipt & A4 Tax Invoice preview with direct silent thermal hardware printing.
- `audio.js` (`src/utils/audio.js`): Zero-dependency Web Audio API sound manager (barcode scan chime, cash register checkout chime, low-frequency error buzz) with navbar volume toggle.

## Component Invariants & Legibility Modes
- High-Legibility Mode: DOM `data-density="high"` attribute scales catalog tiles 25% larger (min-height 84px), 18pt+ bold prices, 60px keypad keys, and 44px cart steppers.
- Parent Shield / Admin Mode: Destructive operations (delete test sales, clear all sales, category management, setting modifications) require Admin PIN authentication when `isAdminMode` is false.
- Modal Styling: Containers use `borderRadius: 24px` (`var(--radius-xl)` equivalent) with high-contrast glassmorphism dark theme.
- Touch UI Targets: Interactive buttons and cards MUST specify `touch-action: manipulation` and `-webkit-touch-callout: none`.
- PWA Support: Service Worker `public/sw.js` and manifest `public/manifest.json` enable `CacheFirst` offline launch.

## Related Memories
- Frontend architecture: `mem:frontend/core`
