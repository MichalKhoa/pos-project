import os
import sys
import subprocess
import threading
import logging
from fastapi import APIRouter, Request, HTTPException, status
from pydantic import BaseModel
from database import DB_PATH

logger = logging.getLogger("pos-system")

router = APIRouter(prefix="/api/v1/system", tags=["System Management"])


@router.get("/litestream-status")
def get_litestream_status():
    """Returns Litestream database replication status and SQLite WAL metrics."""
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    config_path = os.path.join(backend_dir, "litestream.yml")
    config_exists = os.path.exists(config_path)

    is_running = False
    try:
        if sys.platform == "win32":
            res = subprocess.run(["tasklist", "/FI", "IMAGENAME eq litestream.exe"], capture_output=True, text=True, timeout=3)
            is_running = "litestream.exe" in res.stdout
        else:
            res = subprocess.run(["pgrep", "-f", "litestream"], capture_output=True, text=True, timeout=3)
            is_running = res.returncode == 0
    except Exception:
        is_running = False

    wal_path = DB_PATH + "-wal"
    db_size = os.path.getsize(DB_PATH) if os.path.exists(DB_PATH) else 0
    wal_size = os.path.getsize(wal_path) if os.path.exists(wal_path) else 0

    return {
        "status": "SUCCESS",
        "litestream_configured": config_exists,
        "is_running": is_running,
        "wal_active": os.path.exists(wal_path),
        "db_size_bytes": db_size,
        "wal_size_bytes": wal_size,
        "message": "Litestream replikace je aktivní" if is_running else ("Konfigurace přítomna" if config_exists else "Litestream nenakonfigurován")
    }


@router.get("/backup-status")
def get_system_backup_status():
    """Returns local database backup metrics, WAL metrics, and last backup timestamp."""
    from services.backup_service import get_backup_status
    return get_backup_status()


@router.post("/trigger-backup")
def trigger_manual_backup(request: Request):
    """Manual 1-click snapshot trigger from Settings UI."""
    client_host = request.client.host if request.client else ""
    if client_host not in ("127.0.0.1", "::1", "localhost", "testclient"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Zálohování je povoleno pouze z lokální pokladny (localhost)."
        )
    from services.backup_service import create_database_backup
    res = create_database_backup()
    if res.get("status") == "ERROR":
        raise HTTPException(status_code=500, detail=res.get("message"))
    return res


class RestoreRequest(BaseModel):
    filename: str


@router.get("/backups")
def get_available_backups():
    """Returns sorted list of available database backup ZIP archives."""
    from services.backup_service import list_backups
    return list_backups()


@router.post("/restore")
def restore_backup(payload: RestoreRequest, request: Request):
    """Restores database from a selected ZIP backup archive with safety snapshot."""
    client_host = request.client.host if request.client else ""
    if client_host not in ("127.0.0.1", "::1", "localhost", "testclient"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Obnova databáze je povolena pouze z lokální pokladny (localhost)."
        )
    from services.backup_service import restore_database_from_backup
    res = restore_database_from_backup(payload.filename)
    if res.get("status") == "ERROR":
        raise HTTPException(status_code=400, detail=res.get("message"))
    return res


@router.post("/shutdown")
def shutdown_system(request: Request):
    """Safely stop backend service & terminal windows on cashier request."""
    # Security check: Enforce loopback caller restriction
    client_host = request.client.host if request.client else ""
    if client_host not in ("127.0.0.1", "::1", "localhost", "testclient"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Shutdown endpoint is restricted to localhost callers."
        )

    logger.info("Shutdown requested by cashier via POS interface.")

    # Process completion check: Flush pending offline EET sales if present
    try:
        from database import SessionLocal
        from models import SaleModel, StoreConfigModel
        from services.eet_service import CzechEETService

        db = SessionLocal()
        config = db.query(StoreConfigModel).first()
        if config and not config.eet_enabled:
            logger.info("Shutdown: EET is disabled in store config, skipping offline sales flush.")
        else:
            pending_sales = db.query(SaleModel).filter(
                (SaleModel.is_sent_to_eet == False) | (SaleModel.eet_status == "OFFLINE_PENDING")
            ).all()

            if pending_sales:
                logger.info(f"Shutdown: Flushing {len(pending_sales)} pending offline EET sales...")
            store_dict = {
                "eic_popl": config.dic if config else "CZ00000019",
                "dic": config.dic if config else "CZ00000019",
                "id_jednotky": config.id_provozovny if config else "11",
                "id_provozovny": config.id_provozovny if config else "11",
                "id_pokl": config.id_pokl if config else "1",
                "eet_cert_path": config.eet_cert_path if config else "",
                "eet_cert_password": config.get_decrypted_cert_password() if config else "",
                "eet_environment": config.eet_environment if config else "playground"
            }
            eet_svc = CzechEETService()
            for sale in pending_sales:
                sale_data = {
                    "receiptNumber": sale.receipt_number,
                    "totalAmount": sale.total_amount,
                    "taxSummary": sale.tax_summary or {},
                    "timestamp": sale.timestamp.isoformat()
                }
                res = eet_svc.sign_and_submit_sale(sale_data, store_dict)
                if res.get("eet_status") == "EVD_OK":
                    sale.fik_code = res.get("fik")
                    sale.eet_status = "EVD_OK"
                    sale.is_sent_to_eet = True
            db.commit()
        db.close()
    except Exception as e:
        logger.warning(f"Error processing pending sales during shutdown: {e}")

    def terminate():
        try:
            if sys.platform == "win32":
                # Stop Windows service cleanly if installed & active
                subprocess.run(["net", "stop", "VoltFlowPOSBackend"], shell=False, capture_output=True)
                subprocess.run(["net", "stop", "HimmelPOSBackend"], shell=False, capture_output=True)

                # Target POS launcher terminal windows and app instances (both VoltFlow and legacy Himmel)
                subprocess.run(["taskkill", "/T", "/F", "/FI", "WINDOWTITLE eq VoltFlow POS*"], shell=False, capture_output=True)
                subprocess.run(["taskkill", "/T", "/F", "/FI", "WINDOWTITLE eq Himmel POS*"], shell=False, capture_output=True)
                subprocess.run(["taskkill", "/F", "/IM", "msedge.exe", "/FI", "WINDOWTITLE eq *VoltFlow*"], shell=False, capture_output=True)
                subprocess.run(["taskkill", "/F", "/IM", "msedge.exe", "/FI", "WINDOWTITLE eq *Himmel*"], shell=False, capture_output=True)
                subprocess.run(["taskkill", "/F", "/IM", "msedge.exe", "/FI", "WINDOWTITLE eq http://localhost:5173*"], shell=False, capture_output=True)
            else:
                subprocess.run(["pkill", "-f", "vite"], shell=False, capture_output=True)
                subprocess.run(["pkill", "-f", "main.py"], shell=False, capture_output=True)
        except Exception as e:
            logger.warning(f"Error during terminal cleanup: {e}")
        finally:
            os._exit(0)

    timer = threading.Timer(0.5, terminate)
    timer.start()
    return {"status": "SUCCESS", "message": "Pokladní systém byl úspěšně ukončen."}
