# Hardware & Peripheral Integration

Hardware services and peripheral integrations in `/backend/services` and `/backend/routers`.

## Printers (`escpos_service.py`, `routers/printer.py`)
- ESC/POS thermal receipt printing for 80mm paper widths.
- Supports USB, Serial, and Network connection types using `python-escpos`.
- Prints receipt headers, itemized items with tax breakdowns, BKP/PKP EET codes, and footer notices.

## Customer Display (`routers/display.py`)
- Real-time WebSocket endpoint at `/api/v1/ws/customer-display`.
- Broadcasts current cart state (items, prices, tax totals, total amount due) to connected secondary screens.

## Czech Bank QR Payments (`qr_bank_service.py`, `routers/payments.py`)
- Generates Czech Short Payment Descriptor (SPD) string format for bank apps (`SPD*1.0*ACC:...*AM:...*CC:CZK`).
- Generates base64 QR code image payload for immediate scan on cashier screen.

## Related Memories
- Overall architecture: `mem:architecture`