import time
import logging
import threading
from datetime import datetime
from database import SessionLocal
from models import SaleModel, StoreConfigModel, EetAuditLogModel
from services.eet_service import CzechEETService

logger = logging.getLogger("pos-eet-resend-daemon")
eet_service = CzechEETService()

_daemon_started = False
_daemon_lock = threading.Lock()


def resend_pending_offline_sales():
    """Queries pending offline sales and attempts submission to Financial Administration API."""
    db = SessionLocal()
    try:
        config = db.query(StoreConfigModel).first()
        if not config or not config.eet_enabled:
            return 0

        pending_sales = db.query(SaleModel).filter(
            (SaleModel.is_sent_to_eet == False) | (SaleModel.eet_status == "OFFLINE_PENDING")
        ).all()

        if not pending_sales:
            return 0

        logger.info(f"EET Resend Daemon: Processing {len(pending_sales)} pending offline sales...")

        store_dict = {
            "eic_popl": config.dic or "CZ00000019",
            "dic": config.dic or "CZ00000019",
            "id_jednotky": config.id_provozovny or "11",
            "id_provozovny": config.id_provozovny or "11",
            "id_pokl": config.id_pokl or "1",
            "eet_cert_path": config.eet_cert_path or "",
            "eet_cert_password": config.get_decrypted_cert_password() if config else "",
            "eet_environment": config.eet_environment or "playground"
        }

        processed_count = 0

        for sale in pending_sales:
            sale_data = {
                "receiptNumber": sale.receipt_number,
                "totalAmount": sale.total_amount,
                "taxSummary": sale.tax_summary or {},
                "timestamp": sale.timestamp.isoformat()
            }
            sale.eet_retry_count = (sale.eet_retry_count or 0) + 1

            try:
                res = eet_service.sign_and_submit_sale(sale_data, store_dict)
                status_code = res.get("eet_status") or "ERROR"
                fik = res.get("fik")
                bkp = res.get("bkp") or sale.bkp_code

                if status_code == "EVD_OK" or res.get("is_sent_to_eet"):
                    sale.fik_code = fik
                    sale.eet_status = "EVD_OK"
                    sale.is_sent_to_eet = True
                    processed_count += 1

                # Record audit log entry
                audit_log = EetAuditLogModel(
                    sale_id=sale.id,
                    timestamp=datetime.utcnow(),
                    action="RETRY_SEND",
                    status=sale.eet_status,
                    bkp=bkp,
                    fik=fik,
                    error_message=res.get("error") if status_code != "EVD_OK" else None
                )
                db.add(audit_log)

            except Exception as ex:
                logger.error(f"EET Resend Daemon error processing sale #{sale.receipt_number}: {ex}")
                sale.eet_status = "OFFLINE_PENDING"
                audit_log = EetAuditLogModel(
                    sale_id=sale.id,
                    timestamp=datetime.utcnow(),
                    action="RETRY_SEND",
                    status="ERROR",
                    bkp=sale.bkp_code,
                    error_message=str(ex)
                )
                db.add(audit_log)

        db.commit()
        return processed_count

    except Exception as e:
        logger.error(f"EET Resend Daemon error in resend_pending_offline_sales: {e}")
        db.rollback()
        return 0
    finally:
        db.close()


def run_eet_resend_loop(interval_seconds: int = 60):
    """Infinite loop for resending offline sales every interval_seconds."""
    logger.info(f"EET Resend Daemon loop started (interval: {interval_seconds}s)")
    while True:
        try:
            resend_pending_offline_sales()
        except Exception as e:
            logger.error(f"Error in EET resend loop cycle: {e}")
        time.sleep(interval_seconds)


def start_eet_resend_daemon():
    """Launches the background EET retry daemon thread if not already running."""
    global _daemon_started
    with _daemon_lock:
        if not _daemon_started:
            t = threading.Thread(target=run_eet_resend_loop, daemon=True, name="eet-resend-daemon")
            t.start()
            _daemon_started = True
            logger.info("EET Resend Daemon thread initialized.")
