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
    naturalLossNorm: Optional[float] = None
    natural_loss_norm: Optional[float] = None

    @property
    def effective_natural_loss_norm(self) -> float:
        if self.naturalLossNorm is not None:
            return float(self.naturalLossNorm)
        if self.natural_loss_norm is not None:
            return float(self.natural_loss_norm)
        return 0.0

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
    stockQuantity: Optional[float] = 0.0
    trackStock: Optional[bool] = False
    minStockAlert: Optional[float] = 5.0
    barcode: Optional[str] = ""
    icon: Optional[str] = None
    imageUrl: Optional[str] = None
    showInPresets: Optional[bool] = True
    costPrice: Optional[float] = 0.0
    unit: Optional[str] = 'ks'
    isWeighted: Optional[bool] = False
    marginCoefficient: Optional[float] = None
    is_weighted: Optional[bool] = None
    margin_coefficient: Optional[float] = None

    @property
    def effective_is_weighted(self) -> bool:
        if self.isWeighted is not None:
            return self.isWeighted
        if self.is_weighted is not None:
            return self.is_weighted
        return False

    @property
    def effective_margin_coefficient(self) -> Optional[float]:
        return self.marginCoefficient if self.marginCoefficient is not None else self.margin_coefficient

class RestockPresetSchema(BaseModel):
    quantity_add: float

class ReorderPresetsSchema(BaseModel):
    presets: List[PresetSchema]

class ReorderCategoriesSchema(BaseModel):
    categories: List[CategorySchema]

# Default Seed Data
DEFAULT_CATEGORIES_DATA = [
    {"id": "all", "name": "Všechny položky", "position": 0}
]

