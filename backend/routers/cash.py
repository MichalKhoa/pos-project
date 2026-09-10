import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import get_db
from models import ShiftSessionModel, CashMovementModel, SaleModel, StoreConfigModel
from services.escpos_service import ESCPOSPrinterService
from services.security_utils import round_currency

router = APIRouter(prefix="/api/v1/cash", tags=["Cash Management & Shift Sessions"])


def _calculate_shift_metrics(shift: ShiftSessionModel, db: Session):
    """
    Computes cash sales, cash refunds, total revenue, card/QR breakdowns,
    and cash drawer movements for the specified shift session.
    """
    sales_query = db.query(SaleModel).filter(SaleModel.timestamp >= shift.opened_at)
    if shift.is_closed and shift.closed_at:
        sales_query = sales_query.filter(SaleModel.timestamp <= shift.closed_at)
    sales = sales_query.all()

    total_cash_sales = 0.0
    total_cash_refunds = 0.0
    total_revenue = 0.0
    card_sales = 0.0
    qr_sales = 0.0
    receipts_count = 0
    refunds_count = 0
    refunds_total = 0.0

    for s in sales:
        amt = float(s.total_amount or 0.0)
        pm = (s.payment_method or "").lower()

        # Extract cash portion
        cash_part = 0.0
        if pm in ("cash", "hotovost"):
            cash_part = amt
        elif pm == "split" and s.split_details and isinstance(s.split_details, dict):
            cash_part = float(s.split_details.get("cash", s.split_details.get("hotovost", 0.0)))

        if s.is_refund:
            refunds_count += 1
            refunds_total += abs(amt)
            total_cash_refunds += abs(cash_part)
        else:
            receipts_count += 1
            total_revenue += amt
            total_cash_sales += cash_part
            if pm in ("card", "karta"):
                card_sales += amt
            elif pm in ("qr", "qr_platba"):
                qr_sales += amt
            elif pm == "split" and s.split_details and isinstance(s.split_details, dict):
                card_sales += float(s.split_details.get("card", s.split_details.get("karta", 0.0)))
                qr_sales += float(s.split_details.get("qr", 0.0))

    movements = (
        db.query(CashMovementModel)
        .filter(CashMovementModel.shift_id == shift.id)
        .order_by(CashMovementModel.created_at.asc())
        .all()
    )

    float_in = sum(float(m.amount) for m in movements if m.movement_type == "FLOAT_IN")
    payouts = sum(float(m.amount) for m in movements if m.movement_type == "PAYOUT")
    safe_drops = sum(float(m.amount) for m in movements if m.movement_type == "SAFE_DROP")

    opening = float(shift.opening_cash or 0.0)
    expected_cash = round(opening + total_cash_sales - total_cash_refunds + float_in - payouts - safe_drops, 2)

    return {
        "sales": sales,
        "movements": movements,
        "total_cash_sales": round(total_cash_sales, 2),
        "total_cash_refunds": round(total_cash_refunds, 2),
        "float_in": round(float_in, 2),
        "payouts": round(payouts, 2),
        "safe_drops": round(safe_drops, 2),
        "net_movements": round(float_in - payouts - safe_drops, 2),
        "expected_cash": expected_cash,
        "total_revenue": round(total_revenue, 2),
        "card_sales": round(card_sales, 2),
        "qr_sales": round(qr_sales, 2),
        "receipts_count": receipts_count,
        "refunds_count": refunds_count,
        "refunds_total": round(refunds_total, 2)
    }


def _get_or_create_current_shift(db: Session) -> ShiftSessionModel:
    """Finds current open shift session or creates a new one if none is active."""
    shift = (
        db.query(ShiftSessionModel)
        .filter(ShiftSessionModel.is_closed == False)
        .order_by(ShiftSessionModel.opened_at.desc())
        .first()
    )
    if not shift:
        last_shift = (
            db.query(ShiftSessionModel)
            .order_by(ShiftSessionModel.closed_at.desc(), ShiftSessionModel.opened_at.desc())
            .first()
        )
        next_shift_num = (last_shift.shift_number + 1) if last_shift else 1
        next_z_seq = (last_shift.z_seq + 1) if last_shift else 1

        shift = ShiftSessionModel(
            id=str(uuid.uuid4()),
            shift_number=next_shift_num,
            opened_at=datetime.utcnow(),
            opening_cash=0.0,
            expected_cash=0.0,
            is_closed=False,
            z_seq=next_z_seq
        )
        db.add(shift)
        db.commit()
        db.refresh(shift)

    return shift


