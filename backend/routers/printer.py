from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import StoreConfigModel
from services.escpos_service import ESCPOSPrinterService, detect_connected_printers
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/printer", tags=["Hardware Printer"])


class PrintReceiptRequest(BaseModel):
    saleData: dict
    storeConfig: dict


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
    res = printer_service.print_receipt(req.saleData, req.storeConfig)

    if isinstance(res, dict):
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


@router.post("/open-drawer")
def open_cash_drawer(db: Session = Depends(get_db)):
    """Trigger physical ESC/POS pulse signal to release the cash drawer."""
    config = db.query(StoreConfigModel).first()
    interface = config.printer_interface if config else "USB"
    address = config.printer_address if config else "/dev/usb/lp0"

    printer_service = ESCPOSPrinterService(interface_type=interface, address=address)
    res = printer_service.open_cash_drawer()

    if isinstance(res, dict) and not res.get("success"):
        raise HTTPException(status_code=500, detail=res.get("error", "Failed to open cash drawer"))

    return {"status": res.get("status", "OPENED"), "physical": res.get("physical", False), "success": True}


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


