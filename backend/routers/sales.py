from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from sqlalchemy.orm import Session, selectinload, noload
from sqlalchemy import func, case
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


class SaleItemResponseSchema(BaseModel):
    id: int
    item_id: Optional[str] = None
    name: str
    price: float
    quantity: int = 1
    vat: int = 21
    discount_percent: float = 0.0

    model_config = {"from_attributes": True}


class SaleResponseSchema(BaseModel):
    id: str
    receipt_number: str
    timestamp: datetime
    total_amount: float
    cart_discount_percent: Optional[float] = 0.0
    payment_method: str
    split_details: Optional[dict] = None
    tendered_amount: Optional[float] = 0.0
    change_due: Optional[float] = 0.0
    tax_summary: dict
    fik_code: Optional[str] = None
    bkp_code: Optional[str] = None
    pkp_code: Optional[str] = None
    eet_status: Optional[str] = "EVD_OK"
    eic_popl: Optional[str] = None
    id_provozovny: Optional[str] = "11"
    id_pokl: Optional[str] = "1"
    is_sent_to_eet: Optional[bool] = True
    is_refund: Optional[bool] = False
    original_receipt_number: Optional[str] = None
    refund_reason: Optional[str] = None
    refund_status: Optional[str] = "NONE"
    refunded_amount: Optional[float] = 0.0
    items: List[SaleItemResponseSchema] = []

    model_config = {"from_attributes": True}


from collections import OrderedDict
import threading
import time

class BoundedTTLIdempotencyCache:
    """Thread-safe bounded LRU cache with TTL eviction for idempotency keys."""
    def __init__(self, max_size: int = 1000, ttl_seconds: float = 300.0):
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds
        self._cache = OrderedDict()
        self._lock = threading.Lock()

    def get(self, key: str) -> Optional[dict]:
        with self._lock:
            if key not in self._cache:
                return None
            res, expire_time = self._cache[key]
            if time.time() > expire_time:
                del self._cache[key]
                return None
            self._cache.move_to_end(key)
            return res

    def set(self, key: str, value: dict):
        with self._lock:
            now = time.time()
            if len(self._cache) >= self.max_size:
                expired_keys = [k for k, (_, exp) in self._cache.items() if now > exp]
                for k in expired_keys:
                    del self._cache[k]
                while len(self._cache) >= self.max_size:
                    self._cache.popitem(last=False)
            self._cache[key] = (value, now + self.ttl_seconds)

    def clear(self):
        with self._lock:
            self._cache.clear()

idempotency_cache = BoundedTTLIdempotencyCache(max_size=1000, ttl_seconds=300.0)


@router.get("/", response_model=List[SaleResponseSchema])
def get_sales_history(
    response: Response,
    limit: Optional[int] = 50,
    offset: int = 0,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    payment_method: Optional[str] = None,
    search: Optional[str] = None,
    doc_type: Optional[str] = None,
    export_all: bool = False,
    include_items: bool = True,
    db: Session = Depends(get_db)
):
    """
    Fetch sales ledger history with pagination, date, payment-method, doc-type, and text search.
    Default limit is 50, capped at 500 unless export_all=True.
    Sets X-Total-Count response header with total matched sales count.
    """
    if include_items:
        query = db.query(SaleModel).options(selectinload(SaleModel.items))
    else:
        query = db.query(SaleModel).options(noload(SaleModel.items))

    if from_date:
        dt_from = parse_iso_timestamp(from_date)
        query = query.filter(SaleModel.timestamp >= dt_from)

    if to_date:
        dt_to = parse_iso_timestamp(to_date)
        query = query.filter(SaleModel.timestamp <= dt_to)

    if payment_method and payment_method != "all":
        query = query.filter(SaleModel.payment_method == payment_method.lower())

    if doc_type == "sales":
        query = query.filter(SaleModel.is_refund == False)
    elif doc_type == "refunds":
        query = query.filter(SaleModel.is_refund == True)

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            (SaleModel.receipt_number.ilike(term)) |
            (SaleModel.original_receipt_number.ilike(term)) |
            (SaleModel.id.ilike(term)) |
            (SaleModel.items.any(SaleItemModel.name.ilike(term)))
        )

    total_count = query.count()
    response.headers["X-Total-Count"] = str(total_count)

    query = query.order_by(SaleModel.timestamp.desc())

    if offset > 0:
        query = query.offset(offset)

    if export_all:
        if limit is not None and limit > 0:
            query = query.limit(limit)
    else:
        effective_limit = min(limit or 50, 500)
        query = query.limit(effective_limit)

    return query.all()


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


