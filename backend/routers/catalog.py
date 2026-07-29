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
    position: Optional[int] = 0

class ReorderPresetsSchema(BaseModel):
    presets: List[PresetSchema]

# Default Seed Data
DEFAULT_CATEGORIES_DATA = [
    {"id": "all", "name": "Všechny položky", "position": 0},
    {"id": "living", "name": "Obývák & Dekorace", "position": 1},
    {"id": "kitchen", "name": "Kuchyně & Jídelna", "position": 2},
    {"id": "bath", "name": "Koupelna", "position": 3},
    {"id": "custom", "name": "Rychlý prodej", "position": 4}
]

DEFAULT_PRESETS_DATA = [
    {"id": "preset-1", "name": "Svíčka Vonná Premium", "price": 249, "vat": 21, "category": "living", "color": "#8b5cf6", "position": 0},
    {"id": "preset-2", "name": "Váza Keramická bílá", "price": 389, "vat": 21, "category": "living", "color": "#3b82f6", "position": 1},
    {"id": "preset-3", "name": "Hrnek Keramický 350ml", "price": 149, "vat": 21, "category": "kitchen", "color": "#10b981", "position": 2},
    {"id": "preset-4", "name": "Sada Příborů 24ks", "price": 699, "vat": 21, "category": "kitchen", "color": "#f59e0b", "position": 3},
    {"id": "preset-5", "name": "Ručník Bavlna 50x100", "price": 199, "vat": 21, "category": "bath", "color": "#06b6d4", "position": 4},
    {"id": "preset-6", "name": "Dávkovač Mýdla Sklo", "price": 229, "vat": 21, "category": "bath", "color": "#ec4899", "position": 5},
    {"id": "preset-7", "name": "Eko Čistící Prostředek", "price": 119, "vat": 21, "category": "bath", "color": "#14b8a6", "position": 6},
    {"id": "preset-8", "name": "Polštář Dekorativní", "price": 299, "vat": 21, "category": "living", "color": "#a855f7", "position": 7},
    {"id": "preset-open-1", "name": "Volný Prodej Zboží", "price": 0, "vat": 21, "category": "custom", "color": "#f59e0b", "is_open_price": True, "position": 8},
    {"id": "preset-open-2", "name": "Dárkový Poukaz (Libovolná částka)", "price": 0, "vat": 0, "category": "custom", "color": "#ec4899", "is_open_price": True, "position": 9}
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
    """Fetch quick item presets. Seeds defaults if DB empty."""
    presets = db.query(PresetModel).order_by(PresetModel.position.asc()).all()
    if not presets:
        for p in DEFAULT_PRESETS_DATA:
            db_preset = PresetModel(
                id=p["id"],
                name=p["name"],
                price=p["price"],
                vat=p["vat"],
                category=p["category"],
                color=p["color"],
                is_open_price=p.get("is_open_price", False),
                position=p["position"]
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
            "position": p.position
        }
        for p in presets
    ]

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
        existing.position = preset.position
    else:
        existing = PresetModel(
            id=preset.id,
            name=preset.name,
            price=preset.price,
            category=preset.category,
            vat=preset.vat,
            color=preset.color,
            is_open_price=preset.isOpenPrice,
            position=preset.position
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
        "position": existing.position
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
