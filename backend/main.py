import os
import logging

# Load environment variables from .env if present
def _load_env_file():
    for path in [os.path.join(os.path.dirname(__file__), ".env"), os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")]:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

_load_env_file()

from fastapi import FastAPI, Request, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from database import engine, Base
from routers import sales, printer, display, payments, eet, catalog, updater, config, qr

from logging.handlers import RotatingFileHandler

# Configure rotating file logging (20MB x 30 files retention = 600MB history)
logs_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logs")
os.makedirs(logs_dir, exist_ok=True)
log_file = os.path.join(logs_dir, "pos_backend.log")

file_handler = RotatingFileHandler(log_file, maxBytes=20 * 1024 * 1024, backupCount=30, encoding="utf-8")
file_handler.setFormatter(logging.Formatter("[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s"))

logging.basicConfig(level=logging.INFO, handlers=[file_handler, logging.StreamHandler()])
logger = logging.getLogger("pos-backend")

# Create database tables automatically
Base.metadata.create_all(bind=engine)

# Comprehensive Auto-migrations for existing/old SQLite database files
MIGRATIONS = [
    # Table: store_config
    ("store_config", "csob_terminal_enabled", "BOOLEAN DEFAULT 0"),
    ("store_config", "csob_terminal_ip", "VARCHAR DEFAULT ''"),
    ("store_config", "csob_terminal_port", "INTEGER DEFAULT 8888"),
    ("store_config", "csob_terminal_id", "VARCHAR DEFAULT ''"),
    ("store_config", "cashier_pin", "VARCHAR DEFAULT '1234'"),
    ("store_config", "auto_lock_minutes", "INTEGER DEFAULT 15"),
    ("store_config", "direct_hardware_print", "BOOLEAN DEFAULT 1"),
    ("store_config", "id_provozovny", "VARCHAR DEFAULT '11'"),
    ("store_config", "id_pokl", "VARCHAR DEFAULT '1'"),
    ("store_config", "eet_enabled", "BOOLEAN DEFAULT 0"),
    ("store_config", "eet_cert_path", "VARCHAR DEFAULT ''"),
    ("store_config", "eet_cert_password", "VARCHAR DEFAULT ''"),
    ("store_config", "eet_environment", "VARCHAR DEFAULT 'playground'"),
    ("store_config", "eet_mode", "INTEGER DEFAULT 0"),
    ("store_config", "printer_interface", "VARCHAR DEFAULT 'USB'"),
    ("store_config", "printer_address", "VARCHAR DEFAULT '/dev/usb/lp0'"),
    ("store_config", "printer_paper_width", "VARCHAR DEFAULT '80'"),
    # Table: sales
    ("sales", "cart_discount_percent", "FLOAT DEFAULT 0"),
    ("sales", "split_details", "VARCHAR DEFAULT ''"),
    ("sales", "eic_popl", "VARCHAR DEFAULT ''"),
    ("sales", "id_provozovny", "VARCHAR DEFAULT '11'"),
    ("sales", "id_pokl", "VARCHAR DEFAULT '1'"),
    ("sales", "is_sent_to_eet", "BOOLEAN DEFAULT 1"),
    ("sales", "eet_retry_count", "INTEGER DEFAULT 0"),
    ("sales", "is_refund", "BOOLEAN DEFAULT 0"),
    ("sales", "original_receipt_number", "VARCHAR DEFAULT ''"),
    ("sales", "refund_reason", "VARCHAR DEFAULT ''"),
    ("sales", "refund_status", "VARCHAR DEFAULT 'NONE'"),
    ("sales", "refunded_amount", "FLOAT DEFAULT 0"),
    # Table: sale_items
    ("sale_items", "discount_percent", "FLOAT DEFAULT 0"),
    # Table: catalog_presets
    ("catalog_presets", "is_open_price", "BOOLEAN DEFAULT 0"),
    ("catalog_presets", "color", "VARCHAR DEFAULT '#3b82f6'"),
    ("catalog_presets", "sort_order", "INTEGER DEFAULT 0"),
    # Table: presets
    ("presets", "stock_quantity", "INTEGER DEFAULT 0"),
    ("presets", "track_stock", "BOOLEAN DEFAULT 0"),
    ("presets", "min_stock_alert", "INTEGER DEFAULT 5"),
    ("presets", "barcode", "VARCHAR DEFAULT ''"),
    # Table: store_config
    ("store_config", "bank_account_iban", "VARCHAR DEFAULT 'CZ6508000000001234567890'"),
    ("store_config", "default_language", "VARCHAR DEFAULT 'cs'"),
]

# SAFETY: table/col/col_type are hardcoded tuple constants, never user input.
with engine.connect() as conn:
    for table, col, col_type in MIGRATIONS:
        try:
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"))
            conn.commit()
        except Exception:
            pass

app = FastAPI(
    title="Himmel POS Backend API",
    description="Python FastAPI backend for POS register sales database, ESC/POS hardware printing, customer LCD display, and Czech EET 2.0 / QR payment verification.",
    version="1.0.0"
)

# Enable CORS for React frontend (Vite & LAN network clients)
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "")
allowed_origins = [origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()]
if not allowed_origins:
    allowed_origins = ["*"]


app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-API-Key", "X-Admin-Override"],
)


# Include API Routers
app.include_router(sales.router)
app.include_router(catalog.router)
app.include_router(config.router)
app.include_router(eet.router)
app.include_router(printer.router)
app.include_router(display.router)
app.include_router(payments.router)
app.include_router(updater.router)
app.include_router(qr.router)