DEFAULT_PRESETS_DATA = [
    {"id": "preset-clothes", "name": "Oblečení", "icon": "Shirt", "price": 0, "vat": 21, "category": "all", "color": "#3b82f6", "is_open_price": True, "is_general": True, "position": 0, "stock_quantity": 0.0, "track_stock": False, "min_stock_alert": 5.0, "barcode": "", "unit": "ks", "is_weighted": False, "cost_price": 0.0},
    {"id": "preset-shoes", "name": "Boty", "icon": "Footprints", "price": 0, "vat": 21, "category": "all", "color": "#8b5cf6", "is_open_price": True, "is_general": True, "position": 1, "stock_quantity": 0.0, "track_stock": False, "min_stock_alert": 5.0, "barcode": "", "unit": "ks", "is_weighted": False, "cost_price": 0.0},
    {"id": "preset-socks", "name": "Ponožky", "icon": "Layers", "price": 0, "vat": 21, "category": "all", "color": "#10b981", "is_open_price": True, "is_general": True, "position": 2, "stock_quantity": 0.0, "track_stock": False, "min_stock_alert": 5.0, "barcode": "", "unit": "ks", "is_weighted": False, "cost_price": 0.0},
    {"id": "preset-underwear", "name": "Spodní prádlo", "icon": "Heart", "price": 0, "vat": 21, "category": "all", "color": "#ec4899", "is_open_price": True, "is_general": True, "position": 3, "stock_quantity": 0.0, "track_stock": False, "min_stock_alert": 5.0, "barcode": "", "unit": "ks", "is_weighted": False, "cost_price": 0.0},
    {"id": "preset-home", "name": "Domácí potřeby", "icon": "Home", "price": 0, "vat": 21, "category": "all", "color": "#06b6d4", "is_open_price": True, "is_general": True, "position": 4, "stock_quantity": 0.0, "track_stock": False, "min_stock_alert": 5.0, "barcode": "", "unit": "ks", "is_weighted": False, "cost_price": 0.0},
    {"id": "preset-open-1", "name": "Volný Prodej Zboží", "icon": "Package", "price": 0, "vat": 21, "category": "all", "color": "#f59e0b", "is_open_price": True, "is_general": True, "position": 5, "stock_quantity": 0.0, "track_stock": False, "min_stock_alert": 5.0, "barcode": "", "unit": "ks", "is_weighted": False, "cost_price": 0.0},
    {"id": "preset-open-2", "name": "Dárkový Poukaz", "icon": "Gift", "price": 0, "vat": 0, "category": "all", "color": "#f43f5e", "is_open_price": True, "is_general": True, "position": 6, "stock_quantity": 0.0, "track_stock": False, "min_stock_alert": 5.0, "barcode": "", "unit": "ks", "is_weighted": False, "cost_price": 0.0},
    # Realistic test items for Tasks 1.1, 1.2, 1.3
    {"id": "preset-banana", "name": "Banány volné", "icon": "Banana", "price": 39.90, "cost_price": 24.50, "vat": 12, "category": "all", "color": "#eab308", "is_open_price": False, "is_general": False, "position": 7, "stock_quantity": 45.5, "track_stock": True, "min_stock_alert": 10.0, "barcode": "2900001000000", "unit": "kg", "is_weighted": True, "margin_coefficient": 1.35},
    {"id": "preset-apples", "name": "Jablka Gala", "icon": "Apple", "price": 42.00, "cost_price": 26.00, "vat": 12, "category": "all", "color": "#ef4444", "is_open_price": False, "is_general": False, "position": 8, "stock_quantity": 32.0, "track_stock": True, "min_stock_alert": 10.0, "barcode": "2900002000000", "unit": "kg", "is_weighted": True, "margin_coefficient": 1.35},
    {"id": "preset-open-weighted", "name": "Volné ovoce / zelenina (váha)", "icon": "Scale", "price": 0.0, "cost_price": 0.0, "vat": 12, "category": "all", "color": "#10b981", "is_open_price": True, "is_general": True, "position": 9, "stock_quantity": 0.0, "track_stock": False, "min_stock_alert": 5.0, "barcode": "", "unit": "kg", "is_weighted": True, "margin_coefficient": None},
    {"id": "preset-bread-roll", "name": "Rohlík tukový", "icon": "Wheat", "price": 3.50, "cost_price": 2.10, "vat": 12, "category": "all", "color": "#d97706", "is_open_price": False, "is_general": False, "position": 10, "stock_quantity": 150.0, "track_stock": True, "min_stock_alert": 30.0, "barcode": "8594000001234", "unit": "ks", "is_weighted": False, "margin_coefficient": 1.40},
    {"id": "preset-coffee-beans", "name": "Zrnková Káva Espresso 1kg", "icon": "Coffee", "price": 249.00, "cost_price": 145.00, "vat": 21, "category": "all", "color": "#78350f", "is_open_price": False, "is_general": False, "position": 11, "stock_quantity": 12.0, "track_stock": True, "min_stock_alert": 5.0, "barcode": "8594000005678", "unit": "ks", "is_weighted": False, "margin_coefficient": 1.40},
    {"id": "preset-plzen-beer", "name": "Pilsner Urquell 0.5l", "icon": "Beer", "price": 36.90, "cost_price": 23.50, "vat": 21, "category": "all", "color": "#15803d", "is_open_price": False, "is_general": False, "position": 12, "stock_quantity": 72.0, "track_stock": True, "min_stock_alert": 24.0, "barcode": "8594000009999", "unit": "ks", "is_weighted": False, "margin_coefficient": 1.35}
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
    return [
        {
            "id": c.id,
            "name": c.name,
            "position": c.position,
            "naturalLossNorm": getattr(c, "natural_loss_norm", 0.0) or 0.0
        }
        for c in cats
    ]

@router.post("/categories", status_code=status.HTTP_201_CREATED)
def save_category(cat: CategorySchema, db: Session = Depends(get_db)):
    """Create or update a category."""
    existing = db.query(CategoryModel).filter(CategoryModel.id == cat.id).first()
    if existing:
        existing.name = cat.name
        existing.position = cat.position
        existing.natural_loss_norm = cat.effective_natural_loss_norm
    else:
        existing = CategoryModel(
            id=cat.id,
            name=cat.name,
            position=cat.position,
            natural_loss_norm=cat.effective_natural_loss_norm
        )
        db.add(existing)
    db.commit()
    db.refresh(existing)
    return {
        "id": existing.id,
        "name": existing.name,
        "position": existing.position,
        "naturalLossNorm": existing.natural_loss_norm
    }

@router.delete("/categories/{cat_id}")
def delete_category(cat_id: str, db: Session = Depends(get_db)):
    """Delete a category by ID."""
    existing = db.query(CategoryModel).filter(CategoryModel.id == cat_id).first()
    if existing:
        db.delete(existing)
        db.commit()
    return {"status": "SUCCESS", "deleted_id": cat_id}

@router.put("/categories/reorder")
def reorder_categories(payload: ReorderCategoriesSchema, db: Session = Depends(get_db)):
    """Bulk update categories order positions."""
    for idx, c in enumerate(payload.categories):
        existing = db.query(CategoryModel).filter(CategoryModel.id == c.id).first()
        if existing:
            existing.position = idx
    db.commit()
    return {"status": "SUCCESS", "message": "Categories reordered successfully."}

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
                    stock_quantity=p.get("stock_quantity", 0.0),
                    track_stock=p.get("track_stock", False),
                    min_stock_alert=p.get("min_stock_alert", 5.0),
                    barcode=p.get("barcode", ""),
                    icon=p.get("icon", None),
                    image_url=p.get("imageUrl", None),
                    cost_price=p.get("cost_price", 0.0),
                    unit=p.get("unit", "ks"),
                    is_weighted=p.get("is_weighted", False),
                    margin_coefficient=p.get("margin_coefficient", None)
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
            "stockQuantity": p.stock_quantity if p.stock_quantity is not None else 0.0,
            "trackStock": p.track_stock if p.track_stock is not None else False,
            "minStockAlert": p.min_stock_alert if p.min_stock_alert is not None else 5.0,
            "barcode": p.barcode or "",
            "icon": getattr(p, 'icon', None),
            "imageUrl": getattr(p, 'image_url', None),
            "showInPresets": p.show_in_presets if getattr(p, 'show_in_presets', None) is not None else True,
            "costPrice": getattr(p, 'cost_price', 0.0) or 0.0,
            "unit": getattr(p, 'unit', 'ks') or 'ks',
            "isWeighted": getattr(p, 'is_weighted', False) if getattr(p, 'is_weighted', None) is not None else False,
            "marginCoefficient": getattr(p, 'margin_coefficient', None)
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
        "stockQuantity": preset.stock_quantity if preset.stock_quantity is not None else 0.0,
        "trackStock": preset.track_stock or False,
        "minStockAlert": preset.min_stock_alert if preset.min_stock_alert is not None else 5.0,
        "barcode": preset.barcode or "",
        "icon": getattr(preset, 'icon', None),
        "imageUrl": getattr(preset, 'image_url', None),
        "showInPresets": preset.show_in_presets if getattr(preset, 'show_in_presets', None) is not None else True,
        "costPrice": getattr(preset, 'cost_price', 0.0) or 0.0,
        "unit": getattr(preset, 'unit', 'ks') or 'ks',
        "isWeighted": getattr(preset, 'is_weighted', False) if getattr(preset, 'is_weighted', None) is not None else False,
        "marginCoefficient": getattr(preset, 'margin_coefficient', None)
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
        existing.stock_quantity = round(preset.stockQuantity, 3) if preset.stockQuantity is not None else 0.0
        existing.track_stock = preset.trackStock if preset.trackStock is not None else False
        existing.min_stock_alert = round(preset.minStockAlert, 3) if preset.minStockAlert is not None else 5.0
        existing.barcode = preset.barcode or ""
        existing.show_in_presets = preset.showInPresets if preset.showInPresets is not None else True
        existing.cost_price = preset.costPrice if preset.costPrice is not None else 0.0
        existing.unit = preset.unit or "ks"
        existing.is_weighted = preset.effective_is_weighted
        existing.margin_coefficient = preset.effective_margin_coefficient
        if hasattr(existing, 'icon'): existing.icon = preset.icon
        if hasattr(existing, 'image_url'): existing.image_url = preset.imageUrl
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
            stock_quantity=round(preset.stockQuantity, 3) if preset.stockQuantity is not None else 0.0,
            track_stock=preset.trackStock if preset.trackStock is not None else False,
            min_stock_alert=round(preset.minStockAlert, 3) if preset.minStockAlert is not None else 5.0,
            barcode=preset.barcode or "",
            icon=preset.icon,
            image_url=preset.imageUrl,
            show_in_presets=preset.showInPresets if preset.showInPresets is not None else True,
            cost_price=preset.costPrice if preset.costPrice is not None else 0.0,
            unit=preset.unit or "ks",
            is_weighted=preset.effective_is_weighted,
            margin_coefficient=preset.effective_margin_coefficient
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
        "stockQuantity": existing.stock_quantity if existing.stock_quantity is not None else 0.0,
        "trackStock": existing.track_stock,
        "minStockAlert": existing.min_stock_alert if existing.min_stock_alert is not None else 5.0,
        "barcode": existing.barcode,
        "icon": getattr(existing, 'icon', None),
        "imageUrl": getattr(existing, 'image_url', None),
        "showInPresets": getattr(existing, 'show_in_presets', True),
        "costPrice": getattr(existing, 'cost_price', 0.0),
        "unit": getattr(existing, 'unit', 'ks') or 'ks',
        "isWeighted": getattr(existing, 'is_weighted', False) if getattr(existing, 'is_weighted', None) is not None else False,
        "marginCoefficient": getattr(existing, 'margin_coefficient', None)
    }


