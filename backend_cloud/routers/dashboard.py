from fastapi import APIRouter

try:
    from backend_cloud.snapshot_service import SnapshotService, snapshot_service
except ImportError:
    from snapshot_service import SnapshotService, snapshot_service

router = APIRouter(
    prefix="/api/v1/dashboard",
    tags=["Dashboard"]
)

@router.get("/kpi")
def get_kpi():
    return snapshot_service.get_kpi_summary()

@router.get("/payment-splits")
def get_payment_splits():
    return snapshot_service.get_payment_splits()

@router.get("/zreports")
def get_zreports(limit: int = 50):
    return snapshot_service.get_zreports(limit=limit)

@router.get("/health")
def get_health():
    return snapshot_service.check_health()

