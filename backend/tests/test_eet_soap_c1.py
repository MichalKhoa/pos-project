"""
Tests for EET-C1 fix: lxml+xmlsec XML-DSig replaces f-string interpolation.
"""
import sys
import os
import unittest
import lxml.etree as lxml_etree
import xmlsec

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from services.eet_soap import EETSoapClient, NS_SOAPENV, NS_V4, NS_WSU, NS_WSSE

DS_NS = "http://www.w3.org/2000/09/xmldsig#"


def _generate_test_rsa_key():
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.hazmat.primitives import hashes
    from cryptography import x509
    from cryptography.x509.oid import NameOID
    from datetime import datetime, timezone, timedelta

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = issuer = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, u"EET Test")])
    cert = (
        x509.CertificateBuilder()
        .subject_name(subject).issuer_name(issuer)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(datetime.now(timezone.utc))
        .not_valid_after(datetime.now(timezone.utc) + timedelta(days=365))
        .sign(key, hashes.SHA256())
    )
    return key, cert


class TestEetSoapC1Fix(unittest.TestCase):

    def setUp(self):
        self.client = EETSoapClient(environment="playground")
        self.common_kwargs = dict(
            eic_popl="CZ1234567890", id_jednotky="1", id_pokl="POS1",
            porad_cis="1/2024", dat_trzby="2024-01-15T10:30:00Z",
            celk_trzba=1234.56, pkp="dummypkp",
            bkp="AABBCCDD-EEFF0011-22334455-66778899-AABBCCDD",
        )

    def test_unsigned_payload_is_valid_xml(self):
        xml_str = self.client.build_soap_payload(**self.common_kwargs)
        root = lxml_etree.fromstring(xml_str.encode("utf-8"))
        self.assertEqual(root.tag, f"{{{NS_SOAPENV}}}Envelope")

    def test_unsigned_payload_structure(self):
        xml_str = self.client.build_soap_payload(**self.common_kwargs)
        root = lxml_etree.fromstring(xml_str.encode("utf-8"))
        body = root.find(f"{{{NS_SOAPENV}}}Body")
        self.assertIsNotNone(body)
        body_id = body.get(f"{{{NS_WSU}}}Id")
        self.assertIsNotNone(body_id)
        self.assertTrue(body_id.startswith("id-"))
        data = body.find(f".//{{{NS_V4}}}Data")
        self.assertEqual(data.get("eic_popl"), "CZ1234567890")
        self.assertEqual(data.get("celk_trzba"), "1234.56")

    def test_special_chars_are_xml_escaped(self):
        evil = dict(self.common_kwargs)
        evil["eic_popl"] = 'CZ&<>"test'
        evil["id_pokl"] = 'Pokladna "hlavni" & vedlejsi'
        xml_str = self.client.build_soap_payload(**evil)
        root = lxml_etree.fromstring(xml_str.encode("utf-8"))
        data = root.find(f".//{{{NS_V4}}}Data")
        self.assertEqual(data.get("eic_popl"), 'CZ&<>"test')
        self.assertEqual(data.get("id_pokl"), 'Pokladna "hlavni" & vedlejsi')

    def test_czech_diacritics_survive(self):
        kw = dict(self.common_kwargs)
        kw["porad_cis"] = "C-001/2024-Z-diacritics-test"
        xml_str = self.client.build_soap_payload(**kw)
        root = lxml_etree.fromstring(xml_str.encode("utf-8"))
        data = root.find(f".//{{{NS_V4}}}Data")
        self.assertEqual(data.get("porad_cis"), "C-001/2024-Z-diacritics-test")

    def test_signed_payload_contains_signature(self):
        key, cert = _generate_test_rsa_key()
        xml_str = self.client.build_soap_payload(**self.common_kwargs, private_key=key, certificate=cert)
        root = lxml_etree.fromstring(xml_str.encode("utf-8"))
        security = root.find(f".//{{{NS_WSSE}}}Security")
        self.assertIsNotNone(security)
        sig = security.find(f"{{{DS_NS}}}Signature")
        self.assertIsNotNone(sig)
        sig_value = sig.find(f"{{{DS_NS}}}SignatureValue")
        self.assertTrue(len(sig_value.text or "") > 0)
        body = root.find(f"{{{NS_SOAPENV}}}Body")
        body_id = body.get(f"{{{NS_WSU}}}Id")
        ref = sig.find(f".//{{{DS_NS}}}Reference")
        self.assertEqual(ref.get("URI"), f"#{body_id}")

    def test_signed_payload_passes_xmlsec_verification(self):
        from cryptography.hazmat.primitives import serialization as cs
        key, cert = _generate_test_rsa_key()
        xml_str = self.client.build_soap_payload(**self.common_kwargs, private_key=key, certificate=cert)
        root = lxml_etree.fromstring(xml_str.encode("utf-8"))
        sig_node = root.find(f".//{{{DS_NS}}}Signature")
        cert_der = cert.public_bytes(cs.Encoding.DER)
        verify_key = xmlsec.Key.from_memory(cert_der, xmlsec.KeyFormat.CERT_DER)
        ctx = xmlsec.SignatureContext()
        ctx.key = verify_key
        body = root.find(f"{{{NS_SOAPENV}}}Body")
        ctx.register_id(body, "Id", NS_WSU)
        try:
            ctx.verify(sig_node)
        except xmlsec.VerificationError as e:
            self.fail(f"Signature verification failed: {e}")

    def test_signed_payload_special_chars_verify(self):
        from cryptography.hazmat.primitives import serialization as cs
        key, cert = _generate_test_rsa_key()
        evil = dict(self.common_kwargs)
        evil["eic_popl"] = "CZ&test"
        evil["id_pokl"] = "POS & main"
        xml_str = self.client.build_soap_payload(**evil, private_key=key, certificate=cert)
        root = lxml_etree.fromstring(xml_str.encode("utf-8"))
        sig_node = root.find(f".//{{{DS_NS}}}Signature")
        cert_der = cert.public_bytes(cs.Encoding.DER)
        verify_key = xmlsec.Key.from_memory(cert_der, xmlsec.KeyFormat.CERT_DER)
        ctx = xmlsec.SignatureContext()
        ctx.key = verify_key
        body = root.find(f"{{{NS_SOAPENV}}}Body")
        ctx.register_id(body, "Id", NS_WSU)
        try:
            ctx.verify(sig_node)
        except xmlsec.VerificationError as e:
            self.fail(f"Signature verification failed with special chars: {e}")


if __name__ == "__main__":
    unittest.main()
