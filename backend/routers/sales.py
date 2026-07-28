from fastapi import APIRouter, Depends, HTTPException, status
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

    # Run EET Fiscal Signing
    config = db.query(StoreConfigModel).first()
    store_dict = {
        "storeName": config.store_name if config else "Himmel Home s.r.o.",
        "dic": config.dic if config else "CZ12345678"
    }
    eet_res = eet_service.sign_and_submit_sale(sale.model_dump(), store_dict)

    # Save to SQLite DB
    db_sale = SaleModel(
        id=sale.id,
        receipt_number=sale.receiptNumber,
        timestamp=datetime.fromisoformat(sale.timestamp.replace("Z", "")) if sale.timestamp else datetime.utcnow(),
        total_amount=sale.totalAmount,
        cart_discount_percent=sale.cartDiscountPercent,
        payment_method=sale.paymentMethod,
        split_details=sale.splitDetails,
        tendered_amount=sale.tenderedAmount,
        change_due=sale.changeDue,
        tax_summary=sale.taxSummary,
        fik_code=eet_res.get("fik"),
        bkp_code=eet_res.get("bkp")
    )

    db.add(db_sale)

    # Save itemized rows
    for item in sale.items:
        db_item = SaleItemModel(
            sale_id=sale.id,
            item_id=item.id,
            name=item.name,
            price=item.price,
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
        "bkp": db_sale.bkp_code
    }


@router.delete("/{sale_id}")
def delete_sale(sale_id: str, db: Session = Depends(get_db)):
    """Delete a test sale transaction (Admin Mode)."""
    sale = db.query(SaleModel).filter(SaleModel.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    
    db.delete(sale)
    db.commit()
    return {"status": "DELETED", "sale_id": sale_id}
