import unittest
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from datetime import datetime, timedelta, timezone
import tempfile
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import pkcs12, BestAvailableEncryption

from services.eet_crypto import EETCryptoManager

class TestEetCrypto(unittest.TestCase):
    def test_bkp_formatting(self):
        crypto = EETCryptoManager("", "")
        raw_sha1 = "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678"
        bkp = crypto._format_bkp(raw_sha1)

        self.assertEqual(len(bkp), 44)
        self.assertEqual(bkp.count("-"), 4)
        self.assertTrue(bkp.isupper())
        self.assertEqual(bkp, "A1B2C3D4-E5F60718-293A4B5C-6D7E8F90-12345678")

    def test_valid_playground_cert_loads(self):
        cert_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "certs", "CA_EET-Playground-CZ00000019.p12"))
        if not os.path.exists(cert_path):
            self.skipTest("Playground certificate not present")
        crypto = EETCryptoManager()
        self.assertTrue(crypto.load_p12_certificate(cert_path, "aaaa1111"))
        self.assertIsNotNone(crypto.private_key)
        self.assertIsNotNone(crypto.certificate)

    def test_expired_cert_rejected(self):
        key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "EXPIRED-TEST")])
        now = datetime.now(timezone.utc)
        cert = (
            x509.CertificateBuilder()
            .subject_name(name)
            .issuer_name(name)
            .public_key(key.public_key())
            .serial_number(1001)
            .not_valid_before(now - timedelta(days=60))
            .not_valid_after(now - timedelta(days=1))
            .sign(key, hashes.SHA256())
        )
        p12_bytes = pkcs12.serialize_key_and_certificates(
            name=b"expired",
            key=key,
            cert=cert,
            cas=None,
            encryption_algorithm=BestAvailableEncryption(b"testpass")
        )

        with tempfile.NamedTemporaryFile(suffix=".p12", delete=False) as tf:
            tf.write(p12_bytes)
            tmp_path = tf.name

        try:
            crypto = EETCryptoManager()
            loaded = crypto.load_p12_certificate(tmp_path, "testpass")
            self.assertFalse(loaded)
            self.assertIsNone(crypto.private_key)
            self.assertIsNone(crypto.certificate)
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

if __name__ == "__main__":
    unittest.main()
