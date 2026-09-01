# Himmel POS — Project Memory & Architecture Context

## Core Technologies
- **Frontend**: React + Vite + Vanilla CSS (No Tailwind). Multi-language support (CZ, VI, EN).
- **Backend**: Python FastAPI (`backend/main.py`) + SQLite (`database.py`, `models.py`).
- **Hardware Integration**: ČSOB Ingenico Move 3500 terminal TCP API, USB/Serial ESC/POS receipt printing, customer LCD display WebSocket.
- **Fiscalization**: Czech EET 2.0 PKCS#12 XML signing & SOAP playground/production communication.

## Recent Features & Enhancements

### 1. Mobile Phone / Responsive Layout (≤768px)
- **3-Column POS Register Layout** converts to a single-column view on mobile screens.
- Bottom navigation tab bar switches between:
  1. `Klávesy` (Manual Keypad)
  2. `Produkty` (Quick Preset Grid)
  3. `Košík` (Cart with live count badge)
- **Keypad Flex-Fill**: Flexbox layout fills 100% of available viewport (`100dvh` minus navbar and tab bar). Elements keep `flex: 0 0 auto` natural height while grid buttons stretch proportionally.
- Modals scale cleanly on small screens (`<=480px`).

### 2. ČSOB Business Connector Integration & Analysis
- **API Overview**: SOAP 1.1 / HTTPS with mutual TLS (X.509 client certificate).
- **Batch Processing**: Uses `GetDownloadFileList(FileType=AVIZO)` to poll payment statement files. Max rate limit: **30 calls per 20 minutes**.
- **Docs Location**: `docs/csob_docs/CSOB_INCOMING_PAYMENTS_SUMMARY.md`.

### 3. Real-Time QR Payment Verification via Bank Email Listener
- **Real-Time Verification (2–4 seconds)**: IMAP background thread (`backend/services/email_payment_listener.py`) connects to IMAP (e.g. `imap.seznam.cz:993`) over SSL.
- **Regex Parsing**: Extracts Variable Symbol (VS) and Amount from ČSOB / Czech bank incoming transaction alert emails and caches them in thread-safe `PaymentCache`.
- **POS Integration**: Frontend polls `POST /api/v1/payments/verify-qr` every 2s → auto-verifies payment and completes sale.
- **Setup Guide**: `docs/NUDAVANI_EMAIL_PLATBY_MANUAL.md`.

### 4. Modular Architecture & Testing
- **Code-Splitting**: Admin views (`SettingsView`, `SalesHistoryView`, `InventoryView`, `CustomerDisplayView`, `PresetsCatalogView`) lazy-loaded via `React.lazy()` + `<Suspense>`.
- **Custom Domain Hooks**: `useCart`, `useRegisterKeypad`, `usePosAudio`.
- **Financial Utilities**: `src/utils/tax.js` (`roundCZK`, `calculateCartTotals`, `calculateCashChange`).
- **Test Suites**: `npm run test` (`vitest` financial math suite) & `python -m unittest discover -s backend/tests -p "test_*.py"`.

## Mandatory Agent Discipline
- **Implementation Planning First**: Always start tasks by creating a phased, multi-step implementation plan (`implementation_plan.md`) and get approval before executing code changes.
- **Serena Memory Sync**: Always update `.serena/memories/` when models, routers, utilities, or architectural patterns change.
- **Codegraph Sync**: Check `codegraph_explore` before modifying symbols and ensure index stays healthy.
