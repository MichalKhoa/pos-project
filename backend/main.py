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
from database import engine, Base
from migrations import run_schema_migrations
from routers import sales, printer, display, payments, eet, catalog, updater, config, qr, system

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
run_schema_migrations(engine)

from contextlib import asynccontextmanager
import threading
import time

_shutdown_event = threading.Event()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Startup SQLite integrity quick check
    from database import check_db_integrity, run_wal_checkpoint
    if check_db_integrity():
        logger.info("SQLite database PRAGMA quick_check: OK")
    else:
        logger.critical("SQLite database PRAGMA quick_check FAILED!")

    # 2. Periodic WAL Checkpoint daemon (every 15 minutes, checks shutdown event)
    def _wal_checkpoint_loop():
        while not _shutdown_event.is_set():
            if _shutdown_event.wait(timeout=900):
                break
            try:
                run_wal_checkpoint()
            except Exception as e:
                logger.warning(f"Error in WAL checkpoint loop: {e}")

    wal_thread = threading.Thread(target=_wal_checkpoint_loop, daemon=True)
    wal_thread.start()

    # 3. Hourly Automated Database Backup daemon (every 60 minutes)
    def _hourly_backup_loop():
        from services.backup_service import create_database_backup
        while not _shutdown_event.is_set():
            if _shutdown_event.wait(timeout=3600):
                break
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

    yield

    # Graceful shutdown sequence
    logger.info("Himmel POS Backend shutting down gracefully...")
    _shutdown_event.set()
    try:
        run_wal_checkpoint()
    except Exception:
        pass
    logger.info("Shutdown WAL checkpoint and cleanup completed.")


app = FastAPI(
    title="Himmel POS Backend API",
    description="Python FastAPI backend for POS register sales database, ESC/POS hardware printing, customer LCD display, and Czech EET 2.0 / QR payment verification.",
    version="1.0.0",
    lifespan=lifespan
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
app.include_router(system.router)


# Single-Process Production Serving: Serve compiled React dist/ static assets dynamically
import mimetypes
mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("text/css", ".css")

from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

dist_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "dist"))
assets_dir = os.path.join(dist_dir, "assets")

# Ensure assets dir exists so mount does not fail
os.makedirs(assets_dir, exist_ok=True)
app.mount("/assets", StaticFiles(directory=assets_dir), name="static_assets")

@app.get("/api/v1/status")
@app.get("/api/status")
def status_check():
    return {
        "status": "ONLINE",
        "app": "Himmel POS Python FastAPI Backend",
        "docs_url": "/docs",
        "version": "1.0.0"
    }

@app.get("/{full_path:path}", include_in_schema=False)
async def serve_spa(full_path: str):
    # Allow API endpoints to pass through if unhandled
    if full_path.startswith("api/") or full_path.startswith("docs") or full_path.startswith("openapi.json"):
        raise HTTPException(status_code=404, detail="API endpoint not found")
        
    file_path = os.path.normpath(os.path.join(dist_dir, full_path))
    if full_path and os.path.exists(file_path) and os.path.isfile(file_path):
        media_type, _ = mimetypes.guess_type(file_path)
        return FileResponse(file_path, media_type=media_type)

    index_file = os.path.join(dist_dir, "index.html")
    if os.path.exists(index_file):
        headers = {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        }
        return FileResponse(index_file, media_type="text/html", headers=headers)

    return {
        "status": "ONLINE",
        "app": "Himmel POS Python FastAPI Backend",
        "docs_url": "/docs",
        "version": "1.0.0",
        "notice": "Frontend build (dist/index.html) missing. Run 'npm run build' to generate static UI."
    }


if __name__ == "__main__":
    import os
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8000))
    is_dev = os.getenv("ENV", "production").lower() == "development"
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    
    kwargs = {
        "host": host,
        "port": port,
        "reload": is_dev,
    }
    if is_dev:
        kwargs["reload_dirs"] = [
            os.path.join(backend_dir, "routers"),
            os.path.join(backend_dir, "services")
        ]
        kwargs["reload_includes"] = ["main.py", "database.py", "models.py"]
        
    uvicorn.run("main:app", **kwargs)

