# Himmel POS - Python FastAPI Backend & Hardware Integration

This directory contains the production-ready **Python FastAPI Backend Template** for `pos-eet-himmel`.

## 🚀 Features Included:
1. **Sales Ledger Database (`sqlite3` / SQLAlchemy)**: Local SQLite storage for completed sales, itemized rows, and tax breakdowns.
2. **ESC/POS Hardware Printing (`python-escpos`)**: Drivers for USB, Serial, and Network 80mm thermal receipt printers + cash drawer pulse pin trigger.
3. **Customer LCD Display Panel (`WebSockets`)**: Live streaming of cart items and total amounts to a customer-facing LCD display screen.
4. **QR Code Payment Verification Endpoint (`/api/v1/payments/verify-qr`)**: Ready-to-use template for bank API polling (Fio, ČSOB, KB, Air Bank) or payment gateway webhooks.
5. **Czech EET 2.0 Fiscal Signing (`eet_service.py`)**: Signature stub generating `FIK` and `BKP` codes.

---

## 💻 How to Run the Python Backend

### 1. Install Dependencies
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Start the Server
```bash
python3 main.py
```
Or with Uvicorn:
```bash
uvicorn main:app --reload --port 8000
```

Interactive OpenAPI Documentation will be available at:
👉 **`http://localhost:8000/docs`**

---

## 📡 API Endpoints Summary

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/sales/` | Fetch full sales ledger history |
| `POST` | `/api/v1/sales/` | Save new completed transaction & run EET signing |
| `DELETE` | `/api/v1/sales/{id}` | Delete test transaction (Admin Mode) |
| `POST` | `/api/v1/printer/print` | Trigger physical ESC/POS 80mm thermal print job |
| `WS` | `/api/v1/ws/customer-display` | Real-time WebSocket stream for Customer LCD screen |
| `POST` | `/api/v1/payments/generate-qr-string` | Generate Czech SPD format bank QR payload |
| `POST` | `/api/v1/payments/verify-qr` | Check arrival of QR bank transfer |
