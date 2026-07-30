from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from models import StoreConfigModel
from services.qr_bank_service import CzechBankQRPaymentService
from services.csob_terminal_service import CSOBTerminalService

router = APIRouter(prefix="/api/v1/payments", tags=["Payments & Terminal"])
qr_service = CzechBankQRPaymentService()


class VerifyQRPaymentRequest(BaseModel):
    variableSymbol: str
    expectedAmount: float


class GenerateQRPayloadRequest(BaseModel):
    amount: float
    variableSymbol: str
    message: str = "Nákup v obchodu"


class TerminalConfigSchema(BaseModel):
    enabled: bool = False
    ip: str = ""
    port: int = 8888
    terminalId: str = ""


class TerminalPingRequest(BaseModel):
    ip: Optional[str] = None
    port: Optional[int] = None


class TerminalPayRequest(BaseModel):
    amount: float
    variableSymbol: Optional[str] = ""


@router.post("/generate-qr-string")
def generate_qr_string(req: GenerateQRPayloadRequest):
    """Generates Czech SPD format QR payload for banking app scanning."""
    spd_string = qr_service.generate_qr_string(req.amount, req.variableSymbol, req.message)
    return {
        "status": "OK",
        "spd_string": spd_string,
        "variable_symbol": req.variableSymbol,
        "amount": req.amount
    }


@router.post("/verify-qr")
def verify_qr_payment(req: VerifyQRPaymentRequest):
    """
    Endpoint for checking arrival of Czech QR bank payments.
    Polls bank API or checks instant payment arrival.
    """
    res = qr_service.check_payment_status(req.variableSymbol, req.expectedAmount)
    return res


# --- CSOB INGENICO MOVE 3500 TERMINAL ENDPOINTS ---

@router.get("/terminal/config")
def get_terminal_config(db: Session = Depends(get_db)):
    """Returns ČSOB Ingenico Move 3500 terminal configuration from database."""
    config = db.query(StoreConfigModel).first()
    if not config:
        config = StoreConfigModel()
        db.add(config)
        db.commit()
        db.refresh(config)

    return {
        "enabled": bool(config.csob_terminal_enabled),
        "ip": config.csob_terminal_ip or "",
        "port": config.csob_terminal_port or 8888,
        "terminalId": config.csob_terminal_id or "",
        "is_configured": bool(config.csob_terminal_enabled and config.csob_terminal_ip and config.csob_terminal_port)
    }


@router.post("/terminal/config")
def save_terminal_config(data: TerminalConfigSchema, db: Session = Depends(get_db)):
    """Saves ČSOB Ingenico Move 3500 terminal configuration."""
    config = db.query(StoreConfigModel).first()
    if not config:
        config = StoreConfigModel()
        db.add(config)

    config.csob_terminal_enabled = data.enabled
    config.csob_terminal_ip = data.ip.strip()
    config.csob_terminal_port = data.port if data.port > 0 else 8888
    config.csob_terminal_id = data.terminalId.strip()

    db.commit()
    db.refresh(config)

    return {
        "status": "SUCCESS",
        "message": "Konfigurace ČSOB terminálu byla uložena.",
        "config": {
            "enabled": config.csob_terminal_enabled,
            "ip": config.csob_terminal_ip,
            "port": config.csob_terminal_port,
            "terminalId": config.csob_terminal_id
        }
    }


@router.post("/terminal/ping")
def ping_terminal(req: TerminalPingRequest, db: Session = Depends(get_db)):
    """Tests TCP socket connection to CSOB Ingenico Move 3500 terminal."""
    config = db.query(StoreConfigModel).first()
    target_ip = req.ip if req.ip is not None else (config.csob_terminal_ip if config else "")
    target_port = req.port if req.port is not None else (config.csob_terminal_port if config else 8888)

    term_service = CSOBTerminalService(ip=target_ip, port=target_port)
    return term_service.ping_terminal(target_ip=target_ip, target_port=target_port)


@router.post("/terminal/pay")
def process_terminal_payment(req: TerminalPayRequest, db: Session = Depends(get_db)):
    """Initiates payment transaction on CSOB Ingenico Move 3500 terminal."""
    config = db.query(StoreConfigModel).first()
    term_service = CSOBTerminalService(
        ip=config.csob_terminal_ip if config else "",
        port=config.csob_terminal_port if config else 8888,
        terminal_id=config.csob_terminal_id if config else "",
        enabled=config.csob_terminal_enabled if config else False
    )

    return term_service.process_payment(amount=req.amount, variable_symbol=req.variableSymbol or "")


@router.post("/terminal/reconcile")
def reconcile_terminal(db: Session = Depends(get_db)):
    """Triggers end of day reconciliation (denní uzávěrka) on ČSOB terminal."""
    config = db.query(StoreConfigModel).first()
    term_service = CSOBTerminalService(
        ip=config.csob_terminal_ip if config else "",
        port=config.csob_terminal_port if config else 8888,
        terminal_id=config.csob_terminal_id if config else "",
        enabled=config.csob_terminal_enabled if config else False
    )

    return term_service.reconcile_terminal()

