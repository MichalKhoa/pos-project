from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models import CategoryModel, PresetModel
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/catalog", tags=["Catalog & Presets"])


class CategorySchema(BaseModel):
    id: str
    name: str
    position: Optional[int] = 0


class PresetSchema(BaseModel):
    id: str
    name: str
    price: float = 0.0
    category: str = "custom"
    vat: int = 21
    color: Optional[str] = None
    is_open_price: Optional[bool] = False
    position: Optional[int] = 0


class ReorderPresetsSchema(BaseModel):
    presets: List[dict]


@router.get("/categories")
def get_categories(db: Session = Depends(get_db)):
    """Fetch product categories."""
    return db.query(CategoryModel).order_by(CategoryModel.position).all()


@router.post("/categories", status_code=status.HTTP_200_OK)
def save_category(cat: CategorySchema, db: Session = Depends(get_db)):
    """Save or update a category."""
    db_cat = db.query(CategoryModel).filter(CategoryModel.id == cat.id).first()
    if db_cat:
        db_cat.name = cat.name
        if cat.position is not None:
            db_cat.position = cat.position
    else:
        db_cat = CategoryModel(
            id=cat.id,
            name=cat.name,
            position=cat.position or 0
        )
        db.add(db_cat)
    db.commit()
    db.refresh(db_cat)
    return db_cat


@router.delete("/categories/{cat_id}")
def delete_category(cat_id: str, db: Session = Depends(get_db)):
    """Delete a category."""
    cat = db.query(CategoryModel).filter(CategoryModel.id == cat_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    db.delete(cat)
    db.commit()
    return {"status": "DELETED", "id": cat_id}


@router.get("/presets")
def get_presets(db: Session = Depends(get_db)):
    """Fetch quick item presets."""
    return db.query(PresetModel).order_by(PresetModel.position).all()


@router.post("/presets", status_code=status.HTTP_200_OK)
def save_preset(preset: PresetSchema, db: Session = Depends(get_db)):
    """Save or update a preset."""
    db_preset = db.query(PresetModel).filter(PresetModel.id == preset.id).first()
    if db_preset:
        db_preset.name = preset.name
        db_preset.price = preset.price
        db_preset.category = preset.category
        db_preset.vat = preset.vat
        db_preset.color = preset.color
        db_preset.is_open_price = preset.is_open_price or False
        if preset.position is not None:
            db_preset.position = preset.position
    else:
        db_preset = PresetModel(
            id=preset.id,
            name=preset.name,
            price=preset.price,
            category=preset.category,
            vat=preset.vat,
            color=preset.color,
            is_open_price=preset.is_open_price or False,
            position=preset.position or 0
        )
        db.add(db_preset)
    db.commit()
    db.refresh(db_preset)
    return db_preset


@router.put("/presets/reorder")
def reorder_presets(body: ReorderPresetsSchema, db: Session = Depends(get_db)):
    """Bulk reorder presets."""
    for idx, item in enumerate(body.presets):
        preset_id = item.get("id")
        if preset_id:
            db_preset = db.query(PresetModel).filter(PresetModel.id == preset_id).first()
            if db_preset:
                db_preset.position = idx
    db.commit()
    return {"status": "UPDATED"}


@router.delete("/presets/{preset_id}")
def delete_preset(preset_id: str, db: Session = Depends(get_db)):
    """Delete a preset."""
    preset = db.query(PresetModel).filter(PresetModel.id == preset_id).first()
    if not preset:
        raise HTTPException(status_code=404, detail="Preset not found")
    db.delete(preset)
    db.commit()
    return {"status": "DELETED", "id": preset_id}
