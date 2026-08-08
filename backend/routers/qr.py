import io
import qrcode
import logging
from fastapi import APIRouter, Response, Query, Depends
from sqlalchemy.orm import Session
from database import get_db
from models import StoreConfigModel

router = APIRouter(prefix="/api/v1/qr", tags=["Offline QR Generator"])
logger = logging.getLogger("pos-qr")


@router.api_route("/generate", methods=["GET", "HEAD"])
def generate_qr_code(
    data: str = Query(..., description="String payload to encode into QR code")
):
    """
    Generates a PNG QR code image offline directly in memory.
    No external Internet or third-party APIs required.
    """
    try:
        qr = qrcode.QRCode(
            version=None,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=8,
            border=2,
        )
        qr.add_data(data)
        qr.make(fit=True)

        img = qr.make_image(fill_color="black", back_color="white")
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        buffer.seek(0)

        return Response(content=buffer.getvalue(), media_type="image/png")
    except Exception as e:
        logger.error(f"Failed to generate offline QR code: {e}")
        return Response(content=b"", media_type="image/png", status_code=500)


@router.api_route("/spd", methods=["GET", "HEAD"])
def generate_spd_qr(
    iban: str = Query("", description="Merchant account IBAN"),
    amount: float = Query(..., description="Sale total amount in CZK"),
    vs: str = Query("", description="Variable symbol / receipt number"),
    ks: str = Query("0008", description="Constant symbol (e.g. 0008 for retail)"),
    ss: str = Query("", description="Specific symbol"),
    msg: str = Query("Platba Himmel POS", description="Payment message"),
    recipient: str = Query("", description="Recipient name"),
    db: Session = Depends(get_db)
):
    """
    Generates official Czech Banking Association (ČBA) Short Payment Descriptor (SPD) QR code PNG offline.
    Verifies merchant IBAN directly against server database configuration for maximum security.
    """
    # Sanitize and resolve merchant IBAN from database if placeholder or empty
    target_iban = iban.strip() if iban else ""
    if not target_iban or target_iban.startswith("CZ000000"):
        cfg = db.query(StoreConfigModel).first()
        if cfg and cfg.merchant_iban and not cfg.merchant_iban.startswith("CZ000000"):
            target_iban = cfg.merchant_iban.strip()
        else:
            target_iban = "CZ0000000000000000000000"

    from services.qr_bank_service import CzechBankQRPaymentService
    service = CzechBankQRPaymentService(account_iban=target_iban)
    spd_data = service.generate_qr_string(
        amount=amount,
        variable_symbol=vs,
        message=msg,
        constant_symbol=ks,
        specific_symbol=ss,
        recipient_name=recipient
    )
    return generate_qr_code(data=spd_data)

