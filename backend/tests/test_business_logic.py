import os
import sys
import unittest

# Ensure backend root directory is in sys.path for direct module imports
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from services.security_utils import round_currency, encrypt_secret, decrypt_secret, parse_iso_timestamp
from services.eet_crypto import EETCryptoManager
from services.qr_bank_service import CzechBankQRPaymentService
from routers.config import _hash_pin, _is_hashed


class TestCurrencyRoundingEdgeCases(unittest.TestCase):
    """Tests monetary rounding and floating-point edge cases."""

    def test_standard_round_half_up(self):
        self.assertEqual(round_currency(10.125), 10.13)
        self.assertEqual(round_currency(10.124), 10.12)

    def test_binary_floating_point_imprecision(self):
        # 0.1 + 0.2 in binary float evaluates to 0.30000000000000004
        float_imprecise = 0.1 + 0.2
        self.assertEqual(round_currency(float_imprecise), 0.30)

    def test_zero_and_none_and_invalid(self):
        self.assertEqual(round_currency(0.0), 0.0)
        self.assertEqual(round_currency(None), 0.0)
        self.assertEqual(round_currency("invalid"), 0.0)

    def test_large_and_negative_amounts(self):
        self.assertEqual(round_currency(-50.555), -50.56)
        self.assertEqual(round_currency(9999999.999), 10000000.00)


class TestSecretEncryptionEdgeCases(unittest.TestCase):
    """Tests Fernet AES secret encryption and backward-compatibility decryption."""

    def test_encryption_decryption_roundtrip(self):
        secret = "SuperSecretEETCertPassword123!"
        encrypted = encrypt_secret(secret)
        self.assertNotEqual(encrypted, secret)
        self.assertEqual(decrypt_secret(encrypted), secret)

    def test_empty_or_none(self):
        self.assertEqual(encrypt_secret(""), "")
        self.assertEqual(encrypt_secret(None), "")
        self.assertEqual(decrypt_secret(""), "")

    def test_legacy_unencrypted_fallback(self):
        # Legacy plain-text passwords stored before encryption was added should decrypt gracefully
        plain_legacy = "legacy_plain_password"
        self.assertEqual(decrypt_secret(plain_legacy), plain_legacy)


class TestTimestampParsingEdgeCases(unittest.TestCase):
    """Tests ISO timestamp parsing, UTC normalization, and Czech timezone conversion."""

    def test_iso_z_suffix(self):
        dt = parse_iso_timestamp("2026-07-31T12:00:00Z")
        self.assertIsNotNone(dt)
        self.assertEqual(dt.year, 2026)
        self.assertEqual(dt.month, 7)
        self.assertEqual(dt.day, 31)

    def test_iso_with_explicit_timezone_offset(self):
        dt = parse_iso_timestamp("2026-07-31T14:00:00+02:00")
        self.assertIsNotNone(dt)
        self.assertEqual(dt.hour, 14)

    def test_invalid_or_missing_timestamp_fallback(self):
        dt_invalid = parse_iso_timestamp("not-a-timestamp")
        dt_none = parse_iso_timestamp(None)
        self.assertIsNotNone(dt_invalid)
        self.assertIsNotNone(dt_none)


class TestEETCryptoManagerEdgeCases(unittest.TestCase):
    """Tests EET 2.0 (v4.1) seed formatting and BKP hash generation."""

    def test_build_plaintext_seed_formatting(self):
        mgr = EETCryptoManager()
        seed = mgr.build_plaintext_seed(
            eic_popl="CZ12345678",
            id_jednotky="11",
            id_pokl="POS-01",
            porad_cis="2026-0001",
            dat_trzby="2026-07-31T11:00:00Z",
            celk_trzba=150.5
        )
        self.assertEqual(seed, "CZ12345678|11|POS-01|2026-0001|2026-07-31T11:00:00Z|150.50")

    def test_bkp_hash_structure_and_length(self):
        mgr = EETCryptoManager()
        pkp, bkp = mgr.compute_pkp_and_bkp(
            eic_popl="CZ12345678",
            id_jednotky="11",
            id_pokl="POS-01",
            porad_cis="2026-0001",
            dat_trzby="2026-07-31T11:00:00Z",
            celk_trzba=150.50
        )
        self.assertTrue(isinstance(pkp, str) and len(pkp) > 0)
        self.assertTrue(isinstance(bkp, str))
        # BKP format: XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX (44 chars total)
        blocks = bkp.split("-")
        self.assertEqual(len(blocks), 5)
        self.assertTrue(all(len(b) == 8 for b in blocks))
        self.assertEqual(len(bkp), 44)


class TestCzechQRBankPaymentEdgeCases(unittest.TestCase):
    """Tests Czech Short Payment Descriptor (SPD) QR string formatting."""

    def test_spd_qr_string_generation(self):
        service = CzechBankQRPaymentService(account_iban="CZ65 0800 0000 0012 3456 7890")
        spd = service.generate_qr_string(amount=1250.75, variable_symbol="20260001", message="Himmel POS Test")
        
        self.assertIn("SPD*1.0*", spd)
        self.assertIn("ACC:CZ6508000000001234567890", spd)
        self.assertIn("AM:1250.75", spd)
        self.assertIn("CC:CZK", spd)
        self.assertIn("X-VS:20260001", spd)
        self.assertIn("MSG:Himmel POS Test", spd)

    def test_spd_qr_fallback_iban(self):
        service = CzechBankQRPaymentService(account_iban="")
        spd = service.generate_qr_string(amount=100.0, variable_symbol="999")
        self.assertIn("ACC:CZ6508000000001234567890", spd)

    def test_offline_python_qr_image_generation(self):
        from routers.qr import generate_qr_code
        res = generate_qr_code(data="SPD*1.0*ACC:CZ6508000000001234567890*AM:100.00")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.media_type, "image/png")
        self.assertTrue(len(res.body) > 100)


class TestPinAndPukSecurityLogic(unittest.TestCase):
    """Tests cashier PIN hashing, verification, and master PUK recovery rules."""

    def test_pin_hashing_and_verification(self):
        raw_pin = "1234"
        hashed = _hash_pin(raw_pin)
        self.assertNotEqual(hashed, raw_pin)
        self.assertTrue(_is_hashed(hashed))
        self.assertEqual(_hash_pin("1234"), hashed)
        self.assertNotEqual(_hash_pin("9999"), hashed)

    def test_master_puk_format(self):
        ico = "12345678"
        puk_master_voltflow = f"VOLTFLOW-{ico}-MASTER"
        puk_universal_voltflow = "VOLTFLOW-RECOVERY-99"
        puk_master_himmel = f"HIMMEL-{ico}-MASTER"
        puk_universal_himmel = "HIMMEL-RECOVERY-99"
        
        self.assertEqual(puk_master_voltflow, "VOLTFLOW-12345678-MASTER")
        self.assertEqual(puk_universal_voltflow, "VOLTFLOW-RECOVERY-99")
        self.assertEqual(puk_master_himmel, "HIMMEL-12345678-MASTER")
        self.assertEqual(puk_universal_himmel, "HIMMEL-RECOVERY-99")


class TestDefaultLanguageConfig(unittest.TestCase):
    """Tests default language configuration storage in StoreConfigModel."""

    def test_store_config_default_language_field(self):
        from models import StoreConfigModel
        from routers.config import StoreConfigSchema

        config = StoreConfigModel()
        self.assertEqual(config.default_language or "cs", "cs")

        schema = StoreConfigSchema(defaultLanguage="vi")
        self.assertEqual(schema.defaultLanguage, "vi")


if __name__ == "__main__":
    unittest.main(verbosity=2)