def _build_shift_dict(shift: ShiftSessionModel, metrics: dict) -> dict:
    """Builds serialized representation of a shift with movements and expected cash."""
    return {
        "id": shift.id,
        "shift_number": shift.shift_number,
        "opened_at": shift.opened_at.isoformat() if shift.opened_at else None,
        "closed_at": shift.closed_at.isoformat() if shift.closed_at else None,
        "opening_cash": round(shift.opening_cash or 0.0, 2),
        "total_cash_sales": metrics["total_cash_sales"],
        "total_cash_refunds": metrics["total_cash_refunds"],
        "float_in": metrics["float_in"],
        "payouts": metrics["payouts"],
        "safe_drops": metrics["safe_drops"],
        "net_movements": metrics["net_movements"],
        "expected_cash": metrics["expected_cash"],
        "actual_cash": round(shift.actual_cash, 2) if shift.actual_cash is not None else None,
        "discrepancy": round(shift.discrepancy, 2) if shift.discrepancy is not None else None,
        "is_closed": shift.is_closed,
        "z_seq": shift.z_seq,
        "movements": [
            {
                "id": m.id,
                "shift_id": m.shift_id,
                "movement_type": m.movement_type,
                "amount": round(m.amount, 2),
                "reason": m.reason,
                "created_at": m.created_at.isoformat() if m.created_at else None
            }
            for m in metrics["movements"]
        ]
    }


# --------------------------------------------------------------------------
# Schemas
# --------------------------------------------------------------------------

class CashMovementCreate(BaseModel):
    movement_type: str  # 'FLOAT_IN', 'PAYOUT', 'SAFE_DROP'
    amount: float
    reason: Optional[str] = ""
    print_slip: Optional[bool] = False


class CloseShiftRequest(BaseModel):
    actual_cash: float
    notes: Optional[str] = None


class PrintMovementSlipRequest(BaseModel):
    movementData: dict
    storeConfig: Optional[dict] = None


class PrintZReportRequest(BaseModel):
    zReportData: dict
    storeConfig: Optional[dict] = None
    openDrawer: bool = True


# --------------------------------------------------------------------------
# API Endpoints
# --------------------------------------------------------------------------

@router.get("/current-shift")
def get_current_shift(db: Session = Depends(get_db)):
    """
    Returns current active shift session, creating a default one if none exists.
    Calculates dynamic expected cash:
    opening_cash + total_cash_sales - total_cash_refunds + float_in - payouts - safe_drops.
    """
    shift = _get_or_create_current_shift(db)
    metrics = _calculate_shift_metrics(shift, db)

    # Persist current expected cash in DB
    shift.expected_cash = metrics["expected_cash"]
    db.commit()

    return _build_shift_dict(shift, metrics)


@router.post("/movement")
def create_cash_movement(data: CashMovementCreate, db: Session = Depends(get_db)):
    """
    Records a cash drawer movement ('FLOAT_IN', 'PAYOUT', 'SAFE_DROP'),
    associates it with the current open shift, and returns updated balance.
    """
    valid_types = ("FLOAT_IN", "PAYOUT", "SAFE_DROP")
    m_type = data.movement_type.strip().upper()
    if m_type not in valid_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid movement_type '{data.movement_type}'. Allowed: {', '.join(valid_types)}"
        )

    if data.amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Movement amount must be greater than zero."
        )

    shift = _get_or_create_current_shift(db)

    movement = CashMovementModel(
        id=str(uuid.uuid4()),
        shift_id=shift.id,
        movement_type=m_type,
        amount=round(data.amount, 2),
        reason=data.reason.strip() if data.reason else None,
        created_at=datetime.utcnow()
    )
    db.add(movement)
    db.commit()
    db.refresh(movement)

    # Recalculate metrics
    metrics = _calculate_shift_metrics(shift, db)
    shift.expected_cash = metrics["expected_cash"]
    db.commit()

    result = {
        "status": "CREATED",
        "movement": {
            "id": movement.id,
            "shift_id": movement.shift_id,
            "movement_type": movement.movement_type,
            "amount": round(movement.amount, 2),
            "reason": movement.reason,
            "created_at": movement.created_at.isoformat()
        },
        "shift": _build_shift_dict(shift, metrics)
    }

    return result


