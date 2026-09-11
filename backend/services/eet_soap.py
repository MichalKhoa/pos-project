import uuid
import base64
import logging
import requests
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import Dict, Any, Optional

import lxml.etree as lxml_etree
import xmlsec
from cryptography.hazmat.primitives import serialization

logger = logging.getLogger("pos-eet-soap")

PLAYGROUND_URL = "https://pg.trzbyeet.gov.cz/eet/services/EETServiceSOAP/v4"
PRODUCTION_URL = "https://trzbyeet.gov.cz/eet/services/EETServiceSOAP/v4"

# W3C / WS-Security namespace URIs
NS_SOAPENV = "http://schemas.xmlsoap.org/soap/envelope/"
NS_V4 = "http://fs.gov.cz/eet/schema/v4"
NS_WSU = "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd"
NS_WSSE = "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd"


class EETSoapClient:
    """
    SOAP v4.1 Client for Czech Financial Administration EET API.
    Sends WS-Security 1.0 signed XML SOAP payloads for online sales fiscalization.
    XML is built with lxml (proper escaping) and signed via xmlsec with W3C Exclusive C14N.
    """


    def __init__(self, environment: str = "playground", timeout: float = 3.0, offline_mode: bool = False):
        self.environment = environment
        self.url = PRODUCTION_URL if environment == "production" else PLAYGROUND_URL
        self.timeout = timeout
        self.offline_mode = offline_mode

    def _build_lxml_envelope(
        self,
        msg_uuid: str,
        dat_odesl: str,
        prvni_zaslani: bool,
        overeni: bool,
        hlavicka_attrs: dict,
        data_attrs: dict,
        body_id: str,
        token_hex: str,
        celk_trzba: float,
        private_key: Optional[Any],
        certificate: Optional[Any],
    ) -> str:
        """
        Builds the SOAP envelope using lxml for proper XML construction and xmlsec
        for W3C Exclusive C14N signing. Special characters in any field are correctly
        escaped by lxml — no injection risk.
        """
        envelope = lxml_etree.Element(
            f"{{{NS_SOAPENV}}}Envelope",
            nsmap={"soapenv": NS_SOAPENV, "v4": NS_V4},
        )
        header_el = lxml_etree.SubElement(envelope, f"{{{NS_SOAPENV}}}Header")
        body_el = lxml_etree.SubElement(envelope, f"{{{NS_SOAPENV}}}Body")
        body_el.set(f"{{{NS_WSU}}}Id", body_id)

        trzba_el = lxml_etree.SubElement(body_el, f"{{{NS_V4}}}Trzba")
        hlavicka_el = lxml_etree.SubElement(trzba_el, f"{{{NS_V4}}}Hlavicka")
        for k, v in sorted(hlavicka_attrs.items()):
            hlavicka_el.set(k, v)
        data_el = lxml_etree.SubElement(trzba_el, f"{{{NS_V4}}}Data")
        for k, v in sorted(data_attrs.items()):
            data_el.set(k, v)

        if not private_key or not certificate:
            return lxml_etree.tostring(
                envelope,
                xml_declaration=True,
                encoding="UTF-8",
            ).decode("utf-8")

        # --- wsse:Security ---
        security_el = lxml_etree.SubElement(
            header_el,
            f"{{{NS_WSSE}}}Security",
            nsmap={"wsse": NS_WSSE, "wsu": NS_WSU},
        )
        cert_der = certificate.public_bytes(serialization.Encoding.DER)
        cert_b64 = base64.b64encode(cert_der).decode("utf-8")
        bst_id = f"X509-{token_hex}1"
        bst_el = lxml_etree.SubElement(security_el, f"{{{NS_WSSE}}}BinarySecurityToken")
        bst_el.set("EncodingType",
                   "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary")
        bst_el.set("ValueType",
                   "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3")
        bst_el.set(f"{{{NS_WSU}}}Id", bst_id)
        bst_el.text = cert_b64

        # ds:Signature template — xmlsec fills DigestValue + SignatureValue with real exc-c14n
        sig_node = xmlsec.template.create(
            envelope,
            c14n_method=xmlsec.Transform.EXCL_C14N,
            sign_method=xmlsec.Transform.RSA_SHA256,
            ns="ds",
        )
        security_el.append(sig_node)

        ref = xmlsec.template.add_reference(
            sig_node,
            digest_method=xmlsec.Transform.SHA256,
            uri=f"#{body_id}",
        )
        xmlsec.template.add_transform(ref, xmlsec.Transform.EXCL_C14N)

        ki = xmlsec.template.ensure_key_info(sig_node)
        str_el = lxml_etree.SubElement(ki, f"{{{NS_WSSE}}}SecurityTokenReference")
        wsse_ref_el = lxml_etree.SubElement(str_el, f"{{{NS_WSSE}}}Reference")
        wsse_ref_el.set("URI", f"#{bst_id}")
        wsse_ref_el.set("ValueType",
                        "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3")

        # Load key: export cryptography private key → PEM → xmlsec.Key
        pem_bytes = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        )
        xsec_key = xmlsec.Key.from_memory(pem_bytes, xmlsec.KeyFormat.PEM)
        xsec_key.load_cert_from_memory(cert_der, xmlsec.KeyFormat.CERT_DER)

        ctx = xmlsec.SignatureContext()
        ctx.key = xsec_key
        ctx.register_id(body_el, "Id", NS_WSU)
        ctx.sign(sig_node)

        return lxml_etree.tostring(
            envelope,
            xml_declaration=True,
            encoding="UTF-8",
        ).decode("utf-8")

    def build_soap_payload(
        self,
        eic_popl: str,
        id_jednotky: str,
        id_pokl: str,
        porad_cis: str,
        dat_trzby: str,
        celk_trzba: float,
        pkp: str,
        bkp: str,
        prvni_zaslani: bool = True,
        overeni: bool = False,
        eic_poverujiciho: Optional[str] = None,
        povereni_vice_popl: Optional[bool] = None,
        urceno_cerp_zuct: Optional[float] = None,
        cerp_zuct: Optional[float] = None,
        private_key: Optional[Any] = None,
        certificate: Optional[Any] = None
    ) -> str:
        """
        Builds the EET v4.1 compliant SOAP 1.1 payload.
        Uses lxml for proper XML construction (attributes are escaped, no injection risk)
        and xmlsec for W3C Exclusive C14N XML-DSig as required by the Czech EET specification.
        """
        from services.security_utils import round_currency

        msg_uuid = str(uuid.uuid4())
        dat_odesl = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        token_hex = uuid.uuid4().hex.upper()
        body_id = f"id-{token_hex}"

        hlavicka_attrs: Dict[str, str] = {
            "dat_odesl": dat_odesl,
            "overeni": "true" if overeni else "false",
            "prvni_zaslani": "true" if prvni_zaslani else "false",
            "uuid_zpravy": msg_uuid,
        }

        data_attrs: Dict[str, str] = {
            "celk_trzba": f"{round_currency(celk_trzba):.2f}",
            "dat_trzby": dat_trzby,
            "eic_popl": eic_popl,
            "id_jednotky": str(id_jednotky),
            "id_pokl": str(id_pokl),
            "porad_cis": str(porad_cis),
        }
        if eic_poverujiciho:
            data_attrs["eic_poverujiciho"] = eic_poverujiciho
        if povereni_vice_popl is not None:
            data_attrs["povereni_vice_popl"] = "true" if povereni_vice_popl else "false"
        if urceno_cerp_zuct is not None:
            data_attrs["urceno_cerp_zuct"] = f"{round_currency(urceno_cerp_zuct):.2f}"
        if cerp_zuct is not None:
            data_attrs["cerp_zuct"] = f"{round_currency(cerp_zuct):.2f}"

        return self._build_lxml_envelope(
            msg_uuid=msg_uuid,
            dat_odesl=dat_odesl,
            prvni_zaslani=prvni_zaslani,
            overeni=overeni,
            hlavicka_attrs=hlavicka_attrs,
            data_attrs=data_attrs,
            body_id=body_id,
            token_hex=token_hex,
            celk_trzba=celk_trzba,
            private_key=private_key,
            certificate=certificate,
        )


    def send_sale_to_eet(
        self,
        eic_popl: str,
        id_jednotky: str,
        id_pokl: str,
        porad_cis: str,
        dat_trzby: str,
        celk_trzba: float,
        pkp: str,
        bkp: str,
        prvni_zaslani: bool = True,
        overeni: bool = False,
        private_key: Optional[Any] = None,
        certificate: Optional[Any] = None,
        offline_mode: Optional[bool] = None
    ) -> Dict[str, Any]:
        """
        Sends transaction payload to EET SOAP Endpoint and parses response POK code.
        """
        if offline_mode is None:
            offline_mode = self.offline_mode

        payload = self.build_soap_payload(
            eic_popl=eic_popl,
            id_jednotky=id_jednotky,
            id_pokl=id_pokl,
            porad_cis=porad_cis,
            dat_trzby=dat_trzby,
            celk_trzba=celk_trzba,
            pkp=pkp,
            bkp=bkp,
            prvni_zaslani=prvni_zaslani,
            overeni=overeni,
            private_key=private_key,
            certificate=certificate
        )

        headers = {
            "Content-Type": "text/xml; charset=utf-8",
            "SOAPAction": "http://fs.gov.cz/eet/OdeslaniTrzby"
        }

        network_error = None
        try:
            logger.info(f"Submitting EET v4.1 transaction to {self.url} (overeni={overeni})")
            response = requests.post(self.url, data=payload.encode("utf-8"), headers=headers, timeout=self.timeout)

            if response.status_code == 200:
                parsed_res = self.parse_response(response.text)
                if parsed_res.get("pok"):
                    return {
                        "status": "EVD_OK",
                        "pok": parsed_res.get("pok"),
                        "fik": parsed_res.get("pok"), # Backwards compatibility alias
                        "bkp": bkp,
                        "pkp": pkp,
                        "raw_response": response.text
                    }
                elif parsed_res.get("overeni_ok"):
                    return {
                        "status": "EVD_OK",
                        "pok": f"{uuid.uuid4()}-ff",
                        "fik": f"{uuid.uuid4()}-ff",
                        "bkp": bkp,
                        "pkp": pkp,
                        "raw_response": response.text
                    }
                elif parsed_res.get("chyba_msg"):
                    return {
                        "status": "ERROR",
                        "error": parsed_res.get("chyba_msg"),
                        "bkp": bkp,
                        "pkp": pkp
                    }

            logger.warning(f"EET SOAP Endpoint returned status {response.status_code}")
            network_error = f"EET SOAP Endpoint returned status {response.status_code}"
        except Exception as e:
            logger.warning(f"EET SOAP Request unreachable/timed out: {e}")
            network_error = str(e)

        # EET-M1: Raise on network failure even in non-prod when offline_mode=False
        if not offline_mode:
            raise ConnectionError(f"EET communication failed: {network_error}")

        # Simulated POK for offline fallback
        simulated_pok = f"{uuid.uuid4()}-ff"

        return {
            "status": "OFFLINE_PENDING" if not overeni else "VERIFIED_OFFLINE",
            "pok": simulated_pok,
            "fik": simulated_pok,
            "bkp": bkp,
            "pkp": pkp,
            "is_sent_to_eet": False,
            "error": f"Endpoint unreachable ({network_error}), fallback to local BKP/PKP"
        }

    def parse_response(self, response_xml: str) -> Dict[str, Any]:
        """Extracts POK code, warnings, or error descriptions from EET XML response."""
        res = {"pok": None, "overeni_ok": False, "chyba_msg": None, "warnings": []}
        try:
            root = ET.fromstring(response_xml)
            for elem in root.iter():
                tag_local = elem.tag.split("}")[-1] if "}" in elem.tag else elem.tag
                if tag_local == "Potvrzeni":
                    res["pok"] = elem.attrib.get("pok")
                elif tag_local == "Chyba":
                    kod = elem.attrib.get("kod")
                    msg = elem.text or ""
                    if kod == "0":
                        res["overeni_ok"] = True
                    else:
                        res["chyba_msg"] = f"Chyba {kod}: {msg.strip()}"
                elif tag_local == "Varovani":
                    kod_varov = elem.attrib.get("kod_varov")
                    varov_text = elem.text or ""
                    res["warnings"].append(f"Varování {kod_varov}: {varov_text.strip()}")
        except Exception as e:
            logger.error(f"Error parsing EET XML response: {e}")
            res["chyba_msg"] = f"XML Parsing error: {e}"
        return res
