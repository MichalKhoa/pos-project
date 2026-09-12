from fastapi import APIRouter

router = APIRouter(
    prefix="/api/v1/staging",
    tags=["Staging"]
)

@router.post("/intakes")
def create_intake(draft: dict):
    return {"status": "success", "message": "Draft intake received"}

@router.get("/pending")
def get_pending():
    return [
        {"id": "stg_1", "type": "product_update", "status": "pending"},
        {"id": "stg_2", "type": "price_change", "status": "pending"}
    ]

@router.post("/ack")
def ack_staging(payload: dict):
    return {"status": "success", "message": "Staging item acknowledged"}
