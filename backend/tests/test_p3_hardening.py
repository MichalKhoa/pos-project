import unittest
import sys
import os
from unittest.mock import patch, MagicMock
from sqlalchemy import create_engine, text
from pydantic import ValidationError

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from routers.sales import SaleItemSchema
from services.eet_service import CzechEETService
from services.eet_soap import EETSoapClient
from services.eet_resend_daemon import resend_pending_offline_sales
from services.escpos_service import print_receipt_logo
from migrations import run_schema_migrations
from models import StoreConfigModel, SaleModel


class TestP3Hardening(unittest.TestCase):

    # 1. FIN-L1: Pydantic validator vat in {0, 12, 21} on SaleItemSchema
    def test_vat_validator_tiers_allowed(self):
        item21 = SaleItemSchema(name="Standard", price=100.0, vat=21)
        self.assertEqual(item21.vat, 21)

        item12 = SaleItemSchema(name="Reduced", price=100.0, vat=12)
        self.assertEqual(item12.vat, 12)

        item0 = SaleItemSchema(name="Zero", price=100.0, vat=0)
        self.assertEqual(item0.vat, 0)

    def test_vat_validator_invalid_tiers_rejected(self):
        for invalid_vat in [1, 5, 10, 15, 19, 23]:
            with self.assertRaises(ValidationError, msg=f"VAT {invalid_vat} should be rejected"):
                SaleItemSchema(name="Invalid", price=100.0, vat=invalid_vat)

    # 2. EET-L1: Raise on missing DIC config
    def test_eet_service_missing_dic_raises(self):
        service = CzechEETService()
        dummy_sale = {
            "receiptNumber": "2026-000001",
            "totalAmount": 100.0,
            "timestamp": "2026-09-12T10:00:00Z"
        }
        with self.assertRaises(ValueError) as ctx:
            service.sign_and_submit_sale(dummy_sale, {})
        self.assertIn("Missing DIC configuration", str(ctx.exception))

        with self.assertRaises(ValueError) as ctx:
            service.verify_eet_connection({})
        self.assertIn("Missing DIC configuration", str(ctx.exception))

    @patch("services.eet_resend_daemon.SessionLocal")
    def test_eet_resend_daemon_missing_dic_raises(self, mock_session_factory):
        mock_db = MagicMock()
        mock_session_factory.return_value = mock_db
        mock_config = MagicMock(spec=StoreConfigModel)
        mock_config.eet_enabled = True
        mock_config.dic = None
        mock_sale = MagicMock(spec=SaleModel)
        mock_sale.is_sent_to_eet = False
        mock_sale.eet_status = "OFFLINE_PENDING"

        mock_db.query.return_value.first.return_value = mock_config
        mock_db.query.return_value.filter.return_value.order_by.return_value.limit.return_value.all.return_value = [mock_sale]

        with self.assertRaises(ValueError) as ctx:
            resend_pending_offline_sales()
        self.assertIn("Missing DIC configuration", str(ctx.exception))

    # 3. EET-M1: Raise on network failure even in non-prod when offline_mode=False
    @patch("services.eet_soap.requests.post")
    def test_eet_soap_network_failure_raises_when_online(self, mock_post):
        mock_post.side_effect = ConnectionError("Network unreachable")
        client = EETSoapClient(environment="playground", offline_mode=False)

        with self.assertRaises(ConnectionError) as ctx:
            client.send_sale_to_eet(
                eic_popl="CZ12345678",
                id_jednotky="11",
                id_pokl="1",
                porad_cis="2026-000001",
                dat_trzby="2026-09-12T10:00:00Z",
                celk_trzba=100.0,
                pkp="DUMMY_PKP",
                bkp="12345678-12345678-12345678-12345678-12345678"
            )
        self.assertIn("EET communication failed", str(ctx.exception))

    @patch("services.eet_soap.requests.post")
    def test_eet_soap_network_failure_fallback_when_offline_mode(self, mock_post):
        mock_post.side_effect = ConnectionError("Network unreachable")
        client = EETSoapClient(environment="playground", offline_mode=True)

        res = client.send_sale_to_eet(
            eic_popl="CZ12345678",
            id_jednotky="11",
            id_pokl="1",
            porad_cis="2026-000001",
            dat_trzby="2026-09-12T10:00:00Z",
            celk_trzba=100.0,
            pkp="DUMMY_PKP",
            bkp="12345678-12345678-12345678-12345678-12345678"
        )
        self.assertEqual(res["status"], "OFFLINE_PENDING")
        self.assertFalse(res["is_sent_to_eet"])
        self.assertIn("Endpoint unreachable", res["error"])

    # 4. PRN-H3: Cap logo base64 size before decode
    def test_print_receipt_logo_oversized_skipped(self):
        mock_printer = MagicMock()
        mock_printer.image = MagicMock()

        oversized_b64 = "A" * (2 * 1024 * 1024 + 64)
        print_receipt_logo(mock_printer, oversized_b64, is_58mm=True)
        mock_printer.image.assert_not_called()

    # 5. DB-L1: Add index on sales.timestamp in migrations
    def test_migrations_creates_sales_timestamp_index(self):
        engine = create_engine("sqlite:///:memory:")
        with engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE sales (
                    id VARCHAR PRIMARY KEY,
                    receipt_number VARCHAR,
                    timestamp DATETIME,
                    total_amount DECIMAL(10,2),
                    payment_method VARCHAR
                );
            """))
            conn.commit()

        run_schema_migrations(engine=engine)

        with engine.connect() as conn:
            indexes = conn.execute(text("PRAGMA index_list('sales');")).fetchall()
            index_names = {row[1] for row in indexes}
            self.assertIn("ix_sales_timestamp", index_names)


if __name__ == "__main__":
    unittest.main()
