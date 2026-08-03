import unittest
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

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

if __name__ == "__main__":
    unittest.main()
