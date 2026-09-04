# Litestream Database Replication

Litestream real-time SQLite database replication and backup manager.

## Config & Files
- Config file: [backend/litestream.yml](file:///home/misko/Documents/pos-eet-himmel/backend/litestream.yml)
- Database path: `backend/pos_store.db` (WAL mode enabled)
- Launcher integration: `VoltFlow_POS.bat` silently runs `litestream.exe replicate -config backend/litestream.yml`

## Features & Invariants
- Real-time WAL streaming (sync interval 1s, snapshot interval 24h, 72h retention).
- S3 / Cloudflare R2 object storage endpoint configuration.
- Health monitoring endpoint: `GET /api/v1/system/litestream-status` returns replication daemon state, WAL active state, and file sizes.
- Visual health badge in [SettingsView.jsx](file:///home/misko/Documents/pos-eet-himmel/src/components/SettingsView.jsx).

## Related Memories
- Database schema and persistence: `mem:database`
- Backend core router setup: `mem:backend/core`
