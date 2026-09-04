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
    msg: str = Query("Platba VoltFlow POS", description="Payment message"),
    recipient: str = Query("", description="Recipient name"),
    db: Session = Depends(get_db)
):
    """
    Generates official Czech Banking Association (ČBA) Short Payment Descriptor (SPD) QR code PNG offline.
    Verifies merchant IBAN directly against server database configuration for maximum security.
    """
    # Safely extract query parameters (client IBAN is ignored for security)
    target_vs = vs if isinstance(vs, str) else ""
    target_ks = ks if isinstance(ks, str) else "0008"
    target_ss = ss if isinstance(ss, str) else ""
    target_msg = msg if isinstance(msg, str) else "Platba VoltFlow POS"
    target_recipient = recipient.strip() if isinstance(recipient, str) else ""

    cfg = db.query(StoreConfigModel).first()
    if cfg and cfg.bank_account_iban and cfg.bank_account_iban.strip() and not cfg.bank_account_iban.startswith("CZ000000") and cfg.bank_account_iban.strip() != "CZ6508000000001234567890":
        target_iban = cfg.bank_account_iban.strip()
    else:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Bankovní účet (IBAN) není v nastavení pokladny nakonfigurován.")

    if not target_recipient and cfg and cfg.store_name:
        target_recipient = cfg.store_name.strip()

    from services.qr_bank_service import CzechBankQRPaymentService
    service = CzechBankQRPaymentService(account_iban=target_iban)
    spd_data = service.generate_qr_string(
        amount=amount,
        variable_symbol=target_vs,
        message=target_msg,
        constant_symbol=target_ks,
        specific_symbol=target_ss,
        recipient_name=target_recipient
    )
    return generate_qr_code(data=spd_data)

