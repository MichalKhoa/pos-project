import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc

from database import get_db, atomic_transaction
from models import PresetModel, StockMovementModel

router = APIRouter(prefix="/api/v1/inventory", tags=["Inventory & Stock Ledger"])


class IntakeItemSchema(BaseModel):
    preset_id: str
    quantity: float
    cost_price: float
    new_selling_price: Optional[float] = None
    newSellingPrice: Optional[float] = None

    @property
    def effective_new_selling_price(self) -> Optional[float]:
        return self.new_selling_price if self.new_selling_price is not None else self.newSellingPrice


class StockIntakeSchema(BaseModel):
    supplier_ico: Optional[str] = None
    supplier_name: Optional[str] = None
    document_ref: Optional[str] = None
    note: Optional[str] = None
    items: List[IntakeItemSchema]


class StockMovementResponseSchema(BaseModel):
    id: str
    preset_id: str
    preset_name: Optional[str] = None
    movement_type: str
    quantity_delta: float
    unit_cost: float
    supplier_ico: Optional[str] = None
    supplier_name: Optional[str] = None
    document_ref: Optional[str] = None
    note: Optional[str] = None
    timestamp: datetime

    model_config = {"from_attributes": True}


@router.post("/intake", status_code=status.HTTP_201_CREATED)
def submit_stock_intake(payload: StockIntakeSchema, db: Session = Depends(get_db)):
    """
    Process batch stock intake (příjemka zboží) into inventory (§ 7b ZDP).
    In a single atomic transaction:
    - Increments preset stock quantity.
    - Updates preset purchase cost price (bez DPH).
    - Appends immutable RECEIPT movement records to the stock ledger.
    """
    if not payload.items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Příjemka musí obsahovat alespoň jednu položku."
        )

    created_movements = []
    now = datetime.utcnow()

    with atomic_transaction(db):
        for item in payload.items:
            preset = db.query(PresetModel).filter(PresetModel.id == item.preset_id).first()
            if not preset:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Položka se zadaným ID {item.preset_id} nebyla nalezena."
                )

            # Moving Weighted Average Cost (VAP) formula (§ 25 ZoÚ / § 7b ZDP)
            cur_stock = preset.stock_quantity or 0.0
            cur_cost = preset.cost_price or 0.0
            intake_qty = item.quantity
            intake_cost = item.cost_price
            if cur_stock <= 0:
                new_vap = intake_cost
            else:
                new_vap = ((cur_stock * cur_cost) + (intake_qty * intake_cost)) / (cur_stock + intake_qty)

            preset.stock_quantity = round(cur_stock + intake_qty, 3)
            preset.cost_price = round(new_vap, 2)

            # Atomic selling price update if provided
            sell_price = item.effective_new_selling_price
            if sell_price is not None and sell_price > 0:
                preset.price = round(sell_price, 2)

            # Create StockMovementModel entry
            movement = StockMovementModel(
                id=f"smov_{uuid.uuid4().hex[:12]}",
                preset_id=preset.id,
                movement_type="RECEIPT",
                quantity_delta=round(item.quantity, 3),
                unit_cost=round(item.cost_price, 2),
                supplier_ico=payload.supplier_ico.strip() if payload.supplier_ico else None,
                supplier_name=payload.supplier_name.strip() if payload.supplier_name else None,
                document_ref=payload.document_ref.strip() if payload.document_ref else None,
                note=payload.note.strip() if payload.note else None,
                timestamp=now
            )
            db.add(movement)
            created_movements.append(movement)

    return {
        "status": "SUCCESS",
        "intake_count": len(created_movements),
        "document_ref": payload.document_ref,
        "supplier_name": payload.supplier_name
    }


@router.get("/movements", response_model=List[StockMovementResponseSchema])
def get_stock_movements(
    preset_id: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """
    Fetch chronological stock movement ledger entries with joined preset names.
    Supports filtering by preset_id and standard limit/offset pagination.
    """
    query = (
        db.query(
            StockMovementModel.id,
            StockMovementModel.preset_id,
            PresetModel.name.label("preset_name"),
            StockMovementModel.movement_type,
            StockMovementModel.quantity_delta,
            StockMovementModel.unit_cost,
            StockMovementModel.supplier_ico,
            StockMovementModel.supplier_name,
            StockMovementModel.document_ref,
            StockMovementModel.note,
            StockMovementModel.timestamp
        )
        .outerjoin(PresetModel, StockMovementModel.preset_id == PresetModel.id)
    )

    if preset_id:
        query = query.filter(StockMovementModel.preset_id == preset_id)

    query = query.order_by(desc(StockMovementModel.timestamp))

    if offset > 0:
        query = query.offset(offset)

    effective_limit = min(max(1, limit), 500)
    query = query.limit(effective_limit)

    results = query.all()

    return [
        StockMovementResponseSchema(
            id=r.id,
            preset_id=r.preset_id,
            preset_name=r.preset_name or "Neznámá položka",
            movement_type=r.movement_type,
            quantity_delta=r.quantity_delta,
            unit_cost=r.unit_cost,
            supplier_ico=r.supplier_ico,
            supplier_name=r.supplier_name,
            document_ref=r.document_ref,
            note=r.note,
            timestamp=r.timestamp
        )
        for r in results
    ]


class PriceHistoryItemSchema(BaseModel):
    id: str
    timestamp: datetime
    supplier_ico: Optional[str] = None
    supplier_name: Optional[str] = None
    document_ref: Optional[str] = None
    unit_cost: float
    quantity_delta: float
    note: Optional[str] = None
    trend: str

    model_config = {"from_attributes": True}


@router.get("/price-history/{preset_id}", response_model=List[PriceHistoryItemSchema])
def get_price_history(preset_id: str, db: Session = Depends(get_db)):
    """
    Fetch chronological purchase price history for a given preset (§ 25 ZoÚ).
    Calculates cost trend relative to previous receipt ('stable', 'rose', 'fell').
    """
    movements = (
        db.query(StockMovementModel)
        .filter(
            StockMovementModel.preset_id == preset_id,
            StockMovementModel.movement_type == "RECEIPT"
        )
        .order_by(StockMovementModel.timestamp.asc())
        .all()
    )

    history = []
    prev_cost = None
    for idx, m in enumerate(movements):
        unit_cost = float(m.unit_cost or 0.0)
        if idx == 0 or prev_cost is None:
            trend = "stable"
        elif unit_cost > prev_cost:
            trend = "rose"
        elif unit_cost < prev_cost:
            trend = "fell"
        else:
            trend = "stable"
        prev_cost = unit_cost

        history.append(
            PriceHistoryItemSchema(
                id=m.id,
                timestamp=m.timestamp,
                supplier_ico=m.supplier_ico,
                supplier_name=m.supplier_name,
                document_ref=m.document_ref,
                unit_cost=unit_cost,
                quantity_delta=m.quantity_delta,
                note=m.note,
                trend=trend
            )
        )
    return history
