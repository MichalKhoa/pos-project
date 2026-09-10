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

            # Update preset stock quantity and cost price
            preset.stock_quantity = round((preset.stock_quantity or 0.0) + item.quantity, 3)
            preset.cost_price = round(item.cost_price, 2)

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
