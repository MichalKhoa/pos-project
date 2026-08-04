from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models import CategoryModel, PresetModel
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/catalog", tags=["Catalog Presets & Categories"])

# Pydantic Schemas
class CategorySchema(BaseModel):
    id: str
    name: str
    position: Optional[int] = 0

class PresetSchema(BaseModel):
    id: str
    name: str
    price: float
    category: str
    vat: Optional[int] = 21
    color: Optional[str] = "#3b82f6"
    isOpenPrice: Optional[bool] = False
    isGeneralPreset: Optional[bool] = False
    position: Optional[int] = 0
    stockQuantity: Optional[int] = 0
    trackStock: Optional[bool] = False
    minStockAlert: Optional[int] = 5
    barcode: Optional[str] = ""

class RestockPresetSchema(BaseModel):
    quantity_add: int

class ReorderPresetsSchema(BaseModel):
    presets: List[PresetSchema]

# Default Seed Data
DEFAULT_CATEGORIES_DATA = [
    {"id": "all", "name": "Všechny položky", "position": 0}
]

DEFAULT_PRESETS_DATA = [
    {"id": "preset-clothes", "name": "Oblečení", "price": 0, "vat": 21, "category": "all", "color": "#3b82f6", "is_open_price": True, "is_general": True, "position": 0, "stock_quantity": 0, "track_stock": False, "min_stock_alert": 5, "barcode": ""},
    {"id": "preset-shoes", "name": "Boty", "price": 0, "vat": 21, "category": "all", "color": "#8b5cf6", "is_open_price": True, "is_general": True, "position": 1, "stock_quantity": 0, "track_stock": False, "min_stock_alert": 5, "barcode": ""},
    {"id": "preset-socks", "name": "Ponožky", "price": 0, "vat": 21, "category": "all", "color": "#10b981", "is_open_price": True, "is_general": True, "position": 2, "stock_quantity": 0, "track_stock": False, "min_stock_alert": 5, "barcode": ""},
    {"id": "preset-underwear", "name": "Spodní prádlo", "price": 0, "vat": 21, "category": "all", "color": "#ec4899", "is_open_price": True, "is_general": True, "position": 3, "stock_quantity": 0, "track_stock": False, "min_stock_alert": 5, "barcode": ""},
    {"id": "preset-home", "name": "Domácí potřeby", "price": 0, "vat": 21, "category": "all", "color": "#06b6d4", "is_open_price": True, "is_general": True, "position": 4, "stock_quantity": 0, "track_stock": False, "min_stock_alert": 5, "barcode": ""},
    {"id": "preset-open-1", "name": "Volný Prodej Zboží", "price": 0, "vat": 21, "category": "all", "color": "#f59e0b", "is_open_price": True, "is_general": True, "position": 5, "stock_quantity": 0, "track_stock": False, "min_stock_alert": 5, "barcode": ""},
    {"id": "preset-open-2", "name": "Dárkový Poukaz", "price": 0, "vat": 0, "category": "all", "color": "#f43f5e", "is_open_price": True, "is_general": True, "position": 6, "stock_quantity": 0, "track_stock": False, "min_stock_alert": 5, "barcode": ""}
]

# --- CATEGORIES ENDPOINTS ---

@router.get("/categories")
def get_categories(db: Session = Depends(get_db)):
    """Fetch product categories. Seeds defaults if DB empty."""
    cats = db.query(CategoryModel).order_by(CategoryModel.position.asc()).all()
    if not cats:
        for c in DEFAULT_CATEGORIES_DATA:
            db_cat = CategoryModel(id=c["id"], name=c["name"], position=c["position"])
            db.add(db_cat)
        db.commit()
        cats = db.query(CategoryModel).order_by(CategoryModel.position.asc()).all()
    return [{"id": c.id, "name": c.name, "position": c.position} for c in cats]

