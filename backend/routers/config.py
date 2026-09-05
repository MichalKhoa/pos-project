import os
import hashlib
from fastapi import APIRouter, Depends, HTTPException, Request
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
    storeName: Optional[str] = None
    street: Optional[str] = None
    city: Optional[str] = None
    ico: Optional[str] = None
    dic: Optional[str] = None
    registerNo: Optional[str] = None
    defaultVat: Optional[int] = None
    receiptFooter: Optional[str] = None
    bankAccountIban: Optional[str] = None
    printerInterface: Optional[str] = None
    printerAddress: Optional[str] = None
    printerPaperWidth: Optional[str] = None
    idProvozovny: Optional[str] = None
    idPokl: Optional[str] = None
    eetEnabled: Optional[bool] = None
    eetEnvironment: Optional[str] = None
    csobTerminalEnabled: Optional[bool] = None
    csobTerminalIp: Optional[str] = None
    csobTerminalPort: Optional[int] = None
    csobTerminalId: Optional[str] = None
    cashierPin: Optional[str] = None
    adminPin: Optional[str] = None
    autoLockMinutes: Optional[int] = None
    directHardwarePrint: Optional[bool] = None
    defaultLanguage: Optional[str] = None
    cartPosition: Optional[str] = None
    fontSize: Optional[str] = None
    customerDisplayTitle: Optional[str] = None
    customerDisplayAutoSleep: Optional[bool] = None
    customerDisplayStandbyDelay: Optional[int] = None
    autoPrintReceipt: Optional[bool] = None
    presetGridColumns: Optional[str] = None
    presetDensity: Optional[str] = None
    presetButtonStyle: Optional[str] = None
    showPresetVat: Optional[bool] = None

    # Receipt Customization
    receiptTopMargin: Optional[int] = None
    receiptBottomMargin: Optional[int] = None
    receiptCopies: Optional[int] = None
    receiptEncoding: Optional[str] = None
    stripDiacritics: Optional[bool] = None
    receiptSeparatorStyle: Optional[str] = None
    receiptSeparatorSpacing: Optional[str] = None
    receiptTitleStyle: Optional[str] = None
    receiptBoldStoreName: Optional[bool] = None
    receiptBoldItemNames: Optional[bool] = None
    receiptBoldPrices: Optional[bool] = None
    receiptBoldTotal: Optional[bool] = None
    receiptBoldFooter: Optional[bool] = None
    receiptShowStoreContact: Optional[bool] = None
    receiptStorePhone: Optional[str] = None
    receiptStoreEmail: Optional[str] = None
    receiptVatPayerStatus: Optional[str] = None
    receiptItemDensity: Optional[str] = None
    receiptShowItemSku: Optional[bool] = None
    receiptShowItemVat: Optional[bool] = None
    receiptShowItemDiscount: Optional[bool] = None
    receiptTaxMatrixStyle: Optional[str] = None
    receiptQrCodeType: Optional[str] = None
    receiptQrCodeUrl: Optional[str] = None
    receiptShowLogo: Optional[bool] = None
    receiptLogoBase64: Optional[str] = None
    receiptCustomHeader: Optional[str] = None
    receiptFooterLines: Optional[str] = None
    receiptShowBranding: Optional[bool] = None
    receiptShowCashier: Optional[bool] = None


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
        "bankAccountIban": (config.bank_account_iban or "").strip() if config.bank_account_iban != "CZ6508000000001234567890" else "",
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
        "hasAdminPin": bool(getattr(config, 'admin_pin', None) and config.admin_pin != _hash_pin("1234")),
        "autoLockMinutes": config.auto_lock_minutes if config.auto_lock_minutes is not None else 15,
        "directHardwarePrint": config.direct_hardware_print if config.direct_hardware_print is not None else True,
        "autoPrintReceipt": getattr(config, 'auto_print_receipt', False) if getattr(config, 'auto_print_receipt', None) is not None else False,
        "presetGridColumns": getattr(config, 'preset_grid_columns', "auto") or "auto",
        "presetDensity": getattr(config, 'preset_density', "standard") or "standard",
        "presetButtonStyle": getattr(config, 'preset_button_style', "left-stripe") or "left-stripe",
        "defaultLanguage": config.default_language or "cs",
        "cartPosition": config.cart_position if getattr(config, 'cart_position', None) else "left",
        "customerDisplayTitle": getattr(config, 'customer_display_title', "Vítejte u nás") or "Vítejte u nás",
        "customerDisplayAutoSleep": getattr(config, 'customer_display_auto_sleep', True) if getattr(config, 'customer_display_auto_sleep', None) is not None else True,
        "customerDisplayStandbyDelay": getattr(config, 'customer_display_standby_delay', 10) or 10,
        "showPresetVat": getattr(config, 'show_preset_vat', True) if getattr(config, 'show_preset_vat', None) is not None else True,
        # Receipt Overhaul Fields
        "receiptTopMargin": getattr(config, 'receipt_top_margin', 1) if getattr(config, 'receipt_top_margin', None) is not None else 1,
        "receiptBottomMargin": getattr(config, 'receipt_bottom_margin', 3) if getattr(config, 'receipt_bottom_margin', None) is not None else 3,
        "receiptCopies": getattr(config, 'receipt_copies', 1) if getattr(config, 'receipt_copies', None) is not None else 1,
        "receiptEncoding": getattr(config, 'receipt_encoding', "CP852") or "CP852",
        "stripDiacritics": getattr(config, 'strip_diacritics', False) if getattr(config, 'strip_diacritics', None) is not None else False,
        "receiptSeparatorStyle": getattr(config, 'receipt_separator_style', "dashed") or "dashed",
        "receiptSeparatorSpacing": getattr(config, 'receipt_separator_spacing', "standard") or "standard",
        "receiptTitleStyle": getattr(config, 'receipt_title_style', "banner") or "banner",
        "receiptBoldStoreName": getattr(config, 'receipt_bold_store_name', True) if getattr(config, 'receipt_bold_store_name', None) is not None else True,
        "receiptBoldItemNames": getattr(config, 'receipt_bold_item_names', True) if getattr(config, 'receipt_bold_item_names', None) is not None else True,
        "receiptBoldPrices": getattr(config, 'receipt_bold_prices', True) if getattr(config, 'receipt_bold_prices', None) is not None else True,
        "receiptBoldTotal": getattr(config, 'receipt_bold_total', True) if getattr(config, 'receipt_bold_total', None) is not None else True,
        "receiptBoldFooter": getattr(config, 'receipt_bold_footer', False) if getattr(config, 'receipt_bold_footer', None) is not None else False,
        "receiptShowStoreContact": getattr(config, 'receipt_show_store_contact', True) if getattr(config, 'receipt_show_store_contact', None) is not None else True,
        "receiptStorePhone": getattr(config, 'receipt_store_phone', "") or "",
        "receiptStoreEmail": getattr(config, 'receipt_store_email', "") or "",
        "receiptVatPayerStatus": getattr(config, 'receipt_vat_payer_status', "payer") or "payer",
        "receiptItemDensity": getattr(config, 'receipt_item_density', "standard") or "standard",
        "receiptShowItemSku": getattr(config, 'receipt_show_item_sku', False) if getattr(config, 'receipt_show_item_sku', None) is not None else False,
        "receiptShowItemVat": getattr(config, 'receipt_show_item_vat', True) if getattr(config, 'receipt_show_item_vat', None) is not None else True,
        "receiptShowItemDiscount": getattr(config, 'receipt_show_item_discount', True) if getattr(config, 'receipt_show_item_discount', None) is not None else True,
        "receiptTaxMatrixStyle": getattr(config, 'receipt_tax_matrix_style', "detailed") or "detailed",
        "receiptQrCodeType": getattr(config, 'receipt_qr_code_type', "none") or "none",
        "receiptQrCodeUrl": getattr(config, 'receipt_qr_code_url', "") or "",
        "receiptShowLogo": getattr(config, 'receipt_show_logo', False) if getattr(config, 'receipt_show_logo', None) is not None else False,
        "receiptLogoBase64": getattr(config, 'receipt_logo_base64', "") or "",
        "receiptCustomHeader": getattr(config, 'receipt_custom_header', "") or "",
        "receiptFooterLines": getattr(config, 'receipt_footer_lines', "Děkujeme za váš nákup!\nReklamace možná do 14 dnů s účtenkou.") or "Děkujeme za váš nákup!\nReklamace možná do 14 dnů s účtenkou.",
        "receiptShowBranding": getattr(config, 'receipt_show_branding', True) if getattr(config, 'receipt_show_branding', None) is not None else True,
        "receiptShowCashier": getattr(config, 'receipt_show_cashier', True) if getattr(config, 'receipt_show_cashier', None) is not None else True
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
    if data.adminPin is not None:
        if len(data.adminPin) < 4 or len(data.adminPin) > 8 or not data.adminPin.isdigit():
            raise HTTPException(status_code=400, detail="Admin PIN kód musí mít 4 až 8 číslic.")
        config.admin_pin = _hash_pin(data.adminPin)
    if data.autoLockMinutes is not None: config.auto_lock_minutes = data.autoLockMinutes
    if data.directHardwarePrint is not None: config.direct_hardware_print = data.directHardwarePrint
    if data.autoPrintReceipt is not None: config.auto_print_receipt = data.autoPrintReceipt
    if data.presetGridColumns is not None: config.preset_grid_columns = data.presetGridColumns
    if data.presetDensity is not None: config.preset_density = data.presetDensity
    if data.presetButtonStyle is not None: config.preset_button_style = data.presetButtonStyle
    if data.defaultLanguage is not None: config.default_language = data.defaultLanguage
    if data.cartPosition is not None: config.cart_position = data.cartPosition
    if data.showPresetVat is not None: config.show_preset_vat = data.showPresetVat
    # Receipt Overhaul Fields
    if data.receiptTopMargin is not None: config.receipt_top_margin = data.receiptTopMargin
    if data.receiptBottomMargin is not None: config.receipt_bottom_margin = data.receiptBottomMargin
    if data.receiptCopies is not None: config.receipt_copies = data.receiptCopies
    if data.receiptEncoding is not None: config.receipt_encoding = data.receiptEncoding
    if data.stripDiacritics is not None: config.strip_diacritics = data.stripDiacritics
    if data.receiptSeparatorStyle is not None: config.receipt_separator_style = data.receiptSeparatorStyle
    if data.receiptSeparatorSpacing is not None: config.receipt_separator_spacing = data.receiptSeparatorSpacing
    if data.receiptTitleStyle is not None: config.receipt_title_style = data.receiptTitleStyle
    if data.receiptBoldStoreName is not None: config.receipt_bold_store_name = data.receiptBoldStoreName
    if data.receiptBoldItemNames is not None: config.receipt_bold_item_names = data.receiptBoldItemNames
    if data.receiptBoldPrices is not None: config.receipt_bold_prices = data.receiptBoldPrices
    if data.receiptBoldTotal is not None: config.receipt_bold_total = data.receiptBoldTotal
    if data.receiptBoldFooter is not None: config.receipt_bold_footer = data.receiptBoldFooter
    if data.receiptShowStoreContact is not None: config.receipt_show_store_contact = data.receiptShowStoreContact
    if data.receiptStorePhone is not None: config.receipt_store_phone = data.receiptStorePhone
    if data.receiptStoreEmail is not None: config.receipt_store_email = data.receiptStoreEmail
    if data.receiptVatPayerStatus is not None: config.receipt_vat_payer_status = data.receiptVatPayerStatus
    if data.receiptItemDensity is not None: config.receipt_item_density = data.receiptItemDensity
    if data.receiptShowItemSku is not None: config.receipt_show_item_sku = data.receiptShowItemSku
    if data.receiptShowItemVat is not None: config.receipt_show_item_vat = data.receiptShowItemVat
    if data.receiptShowItemDiscount is not None: config.receipt_show_item_discount = data.receiptShowItemDiscount
    if data.receiptTaxMatrixStyle is not None: config.receipt_tax_matrix_style = data.receiptTaxMatrixStyle
    if data.receiptQrCodeType is not None: config.receipt_qr_code_type = data.receiptQrCodeType
    if data.receiptQrCodeUrl is not None: config.receipt_qr_code_url = data.receiptQrCodeUrl
    if data.receiptShowLogo is not None: config.receipt_show_logo = data.receiptShowLogo
    if data.receiptLogoBase64 is not None: config.receipt_logo_base64 = data.receiptLogoBase64
    if data.receiptCustomHeader is not None: config.receipt_custom_header = data.receiptCustomHeader
    if data.receiptFooterLines is not None: config.receipt_footer_lines = data.receiptFooterLines
    if data.receiptShowBranding is not None: config.receipt_show_branding = data.receiptShowBranding
    if data.receiptShowCashier is not None: config.receipt_show_cashier = data.receiptShowCashier

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


