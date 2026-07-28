from fastapi import APIRouter
from pydantic import BaseModel
from services.qr_bank_service import CzechBankQRPaymentService

router = APIRouter(prefix="/api/v1/payments", tags=["QR Payments"])
qr_service = CzechBankQRPaymentService()


class VerifyQRPaymentRequest(BaseModel):
    variableSymbol: str
    expectedAmount: float


class GenerateQRPayloadRequest(BaseModel):
    amount: float
    variableSymbol: str
    message: str = "Nákup v obchodu"


@router.post("/generate-qr-string")
def generate_qr_string(req: GenerateQRPayloadRequest):
    """Generates Czech SPD format QR payload for banking app scanning."""
    spd_string = qr_service.generate_qr_string(req.amount, req.variableSymbol, req.message)
    return {
        "status": "OK",
        "spd_string": spd_string,
        "variable_symbol": req.variableSymbol,
        "amount": req.amount
    }


@router.post("/verify-qr")
def verify_qr_payment(req: VerifyQRPaymentRequest):
    """
    Endpoint for checking arrival of Czech QR bank payments.
    Polls bank API or checks instant payment arrival.
    """
    res = qr_service.check_payment_status(req.variableSymbol, req.expectedAmount)
    return res
