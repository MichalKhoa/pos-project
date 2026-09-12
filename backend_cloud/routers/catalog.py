from fastapi import APIRouter, Depends
from typing import Optional
from sqlalchemy.orm import Session

try:
    from backend_cloud.snapshot_service import SnapshotService, snapshot_service
    from backend_cloud.database import get_staging_db, StagedProductModel, StagedPriceChangeModel
except ImportError:
    from snapshot_service import SnapshotService, snapshot_service
    from database import get_staging_db, StagedProductModel, StagedPriceChangeModel

router = APIRouter(
    prefix="/api/v1/catalog",
    tags=["Catalog"]
)

@router.get("")
@router.get("/")
def get_catalog(
    search: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_staging_db),
):
    result = snapshot_service.get_catalog(
        search=search,
        category=category,
        limit=limit,
        offset=offset,
    )
    # Check pending products from staging queue
    try:
        staged_query = db.query(StagedProductModel).filter(StagedProductModel.status == "PENDING_STORE_SYNC")
        if search:
            s_term = f"%{search.strip()}%"
            staged_query = staged_query.filter(
                (StagedProductModel.name.ilike(s_term)) | (StagedProductModel.barcode.ilike(s_term))
            )
        if category:
            staged_query = staged_query.filter(StagedProductModel.category == category.strip())

        staged_prods = staged_query.all()
        staged_items = [
            {
                "id": sp.id,
                "name": sp.name,
                "price": f"{sp.price:.2f}",
                "cost_price": f"{sp.cost_price:.2f}",
                "vat": sp.vat,
                "category": sp.category or "custom",
                "stock_quantity": sp.stock_quantity,
                "track_stock": sp.track_stock,
                "barcode": sp.barcode or "",
                "unit": sp.unit or "ks",
                "show_in_presets": getattr(sp, "show_in_presets", True),
                "color": getattr(sp, "color", "#2563eb"),
                "icon": getattr(sp, "icon", ""),
                "is_weighted": getattr(sp, "is_weighted", False),
                "is_open_price": getattr(sp, "is_open_price", False),
                "min_stock_alert": getattr(sp, "min_stock_alert", 5.0),
                "margin_coefficient": getattr(sp, "margin_coefficient", None),
                "is_staged": True,
                "status": sp.status,
            }
            for sp in staged_prods
        ]
        if staged_items:
            result["items"] = staged_items + result.get("items", [])
            result["total"] = result.get("total", 0) + len(staged_items)
    except Exception:
        pass

    return result
