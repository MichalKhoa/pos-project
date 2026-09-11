import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc

from database import get_db, atomic_transaction
from models import (
    PresetModel,
    StockMovementModel,
    CategoryModel,
    WriteOffSequenceModel,
    StockWriteOffModel,
    StockWriteOffItemModel,
    InventoryAuditSequenceModel,
    InventoryAuditModel,
    InventoryAuditItemModel
)

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


def generate_next_write_off_number(db: Session, year: Optional[int] = None) -> str:
    """
    Atomically increments and retrieves the next write-off protocol sequence number (§ 25 ZoÚ).
    Format: ODP-YYYY-XXXX (e.g. ODP-2026-0001)
    """
    if not year:
        year = datetime.now().year

    seq_obj = db.query(WriteOffSequenceModel).filter(WriteOffSequenceModel.year == year).first()
    if not seq_obj:
        year_prefix = f"ODP-{year}-"
        max_num = 0
        existing_write_offs = db.query(StockWriteOffModel.protocol_number).filter(StockWriteOffModel.protocol_number.like(f"{year_prefix}%")).all()
        for (pn,) in existing_write_offs:
            try:
                num = int(pn.split("-")[2])
                if num > max_num:
                    max_num = num
            except Exception:
                pass
        seq_obj = WriteOffSequenceModel(year=year, last_seq=max_num)
        db.add(seq_obj)
        db.flush()

    seq_obj.last_seq += 1
    next_num = seq_obj.last_seq
    return f"ODP-{year}-{next_num:04d}"


def generate_next_audit_number(db: Session, year: Optional[int] = None) -> str:
    """
    Atomically increments and retrieves the next physical inventory protocol sequence number (§ 29, 30 ZoÚ).
    Format: INV-YYYY-XXXX (e.g. INV-2026-0001)
    """
    if not year:
        year = datetime.now().year

    seq_obj = db.query(InventoryAuditSequenceModel).filter(InventoryAuditSequenceModel.year == year).first()
    if not seq_obj:
        year_prefix = f"INV-{year}-"
        max_num = 0
        existing_audits = db.query(InventoryAuditModel.protocol_number).filter(InventoryAuditModel.protocol_number.like(f"{year_prefix}%")).all()
        for (pn,) in existing_audits:
            try:
                num = int(pn.split("-")[2])
                if num > max_num:
                    max_num = num
            except Exception:
                pass
        seq_obj = InventoryAuditSequenceModel(year=year, last_seq=max_num)
        db.add(seq_obj)
        db.flush()

    seq_obj.last_seq += 1
    next_num = seq_obj.last_seq
    return f"INV-{year}-{next_num:04d}"


class WriteOffItemRequestSchema(BaseModel):
    preset_id: str
    quantity: float
    is_norm_loss: Optional[bool] = None  # None = auto-detect by category norm and reason


class WriteOffRequestSchema(BaseModel):
    reason: str  # 'EXSPIRACE', 'ZKAZA', 'ROZBITI', 'KRADEZ', 'OTHER'
    responsible_person: Optional[str] = None
    note: Optional[str] = None
    items: List[WriteOffItemRequestSchema]


class WriteOffItemResponseSchema(BaseModel):
    id: str
    preset_id: str
    preset_name: str
    quantity: float
    unit: str
    unit_cost: float
    unit_price: float
    vat: int
    total_cost: float
    total_price: float
    is_norm_loss: bool

    model_config = {"from_attributes": True}


class WriteOffResponseSchema(BaseModel):
    id: str
    protocol_number: str
    reason: str
    responsible_person: Optional[str] = None
    note: Optional[str] = None
    total_cost_value: float
    total_retail_value: float
    is_tax_deductible: bool
    vat_adjustment_required: bool
    timestamp: datetime
    items: List[WriteOffItemResponseSchema]

    model_config = {"from_attributes": True}


