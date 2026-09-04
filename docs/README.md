# VoltFlow POS — Documentation & Operational Guides

Welcome to the comprehensive technical documentation and operational guides for **VoltFlow POS** (`pos-eet-himmel`).

---

## 📂 Documentation Map

```
docs/
├── README.md                          # Documentation index (this file)
├── guides/                            # Operator & Administrator Manuals
│   ├── CASHIER_SETUP_GUIDE.md         # Daily cashier touch workflows & register usage
│   ├── CSOB_TERMINAL_GUIDE.md         # ČSOB Ingenico Move 3500 terminal TCP configuration
│   ├── REALTIME_QR_EMAIL_VERIFICATION_GUIDE.md # Bank email listener instant QR verification
│   ├── SCALING_AND_NETWORK_SECURITY.md# Multi-register networking & firewall configuration
│   ├── LITESTREAM_R2_SETUP.md         # Off-site real-time SQLite database replication to S3/R2
│   └── WINDOWS_SERVICE_SETUP.md       # Windows background service administration
├── eet_docs/                          # Official Czech EET 2.0 Specifications & Metodika
│   ├── markdown/                      # Converted Markdown EET documentation
│   └── convert_pdf_to_md.py           # Converter script for incoming Ministry PDF documents
├── csob_docs/                         # ČSOB Business Connector technical specifications
├── plans/                             # Architecture & Implementation Roadmaps
│   ├── DONE_DATABASE_SAFETY_PLAN.md   # SQLite schema auto-migrations & safety invariants
│   ├── DONE_EET_HARDENING_PLAN.md     # EET 2.0 cryptographic signing & SOAP dispatch
│   ├── DONE_INVENTORY_IMPLEMENTATION_PLAN.md # Inventory ledger & stock tracking
│   └── DONE_STABILITY_AND_QUALITY_PLAN.md    # Test coverage & touch ergonomics standards
└── TOKEN_TRACKING.md                  # Development telemetry & token optimization guide
```

---

## 📘 Quick Reference: Operations & Setup Guides

### 1. Cashier Operations (`docs/guides/CASHIER_SETUP_GUIDE.md`)
- Touchscreen 4x4 keypad with ± Vratka (return) mode.
- Preset item selection, category switching, and quick Czech VAT tier buttons (21%, 12%, 0%).
- Completing transactions via Cash (with change calculation), Card, QR, and Split tenders.

### 2. ČSOB Terminal Integration (`docs/guides/CSOB_TERMINAL_GUIDE.md`)
- Connecting the Ingenico Move 3500 payment terminal via local TCP/IP network.
- Protocol commands: amount passing, transaction approval, merchant copy printing.
- Troubleshooting communication timeouts and switching to manual card entry mode.

### 3. Real-Time QR Payment Verification (`docs/guides/REALTIME_QR_EMAIL_VERIFICATION_GUIDE.md`)
- Setting up the background IMAP listener for instant payment validation (2–4 seconds).
- Supported email providers (Seznam.cz, Gmail, Outlook) and bank notification formats.
- Testing and debugging incoming Variable Symbol (VS) and amount parsing.

### 4. Database Security & Off-Site Replication (`docs/guides/LITESTREAM_R2_SETUP.md`)
- Real-time continuous replication of SQLite `pos_store.db` using Litestream.
- Backing up to Cloudflare R2 or Amazon S3 with zero downtime and point-in-time recovery.

### 5. Czech EET 2.0 Technical Standard (`docs/eet_docs/`)
- PKCS#12 (`.p12`) taxpayer certificate management.
- RSA-SHA256 PKP (Podpisový Kód Poplatníka) signature generation.
- SHA-1 BKP (Bezpečnostní Kód Poplatníka) security code formatting.
- WS-Security 1.0 SOAP envelope dispatch with offline queue fallback.
