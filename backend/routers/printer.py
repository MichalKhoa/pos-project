from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import StoreConfigModel, PrintLogModel
from services.escpos_service import ESCPOSPrinterService, detect_connected_printers
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/printer", tags=["Hardware Printer"])


PRINT_LOG_RETENTION = 200


def _log_print_attempt(db: Session, kind: str, success: bool, message: str = ""):
    """Best-effort record of a print/debug attempt; never breaks the calling endpoint.

    Keeps only the newest PRINT_LOG_RETENTION rows — this is a live diagnostics log,
    not an audit trail, so it doesn't grow unbounded on a POS running for years.
    """
    try:
        db.add(PrintLogModel(kind=kind, success=success, message=(message or "")[:500]))
        db.commit()
        cutoff = db.query(PrintLogModel.id).order_by(PrintLogModel.id.desc()).offset(PRINT_LOG_RETENTION).limit(1).scalar()
        if cutoff is not None:
            db.query(PrintLogModel).filter(PrintLogModel.id <= cutoff).delete(synchronize_session=False)
            db.commit()
    except Exception:
        db.rollback()


@router.get("/print-log")
def get_print_log(limit: int = 20, db: Session = Depends(get_db)):
    """Recent print/debug attempts (newest first), for self-diagnosing printing problems."""
    rows = db.query(PrintLogModel).order_by(PrintLogModel.id.desc()).limit(max(1, min(limit, 100))).all()
    return {
        "attempts": [
            {
                "timestamp": row.timestamp.isoformat() if row.timestamp else None,
                "kind": row.kind,
                "success": row.success,
                "message": row.message or ""
            }
            for row in rows
        ]
    }


class PrintReceiptRequest(BaseModel):
    saleData: dict
    storeConfig: dict
    openDrawer: bool = True


import threading
import time
from typing import Optional, List, Dict, Any

_devices_cache: Optional[List[Dict[str, Any]]] = None
_devices_cache_expiry: float = 0.0
_devices_lock = threading.Lock()


def get_cached_printer_devices(ttl_seconds: float = 15.0, force_refresh: bool = False) -> List[Dict[str, Any]]:
    """Thread-safe memoization for connected hardware printer devices."""
    global _devices_cache, _devices_cache_expiry
    now = time.time()
    with _devices_lock:
        if not force_refresh and _devices_cache is not None and now < _devices_cache_expiry:
            return _devices_cache

        devices = detect_connected_printers()
        _devices_cache = devices
        _devices_cache_expiry = now + ttl_seconds
        return _devices_cache


def invalidate_printer_devices_cache():
    """Clear printer devices cache to force fresh scan."""
    global _devices_cache, _devices_cache_expiry
    with _devices_lock:
        _devices_cache = None
        _devices_cache_expiry = 0.0


@router.get("/devices")
def get_printer_devices():
    """Scan and list connected hardware printer devices."""
    devices = get_cached_printer_devices(ttl_seconds=15.0)
    return {"devices": devices}


@router.post("/print")
def print_receipt(req: PrintReceiptRequest, db: Session = Depends(get_db)):
    """Trigger physical ESC/POS thermal print job."""
    config = db.query(StoreConfigModel).first()
    interface = config.printer_interface if config else "USB"
    address = config.printer_address if config else "/dev/usb/lp0"

    printer_service = ESCPOSPrinterService(interface_type=interface, address=address)
    res = printer_service.print_receipt(req.saleData, req.storeConfig, req.openDrawer)

    if isinstance(res, dict):
        _log_print_attempt(db, "receipt", bool(res.get("success")), res.get("error", "") if not res.get("success") else res.get("status", ""))
        if not res.get("success"):
            raise HTTPException(status_code=500, detail=res.get("error", "Failed to print to hardware thermal printer"))
        return {
            "status": res.get("status", "PRINTED"),
            "physical": res.get("physical", False),
            "receiptNumber": req.saleData.get("receiptNumber")
        }

    if not res:
        raise HTTPException(status_code=500, detail="Failed to print to hardware thermal printer")

    return {"status": "PRINTED", "physical": True, "receiptNumber": req.saleData.get("receiptNumber")}


class PreviewReceiptRequest(BaseModel):
    saleData: dict
    storeConfig: dict


