# Himmel POS - Core Overview

Top-level entry point for `pos-eet-himmel` project structure and system capabilities.

## Domain Memories
- System architecture and REST/WS communication protocols: `mem:architecture`
- Technology stack, dependencies, and environment setup: `mem:tech_stack`
- Python FastAPI backend architecture and routing: `mem:backend/core`
- Czech EET 2.0 fiscal signing, cryptographic security, and SOAP dispatch: `mem:backend/eet`
- Thermal printing (ESC/POS), WebSocket customer display, and QR payments: `mem:backend/hardware`
- React 19 Vite single-page application structure and state router: `mem:frontend/core`
- UI views, modals, cart management, and layout components: `mem:frontend/components`
- SQLite database models and persistence: `mem:database`
- Litestream SQLite cloud replication and WAL backup: `mem:backend/litestream`
- Security, PIN authentication, hashing, and recovery architecture: `mem:security_and_auth`
- Windows launchers, runtime environment, and operational execution: `mem:testing_and_launch`