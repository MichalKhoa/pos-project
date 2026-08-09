import hashlib
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from database import get_db
from models import StoreConfigModel

router = APIRouter(prefix="/api/v1/config", tags=["config"])


def _hash_pin(pin: str) -> str:
    """SHA-256 hash a PIN string."""
    return hashlib.sha256(pin.encode("utf-8")).hexdigest()


def _is_hashed(value: str) -> bool:
    """Check if value looks like a SHA-256 hex digest (64 hex chars)."""
    return len(value) == 64 and all(c in '0123456789abcdef' for c in value)


class StoreConfigSchema(BaseModel):
    storeName: Optional[str] = "Himmel Home s.r.o."
    street: Optional[str] = "Václavské náměstí 15"
    city: Optional[str] = "110 00 Praha 1"
    ico: Optional[str] = "12345678"
    dic: Optional[str] = "CZ12345678"
    registerNo: Optional[str] = "Pokladna #01"
    defaultVat: Optional[int] = 21
    receiptFooter: Optional[str] = "Děkujeme za váš nákup!"
    bankAccountIban: Optional[str] = "CZ6508000000001234567890"
    printerInterface: Optional[str] = "USB"
    printerAddress: Optional[str] = "/dev/usb/lp0"
    printerPaperWidth: Optional[str] = "80"
    idProvozovny: Optional[str] = "11"
    idPokl: Optional[str] = "1"
    eetEnabled: Optional[bool] = False
    eetEnvironment: Optional[str] = "playground"
    csobTerminalEnabled: Optional[bool] = False
    csobTerminalIp: Optional[str] = ""
    csobTerminalPort: Optional[int] = 8888
    csobTerminalId: Optional[str] = ""
    cashierPin: Optional[str] = "1234"
    autoLockMinutes: Optional[int] = 15
    directHardwarePrint: Optional[bool] = True
    defaultLanguage: Optional[str] = "cs"
    cartPosition: Optional[str] = "left"
    customerDisplayTitle: Optional[str] = "Vítejte u nás"
    customerDisplayAutoSleep: Optional[bool] = True
    customerDisplayStandbyDelay: Optional[int] = 10


@router.get("")
def get_store_config(db: Session = Depends(get_db)):
    config = db.query(StoreConfigModel).first()
    if not config:
        config = StoreConfigModel()
        db.add(config)
        db.commit()
        db.refresh(config)

    return {
        "storeName": config.store_name,
        "street": config.street,
        "city": config.city,
        "ico": config.ico,
        "dic": config.dic,
        "registerNo": config.register_no,
        "defaultVat": config.default_vat,
        "receiptFooter": config.receipt_footer,
        "bankAccountIban": config.bank_account_iban or "CZ6508000000001234567890",
        "printerInterface": config.printer_interface,
        "printerAddress": config.printer_address,
        "printerPaperWidth": config.printer_paper_width,
        "idProvozovny": config.id_provozovny or "11",
        "idPokl": config.id_pokl or "1",
        "eetEnabled": config.eet_enabled if config.eet_enabled is not None else False,
        "eetEnvironment": config.eet_environment or "playground",
        "csobTerminalEnabled": config.csob_terminal_enabled or False,
        "csobTerminalIp": config.csob_terminal_ip or "",
        "csobTerminalPort": config.csob_terminal_port or 8888,
        "csobTerminalId": config.csob_terminal_id or "",
        "hasPin": bool(config.cashier_pin and config.cashier_pin != _hash_pin("1234")),
        "autoLockMinutes": config.auto_lock_minutes if config.auto_lock_minutes is not None else 15,
        "directHardwarePrint": config.direct_hardware_print if config.direct_hardware_print is not None else True,
        "defaultLanguage": config.default_language or "cs",
        "cartPosition": config.cart_position if getattr(config, 'cart_position', None) else "left",
        "customerDisplayTitle": getattr(config, 'customer_display_title', "Vítejte u nás") or "Vítejte u nás",
        "customerDisplayAutoSleep": getattr(config, 'customer_display_auto_sleep', True) if getattr(config, 'customer_display_auto_sleep', None) is not None else True,
        "customerDisplayStandbyDelay": getattr(config, 'customer_display_standby_delay', 10) or 10
    }


@router.post("")
def update_store_config(data: StoreConfigSchema, db: Session = Depends(get_db)):
    config = db.query(StoreConfigModel).first()
    if not config:
        config = StoreConfigModel()
        db.add(config)

    if data.storeName is not None: config.store_name = data.storeName
    if data.street is not None: config.street = data.street
    if data.city is not None: config.city = data.city
    if data.ico is not None: config.ico = data.ico
    if data.dic is not None: config.dic = data.dic
    if data.registerNo is not None: config.register_no = data.registerNo
    if data.defaultVat is not None: config.default_vat = data.defaultVat
    if data.receiptFooter is not None: config.receipt_footer = data.receiptFooter
    if data.bankAccountIban is not None: config.bank_account_iban = data.bankAccountIban
    if data.printerInterface is not None: config.printer_interface = data.printerInterface
    if data.printerAddress is not None: config.printer_address = data.printerAddress
    if data.printerPaperWidth is not None: config.printer_paper_width = data.printerPaperWidth
    if data.idProvozovny is not None: config.id_provozovny = data.idProvozovny
    if data.idPokl is not None: config.id_pokl = data.idPokl
    if data.eetEnabled is not None: config.eet_enabled = data.eetEnabled
    if data.eetEnvironment is not None: config.eet_environment = data.eetEnvironment
    if data.customerDisplayTitle is not None: config.customer_display_title = data.customerDisplayTitle
    if data.customerDisplayAutoSleep is not None: config.customer_display_auto_sleep = data.customerDisplayAutoSleep
    if data.customerDisplayStandbyDelay is not None: config.customer_display_standby_delay = data.customerDisplayStandbyDelay
    if data.csobTerminalEnabled is not None: config.csob_terminal_enabled = data.csobTerminalEnabled
    if data.csobTerminalIp is not None: config.csob_terminal_ip = data.csobTerminalIp
    if data.csobTerminalPort is not None: config.csob_terminal_port = data.csobTerminalPort
    if data.csobTerminalId is not None: config.csob_terminal_id = data.csobTerminalId
    if data.cashierPin is not None:
        if len(data.cashierPin) < 4 or len(data.cashierPin) > 8 or not data.cashierPin.isdigit():
            raise HTTPException(status_code=400, detail="PIN kód musí mít 4 až 8 číslic.")
        config.cashier_pin = _hash_pin(data.cashierPin)
    if data.autoLockMinutes is not None: config.auto_lock_minutes = data.autoLockMinutes
    if data.directHardwarePrint is not None: config.direct_hardware_print = data.directHardwarePrint
    if data.defaultLanguage is not None: config.default_language = data.defaultLanguage
    if data.cartPosition is not None: config.cart_position = data.cartPosition

    db.commit()
    db.refresh(config)

    return {"status": "SUCCESS", "message": "Config stored in SQLite database successfully"}


