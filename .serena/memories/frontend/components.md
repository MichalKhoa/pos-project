# Frontend Components

UI components located in `/src/components`.

## Views & Layout
- `Navbar.jsx`: Header navigation bar with backend status indicator, active tab toggles, language dropdown selector (`CS`, `VI`, `EN`), streamlined Quick Lock icon button, theme toggle, and clock.
- `QuickPresetGrid.jsx`: Category filter buttons, internationalized search bar, edit mode toggles, and quick-select item grid for cashier register (touch keypad limit 10 chars).
- `PresetsCatalogView.jsx`: Category and product catalog management interface.
- `SalesHistoryView.jsx`: Sales ledger with search, date filter, status badges, receipt viewer, CSV export, and EET re-send.
- `SettingsView.jsx`: Store configuration, hardware printer device auto-scanner, paper format selector (58mm / 80mm / A4), direct HW print toggle, cashier PIN & auto-lock timeout, EET certificate settings, CSOB terminal setup, and backup/restore.

## Cart & Keypads
- `Cart.jsx`: Itemized shopping cart, per-item discount trigger, quantity controls, tax breakdown, pay button.
- `ManualKeypad.jsx`: Touchscreen numeric keypad for custom price/SKU entry (up to 999,999.99 Kč capacity).

## Modals
- `LockScreenModal.jsx`: Touchscreen 4-digit PIN security lock overlay with physical keyboard support (`0-9`, `Backspace`, `Escape`, `C`) and shake animation on invalid PIN entry.
- `PaymentModal.jsx`: Multi-payment workflow (Cash change calculator, Card terminal, Czech SPD QR code, Split payment).
- `ReceiptModal.jsx`: Receipt & A4 Tax Invoice preview with direct silent thermal hardware printing and optional debug preview pop-up window trigger.
- `DiscountModal.jsx`: Custom percentage/amount discount entry.
- `CategoryManagerModal.jsx`, `RefundModal.jsx`, `CalendarModal.jsx`, `ShutdownModal.jsx`, `PendingSyncModal.jsx`.

## Component Invariants
- Modal components (`RefundModal.jsx`, `DiscountModal.jsx`, `LockScreenModal.jsx`, etc.): MUST define all React hooks (`useState`, `useEffect`) unconditionally at top of component before any conditional early returns (`if (!isOpen) return null;`) to satisfy React Rules of Hooks.

## Related Memories
- Frontend architecture: `mem:frontend/core`