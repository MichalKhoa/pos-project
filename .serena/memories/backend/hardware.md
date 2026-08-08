# Hardware & Peripheral Integration

Hardware services and peripheral integrations in `/backend/services` and `/backend/routers`.

## Printers (`escpos_service.py`, `routers/printer.py`)
- ESC/POS thermal receipt and A4 tax invoice printing for 58mm, 80mm, and A4 paper formats.
- Device Auto-Discovery (`detect_connected_printers()`): Scans USB nodes (`/dev/usb/lp*`), TTY serial ports (`/dev/ttyUSB*`, `/dev/ttyACM*`), CUPS printers (`lpstat -p`), Network IPs, and virtual browser print.
- Backend API Endpoint `GET /api/v1/printer/devices` returns discovered hardware printers.
- Supports direct silent hardware printing (`direct_hardware_print: true`) bypassing browser popups.
- Prints receipt headers, itemized items with tax breakdowns, BKP/PKP EET codes, and footer notices.

## Customer Display (`routers/display.py`, `routers/qr.py`)
- Real-time WebSocket endpoint at `/api/v1/ws/customer-display` and REST broadcast endpoint `POST /api/v1/display/broadcast`.
- Streams current cart state (items, quantities, prices, tax totals, total amount due), payment QR states, and payment completion status to connected secondary phone/LCD screens over local Wi-Fi.
- **Security Controls**: WebSocket connection operates in read-only listener mode for customer devices; unauthorized incoming WebSocket pushes are ignored. REST broadcast endpoint verifies payload structure.
- **Server IBAN Protection**: `/api/v1/qr/spd` automatically resolves merchant IBAN directly from database `store_config` table to prevent QR payment spoofing.
- **Customizable Greeting**: `customer_display_title` field in `StoreConfigModel` allows editable greetings (e.g. "Vítejte u Táty").

## Czech Bank QR Payments (`qr_bank_service.py`, `routers/qr.py`)
- Generates Czech Short Payment Descriptor (SPD) string format for bank apps (`SPD*1.0*ACC:...*AM:...*CC:CZK`).
- Generates base64 QR code image payload for immediate scan on cashier or secondary customer screen.

## Related Memories
- Overall architecture: `mem:architecture`