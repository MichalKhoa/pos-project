# Task Memory: Native Python Cloud Sync Integration

## Status
- **Phase 0**: Architecture & Planning completed.
- **Phase 1**: Core Python S3 Service & Model Configuration (Completed & verified with 13 unit tests).
- **Phase 2**: REST API Endpoints & Security (Completed & verified with 15 unit tests).
- **Phase 3**: Frontend Settings UI & Cloud Restore Dialog (Completed & verified with 6 unit tests, 111 total frontend tests, 0 lint warnings, clean build).

## Architectural Decisions
1. **Pure Python S3 / R2 Sync**: Replaced external Litestream binary with pure Python (`boto3`). Zero external binaries to distribute, zero Windows file locking violations (`ERROR_SHARING_VIOLATION`), 100% cross-platform.
2. **SQLite Online Backup Integration**: Uploads timestamped ZIP files (`pos_backup_*.zip`) created by `sqlite3.Connection.backup()`, preserving shared-lock integrity without locking WAL files.
3. **Encrypted Credentials in DB**: `StoreConfigModel` stores cloud configuration with AES-256 encrypted secret keys using store Fernet key. Configurable directly in POS Settings UI without editing `.env`.
4. **Retention & Restore**: Automatically prunes remote backups older than retention days (default 30). Cloud restore downloads selected archive, verifies SQLite `PRAGMA quick_check`, takes local safety snapshot, and executes `init_db_schema()`.
5. **Loopback & Technician Guard**: All `/cloud-backup/*` endpoints are protected by `verify_technician_auth` enforcing loopback client IPs, origin validation, and PIN authentication.

## Phase 1 Implementation Summary
- Added `boto3>=1.34.0` to `backend/requirements.txt`.
- Added encrypted cloud backup fields to `StoreConfigModel` in `backend/models.py`.
- Implemented `CloudSyncService` in `backend/services/cloud_sync_service.py`.
- Hooked asynchronous cloud upload into `backend/services/backup_service.py` and `backend/main.py`.
- Automated tests in `backend/tests/test_cloud_sync_service.py`: 13/13 passing.

## Phase 2 Implementation Summary
- Exposed 6 REST endpoints under `/api/v1/system/cloud-backup/`:
  - `GET /status`: configuration and sync status telemetry with secret masking.
  - `POST /test`: S3/R2 connectivity test with credentials fallback.
  - `POST /configure`: saves configuration with Fernet AES-256 secret encryption.
  - `POST /upload-now`: creates local SQLite snapshot and uploads synchronously to S3.
  - `GET /backups`: lists available remote backup archives.
  - `POST /restore`: downloads remote archive, verifies SQLite `quick_check`, creates safety snapshot, restores DB, disposes pool, and runs migrations.
- Guarded all endpoints with `_auth = Depends(verify_technician_auth)` (loopback restriction, origin filtering, technician PIN check).
- Automated tests in `backend/tests/test_cloud_backup_api.py`: 15/15 passing.
- Total cloud test suite: 28/28 passing.

## Phase 3 Implementation Summary
- Added frontend API methods to `src/api/posApi.js`:
  - `fetchCloudBackupStatus(pin)`
  - `testCloudBackupConnection(payload, pin)`
  - `configureCloudBackup(payload, pin)`
  - `triggerCloudBackupUpload(pin)`
  - `fetchRemoteCloudBackups(pin)`
  - `restoreRemoteCloudBackup(filename, pin)`
- Enhanced `src/components/settings/BackupSection.jsx`:
  - Dedicated Cloud Backup Card with toggle switch, live status badge (SUCCESS/ERROR/Disabled), last sync timestamp, and AES-256 indicator.
  - Full credentials form: Endpoint URL, Bucket, Prefix, Access Key, Secret Access Key (masked with reveal toggle), Retention Days.
  - Action buttons: "Otestovat spojení" (Test Connection), "Uložit nastavení cloudu" (Save Settings), "Zálohovat do cloudu nyní" (Instant Sync).
  - Cloud Restore Dialog Modal: Browse remote S3 archives, file size/date formatting, confirmation safety prompt, loading spinner, and restore execution.
- Added localized translations across `cs`, `vi`, `en` in `src/i18n/translations.js` with 100% key parity.
- Unit tests in `src/__tests__/BackupSection.test.jsx`: 6/6 passing.
- Quality gates verified: `npm run test` (111/111 passing), `npm run lint` (0 errors, 0 warnings), `npm run build` (clean dist bundle).