@router.post("/preview")
def preview_receipt(req: PreviewReceiptRequest):
    """Debug tool: render the exact ESC/POS output for the given settings, no hardware touched."""
    printer_service = ESCPOSPrinterService("DUMMY")
    res = printer_service.preview_receipt(req.saleData, req.storeConfig)
    return {"lines": res.get("lines", [])}


class OpenDrawerRequest(BaseModel):
    storeConfig: dict = {}


@router.post("/open-drawer")
def open_cash_drawer(req: OpenDrawerRequest = OpenDrawerRequest(), db: Session = Depends(get_db)):
    """Trigger physical ESC/POS pulse signal to release the cash drawer."""
    config = db.query(StoreConfigModel).first()
    interface = config.printer_interface if config else "USB"
    address = config.printer_address if config else "/dev/usb/lp0"

    printer_service = ESCPOSPrinterService(interface_type=interface, address=address)
    res = printer_service.open_cash_drawer(req.storeConfig)

    if isinstance(res, dict):
        _log_print_attempt(db, "open-drawer", bool(res.get("success")), res.get("error", "") if not res.get("success") else res.get("status", ""))
    if isinstance(res, dict) and not res.get("success"):
        raise HTTPException(status_code=500, detail=res.get("error", "Failed to open cash drawer"))

    return {"status": res.get("status", "OPENED"), "physical": res.get("physical", False), "success": True}


class PrintRulerRequest(BaseModel):
    storeConfig: dict = {}


@router.post("/print-ruler")
def print_ruler(req: PrintRulerRequest = PrintRulerRequest(), db: Session = Depends(get_db)):
    """Print a numbered column ruler in Font A and Font B to find the printer's real column count (D15)."""
    config = db.query(StoreConfigModel).first()
    interface = config.printer_interface if config else "USB"
    address = config.printer_address if config else "/dev/usb/lp0"

    printer_service = ESCPOSPrinterService(interface_type=interface, address=address)
    res = printer_service.print_ruler(req.storeConfig)

    if isinstance(res, dict):
        _log_print_attempt(db, "print-ruler", bool(res.get("success")), res.get("error", "") if not res.get("success") else res.get("status", ""))
    if isinstance(res, dict) and not res.get("success"):
        raise HTTPException(status_code=500, detail=res.get("error", "Failed to print ruler"))

    return {"status": res.get("status", "PRINTED"), "physical": res.get("physical", False), "success": True}


class PrintDailySummaryRequest(BaseModel):
    summaryData: dict
    storeConfig: dict
    openDrawer: bool = True


@router.post("/print-daily-summary")
def print_daily_summary(req: PrintDailySummaryRequest, db: Session = Depends(get_db)):
    """Trigger physical ESC/POS daily shift summary print job and cash drawer release."""
    config = db.query(StoreConfigModel).first()
    interface = config.printer_interface if config else "USB"
    address = config.printer_address if config else "/dev/usb/lp0"

    printer_service = ESCPOSPrinterService(interface_type=interface, address=address)
    res = printer_service.print_daily_summary(req.summaryData, req.storeConfig, open_drawer=req.openDrawer)

    if isinstance(res, dict):
        _log_print_attempt(db, "daily-summary", bool(res.get("success")), res.get("error", "") if not res.get("success") else res.get("status", ""))
    if isinstance(res, dict) and not res.get("success"):
        raise HTTPException(status_code=500, detail=res.get("error", "Failed to print daily summary slip"))

    return {
        "status": res.get("status", "PRINTED") if isinstance(res, dict) else "PRINTED",
        "physical": res.get("physical", False) if isinstance(res, dict) else True,
        "success": True
    }


class PrintBarcodeLabelRequest(BaseModel):
    itemData: dict
    storeConfig: dict = {}
    copies: int = 1
    validityDate: Optional[str] = None


@router.post("/print-label")
def print_barcode_label(req: PrintBarcodeLabelRequest, db: Session = Depends(get_db)):
    """Trigger physical ESC/POS thermal barcode shelf label print job."""
    config = db.query(StoreConfigModel).first()
    interface = config.printer_interface if config else "USB"
    address = config.printer_address if config else "/dev/usb/lp0"

    store_config = req.storeConfig or {}
    if config and not store_config.get("storeName"):
        store_config["storeName"] = config.store_name

    printer_service = ESCPOSPrinterService(interface_type=interface, address=address)
    res = printer_service.print_barcode_label(req.itemData, store_config, copies=req.copies, validity_date=req.validityDate)

    if isinstance(res, dict) and not res.get("success"):
        raise HTTPException(status_code=500, detail=res.get("error", "Failed to print barcode label"))

    return {
        "status": res.get("status", "PRINTED") if isinstance(res, dict) else "PRINTED",
        "physical": res.get("physical", False) if isinstance(res, dict) else True,
        "copies": req.copies,
        "success": True
    }


