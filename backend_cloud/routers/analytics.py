from fastapi import APIRouter

router = APIRouter(
    prefix="/api/v1/analytics",
    tags=["Analytics"]
)

@router.get("/top-profit")
def get_top_profit():
    return [
        {"product": "Espresso", "profit": "500.00"},
        {"product": "Cappuccino", "profit": "400.00"}
    ]

@router.get("/dead-stock")
def get_dead_stock():
    return [
        {"product": "Old Muffin", "days_in_stock": 30}
    ]

@router.get("/heatmap")
def get_heatmap():
    return {
        "monday": [10, 20, 30],
        "tuesday": [15, 25, 35]
    }