@router.post("/close-shift")
def close_shift(req: CloseShiftRequest, db: Session = Depends(get_db)):
    """
    Closes the current active shift session, records actual counted cash,
    computes discrepancy (actual - expected), and generates Z-Report summary.
    """
    shift = (
        db.query(ShiftSessionModel)
        .filter(ShiftSessionModel.is_closed == False)
        .order_by(ShiftSessionModel.opened_at.desc())
        .first()
    )
    if not shift:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active open shift found to close."
        )

    metrics = _calculate_shift_metrics(shift, db)
    expected = metrics["expected_cash"]
    actual = round(float(req.actual_cash), 2)
    discrepancy = round(actual - expected, 2)

    shift.expected_cash = expected
    shift.actual_cash = actual
    shift.discrepancy = discrepancy
    shift.is_closed = True
    shift.closed_at = datetime.utcnow()

    db.commit()
    db.refresh(shift)

    shift_dict = _build_shift_dict(shift, metrics)
    if req.notes:
        shift_dict["notes"] = req.notes.strip()

    return {
        "status": "CLOSED",
        "shift": shift_dict,
        "z_seq": shift.z_seq,
        "shift_number": shift.shift_number,
        "total_revenue": metrics["total_revenue"],
        "cash_sales": metrics["total_cash_sales"],
        "card_sales": metrics["card_sales"],
        "qr_sales": metrics["qr_sales"],
        "receipts_count": metrics["receipts_count"],
        "refunds_count": metrics["refunds_count"],
        "refunds_total": metrics["refunds_total"]
    }


def _get_store_config_dict(db: Session, override: Optional[dict] = None) -> dict:
    """Helper to get StoreConfig dict for printer formatting."""
    cfg = db.query(StoreConfigModel).first()
    res = {
        "storeName": cfg.store_name if cfg else "VoltFlow POS",
        "street": cfg.street if cfg else "",
        "city": cfg.city if cfg else "",
        "ico": cfg.ico if cfg else "",
        "dic": cfg.dic if cfg else "",
        "printerInterface": cfg.printer_interface if cfg else "USB",
        "printerAddress": cfg.printer_address if cfg else "/dev/usb/lp0",
        "printerPaperWidth": cfg.printer_paper_width if cfg else "80",
    }
    if override and isinstance(override, dict):
        res.update(override)
    return res


@router.post("/print-movement-slip")
def print_movement_slip(req: PrintMovementSlipRequest, db: Session = Depends(get_db)):
    """Formats and prints physical/simulated ESC/POS 58mm/80mm cash drawer movement slip."""
    store_cfg = _get_store_config_dict(db, req.storeConfig)
    printer_service = ESCPOSPrinterService(
        interface_type=store_cfg.get("printerInterface", "USB"),
        address=store_cfg.get("printerAddress", "/dev/usb/lp0")
    )
    res = printer_service.print_cash_movement_slip(req.movementData, store_cfg)

    if isinstance(res, dict) and not res.get("success"):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=res.get("error", "Failed to print cash movement slip")
        )

    return {
        "status": res.get("status", "PRINTED") if isinstance(res, dict) else "PRINTED",
        "physical": res.get("physical", False) if isinstance(res, dict) else True,
        "success": True
    }


@router.post("/print-z-report")
def print_z_report(req: PrintZReportRequest, db: Session = Depends(get_db)):
    """Formats and prints official Z-report daily closing slip on thermal printer and opens drawer."""
    store_cfg = _get_store_config_dict(db, req.storeConfig)
    printer_service = ESCPOSPrinterService(
        interface_type=store_cfg.get("printerInterface", "USB"),
        address=store_cfg.get("printerAddress", "/dev/usb/lp0")
    )
    res = printer_service.print_z_report(req.zReportData, store_cfg, open_drawer=req.openDrawer)

    if isinstance(res, dict) and not res.get("success"):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=res.get("error", "Failed to print Z-Report")
        )

    return {
        "status": res.get("status", "PRINTED") if isinstance(res, dict) else "PRINTED",
        "physical": res.get("physical", False) if isinstance(res, dict) else True,
        "success": True
    }