@app.on_event("startup")
def startup_event():
    # 1. Startup SQLite integrity quick check
    from database import check_db_integrity, run_wal_checkpoint
    if check_db_integrity():
        logger.info("SQLite database PRAGMA quick_check: OK")
    else:
        logger.critical("SQLite database PRAGMA quick_check FAILED!")

    # 2. Periodic WAL Checkpoint daemon (every 15 minutes)
    import threading, time
    def _wal_checkpoint_loop():
        while True:
            time.sleep(900)
            try:
                run_wal_checkpoint()
            except Exception as e:
                logger.warning(f"Error in WAL checkpoint loop: {e}")

    wal_thread = threading.Thread(target=_wal_checkpoint_loop, daemon=True)
    wal_thread.start()

    # 3. Hourly Automated Database Backup daemon (every 60 minutes)
    def _hourly_backup_loop():
        from services.backup_service import create_database_backup
        while True:
            time.sleep(3600)
            try:
                create_database_backup()
            except Exception as e:
                logger.warning(f"Error in hourly database backup daemon: {e}")

    backup_thread = threading.Thread(target=_hourly_backup_loop, daemon=True)
    backup_thread.start()

    try:
        from services.email_payment_listener import start_email_listener_from_env
        start_email_listener_from_env()
    except Exception as e:
        logger.warning(f"Failed to start bank email listener: {e}")

    try:
        from services.eet_resend_daemon import start_eet_resend_daemon
        start_eet_resend_daemon()
    except Exception as e:
        logger.warning(f"Failed to start EET resend daemon: {e}")


# Single-Process Production Serving: Serve compiled React dist/ static assets if directory exists
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

dist_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "dist"))

@app.get("/api/v1/status")
@app.get("/api/status")
def status_check():
    return {
        "status": "ONLINE",
        "app": "Himmel POS Python FastAPI Backend",
        "docs_url": "/docs",
        "version": "1.0.0"
    }

if os.path.exists(dist_dir):
    assets_dir = os.path.join(dist_dir, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="static_assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        file_path = os.path.join(dist_dir, full_path)
        if full_path and os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        index_file = os.path.join(dist_dir, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        return FileResponse(file_path)

    logger.info(f"Production static UI files served from {dist_dir}")
else:
    @app.get("/")
    def root():
        return {
            "status": "ONLINE",
            "app": "Himmel POS Python FastAPI Backend",
            "docs_url": "/docs",
            "version": "1.0.0",
            "notice": "Frontend build (dist) missing. Run 'npm run build' to generate static UI."
        }


@app.get("/api/v1/system/litestream-status")
def get_litestream_status():
    """Returns Litestream database replication status and SQLite WAL metrics."""
    import sys, subprocess, os
    backend_dir = os.path.dirname(os.path.abspath(__file__))
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

    from database import DB_PATH
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


@app.get("/api/v1/system/backup-status")
def get_system_backup_status():
    """Returns local database backup metrics, WAL metrics, and last backup timestamp."""
    from services.backup_service import get_backup_status
    return get_backup_status()


@app.post("/api/v1/system/trigger-backup")
def trigger_manual_backup():
    """Manual 1-click snapshot trigger from Settings UI."""
    from services.backup_service import create_database_backup
    res = create_database_backup()
    if res.get("status") == "ERROR":
        raise HTTPException(status_code=500, detail=res.get("message"))
    return res




@app.post("/api/v1/system/shutdown")
def shutdown_system(request: Request):
    """Safely stop backend service & terminal windows on cashier request."""
    # Security check: Enforce loopback caller restriction
    client_host = request.client.host if request.client else ""
    if client_host not in ("127.0.0.1", "::1", "localhost", "testclient"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Shutdown endpoint is restricted to localhost callers."
        )

    import os, subprocess, threading
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
            config = db.query(StoreConfigModel).first()
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
            import sys
            if sys.platform == "win32":
                # Target POS launcher terminal windows and app instances (avoiding indiscriminate process kills)
                subprocess.run(["taskkill", "/T", "/F", "/FI", "WINDOWTITLE eq Himmel POS Web*"], shell=False, capture_output=True)
                subprocess.run(["taskkill", "/T", "/F", "/FI", "WINDOWTITLE eq Himmel POS Launcher*"], shell=False, capture_output=True)
                subprocess.run(["taskkill", "/T", "/F", "/FI", "WINDOWTITLE eq Himmel POS Kiosk Launcher*"], shell=False, capture_output=True)
                subprocess.run(["taskkill", "/F", "/IM", "msedge.exe", "/FI", "WINDOWTITLE eq http://localhost:5173*"], shell=False, capture_output=True)
                subprocess.run(["taskkill", "/F", "/IM", "msedge.exe", "/FI", "WINDOWTITLE eq Himmel POS App*"], shell=False, capture_output=True)
                subprocess.run(["taskkill", "/T", "/F", "/FI", "WINDOWTITLE eq Himmel POS Backend*"], shell=False, capture_output=True)
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





if __name__ == "__main__":
    import os
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8000))
    is_dev = os.getenv("ENV", "development").lower() == "development"
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=is_dev,
        reload_dirs=[
            os.path.join(backend_dir, "routers"),
            os.path.join(backend_dir, "services")
        ],
        reload_includes=["main.py", "database.py", "models.py"]
    )

