# Himmel POS — Project Memory & Architecture Context

## Core Technologies
- **Frontend**: React 19 + Vite + Vanilla CSS (No Tailwind). Multi-language (CZ, VI, EN).
- **Backend**: Python FastAPI (`backend/main.py`) + SQLite (`database.py`, `models.py`).
- **Hardware**: ČSOB Ingenico Move 3500 terminal TCP API, USB/Serial ESC/POS receipt printing, customer LCD display WebSocket.
- **Fiscalization**: Czech EET 2.0 PKCS#12 XML signing & SOAP playground/production communication.

## Recent Features & Enhancements

### 1. Mobile Phone / Responsive Layout (≤768px)
- 3-column POS register converts to 1-column on mobile.
- Bottom tab bar: `Klávesy` (Keypad), `Produkty` (Presets), `Košík` (Cart + badge).
- Keypad fills `100dvh` minus navbar/tabs. Grid buttons stretch proportionally.
- Modals fit small screens (`<=480px`).

### 2. ČSOB Business Connector Integration
- SOAP 1.1 / HTTPS + mutual TLS (X.509 client certificate).
- `GetDownloadFileList(FileType=AVIZO)` poll statements. Max: **30 calls per 20 min**.
- Docs: `docs/csob_docs/CSOB_INCOMING_PAYMENTS_SUMMARY.md`.

### 3. QR Payment Verification via Bank Email Listener
- IMAP background thread (`backend/services/email_payment_listener.py`) connects SSL (e.g. `imap.seznam.cz:993`).
- Regex extracts VS + Amount from bank emails, caches in thread-safe `PaymentCache`.
- Frontend polls `POST /api/v1/payments/verify-qr` every 2s → auto-completes sale.
- Setup: `docs/NUDAVANI_EMAIL_PLATBY_MANUAL.md`.

### 4. Modular Architecture & Testing
- Admin views lazy-loaded via `React.lazy()` + `<Suspense>`.
- Domain hooks: `useCart`, `useRegisterKeypad`, `usePosAudio`.
- Financial math: `src/utils/tax.js` (`roundCZK`, `calculateCartTotals`, `calculateCashChange`).
- Tests: `npm run test` (vitest) & `python -m unittest discover -s backend/tests -p "test_*.py"`.

## Mandatory Agent Discipline
- **Implementation Planning First**: Create phased `implementation_plan.md` + get approval before code changes.
- **Serena Memory & Codegraph (Autonomous)**: Full autonomous authority to read, query, edit, and sync `.serena/memories/` and `.codegraph/` without asking. Keep memories in sync.
