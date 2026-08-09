# Backend Hardware Integration

Hardware drivers & protocols for thermal receipt printers, ČSOB card terminals, customer displays, and barcode scanners.

## Thermal Printer Driver (`/backend/services/escpos_service.py` & `/backend/routers/printer.py`)
- Direct USB POS printer support (`/dev/usb/lp0`, `USB`, `RAW`).
- Network ESC/POS printer support via TCP socket (`RAW_SOCKET`, port 9100).
- Windows Spooler driver support (`WIN32RAW` / `win32print`).
- Dynamic ESC/POS paper width formatting: 80mm (`48` chars per line) vs 58mm (`32` chars per line).
- Automatic printer discovery scanner (`GET /api/v1/printer/scan`): Scans local subnets (`192.168.x.x:9100`) and USB ports (`/dev/usb/lp*`, COM ports) in parallel with a 1.5s socket timeout.
- Cut command: `\x1b\x69` (ESC/POS full cut).
- Cash drawer kick command: `\x1b\x70\x00\x19\xfa` (Pin 2 pulse) broadcast on cash checkout.

## ČSOB Payment Terminal Driver (`/backend/services/csob_terminal_service.py` & `/backend/routers/csob_terminal.py`)
- TCP/IP protocol driver for ČSOB Ingenico / Verifone Ethernet payment terminals.
- Commands: Sale request (`SALE`), Cancellation (`CANCEL`), Terminal Status (`STATUS`), Daily Settlement (`CLOSING`).
- Non-blocking socket timeout with structured response parsing (`status`: `APPROVED`, `DECLINED`, `TIMEOUT`, `ERROR`).
- Status polling endpoint (`GET /api/v1/csob/status`) for real-time payment progress.

## Czech Bank QR Code Generator (`/backend/services/qr_bank_service.py` & `/backend/routers/qr.py`)
- Generates official Czech Banking Association (ČBA) Short Payment Descriptor (SPD v1.0) QR codes offline without external API dependencies.
- QR format: `SPD*1.0*ACC:[IBAN]*AM:[AMOUNT]*CC:CZK*X-VS:[VS]*MSG:[MESSAGE]`.
- Endpoints:
  - `/api/v1/qr/spd`: Resolves merchant IBAN from database `StoreConfigModel.bank_account_iban`, sanitizes string parameters, and returns raw `image/png` binary stream.
  - `/api/v1/qr/status`: Real-time payment arrival checking against email listener cache.

## Secondary Customer Display WebSocket Broadcaster (`/backend/routers/display.py`)
- Standalone HTML5 customer screen accessible at `http://<SERVER_IP>:8000/#/customer-display`.
- Real-time bidirectional WebSocket synchronization (`/api/v1/ws/customer-display`).
- Read-only listener mode on client WS connections; state updates are broadcast strictly via internal REST endpoint (`POST /api/v1/display/broadcast`).
- Displays 3 states: Active cart items with top total bar, Czech SPD QR code for mobile banking payments, and Payment Success 5s auto-reset countdown.
- Power & Sleep Management: WakeLock API (`navigator.wakeLock.request('screen')`) keeps screen active during sales. Integrated Fully Kiosk JS API (`window.fully.turnScreenOff()` / `turnScreenOn()`) automatically powers down physical display backlight after configurable standby delay when backend closes.
