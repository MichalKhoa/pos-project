# Native Python Cloud Sync Integration Plan

Replace external Litestream binary with a 100% pure Python S3/Cloudflare R2 cloud sync engine. Eliminates platform warnings, Windows file sharing conflicts (`ERROR_SHARING_VIOLATION`), and external binary management by directly uploading VoltFlow's native SQLite online backup ZIPs (`pos_backup_*.zip`) to any S3-compatible cloud storage.

## User Review Required

> [!IMPORTANT]
> - **Dependency**: Adds `boto3>=1.34.0` to `backend/requirements.txt`. `boto3` is the official, pure Python AWS/S3 SDK, fully cross-platform (Windows, Linux, macOS) and PyInstaller-compatible.
> - **Credential Security**: Secret Access Key is encrypted at rest using the store's Fernet AES-256 key (same pattern as EET certificate passwords in `StoreConfigModel`).
> - **Zero Disruption to Checkout**: Local snapshot uses `sqlite3.Connection.backup()` (native C API with shared read lock) and uploads asynchronously in a background thread so the cashier register never pauses.

---

## Phase Breakdown & Kickoff Prompts

### Phase 1: Core Python S3 Service & Model Configuration
- **Objective**: Add cloud sync fields to `StoreConfigModel`, implement `CloudSyncService` in `backend/services/cloud_sync_service.py`, and hook auto-upload into the hourly backup loop.
- **Files Touched**:
  - `backend/requirements.txt`
  - `backend/models.py`
  - `backend/services/cloud_sync_service.py` [NEW]
  - `backend/services/backup_service.py`
  - `backend/main.py`
  - `backend/tests/test_cloud_sync_service.py` [NEW]
- **Verification**: `python -m unittest discover -s backend/tests -p "test_cloud_sync*.py" | tokless`
- **Kickoff Prompt for Fresh Chat**:
  ```text
  Implement Phase 1 of the Native Python Cloud Sync as documented in docs/plans/NATIVE_PYTHON_CLOUD_SYNC_PLAN.md:
  Add boto3 to backend/requirements.txt, add encrypted cloud backup fields to StoreConfigModel in backend/models.py, implement backend/services/cloud_sync_service.py (test_connection, upload_backup, prune_remote, list_remote, download_and_restore), wire background upload into backend/services/backup_service.py and backend/main.py, and write automated unit tests in backend/tests/test_cloud_sync_service.py. Verify tests with tokless.
  ```

---

### Phase 2: REST API Endpoints & Security
- **Objective**: Expose secure technician endpoints in `backend/routers/system.py` for testing connection, configuring credentials, manual upload trigger, remote backup listing, and 1-click cloud restore.
- **Files Touched**:
  - `backend/routers/system.py`
  - `backend/tests/test_cloud_backup_api.py` [NEW]
- **Verification**: `python -m unittest discover -s backend/tests -p "test_cloud_backup*.py" | tokless`
- **Kickoff Prompt for Fresh Chat**:
  ```text
  Implement Phase 2 of the Native Python Cloud Sync as documented in docs/plans/NATIVE_PYTHON_CLOUD_SYNC_PLAN.md:
  Expose /api/v1/system/cloud-backup/status, /test, /configure, /upload-now, /backups, and /restore in backend/routers/system.py with verify_technician_auth loopback security and safety snapshot restore logic. Write unit tests in backend/tests/test_cloud_backup_api.py. Verify tests with tokless.
  ```

---

### Phase 3: Frontend Settings UI & Cloud Restore Dialog
- **Objective**: Upgrade `BackupSection.jsx` in Settings modal to configure Cloudflare R2 / AWS S3 / MinIO, show live sync status, test connection, and browse/restore cloud backups.
- **Files Touched**:
  - `src/api/posApi.js`
  - `src/components/settings/BackupSection.jsx`
  - `src/i18n/translations.js` (Czech, Vietnamese, English)
  - `src/__tests__/BackupSection.test.jsx` [NEW]
- **Verification**: `npm run test | tokless` and `npm run build | tokless`
- **Kickoff Prompt for Fresh Chat**:
  ```text
  Implement Phase 3 of the Native Python Cloud Sync as documented in docs/plans/NATIVE_PYTHON_CLOUD_SYNC_PLAN.md:
  Add cloud backup API calls to src/api/posApi.js, enhance src/components/settings/BackupSection.jsx with R2/S3 credentials form, test connection button, instant sync button, and cloud backup restore picker modal. Add translations to src/i18n/translations.js (cs, vi, en). Verify with npm run test and npm run build.
  ```

---

## Detailed Proposed Architecture

### 1. Database Model Additions (`backend/models.py`)
In `StoreConfigModel`:
- `cloud_backup_enabled = Column(Boolean, default=False)`
- `cloud_backup_endpoint = Column(String, default="")` (e.g. `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`)
- `cloud_backup_bucket = Column(String, default="himmel-pos-backups")`
- `cloud_backup_access_key = Column(String, default="")`
- `cloud_backup_secret_key = Column(String, default="")` (Encrypted via `get_decrypted_cloud_secret()`)
- `cloud_backup_prefix = Column(String, default="store_01")`
- `cloud_backup_retention_days = Column(Integer, default=30)`
- `cloud_backup_last_sync = Column(String, default="")`
- `cloud_backup_last_status = Column(String, default="")`
- `cloud_backup_last_error = Column(String, default="")`

### 2. Core Service (`backend/services/cloud_sync_service.py`)
```python
class CloudSyncService:
    def test_connection(self, endpoint, bucket, access_key, secret_key) -> dict: ...
    def upload_backup_file(self, local_zip_path: str) -> dict: ...
    def list_remote_backups(self) -> list: ...
    def prune_remote_backups(self, retention_days: int = 30) -> int: ...
    def download_and_restore(self, remote_filename: str) -> dict: ...
```
- **S3 Compatibility**: Works transparently with Cloudflare R2, AWS S3, MinIO, Wasabi, Backblaze B2.
- **Asynchronous Upload**: Uploads run in background worker thread, logging errors without blocking local operations.
- **Safe Restore Flow**:
  1. Downloads remote ZIP to temporary directory.
  2. Extracts and verifies SQLite integrity (`PRAGMA quick_check`).
  3. Takes pre-restore safety snapshot of active local DB.
  4. Disposes connection pool (`engine.dispose()`).
  5. Replaces `pos_store.db` and purges `-wal`/`-shm`.
  6. Runs `init_db_schema()` to ensure any schema diffs are migrated.

---

## Verification Plan

### Automated Tests
- Backend Unit Tests:
  ```powershell
  python -m unittest discover -s backend/tests -p "test_cloud_*.py" | tokless
  ```
- Full Test Suite:
  ```powershell
  python -m unittest discover -s backend/tests -p "test_*.py" | tokless
  npm run test | tokless
  npm run lint | tokless
  npm run build | tokless
  ```

### Manual Verification
1. Open POS Settings → Cloud Backup.
2. Enter mock / real R2 credentials → click "Test Connection" → verify green success toast.
3. Click "Zálohovat do cloudu" → verify backup ZIP uploaded to R2 bucket.
4. Click "Obnovit z cloudu" → verify remote backups list renders and selected restore passes integrity check.
