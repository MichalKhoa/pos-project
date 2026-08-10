from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models import SaleModel, SaleItemModel, StoreConfigModel, ReceiptSequenceModel
from services.eet_service import CzechEETService
from services.security_utils import parse_iso_timestamp, round_currency
from pydantic import BaseModel

from datetime import datetime

router = APIRouter(prefix="/api/v1/sales", tags=["Sales Ledger"])
eet_service = CzechEETService()


def generate_next_receipt_number(db: Session, year: Optional[int] = None) -> str:
    """
    Atomically increments and retrieves the next receipt sequence number for the specified year.
    Returns format: YYYY-XXXXXX (e.g. 2026-000042)
    """
    if not year:
        year = datetime.now().year

    seq_obj = db.query(ReceiptSequenceModel).filter(ReceiptSequenceModel.year == year).first()
    if not seq_obj:
        year_prefix = f"{year}-"
        max_num = 0
        existing_sales = db.query(SaleModel.receipt_number).filter(SaleModel.receipt_number.like(f"{year_prefix}%")).all()
        for (rn,) in existing_sales:
            try:
                num = int(rn.split("-")[1])
                if num > max_num:
                    max_num = num
            except Exception:
                pass
        seq_obj = ReceiptSequenceModel(year=year, last_seq=max_num)
        db.add(seq_obj)
        db.flush()

    seq_obj.last_seq += 1
    next_num = seq_obj.last_seq
    db.commit()

    return f"{year}-{next_num:06d}"


class SaleItemSchema(BaseModel):
    id: Optional[str] = None
    name: str
    price: float
    quantity: int = 1
    vat: int = 21
    discount_percent: Optional[float] = 0.0
    discountPercent: Optional[float] = 0.0



class CreateSaleSchema(BaseModel):
    id: str
    receiptNumber: Optional[str] = ""
    timestamp: Optional[str] = None
    totalAmount: float
    cartDiscountPercent: float = 0.0
    paymentMethod: str
    splitDetails: Optional[dict] = None
    tenderedAmount: float = 0.0
    changeDue: float = 0.0
    taxSummary: dict
    items: List[SaleItemSchema]
    isRefund: Optional[bool] = False
    originalReceiptNumber: Optional[str] = None
    refundReason: Optional[str] = None
    refundStatus: Optional[str] = "NONE"
    refundedAmount: Optional[float] = 0.0


class UpdateRefundStatusSchema(BaseModel):
    refund_status: str
    refunded_amount: float


@router.get("/")
def get_sales_history(db: Session = Depends(get_db)):
    """Fetch complete sales ledger history."""
    sales = db.query(SaleModel).order_by(SaleModel.timestamp.desc()).all()
    return sales


@router.get("/next-receipt-number")
def get_next_receipt_number_preview(db: Session = Depends(get_db)):
    """Preview the next available receipt number sequence."""
    year = datetime.now().year
    seq_obj = db.query(ReceiptSequenceModel).filter(ReceiptSequenceModel.year == year).first()
    if seq_obj:
        next_num = seq_obj.last_seq + 1
    else:
        year_prefix = f"{year}-"
        max_num = 0
        existing_sales = db.query(SaleModel.receipt_number).filter(SaleModel.receipt_number.like(f"{year_prefix}%")).all()
        for (rn,) in existing_sales:
            try:
                num = int(rn.split("-")[1])
                if num > max_num:
                    max_num = num
            except Exception:
                pass
        next_num = max_num + 1

    return {"next_receipt_number": f"{year}-{next_num:06d}"}


IDEMPOTENCY_CACHE = {}