@router.post("/categories", status_code=status.HTTP_201_CREATED)
def save_category(cat: CategorySchema, db: Session = Depends(get_db)):
    """Create or update a category."""
    existing = db.query(CategoryModel).filter(CategoryModel.id == cat.id).first()
    if existing:
        existing.name = cat.name
        existing.position = cat.position
    else:
        existing = CategoryModel(id=cat.id, name=cat.name, position=cat.position)
        db.add(existing)
    db.commit()
    db.refresh(existing)
    return {"id": existing.id, "name": existing.name, "position": existing.position}

@router.delete("/categories/{cat_id}")
def delete_category(cat_id: str, db: Session = Depends(get_db)):
    """Delete a category by ID."""
    existing = db.query(CategoryModel).filter(CategoryModel.id == cat_id).first()
    if existing:
        db.delete(existing)
        db.commit()
    return {"status": "SUCCESS", "deleted_id": cat_id}

# --- PRESETS ENDPOINTS ---

@router.get("/presets")
def get_presets(db: Session = Depends(get_db)):
    """Fetch quick item presets. Seeds defaults if DB empty or migrates legacy seed presets."""
    presets = db.query(PresetModel).order_by(PresetModel.position.asc()).all()

    # Auto-migrate legacy sample item presets (preset-1 .. preset-8)
    has_legacy = any(p.id in ["preset-1", "preset-2", "preset-3", "preset-4", "preset-5", "preset-6", "preset-7", "preset-8"] for p in presets)

    if not presets or has_legacy:
        if has_legacy:
            db.query(PresetModel).filter(PresetModel.id.in_(["preset-1", "preset-2", "preset-3", "preset-4", "preset-5", "preset-6", "preset-7", "preset-8", "preset-open-1", "preset-open-2"])).delete(synchronize_session=False)
            db.commit()

        existing_ids = {p.id for p in db.query(PresetModel).all()}
        for p in DEFAULT_PRESETS_DATA:
            if p["id"] not in existing_ids:
                db_preset = PresetModel(
                    id=p["id"],
                    name=p["name"],
                    price=p["price"],
                    vat=p["vat"],
                    category=p["category"],
                    color=p["color"],
                    is_open_price=p.get("is_open_price", False),
                    is_general=p.get("is_general", False),
                    position=p["position"],
                    stock_quantity=p.get("stock_quantity", 0),
                    track_stock=p.get("track_stock", False),
                    min_stock_alert=p.get("min_stock_alert", 5),
                    barcode=p.get("barcode", "")
                )
                db.add(db_preset)
        db.commit()
        presets = db.query(PresetModel).order_by(PresetModel.position.asc()).all()

    return [
        {
            "id": p.id,
            "name": p.name,
            "price": p.price,
            "category": p.category,
            "vat": p.vat,
            "color": p.color,
            "isOpenPrice": p.is_open_price,
            "isGeneralPreset": p.is_general if p.is_general is not None else False,
            "position": p.position,
            "stockQuantity": p.stock_quantity if p.stock_quantity is not None else 0,
            "trackStock": p.track_stock if p.track_stock is not None else False,
            "minStockAlert": p.min_stock_alert if p.min_stock_alert is not None else 5,
            "barcode": p.barcode or ""
        }
        for p in presets
    ]


@router.get("/barcode/{code}")
def get_preset_by_barcode(code: str, db: Session = Depends(get_db)):
    """Fetch product preset matching scanned EAN/barcode (supports single or comma-separated barcodes)."""
    clean_code = code.strip()
    all_presets = db.query(PresetModel).all()
    preset = None
    for p in all_presets:
        if not p.barcode:
            continue
        barcodes = [b.strip() for b in p.barcode.split(",") if b.strip()]
        if clean_code in barcodes:
            preset = p
            break

    if not preset:
        raise HTTPException(status_code=404, detail=f"Zboží s čárovým kódem {clean_code} nebylo nalezeno.")
    return {
        "id": preset.id,
        "name": preset.name,
        "price": preset.price,
        "category": preset.category,
        "vat": preset.vat,
        "color": preset.color,
        "isOpenPrice": preset.is_open_price,
        "isGeneralPreset": preset.is_general or False,
        "position": preset.position,
        "stockQuantity": preset.stock_quantity or 0,
        "trackStock": preset.track_stock or False,
        "minStockAlert": preset.min_stock_alert or 5,
        "barcode": preset.barcode or ""
    }