@router.post("/write-off", status_code=status.HTTP_201_CREATED, response_model=WriteOffResponseSchema)
def submit_stock_write_off(payload: WriteOffRequestSchema, db: Session = Depends(get_db)):
    """
    Process formal stock write-off & liquidation protocol (§ 25 ZoÚ / § 77, 78 ZDPH).
    In a single atomic transaction:
    - Verifies items and stock quantities (quantity must be positive).
    - Checks category natural loss norm and write-off reason to determine tax deductibility.
    - Decrements preset stock quantity.
    - Inserts WRITE_OFF movement into stock_movements ledger.
    - Generates sequential protocol number (ODP-YYYY-XXXX).
    - Persists StockWriteOffModel and StockWriteOffItemModel records.
    """
    if not payload.items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Odpisový protokol musí obsahovat alespoň jednu položku."
        )

    valid_reasons = {"EXSPIRACE", "ZKAZA", "ROZBITI", "KRADEZ", "OTHER"}
    clean_reason = (payload.reason or "").strip().upper()
    if clean_reason not in valid_reasons:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Neplatný důvod odpisu. Povolené hodnoty: {', '.join(sorted(valid_reasons))}"
        )

    for it in payload.items:
        if it.quantity is None or it.quantity <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Množství k odpisu musí být kladné číslo (zadáno: {it.quantity})."
            )

    now = datetime.utcnow()
    protocol_id = f"wroff_{uuid.uuid4().hex[:12]}"

    with atomic_transaction(db):
        protocol_num = generate_next_write_off_number(db, year=now.year)

        # Cache category norms
        categories = {c.id: (c.natural_loss_norm or 0.0) for c in db.query(CategoryModel).all()}

        created_items = []
        total_cost_sum = 0.0
        total_retail_sum = 0.0
        has_non_deductible_item = False

        # If reason is theft (KRADEZ), it is by tax law always non-deductible shortage requiring VAT adjustment
        force_non_deductible_by_reason = clean_reason in {"KRADEZ"}

        for it in payload.items:
            preset = db.query(PresetModel).filter(PresetModel.id == it.preset_id).first()
            if not preset:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Položka se zadaným ID {it.preset_id} nebyla nalezena."
                )

            item_qty = round(float(it.quantity), 3)
            unit_cost = round(float(preset.cost_price or 0.0), 2)
            unit_price = round(float(preset.price or 0.0), 2)
            vat_rate = int(preset.vat or 21)
            line_cost = round(item_qty * unit_cost, 2)
            line_retail = round(item_qty * unit_price, 2)

            total_cost_sum += line_cost
            total_retail_sum += line_retail

            # Determine if this line item is a natural loss within norm
            cat_norm = categories.get(preset.category, 0.0)
            if force_non_deductible_by_reason:
                is_norm = False
            elif it.is_norm_loss is not None:
                is_norm = bool(it.is_norm_loss)
            else:
                # Perishable reasons (EXSPIRACE, ZKAZA) with positive category norm qualify as natural loss
                is_norm = (cat_norm > 0 and clean_reason in {"EXSPIRACE", "ZKAZA"})

            if not is_norm:
                has_non_deductible_item = True

            # Decrement preset stock quantity
            cur_stock = preset.stock_quantity or 0.0
            preset.stock_quantity = round(cur_stock - item_qty, 3)

            # Record WRITE_OFF movement in stock ledger
            reason_labels = {
                "EXSPIRACE": "Exspirace",
                "ZKAZA": "Zkáza / Poškození",
                "ROZBITI": "Rozbití",
                "KRADEZ": "Krádež / Manko",
                "OTHER": "Jiné"
            }
            reason_text = reason_labels.get(clean_reason, clean_reason)
            norm_text = "v normě §25" if is_norm else "nad normu / zaviněné"
            movement_note = f"Odpis {protocol_num}: {reason_text} ({norm_text})"
            if payload.note:
                movement_note += f" - {payload.note.strip()}"

            movement = StockMovementModel(
                id=f"smov_{uuid.uuid4().hex[:12]}",
                preset_id=preset.id,
                movement_type="WRITE_OFF",
                quantity_delta=-item_qty,
                unit_cost=unit_cost,
                document_ref=protocol_num,
                note=movement_note,
                timestamp=now
            )
            db.add(movement)

            # Create protocol item
            write_off_item = StockWriteOffItemModel(
                id=f"wroi_{uuid.uuid4().hex[:12]}",
                write_off_id=protocol_id,
                preset_id=preset.id,
                preset_name=preset.name,
                quantity=item_qty,
                unit=preset.unit or "ks",
                unit_cost=unit_cost,
                unit_price=unit_price,
                vat=vat_rate,
                total_cost=line_cost,
                total_price=line_retail,
                is_norm_loss=is_norm
            )
            db.add(write_off_item)
            created_items.append(write_off_item)

        # Protocol is tax-deductible only if all items qualify within norm and not theft
        is_tax_deductible = not has_non_deductible_item
        vat_adjustment_required = not is_tax_deductible

        write_off_record = StockWriteOffModel(
            id=protocol_id,
            protocol_number=protocol_num,
            reason=clean_reason,
            responsible_person=payload.responsible_person.strip() if payload.responsible_person else None,
            note=payload.note.strip() if payload.note else None,
            total_cost_value=round(total_cost_sum, 2),
            total_retail_value=round(total_retail_sum, 2),
            is_tax_deductible=is_tax_deductible,
            vat_adjustment_required=vat_adjustment_required,
            timestamp=now
        )
        db.add(write_off_record)

    db.refresh(write_off_record)
    return write_off_record


