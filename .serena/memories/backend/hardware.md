# Hardware & Peripheral Integration

Hardware services and peripheral integrations in `/backend/services` and `/backend/routers`.

## Printers (`escpos_service.py`, `routers/printer.py`)
- ESC/POS thermal receipt and A4 tax invoice printing for 58mm, 80mm, and A4 paper formats.
- Device Auto-Discovery (`detect_connected_printers()`): Scans USB nodes (`/dev/usb/lp*`), TTY serial ports (`/dev/ttyUSB*`, `/dev/ttyACM*`), CUPS printers (`lpstat -p`), Network IPs, and virtual browser print.
- Backend API Endpoint `GET /api/v1/printer/devices` returns discovered hardware printers.
- Supports direct silent hardware printing (`direct_hardware_print: true`) bypassing browser popups.
- Prints receipt headers, itemized items with tax breakdowns, BKP/PKP EET codes, and footer notices.

## Customer Display (`routers/display.py`)
- Real-time WebSocket endpoint at `/api/v1/ws/customer-display`.
- Broadcasts current cart state (items, prices, tax totals, total amount due) to connected secondary screens.

## Czech Bank QR Payments (`qr_bank_service.py`, `routers/payments.py`)
- Generates Czech Short Payment Descriptor (SPD) string format for bank apps (`SPD*1.0*ACC:...*AM:...*CC:CZK`).
- Generates base64 QR code image payload for immediate scan on cashier screen.

## Related Memories
- Overall architecture: `mem:architecture`