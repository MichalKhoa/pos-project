import os
import uuid
import shutil
import logging
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
from models import StoreConfigModel, SaleModel
from services.eet_service import CzechEETService

logger = logging.getLogger("pos-eet-router")
router = APIRouter(prefix="/api/v1/eet", tags=["EET 2.0 Fiscalization"])
eet_service = CzechEETService()

CERTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "certs")
os.makedirs(CERTS_DIR, exist_ok=True)


@router.get("/status")
def get_eet_status(db: Session = Depends(get_db)):
    """Returns current EET configuration, certificate validity, and pending offline transactions count."""
    config = db.query(StoreConfigModel).first()
    if not config:
        config = StoreConfigModel()
        db.add(config)
        db.commit()
        db.refresh(config)

    cert_path = config.eet_cert_path or ""
    cert_pwd = config.get_decrypted_cert_password() if config else ""

    crypto_mgr = eet_service.get_crypto_manager(cert_path, cert_pwd)
    cert_info = crypto_mgr.get_certificate_info()

    eet_enabled = config.eet_enabled if config and config.eet_enabled is not None else False

    pending_count = 0
    if eet_enabled:
        pending_count = db.query(SaleModel).filter(
            (SaleModel.is_sent_to_eet == False) | (SaleModel.eet_status == "OFFLINE_PENDING")
        ).count()

    return {
        "eet_enabled": eet_enabled,
        "environment": config.eet_environment or "playground",
        "eic_popl": config.dic or "CZ00000019",
        "dic": config.dic or "CZ00000019",
        "id_jednotky": config.id_provozovny or "11",
        "id_provozovny": config.id_provozovny or "11",
        "id_pokl": config.id_pokl or "1",
        "cert_path": cert_path,
        "certificate": cert_info,
        "pending_offline_sales": pending_count
    }


@router.post("/verify")
def verify_eet_connection(db: Session = Depends(get_db)):
    """Runs EET verification test (overeni = true) against Financial Administration SOAP Endpoint."""
    config = db.query(StoreConfigModel).first()
    store_dict = {
        "eic_popl": config.dic if config else "CZ00000019",
        "dic": config.dic if config else "CZ00000019",
        "id_jednotky": config.id_provozovny if config else "11",
        "id_provozovny": config.id_provozovny if config else "11",
        "id_pokl": config.id_pokl if config else "1",
        "eet_cert_path": config.eet_cert_path if config else "",
        "eet_cert_password": config.get_decrypted_cert_password() if config else "",
        "eet_environment": config.eet_environment if config else "playground"
    }

    res = eet_service.verify_eet_connection(store_dict)
    return res


@router.post("/upload-cert")
def upload_eet_certificate(
    file: UploadFile = File(...),
    password: str = Form(""),
    environment: str = Form("playground"),
    db: Session = Depends(get_db)
):
    """Uploads a PKCS#12 (.p12) merchant certificate and updates store config."""
    safe_filename = os.path.basename(file.filename or "")
    if not safe_filename or not safe_filename.lower().endswith((".p12", ".pfx")):
        raise HTTPException(status_code=400, detail="Soubor musí mít příponu .p12 nebo .pfx")

    MAX_CERT_SIZE = 2 * 1024 * 1024  # 2 MB max size limit
    contents = file.file.read(MAX_CERT_SIZE + 1)
    if len(contents) > MAX_CERT_SIZE:
        raise HTTPException(status_code=413, detail="Soubor certifikátu je příliš velký (max 2 MB).")

    save_path = os.path.join(CERTS_DIR, safe_filename)
    with open(save_path, "wb") as buffer:
        buffer.write(contents)


    # Test certificate parsing
    crypto_mgr = eet_service.get_crypto_manager(save_path, password)
    cert_info = crypto_mgr.get_certificate_info()

    if not cert_info.get("loaded"):
        os.remove(save_path)
        raise HTTPException(
            status_code=400,
            detail="Nepodařilo se načíst certifikát. Zkontrolujte prosím přístupové heslo k souboru .p12."
        )

    # Update DB Store Config
    config = db.query(StoreConfigModel).first()
    if not config:
        config = StoreConfigModel()
        db.add(config)

    config.eet_cert_path = save_path
    config.set_encrypted_cert_password(password)
    config.eet_environment = environment
    db.commit()
    db.refresh(config)

    return {
        "status": "SUCCESS",
        "message": "Certifikát byl úspěšně nahrán a ověřen.",
        "certificate": cert_info
    }


@router.post("/process-queue")
def process_offline_queue(db: Session = Depends(get_db)):
    """Flushes offline transaction queue and resends pending sales to EET."""
    config = db.query(StoreConfigModel).first()
    if config and not config.eet_enabled:
        return {"processed": 0, "status": "EET_DISABLED", "message": "EET evidování je v nastavení vypnuto."}

    pending_sales = db.query(SaleModel).filter(
        (SaleModel.is_sent_to_eet == False) | (SaleModel.eet_status == "OFFLINE_PENDING")
    ).all()

    config = db.query(StoreConfigModel).first()
    store_dict = {
        "eic_popl": config.dic if config else "CZ00000019",
        "dic": config.dic if config else "CZ00000019",
        "id_jednotky": config.id_provozovny if config else "11",
        "id_provozovny": config.id_provozovny if config else "11",
        "id_pokl": config.id_pokl if config else "1",
        "eet_cert_path": config.eet_cert_path if config else "",
        "eet_cert_password": config.get_decrypted_cert_password() if config else "",
        "eet_environment": config.eet_environment if config else "playground"
    }

    processed_count = 0
    synced_ids = []

    for sale in pending_sales:
        sale_data = {
            "receiptNumber": sale.receipt_number,
            "totalAmount": sale.total_amount,
            "taxSummary": sale.tax_summary or {},
            "timestamp": sale.timestamp.isoformat()
        }
        res = eet_service.sign_and_submit_sale(sale_data, store_dict)
        if res.get("eet_status") == "EVD_OK" or res.get("is_sent_to_eet"):
            sale.fik_code = res.get("pok") or res.get("fik")
            sale.eet_status = "EVD_OK"
            sale.is_sent_to_eet = True
            processed_count += 1
            synced_ids.append(sale.id)
        else:
            logger.warning(f"Resend sale #{sale.receipt_number} remaining offline: {res.get('error')}")


    db.commit()

    return {
        "status": "SUCCESS",
        "processed_count": processed_count,
        "synced_sales": synced_ids
    }
