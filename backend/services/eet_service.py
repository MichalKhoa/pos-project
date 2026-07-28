import logging
from datetime import datetime, timezone
from typing import Dict, Any
from services.eet_crypto import EETCryptoManager
from services.eet_soap import EETSoapClient

logger = logging.getLogger("pos-eet-service")


class CzechEETService:
    """
    EET 2.0 (v4.1 API) Complete Fiscalization Service.
    Handles cryptographic signing (PKP/BKP), SOAP server communication,
    verification mode, and offline queue resending.
    """

    def __init__(self):
        self.crypto_managers = {}

    def get_crypto_manager(self, cert_path: str = "", cert_password: str = "") -> EETCryptoManager:
        """Returns cached EETCryptoManager for the given certificate path."""
        cache_key = f"{cert_path}:{cert_password}"
        if cache_key not in self.crypto_managers:
            self.crypto_managers[cache_key] = EETCryptoManager(cert_path, cert_password)
        return self.crypto_managers[cache_key]

    def sign_and_submit_sale(self, sale_data: Dict[str, Any], store_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Calculates PKP & BKP codes, formats EET v4.1 XML message,
        and submits to Financial Administration API (or stores offline).
        """
        eic_popl = store_config.get("eic_popl") or store_config.get("dic") or "CZ00000019"
        id_jednotky = str(store_config.get("id_jednotky") or store_config.get("id_provozovny") or "11")
        id_pokl = str(store_config.get("id_pokl") or "1")
        cert_path = store_config.get("eet_cert_path") or ""
        cert_password = store_config.get("eet_cert_password") or ""
        environment = store_config.get("eet_environment") or "playground"

        current_year = datetime.now(timezone.utc).strftime("%Y")
        receipt_number = sale_data.get("receiptNumber") or sale_data.get("receipt_number") or f"{current_year}-000001"
        total_amount = float(sale_data.get("totalAmount") or sale_data.get("total_amount") or 0.0)

        # Format ISO timestamp in UTC
        ts_raw = sale_data.get("timestamp")
        if isinstance(ts_raw, datetime):
            dat_trzby = ts_raw.strftime("%Y-%m-%dT%H:%M:%SZ")
        elif isinstance(ts_raw, str) and ts_raw:
            dat_trzby = ts_raw.replace("+00:00", "Z")
        else:
            dat_trzby = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        # 1. Cryptographic PKP & BKP Calculation
        crypto_mgr = self.get_crypto_manager(cert_path, cert_password)
        pkp, bkp = crypto_mgr.compute_pkp_and_bkp(
            eic_popl=eic_popl,
            id_jednotky=id_jednotky,
            id_pokl=id_pokl,
            porad_cis=receipt_number,
            dat_trzby=dat_trzby,
            celk_trzba=total_amount
        )

        # 2. Submit WS-Security Signed SOAP XML message
        soap_client = EETSoapClient(environment=environment)
        eet_res = soap_client.send_sale_to_eet(
            eic_popl=eic_popl,
            id_jednotky=id_jednotky,
            id_pokl=id_pokl,
            porad_cis=receipt_number,
            dat_trzby=dat_trzby,
            celk_trzba=total_amount,
            pkp=pkp,
            bkp=bkp,
            prvni_zaslani=True,
            overeni=False,
            private_key=crypto_mgr.private_key,
            certificate=crypto_mgr.certificate
        )

        return {
            "pok": eet_res.get("pok"),
            "fik": eet_res.get("fik"),
            "bkp": bkp,
            "pkp": pkp,
            "eet_status": eet_res.get("status", "EVD_OK"),
            "is_sent_to_eet": eet_res.get("status") == "EVD_OK"
        }

    def verify_eet_connection(self, store_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Sends verification message (overeni = true) to test server connectivity & certificate.
        """
        eic_popl = store_config.get("eic_popl") or store_config.get("dic") or "CZ00000019"
        id_jednotky = str(store_config.get("id_jednotky") or store_config.get("id_provozovny") or "11")
        id_pokl = str(store_config.get("id_pokl") or "1")
        cert_path = store_config.get("eet_cert_path") or ""
        cert_password = store_config.get("eet_cert_password") or ""
        environment = store_config.get("eet_environment") or "playground"

        dat_trzby = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        crypto_mgr = self.get_crypto_manager(cert_path, cert_password)
        pkp, bkp = crypto_mgr.compute_pkp_and_bkp(
            eic_popl=eic_popl,
            id_jednotky=id_jednotky,
            id_pokl=id_pokl,
            porad_cis="VERIFY-0001",
            dat_trzby=dat_trzby,
            celk_trzba=1.00
        )

        soap_client = EETSoapClient(environment=environment)
        eet_res = soap_client.send_sale_to_eet(
            eic_popl=eic_popl,
            id_jednotky=id_jednotky,
            id_pokl=id_pokl,
            porad_cis="VERIFY-0001",
            dat_trzby=dat_trzby,
            celk_trzba=1.00,
            pkp=pkp,
            bkp=bkp,
            prvni_zaslani=True,
            overeni=True,
            private_key=crypto_mgr.private_key,
            certificate=crypto_mgr.certificate
        )

        cert_info = crypto_mgr.get_certificate_info()

        return {
            "status": "SUCCESS" if eet_res.get("status") in ["EVD_OK", "VERIFIED_OFFLINE"] else "ERROR",
            "environment": environment,
            "pok": eet_res.get("pok"),
            "fik": eet_res.get("fik"),
            "bkp": bkp,
            "certificate_info": cert_info,
            "detail": eet_res.get("error") or "Testovací ověřovací zpráva byla úspěšně zpracována."
        }
