from fastapi import APIRouter

try:
    from backend_cloud.snapshot_service import SnapshotService, snapshot_service
except ImportError:
    from snapshot_service import SnapshotService, snapshot_service

router = APIRouter(
    prefix="/api/v1/analytics",
    tags=["Analytics"]
)

@router.get("/top-profit")
def get_top_profit(limit: int = 10):
    return snapshot_service.get_top_profit(limit=limit)

@router.get("/volume-drivers")
def get_volume_drivers(limit: int = 10):
    return snapshot_service.get_volume_drivers(limit=limit)

@router.get("/dead-stock")
def get_dead_stock(days: int = 30):
    return snapshot_service.get_dead_stock(days=days)

@router.get("/heatmap")
def get_heatmap():
    return snapshot_service.get_hourly_heatmap()

@router.get("/margin-alerts")
def get_margin_alerts():
    return snapshot_service.get_margin_alerts()