@router.post("/presets/bulk")
def bulk_save_presets(presets: List[PresetSchema], db: Session = Depends(get_db)):
    """Bulk upsert preset items (e.g. from CSV import or batch edit)."""
    saved_count = 0
    for p in presets:
        existing = db.query(PresetModel).filter(PresetModel.id == p.id).first()
        if existing:
            existing.name = p.name
            existing.price = p.price
            existing.category = p.category
            existing.vat = p.vat
            existing.color = p.color
            existing.is_open_price = p.isOpenPrice
            existing.is_general = p.isGeneralPreset if p.isGeneralPreset is not None else False
            existing.position = p.position
            existing.stock_quantity = round(p.stockQuantity, 3) if p.stockQuantity is not None else 0.0
            existing.track_stock = p.trackStock if p.trackStock is not None else False
            existing.min_stock_alert = round(p.minStockAlert, 3) if p.minStockAlert is not None else 5.0
            existing.barcode = p.barcode or ""
            existing.show_in_presets = p.showInPresets if p.showInPresets is not None else True
            existing.cost_price = p.costPrice if p.costPrice is not None else 0.0
            existing.unit = p.unit or "ks"
            existing.is_weighted = p.effective_is_weighted
            existing.margin_coefficient = p.effective_margin_coefficient
            if hasattr(existing, 'icon'): existing.icon = p.icon
            if hasattr(existing, 'image_url'): existing.image_url = p.imageUrl
        else:
            new_item = PresetModel(
                id=p.id,
                name=p.name,
                price=p.price,
                category=p.category,
                vat=p.vat,
                color=p.color,
                is_open_price=p.isOpenPrice,
                is_general=p.isGeneralPreset if p.isGeneralPreset is not None else False,
                position=p.position,
                stock_quantity=round(p.stockQuantity, 3) if p.stockQuantity is not None else 0.0,
                track_stock=p.trackStock if p.trackStock is not None else False,
                min_stock_alert=round(p.minStockAlert, 3) if p.minStockAlert is not None else 5.0,
                barcode=p.barcode or "",
                icon=p.icon,
                image_url=p.imageUrl,
                show_in_presets=p.showInPresets if p.showInPresets is not None else True,
                cost_price=p.costPrice if p.costPrice is not None else 0.0,
                unit=p.unit or "ks",
                is_weighted=p.effective_is_weighted,
                margin_coefficient=p.effective_margin_coefficient
            )
            db.add(new_item)
        saved_count += 1
    db.commit()
    return {"status": "SUCCESS", "savedCount": saved_count}


@router.patch("/presets/{preset_id}/toggle-pin")
def toggle_preset_pin(preset_id: str, db: Session = Depends(get_db)):
    """1-Tap toggle: Pin or unpin an item to/from register touchscreen presets."""
    preset = db.query(PresetModel).filter(PresetModel.id == preset_id).first()
    if not preset:
        raise HTTPException(status_code=404, detail="Položka nebyla nalezena.")

    current_val = preset.show_in_presets if preset.show_in_presets is not None else True
    preset.show_in_presets = not current_val
    db.commit()
    db.refresh(preset)
    return {
        "status": "SUCCESS",
        "id": preset.id,
        "name": preset.name,
        "showInPresets": preset.show_in_presets
    }


@router.post("/presets/{preset_id}/restock")
def restock_preset(preset_id: str, data: RestockPresetSchema, db: Session = Depends(get_db)):
    """Quickly increment stock quantity for a preset item."""
    preset = db.query(PresetModel).filter(PresetModel.id == preset_id).first()
    if not preset:
        raise HTTPException(status_code=404, detail="Položka nebyla nalezena.")

    preset.stock_quantity = round((preset.stock_quantity or 0.0) + data.quantity_add, 3)
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

