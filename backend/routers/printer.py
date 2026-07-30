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


@router.get("/devices")
def get_printer_devices():
    """Scan and list connected hardware printer devices."""
    devices = detect_connected_printers()
    return {"devices": devices}


@router.post("/print")
def print_receipt(req: PrintReceiptRequest, db: Session = Depends(get_db)):
    """Trigger physical ESC/POS thermal print job."""
    config = db.query(StoreConfigModel).first()
    interface = config.printer_interface if config else "USB"
    address = config.printer_address if config else "/dev/usb/lp0"

    printer_service = ESCPOSPrinterService(interface_type=interface, address=address)
    success = printer_service.print_receipt(req.saleData, req.storeConfig)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to print to hardware thermal printer")

    return {"status": "PRINTED", "receiptNumber": req.saleData.get("receiptNumber")}