@router.post("/verify-admin-pin")
def verify_admin_pin(request: Request, data: PinVerifyRequest, db: Session = Depends(get_db)):
    """Verify technician/admin PIN against hashed value in database or master recovery key."""
    from services.rate_limiter import pin_rate_limiter
    client_ip = request.client.host if request.client else "127.0.0.1"
    pin_rate_limiter.check_rate_limit(client_ip)

    # 1. Master Recovery Key check
    master_key = os.getenv("POS_MASTER_ADMIN_KEY", "VOLTFLOW-ADMIN-MASTER-RECOVERY")
    if data.pin.strip() == master_key:
        return {"status": "SUCCESS", "valid": True, "is_master": True}

    config = db.query(StoreConfigModel).first()
    stored = (getattr(config, 'admin_pin', None) or getattr(config, 'cashier_pin', None) or "1234") if config else "1234"

    # Backward compat / plaintext check
    if not _is_hashed(stored):
        if data.pin == stored:
            if config:
                config.admin_pin = _hash_pin(stored)
                db.commit()
            return {"status": "SUCCESS", "valid": True}
        pin_rate_limiter.record_failed_attempt(client_ip)
        raise HTTPException(status_code=401, detail="Nesprávný Admin PIN kód")

    if _hash_pin(data.pin) == stored:
        return {"status": "SUCCESS", "valid": True}

    pin_rate_limiter.record_failed_attempt(client_ip)
    raise HTTPException(status_code=401, detail="Nesprávný Admin PIN kód")


@router.get("/system/health")
def get_system_health():
    """Returns detailed diagnostic health metrics of backend server and database."""
    import os, datetime
    try:
        import psutil
    except ImportError:
        psutil = None
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

    # PUK Format: VOLTFLOW-<ICO>-MASTER or fallback VOLTFLOW-RECOVERY-99 (with legacy HIMMEL-* support)
    ico_val = config.ico if config and config.ico else '12345678'
    valid_puks = {
        f"VOLTFLOW-{ico_val}-MASTER",
        "VOLTFLOW-RECOVERY-99",
        f"HIMMEL-{ico_val}-MASTER",
        "HIMMEL-RECOVERY-99"
    }

    if puk_clean in valid_puks:
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