class PrintWriteOffRequest(BaseModel):
    protocolData: dict
    storeConfig: dict = {}


@router.post("/print-write-off")
def print_write_off_protocol_slip(req: PrintWriteOffRequest, db: Session = Depends(get_db)):
    """Trigger physical ESC/POS thermal write-off & liquidation protocol slip print job."""
    config = db.query(StoreConfigModel).first()
    interface = config.printer_interface if config else "USB"
    address = config.printer_address if config else "/dev/usb/lp0"

    store_config = req.storeConfig or {}
    if config and not store_config.get("storeName"):
        store_config["storeName"] = config.store_name
    if config and not store_config.get("ico"):
        store_config["ico"] = config.ico

    printer_service = ESCPOSPrinterService(interface_type=interface, address=address)
    res = printer_service.print_write_off_protocol(req.protocolData, store_config)

    if isinstance(res, dict) and not res.get("success"):
        raise HTTPException(status_code=500, detail=res.get("error", "Failed to print write-off protocol"))

    return {
        "status": res.get("status", "PRINTED") if isinstance(res, dict) else "PRINTED",
        "physical": res.get("physical", False) if isinstance(res, dict) else True,
        "protocol_number": res.get("protocol_number"),
        "success": True
    }


class PrintInventoryRequest(BaseModel):
    protocolData: dict
    storeConfig: dict = {}


@router.post("/print-inventory")
def print_inventory_protocol_slip(req: PrintInventoryRequest, db: Session = Depends(get_db)):
    """Trigger physical ESC/POS thermal physical inventory protocol slip print job (§ 29, 30 ZoÚ)."""
    config = db.query(StoreConfigModel).first()
    interface = config.printer_interface if config else "USB"
    address = config.printer_address if config else "/dev/usb/lp0"

    store_config = req.storeConfig or {}
    if config and not store_config.get("storeName"):
        store_config["storeName"] = config.store_name
    if config and not store_config.get("ico"):
        store_config["ico"] = config.ico

    printer_service = ESCPOSPrinterService(interface_type=interface, address=address)
    res = printer_service.print_inventory_protocol(req.protocolData, store_config)

    if isinstance(res, dict) and not res.get("success"):
        raise HTTPException(status_code=500, detail=res.get("error", "Failed to print inventory protocol"))

    return {
        "status": res.get("status", "PRINTED") if isinstance(res, dict) else "PRINTED",
        "physical": res.get("physical", False) if isinstance(res, dict) else True,
        "protocol_number": res.get("protocol_number"),
        "success": True
    }


class PrintTaxReportRequest(BaseModel):
    reportType: str  # 'dpfo' | 'vat'
    reportData: dict
    storeConfig: dict = {}


@router.post("/print-tax-report")
def print_tax_report_slip(req: PrintTaxReportRequest, db: Session = Depends(get_db)):
    """Trigger physical ESC/POS thermal tax summary report slip print job (DPFO or VAT)."""
    config = db.query(StoreConfigModel).first()
    interface = config.printer_interface if config else "USB"
    address = config.printer_address if config else "/dev/usb/lp0"

    store_config = req.storeConfig or {}
    if config and not store_config.get("storeName"):
        store_config["storeName"] = config.store_name
    if config and not store_config.get("ico"):
        store_config["ico"] = config.ico
    if config and not store_config.get("dic"):
        store_config["dic"] = config.dic

    printer_service = ESCPOSPrinterService(interface_type=interface, address=address)
    res = printer_service.print_tax_report(req.reportType, req.reportData, store_config)

    if isinstance(res, dict) and not res.get("success"):
        raise HTTPException(status_code=500, detail=res.get("error", "Failed to print tax report slip"))

    return {
        "status": res.get("status", "PRINTED") if isinstance(res, dict) else "PRINTED",
        "physical": res.get("physical", False) if isinstance(res, dict) else True,
        "report_type": req.reportType,
        "success": True
    }