@router.post("/", status_code=status.HTTP_201_CREATED)
def create_sale(request: Request, sale: CreateSaleSchema, db: Session = Depends(get_db)):
    """Save a completed sale, run EET fiscal signing, and persist line items."""
    idempotency_key = request.headers.get("X-Idempotency-Key") or request.headers.get("x-idempotency-key")
    if idempotency_key and idempotency_key in IDEMPOTENCY_CACHE:
        cached_res, ts = IDEMPOTENCY_CACHE[idempotency_key]
        if datetime.now().timestamp() - ts < 300:
            return cached_res

    # Check if sale ID already exists
    existing = db.query(SaleModel).filter(SaleModel.id == sale.id).first()
    if existing:
        res = {"status": "ALREADY_EXISTS", "sale_id": existing.id, "receipt_number": existing.receipt_number}
        if idempotency_key:
            IDEMPOTENCY_CACHE[idempotency_key] = (res, datetime.now().timestamp())
        return res

    # Ensure atomic receipt number assignment
    assigned_receipt_number = sale.receiptNumber
    if not assigned_receipt_number or db.query(SaleModel).filter(SaleModel.receipt_number == assigned_receipt_number).first():
        assigned_receipt_number = generate_next_receipt_number(db)

    # Retrieve store config
    config = db.query(StoreConfigModel).first()
    store_dict = {
        "storeName": config.store_name if config else "Himmel Home s.r.o.",
        "eic_popl": config.dic if config else "CZ00000019",
        "dic": config.dic if config else "CZ00000019",
        "id_jednotky": config.id_provozovny if config else "11",
        "id_provozovny": config.id_provozovny if config else "11",
        "id_pokl": config.id_pokl if config else "1",
        "eet_cert_path": config.eet_cert_path if config else "",
        "eet_cert_password": config.get_decrypted_cert_password() if config else "",
        "eet_environment": config.eet_environment if config else "playground"
    }

    # Run EET Fiscal Signing (if EET is enabled in store config)
    sale_payload = sale.model_dump()
    sale_payload["receiptNumber"] = assigned_receipt_number
    if config and config.eet_enabled:
        eet_res = eet_service.sign_and_submit_sale(sale_payload, store_dict)
    else:
        eet_res = {
            "fik": None,
            "bkp": None,
            "pkp": None,
            "eet_status": "DISABLED",
            "is_sent_to_eet": True
        }

    from database import get_db, atomic_transaction

    with atomic_transaction(db):
        # Save to SQLite DB
        db_sale = SaleModel(
            id=sale.id,
            receipt_number=assigned_receipt_number,
            timestamp=parse_iso_timestamp(sale.timestamp),
            total_amount=round_currency(sale.totalAmount),
            cart_discount_percent=sale.cartDiscountPercent,
            payment_method=sale.paymentMethod,
            split_details=sale.splitDetails,
            tendered_amount=round_currency(sale.tenderedAmount),
            change_due=round_currency(sale.changeDue),
            tax_summary=sale.taxSummary,
            fik_code=eet_res.get("fik"),
            bkp_code=eet_res.get("bkp"),
            pkp_code=eet_res.get("pkp"),
            eet_status=eet_res.get("eet_status", "EVD_OK"),
            eic_popl=store_dict["dic"],
            id_provozovny=store_dict["id_provozovny"],
            id_pokl=store_dict["id_pokl"],
            is_sent_to_eet=eet_res.get("is_sent_to_eet", True),
            is_refund=sale.isRefund,
            original_receipt_number=sale.originalReceiptNumber,
            refund_reason=sale.refundReason,
            refund_status=sale.refundStatus or "NONE",
            refunded_amount=round_currency(sale.refundedAmount or 0.0)
        )

        db.add(db_sale)

        # Save itemized rows & deduct inventory stock
        from models import PresetModel
        for item in sale.items:
            db_item = SaleItemModel(
                sale_id=sale.id,
                item_id=item.id,
                name=item.name,
                price=round_currency(item.price),
                quantity=item.quantity,
                vat=item.vat,
                discount_percent=item.discount_percent
            )
            db.add(db_item)

            # Deduct stock quantity if product preset has stock tracking enabled
            if item.id:
                preset = db.query(PresetModel).filter(PresetModel.id == item.id).first()
                if preset and preset.track_stock:
                    preset.stock_quantity -= item.quantity

    db.refresh(db_sale)

    res = {
        "status": "SUCCESS",
        "sale_id": db_sale.id,
        "receipt_number": db_sale.receipt_number,
        "fik": db_sale.fik_code,
        "bkp": db_sale.bkp_code,
        "pkp": db_sale.pkp_code,
        "eet_status": db_sale.eet_status
    }
    if idempotency_key:
        IDEMPOTENCY_CACHE[idempotency_key] = (res, datetime.now().timestamp())
    return res


class UpdateRefundStatusSchema(BaseModel):
    refund_status: str
    refunded_amount: float
    restock: Optional[bool] = True


@router.put("/{sale_id}/refund-status")
def update_sale_refund_status(sale_id: str, data: UpdateRefundStatusSchema, db: Session = Depends(get_db)):
    """Update refund status and refunded amount of an existing sale, with optional item restocking."""
    sale = db.query(SaleModel).filter(SaleModel.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    
    sale.refund_status = data.refund_status
    sale.refunded_amount = data.refunded_amount

    # Auto-restock items if restock is enabled (unless damaged/waste)
    if data.restock:
        from models import PresetModel
        for item in sale.items:
            if item.item_id:
                preset = db.query(PresetModel).filter(PresetModel.id == item.item_id).first()
                if preset and preset.track_stock:
                    preset.stock_quantity += item.quantity

    db.commit()
    return {"status": "UPDATED", "sale_id": sale_id}


@router.delete("/purge-all")
def purge_all_sales(request: Request, db: Session = Depends(get_db)):
    """Delete all sales transactions (Admin Mode - Protected)."""
    admin_header = request.headers.get("X-Admin-Override", "")
    if admin_header.lower() != "true":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Vyžadováno potvrzení administrátorského oprávnění (X-Admin-Override header)."
        )

    db.query(SaleItemModel).delete()
    db.query(SaleModel).delete()
    db.commit()
    return {"status": "DELETED_ALL"}


@router.delete("/{sale_id}")
def delete_sale(sale_id: str, request: Request, db: Session = Depends(get_db)):
    """Delete a single test sale transaction (Admin Mode - Protected)."""
    admin_header = request.headers.get("X-Admin-Override", "")
    if admin_header.lower() != "true":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Vyžadováno potvrzení administrátorského oprávnění (X-Admin-Override header)."
        )

    sale = db.query(SaleModel).filter(SaleModel.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    
    db.delete(sale)
    db.commit()
    return {"status": "DELETED", "sale_id": sale_id}


