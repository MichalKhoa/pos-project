from fastapi import APIRouter

router = APIRouter(
    prefix="/api/v1/dashboard",
    tags=["Dashboard"]
)

@router.get("/kpi")
def get_kpi():
    return {
        "gross_revenue": "15000.00",
        "net_revenue": "12396.69",
        "margins": "25.5",
        "total_receipt_count": 120,
        "aov": "125.00",
        "cash_drawer_balance": "5000.00",
        "last_sync_time": "2026-09-12T05:00:00Z"
    }

@router.get("/zreports")
def get_zreports():
    return [
        {"id": 1, "date": "2026-09-11", "total": "14000.00"},
        {"id": 2, "date": "2026-09-10", "total": "13500.00"}
    ]