@router.get("/write-offs", response_model=List[WriteOffResponseSchema])
def get_stock_write_offs(
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """Fetch chronological stock write-off protocols."""
    effective_limit = min(max(1, limit), 200)
    records = (
        db.query(StockWriteOffModel)
        .order_by(desc(StockWriteOffModel.timestamp))
        .offset(offset)
        .limit(effective_limit)
        .all()
    )
    return records


@router.get("/write-offs/{protocol_id}", response_model=WriteOffResponseSchema)
def get_stock_write_off_detail(protocol_id: str, db: Session = Depends(get_db)):
    """Fetch detail of a single write-off protocol by ID or protocol_number."""
    record = (
        db.query(StockWriteOffModel)
        .filter(
            (StockWriteOffModel.id == protocol_id) |
            (StockWriteOffModel.protocol_number == protocol_id)
        )
        .first()
    )
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Protokol o odpisu {protocol_id} nebyl nalezen."
        )
    return record


# =========================================================================
# Physical Inventory Audit & Discrepancy Reconciliation (§ 29, 30 ZoÚ)
# =========================================================================

class InventoryAuditItemRequestSchema(BaseModel):
    preset_id: str
    physical_quantity: float


class InventoryAuditRequestSchema(BaseModel):
    responsible_person: Optional[str] = None
    note: Optional[str] = None
    items: List[InventoryAuditItemRequestSchema]


class InventoryAuditItemResponseSchema(BaseModel):
    id: str
    preset_id: str
    preset_name: str
    system_quantity: float
    physical_quantity: float
    difference: float
    unit: str
    unit_cost: float
    total_cost_impact: float

    model_config = {"from_attributes": True}


class InventoryAuditResponseSchema(BaseModel):
    id: str
    protocol_number: str
    responsible_person: Optional[str] = None
    note: Optional[str] = None
    total_items_counted: int
    total_surplus_value: float
    total_shortage_value: float
    timestamp: datetime
    items: List[InventoryAuditItemResponseSchema]

    model_config = {"from_attributes": True}


