from fastapi import APIRouter
from fastapi.responses import Response

router = APIRouter(
    prefix="/api/v1/exports",
    tags=["Exports"]
)

@router.get("/pohoda")
def get_pohoda():
    return Response(content="<pohoda><records></records></pohoda>", media_type="application/xml")

@router.get("/dph")
def get_dph():
    return {
        "base_21": "1000.00",
        "tax_21": "210.00",
        "base_12": "500.00",
        "tax_12": "60.00",
        "base_0": "100.00",
        "tax_0": "0.00"
    }