@router.get("/stats/daily")
def get_daily_sales_stats(
    month: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Aggregate daily sales statistics (count, revenue, cash, card, refunds) grouped by date.
    Optimized for CalendarModal and high-level ledger overviews without downloading line items.
    """
    date_col = func.date(SaleModel.timestamp)
    query = db.query(
        date_col.label("date"),
        func.count(SaleModel.id).label("count"),
        func.sum(SaleModel.total_amount).label("total_revenue"),
        func.sum(
            case((SaleModel.is_refund == False, case((SaleModel.payment_method == 'card', SaleModel.total_amount), else_=0.0)), else_=0.0)
        ).label("card_total"),
        func.sum(
            case((SaleModel.is_refund == False, case((SaleModel.payment_method != 'card', SaleModel.total_amount), else_=0.0)), else_=0.0)
        ).label("cash_total"),
        func.sum(
            case((SaleModel.is_refund == True, 1), else_=0)
        ).label("refund_count"),
        func.sum(
            case((SaleModel.is_refund == True, func.abs(SaleModel.total_amount)), else_=0.0)
        ).label("refund_total")
    )

    if month:
        query = query.filter(func.strftime('%Y-%m', SaleModel.timestamp) == month)
    if from_date:
        dt_from = parse_iso_timestamp(from_date)
        query = query.filter(SaleModel.timestamp >= dt_from)
    if to_date:
        dt_to = parse_iso_timestamp(to_date)
        query = query.filter(SaleModel.timestamp <= dt_to)

    rows = query.group_by(date_col).order_by(date_col).all()

    result = {}
    for r in rows:
        result[r.date] = {
            "count": r.count or 0,
            "totalRevenue": round_currency(r.total_revenue or 0.0),
            "cardTotal": round_currency(r.card_total or 0.0),
            "cashTotal": round_currency(r.cash_total or 0.0),
            "refundCount": r.refund_count or 0,
            "refundTotal": round_currency(r.refund_total or 0.0)
        }
    return result


@router.get("/stats/shift")
def get_shift_sales_stats(
    date_str: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Fast turnover aggregation for current shift/day.
    Optimized for ShiftStatsWidget without scanning full client sales history array.
    """
    if not date_str:
        date_str = datetime.now().strftime("%Y-%m-%d")

    res = db.query(
        func.count(SaleModel.id).label("count"),
        func.sum(SaleModel.total_amount).label("total_revenue"),
        func.sum(
            case((SaleModel.payment_method == 'cash', SaleModel.total_amount), else_=0.0)
        ).label("cash_total"),
        func.sum(
            case((SaleModel.payment_method == 'card', SaleModel.total_amount), else_=0.0)
        ).label("card_total")
    ).filter(func.date(SaleModel.timestamp) == date_str).first()

    return {
        "date": date_str,
        "todaySalesCount": res.count or 0 if res else 0,
        "todayRevenue": round_currency(res.total_revenue or 0.0) if res else 0.0,
        "todayCash": round_currency(res.cash_total or 0.0) if res else 0.0,
        "todayCard": round_currency(res.card_total or 0.0) if res else 0.0
    }


@router.get("/{sale_id}", response_model=SaleResponseSchema)
def get_sale_by_id(sale_id: str, db: Session = Depends(get_db)):
    """Fetch single sales transaction by ID with full itemized line items."""
    sale = db.query(SaleModel).options(selectinload(SaleModel.items)).filter(SaleModel.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    return sale


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_sale(request: Request, sale: CreateSaleSchema, db: Session = Depends(get_db)):
    """Save a completed sale, run EET fiscal signing, and persist line items."""
    idempotency_key = request.headers.get("X-Idempotency-Key") or request.headers.get("x-idempotency-key")
    if idempotency_key:
        cached_res = idempotency_cache.get(idempotency_key)
        if cached_res:
            return cached_res

    # Check if sale ID already exists
    existing = db.query(SaleModel).filter(SaleModel.id == sale.id).first()
    if existing:
        res = {"status": "ALREADY_EXISTS", "sale_id": existing.id, "receipt_number": existing.receipt_number}
        if idempotency_key:
            idempotency_cache.set(idempotency_key, res)
        return res

    # Ensure atomic receipt number assignment
    assigned_receipt_number = sale.receiptNumber
    if not assigned_receipt_number or db.query(SaleModel).filter(SaleModel.receipt_number == assigned_receipt_number).first():
        assigned_receipt_number = generate_next_receipt_number(db)

    # Retrieve store config
    config = db.query(StoreConfigModel).first()
    store_dict = {
        "storeName": config.store_name if config else "VoltFlow Store s.r.o.",
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
        idempotency_cache.set(idempotency_key, res)
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


