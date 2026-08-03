# 🌐 Himmel POS — Network Security & Multi-Register Scaling Guide

**Document Version:** 1.0.0  
**Target:** Transitioning from Single Kiosk (`localhost`) to Multi-Device / LAN Architecture

---

## 🔒 1. API Authentication & Network Access Control (Audit Finding C1)

### Current Architecture (Local Kiosk Mode)
- **Host Binding:** `127.0.0.1:8000` (loopback only).
- **Security Invariant:** External devices on LAN cannot reach port 8000.
- **Risk Level:** **LOW** for single dedicated cashier machine.

### Scaling Requirement (Multi-Device / Wireless Tablets / LAN Access)
When binding backend to `0.0.0.0:8000` or exposing API across store network:

1. **API Key Middleware (`X-API-Key`)**
   - Require shared or per-register secret header on all `/api/v1/*` requests.
   - Validate header in FastAPI middleware via `os.getenv("POS_API_KEY")`.
2. **Role-Based Access Control (RBAC)**
   - Cashier Role: Create sale, view catalog, print receipt.
   - Manager Role: Config edit, certificate upload, refund processing.
   - Admin Role: Sales deletion, system shutdown.
3. **JWT Session Authentication**
   - Issued upon successful PIN verification (`/api/v1/config/verify-pin`).
   - Short-lived tokens (e.g. 8-hour shift duration) with automatic expiration on lock screen.

---

## 🗄️ 2. Database Scaling (SQLite → PostgreSQL)

### Current Architecture
- SQLite file database (`pos_store.db`) with WAL mode (`PRAGMA journal_mode=WAL;`).
- Ideal for local single-register write workloads up to ~100 writes/sec.

### Scaling Requirement (Multi-Register / Shared Database)
If multiple POS terminals write to the same central database simultaneously:
- **Limitation:** SQLite locks entire database file on writes; concurrent multi-device writes trigger `sqlite3.OperationalError: database is locked`.
- **Upgrade Path:** Switch SQLAlchemy connection string in `backend/database.py` to PostgreSQL:
  ```python
  SQLALCHEMY_DATABASE_URL = os.getenv(
      "DATABASE_URL",
      "postgresql://pos_user:password@localhost:5432/himmel_pos_db"
  )
  ```

---

## 🔐 3. Network Transport Security (TLS / HTTPS)

### Scaling Requirement
When communicating over Wi-Fi or Ethernet router:
- Transporting PIN hashes, EET certificate passwords, or transaction payloads in plain HTTP allows packet sniffing on local network.
- **Fix:** Reverse proxy (Nginx or Caddy) handling TLS termination with local CA / Let's Encrypt certificates.

---

## ⚡ 4. Rate Limiting & Anti-Brute-Force

### Scaling Requirement
- Protect API endpoints against network scanning or automated brute-force scripts.
- Implement `slowapi` rate-limiting middleware in FastAPI (e.g. 5 requests/sec per IP on sensitive routes).

---

## 📋 Recommended Action Plan for Network Expansion

| Phase | Milestone | Priority | Effort |
|-------|-----------|----------|--------|
| **Phase 1** | Add `X-API-Key` FastAPI middleware for LAN deployment | High | 1–2 hrs |
| **Phase 2** | Setup Caddy / Nginx reverse proxy for HTTPS TLS termination | Medium | 2 hrs |
| **Phase 3** | Migrate SQLAlchemy engine to PostgreSQL for multi-register setup | Optional | 4 hrs |