class PinVerifyRequest(BaseModel):
    pin: str


@router.post("/verify-pin")
def verify_pin(request: Request, data: PinVerifyRequest, db: Session = Depends(get_db)):
    """Verify cashier PIN against hashed value in database with rate limiting."""
    from services.rate_limiter import pin_rate_limiter
    client_ip = request.client.host if request.client else "127.0.0.1"
    pin_rate_limiter.check_rate_limit(client_ip)

    config = db.query(StoreConfigModel).first()
    stored = config.cashier_pin if config else "1234"

    # Backward compat: if stored PIN is plaintext (not a hash), compare directly
    # and auto-upgrade to hash on success
    if not _is_hashed(stored):
        if data.pin == stored:
            # Auto-upgrade: hash the plaintext PIN in-place
            if config:
                config.cashier_pin = _hash_pin(stored)
                db.commit()
            return {"status": "SUCCESS", "valid": True}
        pin_rate_limiter.record_failed_attempt(client_ip)
        raise HTTPException(status_code=401, detail="Nesprávný PIN kód")

    if _hash_pin(data.pin) == stored:
        return {"status": "SUCCESS", "valid": True}

    pin_rate_limiter.record_failed_attempt(client_ip)
    raise HTTPException(status_code=401, detail="Nesprávný PIN kód")


@router.get("/system/health")
def get_system_health():
    """Returns detailed diagnostic health metrics of backend server and database."""
    import os, psutil, datetime
    from database import DB_PATH, check_db_integrity

    db_ok = check_db_integrity()
    wal_path = DB_PATH + "-wal"
    db_size = os.path.getsize(DB_PATH) if os.path.exists(DB_PATH) else 0
    wal_size = os.path.getsize(wal_path) if os.path.exists(wal_path) else 0

    cpu_usage = psutil.cpu_percent(interval=None) if hasattr(psutil, "cpu_percent") else 0
    ram = psutil.virtual_memory() if hasattr(psutil, "virtual_memory") else None
    disk = psutil.disk_usage(os.path.dirname(DB_PATH)) if hasattr(psutil, "disk_usage") else None

    return {
        "status": "HEALTHY" if db_ok else "DEGRADED",
        "timestamp": datetime.datetime.now().isoformat(),
        "cpu_percent": cpu_usage,
        "ram": {
            "total_mb": round(ram.total / (1024 * 1024)) if ram else 0,
            "used_mb": round(ram.used / (1024 * 1024)) if ram else 0,
            "percent": ram.percent if ram else 0
        },
        "disk": {
            "total_gb": round(disk.total / (1024 ** 3), 1) if disk else 0,
            "free_gb": round(disk.free / (1024 ** 3), 1) if disk else 0,
            "percent_used": disk.percent if disk else 0
        },
        "database": {
            "integrity": "ok" if db_ok else "corrupt",
            "db_size_bytes": db_size,
            "wal_size_bytes": wal_size
        }
    }


class PukVerifyRequest(BaseModel):
    puk: str


@router.post("/verify-puk")
def verify_puk(data: PukVerifyRequest, db: Session = Depends(get_db)):
    """Verify Master Recovery Code (PUK) to reset PIN to default '1234'."""
    config = db.query(StoreConfigModel).first()
    # Fixed Master PUK / Recovery Key derived from ICO or default
    puk_clean = data.puk.strip().upper()

    # PUK Format: HIMMEL-<ICO>-MASTER or fallback HIMMEL-RECOVERY-99
    expected_puk_1 = f"HIMMEL-{(config.ico if config and config.ico else '12345678')}-MASTER"
    expected_puk_2 = "HIMMEL-RECOVERY-99"

    if puk_clean in (expected_puk_1, expected_puk_2):
        if config:
            config.cashier_pin = _hash_pin("1234")
            db.commit()
        return {"status": "SUCCESS", "valid": True, "message": "PIN byl úspěšně vyresetován na 1234"}

    raise HTTPException(status_code=401, detail="Neplatný záchranný klíč (PUK)!")


@router.get("/backup-status")
def get_system_backup_status():
    """Returns local database backup metrics, WAL metrics, and last backup timestamp."""
    from services.backup_service import get_backup_status
    return get_backup_status()


@router.post("/trigger-backup")
def trigger_manual_backup():
    """Manual 1-click snapshot trigger from Settings UI."""
    from services.backup_service import create_database_backup
    res = create_database_backup()
    if res.get("status") == "ERROR":
        raise HTTPException(status_code=500, detail=res.get("message"))
    return res


