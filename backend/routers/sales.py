from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models import SaleModel, SaleItemModel, StoreConfigModel
from services.eet_service import CzechEETService
from pydantic import BaseModel
from datetime import datetime

router = APIRouter(prefix="/api/v1/sales", tags=["Sales Ledger"])
eet_service = CzechEETService()



class SaleItemSchema(BaseModel):
    id: Optional[str] = None
    name: str
    price: float
    quantity: int = 1
    vat: int = 21
    discount_percent: float = 0.0


class CreateSaleSchema(BaseModel):
    id: str
    receiptNumber: str
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


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_sale(sale: CreateSaleSchema, db: Session = Depends(get_db)):
    """Save a completed sale, run EET fiscal signing, and persist line items."""
    # Check if sale ID already exists
    existing = db.query(SaleModel).filter(SaleModel.id == sale.id).first()
    if existing:
        return {"status": "ALREADY_EXISTS", "sale_id": existing.id}

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

    # Run EET Fiscal Signing
    eet_res = eet_service.sign_and_submit_sale(sale.model_dump(), store_dict)

    from services.security_utils import parse_iso_timestamp, round_currency

    # Save to SQLite DB
    db_sale = SaleModel(
        id=sale.id,
        receipt_number=sale.receiptNumber,
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

    # Save itemized rows
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

    db.commit()
    db.refresh(db_sale)

    return {
        "status": "SUCCESS",
        "sale_id": db_sale.id,
        "receipt_number": db_sale.receipt_number,
        "fik": db_sale.fik_code,
        "bkp": db_sale.bkp_code,
        "pkp": db_sale.pkp_code,
        "eet_status": db_sale.eet_status
    }


@router.put("/{sale_id}/refund-status")
def update_sale_refund_status(sale_id: str, data: UpdateRefundStatusSchema, db: Session = Depends(get_db)):
    """Update refund status and refunded amount of an existing sale."""
    sale = db.query(SaleModel).filter(SaleModel.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    
    sale.refund_status = data.refund_status
    sale.refunded_amount = data.refunded_amount
    db.commit()
    return {"status": "UPDATED", "sale_id": sale_id}


@router.delete("/{sale_id}")
def delete_sale(sale_id: str, request: Request, db: Session = Depends(get_db)):
    """Delete a test sale transaction (Admin Mode - Protected)."""
    client_host = request.client.host if request.client else ""
    if client_host not in ("127.0.0.1", "::1", "localhost", "testclient"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Transaction deletion is restricted to localhost admin session."
        )

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

