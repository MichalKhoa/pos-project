import io
import qrcode
import logging
from fastapi import APIRouter, Response, Query

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
    iban: str = Query(..., description="Merchant account IBAN"),
    amount: float = Query(..., description="Sale total amount in CZK"),
    vs: str = Query("", description="Variable symbol / receipt number"),
    ks: str = Query("0008", description="Constant symbol (e.g. 0008 for retail)"),
    ss: str = Query("", description="Specific symbol"),
    msg: str = Query("Platba Himmel POS", description="Payment message"),
    recipient: str = Query("", description="Recipient name")
):
    """
    Generates official Czech Banking Association (ČBA) Short Payment Descriptor (SPD) QR code PNG offline.
    """
    from services.qr_bank_service import CzechBankQRPaymentService
    service = CzechBankQRPaymentService(account_iban=iban)
    spd_data = service.generate_qr_string(
        amount=amount,
        variable_symbol=vs,
        message=msg,
        constant_symbol=ks,
        specific_symbol=ss,
        recipient_name=recipient
    )
    return generate_qr_code(data=spd_data)
