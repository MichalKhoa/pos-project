from fastapi import APIRouter
from typing import Optional

try:
    from backend_cloud.snapshot_service import SnapshotService, snapshot_service
except ImportError:
    from snapshot_service import SnapshotService, snapshot_service

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
):
    return snapshot_service.get_catalog(
        search=search,
        category=category,
        limit=limit,
        offset=offset,
    )