@router.post("/audit", status_code=status.HTTP_201_CREATED, response_model=InventoryAuditResponseSchema)
def submit_inventory_audit(payload: InventoryAuditRequestSchema, db: Session = Depends(get_db)):
    """
    Process physical stock inventory audit protocol (§ 29, 30 ZoÚ).
    Atomically:
    - Verifies items and non-negative physical quantities.
    - Compares physical count to current database stock_quantity.
    - Generates ADJUSTMENT stock movements for any non-zero discrepancy.
    - Reconciles preset stock_quantity directly to physical count.
    - Generates sequential protocol number (INV-YYYY-XXXX).
    - Persists InventoryAuditModel and InventoryAuditItemModel records.
    """
    if not payload.items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inventurní arch musí obsahovat alespoň jednu položku."
        )

    for it in payload.items:
        if it.physical_quantity is None or it.physical_quantity < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Fyzické množství nesmí být záporné (zadáno: {it.physical_quantity})."
            )

    now = datetime.utcnow()
    audit_id = f"inv_{uuid.uuid4().hex[:12]}"

    with atomic_transaction(db):
        protocol_num = generate_next_audit_number(db, year=now.year)

        audit_items = []
        total_surplus_value = 0.0
        total_shortage_value = 0.0

        for it in payload.items:
            preset = db.query(PresetModel).filter(PresetModel.id == it.preset_id).first()
            if not preset:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Položka se zadaným ID {it.preset_id} neexistuje."
                )

            system_qty = float(preset.stock_quantity or 0.0)
            phys_qty = float(it.physical_quantity)
            diff = round(phys_qty - system_qty, 4)
            unit_cost = float(preset.cost_price or 0.0)
            cost_impact = round(diff * unit_cost, 2)

            if diff > 0:
                total_surplus_value += round(diff * unit_cost, 2)
            elif diff < 0:
                total_shortage_value += round(abs(diff) * unit_cost, 2)

            # Record stock adjustment movement if discrepancy exists
            if diff != 0:
                mov_id = f"sm_{uuid.uuid4().hex[:12]}"
                diff_label = f"+{diff:.2f}" if diff > 0 else f"{diff:.2f}"
                note_str = f"Inventura {protocol_num}: úprava ze stavu {system_qty:.2f} na {phys_qty:.2f} {preset.unit or 'ks'}"
                if payload.note:
                    note_str += f" ({payload.note})"

                mov = StockMovementModel(
                    id=mov_id,
                    preset_id=preset.id,
                    movement_type="ADJUSTMENT",
                    quantity_delta=diff,
                    unit_cost=unit_cost,
                    supplier_ico=None,
                    supplier_name=None,
                    document_ref=protocol_num,
                    note=note_str,
                    timestamp=now
                )
                db.add(mov)

            # Reconcile preset stock quantity to counted physical reality
            preset.stock_quantity = phys_qty

            item_id = f"invi_{uuid.uuid4().hex[:12]}"
            audit_item = InventoryAuditItemModel(
                id=item_id,
                audit_id=audit_id,
                preset_id=preset.id,
                preset_name=preset.name,
                system_quantity=system_qty,
                physical_quantity=phys_qty,
                difference=diff,
                unit=preset.unit or "ks",
                unit_cost=unit_cost,
                total_cost_impact=cost_impact
            )
            audit_items.append(audit_item)

        audit_record = InventoryAuditModel(
            id=audit_id,
            protocol_number=protocol_num,
            responsible_person=(payload.responsible_person or "").strip() or None,
            note=(payload.note or "").strip() or None,
            total_items_counted=len(audit_items),
            total_surplus_value=round(total_surplus_value, 2),
            total_shortage_value=round(total_shortage_value, 2),
            timestamp=now
        )
        audit_record.items = audit_items
        db.add(audit_record)
        db.flush()

        db.refresh(audit_record)
        return audit_record


@router.get("/audits", response_model=List[InventoryAuditResponseSchema])
def get_inventory_audits(
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """Fetch chronological physical inventory audit protocols."""
    effective_limit = min(max(1, limit), 200)
    records = (
        db.query(InventoryAuditModel)
        .order_by(desc(InventoryAuditModel.timestamp))
        .offset(offset)
        .limit(effective_limit)
        .all()
    )
    return records


@router.get("/audits/{protocol_id}", response_model=InventoryAuditResponseSchema)
def get_inventory_audit_detail(protocol_id: str, db: Session = Depends(get_db)):
    """Fetch detail of a single physical inventory audit protocol by ID or protocol_number."""
    record = (
        db.query(InventoryAuditModel)
        .filter(
            (InventoryAuditModel.id == protocol_id) |
            (InventoryAuditModel.protocol_number == protocol_id)
        )
        .first()
    )
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Protokol o inventuře {protocol_id} nebyl nalezen."
        )
    return record
