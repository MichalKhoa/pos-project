# System Architecture

High-level component interaction and communication layers in VoltFlow POS.

## Core Flow
- **Frontend Register**: React 19 SPA running on Vite (default port 5173). Manages cart, item selection, discounts, and payment workflows.
- **Backend API**: Python FastAPI application (default port 8000). Handles sales persistence, EET signature generation, receipt thermal printing, and external customer display streaming.
- **Database**: SQLite database (`pos_store.db`) accessed via SQLAlchemy ORM.
- **Hardware Integration**: Direct USB/Serial/Network printing via `python-escpos` and real-time display updates via WebSockets `/api/v1/ws/customer-display`.

## Key Communication Protocols
- REST APIs (`/api/v1/*`): Sales ledger, printer commands, EET status, bank QR verification, catalog management.
- WebSockets: Real-time itemized stream sent to external customer display monitors.
- SOAP/XML: Czech EET 2.0 fiscal envelope transmission to Finanční správa ČR servers.

## Key References
- FastAPI application entry and router registration: `mem:backend/core`
- Frontend state orchestration and API layer: `mem:frontend/core`