@router.post("/presets", status_code=status.HTTP_201_CREATED)
def save_preset(preset: PresetSchema, db: Session = Depends(get_db)):
    """Create or update a preset button."""
    existing = db.query(PresetModel).filter(PresetModel.id == preset.id).first()
    if existing:
        existing.name = preset.name
        existing.price = preset.price
        existing.category = preset.category
        existing.vat = preset.vat
        existing.color = preset.color
        existing.is_open_price = preset.isOpenPrice
        existing.is_general = preset.isGeneralPreset if preset.isGeneralPreset is not None else False
        existing.position = preset.position
        existing.stock_quantity = preset.stockQuantity if preset.stockQuantity is not None else 0
        existing.track_stock = preset.trackStock if preset.trackStock is not None else False
        existing.min_stock_alert = preset.minStockAlert if preset.minStockAlert is not None else 5
        existing.barcode = preset.barcode or ""
    else:
        existing = PresetModel(
            id=preset.id,
            name=preset.name,
            price=preset.price,
            category=preset.category,
            vat=preset.vat,
            color=preset.color,
            is_open_price=preset.isOpenPrice,
            is_general=preset.isGeneralPreset if preset.isGeneralPreset is not None else False,
            position=preset.position,
            stock_quantity=preset.stockQuantity if preset.stockQuantity is not None else 0,
            track_stock=preset.trackStock if preset.trackStock is not None else False,
            min_stock_alert=preset.minStockAlert if preset.minStockAlert is not None else 5,
            barcode=preset.barcode or ""
        )
        db.add(existing)
    db.commit()
    db.refresh(existing)
    return {
        "id": existing.id,
        "name": existing.name,
        "price": existing.price,
        "category": existing.category,
        "vat": existing.vat,
        "color": existing.color,
        "isOpenPrice": existing.is_open_price,
        "isGeneralPreset": existing.is_general,
        "position": existing.position,
        "stockQuantity": existing.stock_quantity,
        "trackStock": existing.track_stock,
        "minStockAlert": existing.min_stock_alert,
        "barcode": existing.barcode
    }


@router.post("/presets/{preset_id}/restock")
def restock_preset(preset_id: str, data: RestockPresetSchema, db: Session = Depends(get_db)):
    """Quickly increment stock quantity for a preset item."""
    preset = db.query(PresetModel).filter(PresetModel.id == preset_id).first()
    if not preset:
        raise HTTPException(status_code=404, detail="Položka nebyla nalezena.")

    preset.stock_quantity = (preset.stock_quantity or 0) + data.quantity_add
    db.commit()
    db.refresh(preset)
    return {
        "status": "SUCCESS",
        "id": preset.id,
        "name": preset.name,
        "new_stock_quantity": preset.stock_quantity
    }


@router.put("/presets/reorder")
def reorder_presets(payload: ReorderPresetsSchema, db: Session = Depends(get_db)):
    """Bulk update presets order positions."""
    for idx, p in enumerate(payload.presets):
        existing = db.query(PresetModel).filter(PresetModel.id == p.id).first()
        if existing:
            existing.position = idx
    db.commit()
    return {"status": "SUCCESS", "message": "Presets reordered successfully."}


@router.delete("/presets/{preset_id}")
def delete_preset(preset_id: str, db: Session = Depends(get_db)):
    """Delete a preset by ID."""
    existing = db.query(PresetModel).filter(PresetModel.id == preset_id).first()
    if existing:
        db.delete(existing)
        db.commit()
    return {"status": "SUCCESS", "deleted_id": preset_id}

