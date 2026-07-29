# Frontend Components

UI components located in `/src/components`.

## Views & Layout
- `Navbar.jsx`: Header navigation bar with backend status indicator, active tab toggles, and clock.
- `QuickPresetGrid.jsx`: Category filter buttons and quick-select item grid for cashier register.
- `PresetsCatalogView.jsx`: Category and product catalog management interface.
- `SalesHistoryView.jsx`: Sales ledger with search, date filter, status badges, receipt viewer, CSV export, and EET re-send.
- `SettingsView.jsx`: Store configuration, printer settings, EET certificate settings, and backup/restore.

## Cart & Keypads
- `Cart.jsx`: Itemized shopping cart, per-item discount trigger, quantity controls, tax breakdown, pay button.
- `ManualKeypad.jsx`: Touchscreen numeric keypad for custom price/SKU entry.

## Modals
- `PaymentModal.jsx`: Multi-payment workflow (Cash change calculator, Card terminal, Czech SPD QR code, Split payment).
- `ReceiptModal.jsx`: Thermal receipt preview with print trigger.
- `DiscountModal.jsx`: Custom percentage/amount discount entry.
- `CategoryManagerModal.jsx`, `RefundModal.jsx`, `CalendarModal.jsx`, `ShutdownModal.jsx`, `PendingSyncModal.jsx`.

## Component Invariants
- Modal components (`RefundModal.jsx`, `DiscountModal.jsx`, etc.): MUST define all React hooks (`useState`, `useEffect`) unconditionally at top of component before any conditional early returns (`if (!isOpen) return null;`) to satisfy React Rules of Hooks.

## Related Memories
- Frontend architecture: `mem:frontend/core`