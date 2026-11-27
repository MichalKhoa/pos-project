# VoltFlow POS — System Architecture

Detailed architecture of VoltFlow POS (`pos-eet-himmel`). All diagrams are [Mermaid](https://mermaid.js.org/) and render on GitHub and in most Markdown viewers.

Contents:

1. [System context](#1-system-context)
2. [Deployment modes](#2-deployment-modes)
3. [Desktop shell (Tauri)](#3-desktop-shell-tauri)
4. [Backend](#4-backend-fastapi)
5. [Data model](#5-data-model)
6. [Frontend](#6-frontend-react-19)
7. [Key flows](#7-key-flows)
8. [Integrations](#8-integrations)
9. [Cloud and remote dashboard](#9-cloud-and-remote-dashboard)
10. [Security](#10-security)
11. [Build, packaging and CI](#11-build-packaging-and-ci)
12. [Quality gates](#12-quality-gates)

---

## 1. System context

VoltFlow is a local-first POS. The register runs entirely on one machine: a React UI talks over HTTP to a FastAPI backend on `:8000`, which owns the SQLite database and all hardware. The cloud pieces are optional.

```mermaid
flowchart LR
    Cashier([Cashier]) --> UI
    Owner([Owner]) --> Web

    subgraph Register["Register PC (local)"]
        Tauri["Tauri v2 shell<br/>(Rust)"]
        UI["React 19 UI<br/>(src/)"]
        API["FastAPI backend :8000<br/>(backend/)"]
        DB[(SQLite<br/>pos_store.db)]
        Tauri -->|hosts webview| UI
        Tauri -->|spawns sidecar| API
        UI -->|HTTP REST + WebSocket| API
        API --> DB
    end

    API -->|ESC/POS USB, serial, TCP| Printer[/Thermal printer<br/>+ RJ11 drawer/]
    API -->|TCP :20002| Terminal[/ČSOB Ingenico<br/>Move 3500/]
    API -->|serial / WebSocket| LCD[/Customer display/]
    API -->|SOAP, WS-Security| EET[(EET 2.0<br/>Finanční správa)]
    API -->|IMAP| Mail[(Bank notification<br/>mailbox)]
    API -->|Litestream / zip upload| R2[(Cloudflare R2 / S3)]
    API <-->|pull staging batches| Cloud

    subgraph Home["Home server (optional)"]
        Cloud["backend_cloud<br/>FastAPI + SQLite"]
        Web["web/ dashboard<br/>React + Router"]
        Web --> Cloud
    end
```

| Layer | Technology | Location |
| :-- | :-- | :-- |
| Desktop shell | Tauri v2, Rust | `src-tauri/` |
| Register UI | React 19, Vite, vanilla CSS, Vitest, Oxlint | `src/` |
| Backend | Python FastAPI, SQLAlchemy, SQLite (WAL) | `backend/` |
| Cloud API | FastAPI, SQLite, Docker | `backend_cloud/` |
| Remote dashboard | React 19, react-router | `web/` |
| Packaging | PyInstaller (backend), NSIS and MSI (Tauri) | `scripts/`, `backend/pos_backend.spec` |

---

## 2. Deployment modes

The same backend and UI run in three ways.

```mermaid
flowchart TB
    subgraph A["A. Native installer (production)"]
        A1[Tauri window] --> A2["pos-backend sidecar<br/>(PyInstaller onefile)"]
        A2 --> A3[(pos_store.db<br/>next to the exe)]
    end
    subgraph B["B. Scripts (source install)"]
        B1["start.bat / start.sh"] --> B2["uvicorn backend/main.py :8000"]
        B2 --> B3["serves dist/ SPA<br/>+ API on one port"]
        B1 --> B4["Edge --app / --kiosk"]
    end
    subgraph C["C. Development"]
        C1["debug.bat / debug.sh"] --> C2["Vite :5173 (HMR)"]
        C1 --> C3["FastAPI :8000 (reload)"]
        C2 -.->|API calls| C3
    end
```

| Mode | UI served by | Backend started by | Notes |
| :-- | :-- | :-- | :-- |
| A. Native installer | Tauri webview | Tauri sidecar (`pos-backend`) | Needs no Python or Node on the terminal |
| B. Scripts | FastAPI static mount of `dist/` | `start.bat` / `start.sh` | Binds `0.0.0.0` unless frozen, so LAN clients can reach it |
| C. Development | Vite dev server | `debug.*` | Backend reload when `ENV=development` |

When frozen, the backend binds `127.0.0.1` and stores data in `POS_DATA_DIR` or next to the executable. It never stores data in PyInstaller's temporary `_MEIPASS` folder.

---

## 3. Desktop shell (Tauri)

`src-tauri/src/lib.rs` owns the process lifecycle.

```mermaid
sequenceDiagram
    participant App as Tauri app
    participant Side as pos-backend sidecar
    participant Tray as System tray
    participant UI as Webview (React)

    App->>Side: is_backend_responsive(8000)?
    alt already running
        App-->>App: skip spawn
    else not running
        App->>Side: spawn_sidecar("pos-backend")
    end
    App->>Tray: build tray menu (focus, restart, quit)
    UI->>App: invoke restart_backend
    App->>Side: kill_sidecar then spawn_sidecar
    UI->>App: invoke open_customer_display
    App->>UI: new window "customer-display" at /#/customer-display
    Note over App,Side: on exit, kill_sidecar terminates the child
```

- Commands exposed to the UI: `restart_backend`, `open_customer_display`.
- `src/hooks/useTauri.js` wraps these calls and falls back to browser APIs on the web.
- Capabilities live in `src-tauri/capabilities/default.json`; window and bundle settings in `tauri.conf.json`.

---

## 4. Backend (FastAPI)

### 4.1 Layers

```mermaid
flowchart TB
    subgraph Entry["main.py"]
        Life["lifespan: daemons + shutdown"]
        CORS["CORS (LAN + tauri.localhost)"]
        SPA["static mount + SPA fallback"]
    end
    subgraph Routers["routers/ (REST + WebSocket)"]
        R1[sales] --- R2[catalog] --- R3[stock] --- R4[cash]
        R5[config] --- R6[eet] --- R7[payments] --- R8[printer]
        R9[display] --- R10[reports] --- R11[system] --- R12[updater] --- R13[qr]
    end
    subgraph Services["services/ (business logic, drivers)"]
        S1[eet_service / eet_crypto / eet_soap]
        S2[escpos_service / printer_discovery]
        S3[csob_terminal_service]
        S4[email_payment_listener / qr_bank_service]
        S5[hardware_display_service]
        S6[backup_service / cloud_sync_service]
        S7[remote_staging_sync]
        S8[pin_auth / security_utils / rate_limiter]
        S9[pohoda_export / hardware_profile]
    end
    subgraph Data["Persistence"]
        M[models.py]
        MIG[migrations.py]
        D[database.py]
        DB[(SQLite WAL)]
    end
    Entry --> Routers --> Services
    Routers --> M
    Services --> M
    M --> D --> DB
    MIG --> D
```

### 4.2 Routers and endpoints

All routers sit under `/api/v1/...`.

| Router | Prefix | Main endpoints |
| :-- | :-- | :-- |
| `sales.py` | `/sales` | `POST /` create sale, `GET /`, `GET /{id}`, `GET /by-receipt/{n}`, `PUT /{id}/refund-status`, `GET /next-receipt-number`, `GET /stats/daily`, `GET /stats/shift`, `GET /export/pohoda`, `GET /{id}/invoice-html`, `DELETE /{id}`, `DELETE /purge-all` |
| `catalog.py` | `/catalog` | categories (list, create, delete, reorder); presets (list, create, bulk, delete, reorder, toggle-pin, restock); `GET /barcode/{code}` |
| `stock.py` | `/inventory` | `POST /intake`, `GET /movements`, `GET /price-history/{id}`, write-offs, audits, deposit (returnable packaging) movements and summary |
| `cash.py` | `/cash` | `GET /current-shift`, `POST /movement`, `POST /close-shift`, print movement slip and Z-report |
| `config.py` | `/config` | `GET`/`POST` store config, `POST /verify-pin`, `POST /verify-admin-pin`, recovery code, system health, backup status |
| `eet.py` | `/eet` | `GET /status`, `POST /verify`, `POST /upload-cert`, `POST /process-queue`, `GET /audit-logs`, `GET /offline-queue`, `POST /force-resend` |
| `payments.py` | `/payments` | `POST /generate-qr-string`, `POST /verify-qr`, terminal config, ping, pay, reconcile |
| `printer.py` | `/printer` | `GET /devices`, `POST /print`, `POST /open-drawer`, daily summary, label, write-off, inventory and tax report prints |
| `display.py` | `/` | `WS /ws/customer-display`, `POST /display/broadcast` |
| `reports.py` | `/reports` | tax statement and VAT overview (JSON and HTML) |
| `system.py` | `/system` | diagnostics, logs, DB vacuum, backup and restore, export bundle, Litestream and cloud-backup control, ARES company lookup, shutdown, staging sync |
| `updater.py` | `/update` | `GET /status`, `POST /apply` |
| `qr.py` | `/qr` | offline QR generation |

`GET /api/v1/status` (also `/api/status`) is the health probe used by the Tauri shell and the UI.

### 4.3 Background daemons

Started in `lifespan` in `main.py`; all are daemon threads that stop on a shared shutdown event.

```mermaid
flowchart LR
    L[lifespan start] --> T1["DB integrity quick_check<br/>(once)"]
    L --> T2["WAL checkpoint<br/>every 15 min"]
    L --> T3["Backup zip + cloud upload<br/>every 60 min"]
    L --> T4["Email payment listener<br/>(IMAP, if configured)"]
    L --> T5["EET resend daemon<br/>(offline queue)"]
    L --> T6["Cache prewarm<br/>2 s after boot"]
    L --> T7["Remote staging sync<br/>5 s after boot, then 15 min"]
    L --> T8["Windows printer auto-resolve<br/>(nt only)"]
    X[lifespan stop] --> W["set shutdown event<br/>final WAL checkpoint"]
```

`services/hardware_profile.py` picks a hardware tier (RAM based) that sets the SQLite cache and mmap sizes and the number of months to prewarm.

### 4.4 Database lifecycle

- `database.py` resolves a freeze-safe path and opens SQLite in WAL mode; `atomic_transaction(db)` wraps multi-row writes.
- `migrations.py` runs `run_schema_migrations(engine)` on every start. It adds missing columns from the SQLAlchemy models, converts monetary columns to `Numeric`, and runs data migrations such as `migrate_pin_settings`.
- Backups: hourly zip (`backup_service`), optional cloud upload, optional continuous Litestream replication (`litestream.yml`).

---

## 5. Data model

```mermaid
erDiagram
    SALES ||--o{ SALE_ITEMS : contains
    SALES ||--o{ EET_AUDIT_LOGS : "fiscal history"
    PRESETS ||--o{ STOCK_MOVEMENTS : ledger
    STOCK_WRITE_OFFS ||--o{ STOCK_WRITE_OFF_ITEMS : contains
    PRESETS ||--o{ STOCK_WRITE_OFF_ITEMS : "written off"
    INVENTORY_AUDITS ||--o{ INVENTORY_AUDIT_ITEMS : contains
    PRESETS ||--o{ INVENTORY_AUDIT_ITEMS : counted
    CATEGORIES ||..o{ PRESETS : "grouped by (category id)"
    SHIFT_SESSIONS ||..o{ CASH_MOVEMENTS : "shift_id"

    SALES {
        string id PK "client-generated, idempotent"
        string receipt_number "year based sequence"
        datetime timestamp
        numeric total_amount "server computed"
        numeric cash_rounding
        string payment_method "cash, card, qr, split"
        json split_details
        json tax_summary "grouped VAT"
        string fik_code
        string bkp_code
        string pkp_code
        string eet_status "EVD_OK, OFFLINE_PENDING, VERIFIED_ONLY, ERROR, DISABLED"
        bool is_refund
        string original_receipt_number
        string refund_status "NONE, PARTIAL, FULL"
        numeric refunded_amount
        bool is_invoice
        string invoice_number
        string customer_ico
    }
    SALE_ITEMS {
        int id PK
        string sale_id FK
        string item_id "preset id or custom"
        string name
        numeric price
        float quantity "3 decimals"
        int vat "21, 12, 0"
        numeric discount_percent
    }
    PRESETS {
        string id PK
        string name
        numeric price
        string category
        int vat
        string barcode
        bool track_stock
        float stock_quantity
        numeric cost_price
        string unit
        bool is_weighted
        bool is_open_price
    }
    CATEGORIES {
        string id PK
        string name
        int position
        float natural_loss_norm
    }
    STOCK_MOVEMENTS {
        string id PK
        string preset_id FK
        string movement_type "RECEIPT, SALE, RETURN, WRITE_OFF, AUDIT"
        float quantity_delta
        numeric unit_cost
        string supplier_ico
        string document_ref
    }
    EET_AUDIT_LOGS {
        int id PK
        string sale_id FK
        string action "FIRST_SEND, RETRY_SEND, VERIFY"
        string status
        string error_message
    }
    SHIFT_SESSIONS {
        string id PK
        int shift_number
        numeric opening_cash
        numeric expected_cash
        numeric actual_cash
        numeric discrepancy
        bool is_closed
        int z_seq
    }
    CASH_MOVEMENTS {
        string id PK
        string shift_id
        string movement_type "FLOAT_IN, PAYOUT, SAFE_DROP"
        numeric amount
    }
    STOCK_WRITE_OFFS {
        string id PK
    }
    STOCK_WRITE_OFF_ITEMS {
        int id PK
        string write_off_id FK
        string preset_id FK
    }
    INVENTORY_AUDITS {
        string id PK
    }
    INVENTORY_AUDIT_ITEMS {
        int id PK
        string audit_id FK
        string preset_id FK
    }
```

Standalone tables with no foreign keys:

| Table | Purpose |
| :-- | :-- |
| `store_config` | Single row: store profile, DIČ, EET certificate path and encrypted password, hardware settings, PIN and lock settings, inventory toggle |
| `receipt_sequences` | Per-year receipt counter |
| `invoice_sequences` | B2B invoice counter (`FA-YYYY-NNNN`) |
| `write_off_sequences`, `inventory_audit_sequences` | Protocol number counters |
| `deposit_movements` | Returnable-packaging (deposit) ledger |
| `applied_sync_events` | Idempotency keys for batches pulled from the cloud (`INTAKE`, `PRICE_CHANGE`, `PRODUCT`) |

Money is stored as `Numeric(10, 2)`. The backend recomputes totals and the VAT summary itself and never stores client-computed values (see 7.1).

---

## 6. Frontend (React 19)

### 6.1 Structure

```mermaid
flowchart TB
    main[main.jsx] --> App[App.jsx<br/>state + view router]
    App -->|hash = #/customer-display| CDV[CustomerDisplayView]
    App --> Nav[Navbar]
    App --> Views
    subgraph Views["activeTab views"]
        V1["register<br/>Cart + QuickPresetGrid + ManualKeypad"]
        V2["presets<br/>PresetsCatalogView"]
        V3["inventory<br/>InventoryView (when enabled)"]
        V4["history<br/>SalesHistoryView"]
        V5["analytics<br/>AnalyticsView"]
        V6["settings<br/>SettingsView + sections"]
    end
    App --> Modals["AppModals: Payment, Receipt, Refund,<br/>Discount, Lock, Admin PIN, Unsent sales ..."]
    App --> Hooks
    subgraph Hooks["hooks/"]
        H1[useCart]
        H2[usePosCatalog]
        H3[useUnsentSales]
        H4[useOfflineSync]
        H5[usePosKeyboardShortcuts]
        H6[useAutoLock]
        H7[useTauri]
    end
    Hooks --> Api["api/posApi.js<br/>(~85 exported calls)"]
    Hooks --> Utils["utils/<br/>tax, money, buildSalePayload,<br/>saleSync, refundSync, storage"]
    App --> Ctx["context/<br/>StoreConfigContext, ConfirmContext"]
    Api -->|fetch| Backend[(FastAPI :8000)]
    App --> I18N["i18n/translations.js<br/>cs, vi, en"]
```

| Folder | Role |
| :-- | :-- |
| `src/App.jsx` | State container, tab router, customer-display mode switch (`#/customer-display`) |
| `src/api/posApi.js` | Single HTTP client; every backend call goes through it |
| `src/hooks/` | `useCart` (lines addressed by `lineId`, parked carts, undo toast), `usePosCatalog`, `useUnsentSales`, `useOfflineSync`, `usePosKeyboardShortcuts`, `useAutoLock`, `useTauri` |
| `src/components/` | Cart, keypad, payment panels, receipt, history, inventory, settings sections, modals |
| `src/utils/` | Money and VAT math (`tax.js`, `money.js`), sale payload (`buildSalePayload.js`), sync state (`saleSync.js`, `refundSync.js`), receipt HTML, barcode, storage wrapper |
| `src/context/` | `StoreConfigContext` (store config), `ConfirmContext` (confirm dialogs) |
| `src/i18n/` | cs, vi, en dictionary |
| `src/styles/`, `*.css` | Vanilla CSS with design tokens (no Tailwind) |

### 6.2 Client-side sale state

A sale made on the register is kept locally until the server accepts it. `saleSync.js` defines the state.

```mermaid
stateDiagram-v2
    [*] --> PENDING: sale completed on register
    PENDING --> SYNCED: server 201 or ALREADY_EXISTS
    PENDING --> REJECTED: server 4xx (e.g. TOTAL_MISMATCH)
    PENDING --> PENDING: server unreachable (retry every 30 s)
    PENDING --> STRANDED: found locally, missing on server after restart
    STRANDED --> SYNCED: manual resend ("Odeslat")
    REJECTED --> SYNCED: manual resend after review
    SYNCED --> [*]
```

Only `SYNCED` sales can be refunded (`canRefund`). `PENDING`, `STRANDED`, `REJECTED` and EET-pending sales are never trimmed from local storage (`isLocalOnly`). The queue stays in `localStorage` because the backend is a local sidecar: "offline" means the process is down, and the server-side `ALREADY_EXISTS` check makes replays safe.

---

## 7. Key flows

### 7.1 Completing a sale

```mermaid
sequenceDiagram
    actor C as Cashier
    participant UI as React UI
    participant LS as localStorage
    participant API as POST /api/v1/sales
    participant EET as eet_service
    participant DB as SQLite
    participant PR as Printer / drawer

    C->>UI: add items, choose payment
    UI->>UI: buildSalePayload (client id, totals, cash rounding)
    UI->>LS: store sale as PENDING
    UI->>API: POST sale + X-Idempotency-Key
    API->>API: idempotency cache hit? return cached
    API->>DB: sale id exists? return ALREADY_EXISTS
    API->>API: reject zero quantity (422 ZERO_QUANTITY)
    API->>API: assign receipt number, invoice number if B2B
    API->>API: recalculate_sale_totals (server VAT, Decimal)
    alt client total differs
        API->>API: accept only cash within 0.50 and whole koruna
        API-->>UI: else 422 TOTAL_MISMATCH
    end
    API->>API: reject paid sale that totals 0 (ZERO_TOTAL)
    opt EET enabled
        API->>EET: sign_and_submit_sale (PKP, BKP, SOAP)
        EET-->>API: FIK, or OFFLINE_PENDING
    end
    API->>DB: atomic_transaction: sale, items, stock deduction, stock movements
    API-->>UI: 201 SUCCESS (receipt number, fik, eet_status)
    UI->>LS: mark SYNCED
    UI->>PR: print receipt, pulse drawer (cash)
```

Server-side guarantees: totals and `tax_summary` always come from the server; the sale id is idempotent; stock changes and the sale row commit in one transaction.

### 7.2 Refund

```mermaid
flowchart LR
    A[Pick original receipt<br/>GET /sales/by-receipt/N] --> B[Choose lines and qty]
    B --> C["Build storno sale<br/>is_refund = true<br/>negative amounts"]
    C --> D[POST /sales]
    D --> E[PUT /sales/original/refund-status<br/>PARTIAL or FULL + refunded_amount]
    E --> F{restock and inventory on?}
    F -->|yes| G[stock +qty, movement RETURN]
    F -->|no| H[done]
```

Cash refunds are rounded like cash sales (3.50 paid as 4 is refunded as 4, rounding noted). If the original-sale update fails, `refundSync.js` keeps the update owed and retries it.

### 7.3 EET fiscalization

```mermaid
flowchart TD
    S[Sale accepted] --> E{EET enabled?}
    E -->|no| D[eet_status = DISABLED]
    E -->|yes| P["Sign: PKP RSA-SHA256 (PKCS#12)<br/>BKP SHA-1 of PKP"]
    P --> N{Send SOAP<br/>WS-Security}
    N -->|FIK received| OK[EVD_OK]
    N -->|network error| Q[OFFLINE_PENDING<br/>is_sent_to_eet = false]
    N -->|rejected| ERR[ERROR]
    Q --> Dm[eet_resend_daemon<br/>or POST /eet/process-queue]
    Dm --> N
    P --> L[(eet_audit_logs)]
    N --> L
```

### 7.4 Payment methods

```mermaid
flowchart LR
    Pay[PaymentModal] --> Cash[Cash panel<br/>change, rounding, drawer pulse]
    Pay --> Card[Card panel]
    Pay --> QR[QR panel]
    Pay --> Split[Split panel<br/>cash + card + qr]
    Card -->|terminal enabled| T["POST /payments/terminal/pay<br/>csob_terminal_service (TCP)"]
    Card -->|terminal off| M[manual card confirmation]
    QR --> G["POST /payments/generate-qr-string<br/>Czech SPD QR"]
    G --> V["email_payment_listener (IMAP)<br/>match VS + amount in 2-4 s"]
    V --> OKQ[POST /payments/verify-qr]
```

### 7.5 Customer display

```mermaid
sequenceDiagram
    participant Reg as Register UI
    participant API as FastAPI display router
    participant CD as Customer display
    CD->>API: WS /api/v1/ws/customer-display
    Reg->>API: POST /api/v1/display/broadcast (cart, totals)
    API-->>CD: push message
    Note over CD: Route /customer-display. Second Tauri window, a phone on the LAN,<br/>or a serial LCD via hardware_display_service
```

---

## 8. Integrations

| Integration | Code | Protocol |
| :-- | :-- | :-- |
| ESC/POS printer and RJ11 drawer | `services/escpos_service.py`, `printer_discovery.py`, `routers/printer.py` | USB, serial (9600 or 115200), TCP `:9100`, Windows spooler (`WIN32`) |
| ČSOB Ingenico Move 3500 | `services/csob_terminal_service.py`, `routers/payments.py` | TCP, default port 20002 |
| QR payment verification | `services/email_payment_listener.py`, `qr_bank_service.py` | SPD string, IMAP |
| EET 2.0 | `services/eet_crypto.py`, `eet_soap.py`, `eet_service.py`, `eet_resend_daemon.py` | SOAP, WS-Security 1.0, PKCS#12; playground and production |
| Customer LCD | `services/hardware_display_service.py`, `routers/display.py` | serial, WebSocket |
| Pohoda accounting | `services/pohoda_export.py` | XML export from `GET /sales/export/pohoda` |
| ARES company lookup | `routers/system.py` (`/ares/{ico}`) | HTTPS |
| Backups | `services/backup_service.py`, `cloud_sync_service.py`, `litestream.yml` | zip, S3 or R2, Litestream |

Reference material for these lives in `docs/eet_docs/`, `docs/csob_docs/` and `docs/guides/`.

---

## 9. Cloud and remote dashboard

Optional Phase 2 (see `docs/plans/REMOTE_WEB_DASHBOARD_PLAN.md`). The owner prepares products, price changes and supplier intakes remotely; the register pulls them.

```mermaid
sequenceDiagram
    participant Owner
    participant Web as web/ dashboard
    participant Cloud as backend_cloud
    participant Reg as Register backend
    participant DB as pos_store.db

    Owner->>Web: log in (JWT), enter intake, price change, product
    Web->>Cloud: POST /staging/...
    Cloud->>Cloud: store in staged_intakes / staged_price_changes / staged_products
    loop boot + 5 s, then every 15 min
        Reg->>Cloud: pull pending batches
        Reg->>DB: apply with idempotency key (applied_sync_events)
        Reg->>DB: recompute weighted average purchase price
        Reg->>Cloud: acknowledge batch
    end
```

| Component | Content |
| :-- | :-- |
| `backend_cloud/` | Routers `auth`, `dashboard`, `analytics`, `staging`, `exports`, `catalog`; services `email_fetcher`, `isdoc_parser`, `ocr_service`; `snapshot_service.py`; Dockerfile and `docker-compose.yml` (port 8000, `./data` volume) |
| `web/` | Pages: Overview, Analytics, Catalog, Intake, Tax exports, Z-reports; `LoginModal`; `api/cloudApi.js` |

---

## 10. Security

- **PINs**: two independent, toggleable locks (lock screen and Admin PIN), off until the owner enables them. No built-in default PIN, PUK or master key. PINs are stored salted (scrypt); legacy hashes are upgraded on next successful entry. A recovery code is shown once. A master key works only if `POS_MASTER_ADMIN_KEY` (16+ characters) is set in the environment. See `docs/plans/BATCH_G_SECURITY_PLAN.md`. Enforcement is UI-side (audit item C1 stays open).
- **Rate limiting**: `services/rate_limiter.py` limits PIN attempts per client IP.
- **CORS**: allow-list from `ALLOWED_ORIGINS`, else localhost, `tauri.localhost` and private LAN ranges. Allowed headers include `X-Admin-PIN`, `X-Admin-Override`, `X-Idempotency-Key`.
- **Path traversal**: the SPA fallback checks that every served path stays inside `dist/`.
- **Secrets**: the EET certificate password is stored encrypted in `store_config` and decrypted on use.
- **Financial integrity**: server-side VAT recalculation, idempotent sale ids, atomic transactions.
- **Audits**: `docs/audit/` (findings, fix recommendations, flow maps) and `docs/guides/SECURITY_AUDIT.md`.

---

## 11. Build, packaging and CI

```mermaid
flowchart LR
    Src[backend/ + requirements] -->|PyInstaller<br/>pos_backend.spec| Bin["pos-backend-standalone<br/>(onefile or onedir)"]
    Bin -->|scripts/prepare_sidecar.py<br/>target-triple rename| Side[src-tauri/binaries/]
    UI[src/ + Vite] -->|npm run build| Dist[dist/]
    Dist --> Tauri[tauri build]
    Side --> Tauri
    Tauri --> NSIS["VoltFlow-POS-Setup.exe (NSIS)"]
    Tauri --> MSI[VoltFlow-POS.msi]
    Tag[git tag v*] -->|.github/workflows/release-windows.yml| Tauri
```

Build scripts live in `scripts/build/` (`build_standalone.*`, `build_windows_release.bat`). Auxiliary tools (kiosk, service install with NSSM, stop, hardware preflight, customer display) are in `scripts/tools/`.

---

## 12. Quality gates

| Gate | Command |
| :-- | :-- |
| Frontend tests (Vitest) | `npm run test` |
| Frontend lint (Oxlint) | `npm run lint` |
| Production build | `npm run build` |
| Backend tests (unittest) | `python -m unittest discover -s backend/tests -p "test_*.py"` |
| Cloud backend tests | `backend_cloud/tests/` |

Sale payload parity between client and server is covered by contract fixtures (`backend/tests/fixtures/sales/`, `test_sale_contract`).
