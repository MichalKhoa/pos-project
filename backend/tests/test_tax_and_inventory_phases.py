import unittest
import uuid
import os
import sys
from datetime import datetime
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from main import app
from database import SessionLocal, engine
from models import (
    Base, PresetModel, StoreConfigModel, SaleModel, SaleItemModel,
    StockMovementModel, CashMovementModel, InventoryAuditModel,
    InventoryAuditItemModel, DepositMovementModel
)


class TestTaxAndInventoryPhases(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        Base.metadata.create_all(bind=engine)
        self.db = SessionLocal()

        self.test_preset_ids = ["preset_test_pivo", "preset_test_rohlik"]
        self.test_sale_ids = ["sale_tax_test_01", "sale_vat_test_01", "sale_b2b_test_01"]

        # Clean existing test records if any
        self._cleanup()

        # Seed basic StoreConfig if missing
        cfg = self.db.query(StoreConfigModel).first()
        if not cfg:
            cfg = StoreConfigModel(
                id=1,
                store_name="Testovací Prodejna s.r.o.",
                ico="12345678",
                dic="CZ12345678",
                street="Nádražní 10",
                city="Praha 5",
                bank_account_iban="CZ6508000000001234567890",
                eet_enabled=False
            )
            self.db.add(cfg)
            self.db.commit()

        # Seed test preset products
        self.p1 = PresetModel(
            id="preset_test_pivo",
            name="Pivo Plzeň 0.5l",
            price=38.0,
            cost_price=24.0,
            stock_quantity=50.0,
            track_stock=True,
            vat=21,
            unit="ks"
        )
        self.p2 = PresetModel(
            id="preset_test_rohlik",
            name="Rohlík tukový",
            price=3.0,
            cost_price=1.5,
            stock_quantity=100.0,
            track_stock=True,
            vat=12,
            unit="ks"
        )
        self.db.add_all([self.p1, self.p2])
        self.db.commit()

    def _cleanup(self):
        self.db.query(InventoryAuditItemModel).filter(InventoryAuditItemModel.preset_id.in_(self.test_preset_ids)).delete(synchronize_session=False)
        self.db.query(StockMovementModel).filter(StockMovementModel.preset_id.in_(self.test_preset_ids)).delete(synchronize_session=False)
        self.db.query(StockMovementModel).filter(StockMovementModel.id.in_(["sm_intake_test_01"])).delete(synchronize_session=False)
        self.db.query(CashMovementModel).filter(CashMovementModel.id.in_(["cm_payout_test_01"])).delete(synchronize_session=False)
        self.db.query(SaleItemModel).filter(SaleItemModel.sale_id.in_(self.test_sale_ids)).delete(synchronize_session=False)
        self.db.query(SaleModel).filter(SaleModel.id.in_(self.test_sale_ids)).delete(synchronize_session=False)
        self.db.query(DepositMovementModel).delete(synchronize_session=False)
        self.db.query(PresetModel).filter(PresetModel.id.in_(self.test_preset_ids)).delete(synchronize_session=False)
        self.db.commit()

    def tearDown(self):
        self._cleanup()
        self.db.close()

    # =========================================================================
    # TASK 1.1: Physical Inventory Count & Discrepancy Reconciliation Tests
    # =========================================================================

    def test_inventory_audit_success(self):
        """Test physical inventory reconciliation with shortage and surplus."""
        payload = {
            "responsible_person": "Josef Novák",
            "note": "Roční inventura 2026",
            "items": [
                {"preset_id": "preset_test_pivo", "physical_quantity": 45.0},    # Shortage: 50 -> 45 (diff: -5, unit_cost: 24)
                {"preset_id": "preset_test_rohlik", "physical_quantity": 110.0}  # Surplus: 100 -> 110 (diff: +10, unit_cost: 1.5)
            ]
        }
        res = self.client.post("/api/v1/inventory/audit", json=payload)
        self.assertEqual(res.status_code, 201)
        data = res.json()

        self.assertTrue(data["protocol_number"].startswith("INV-"))
        self.assertEqual(data["responsible_person"], "Josef Novák")
        self.assertEqual(data["total_items_counted"], 2)
        self.assertEqual(data["total_shortage_value"], 120.0)  # 5 * 24.0
        self.assertEqual(data["total_surplus_value"], 15.0)    # 10 * 1.5

        # Check stock quantity updated directly in PresetModel
        p1_updated = self.db.query(PresetModel).filter(PresetModel.id == "preset_test_pivo").first()
        self.assertEqual(p1_updated.stock_quantity, 45.0)

        p2_updated = self.db.query(PresetModel).filter(PresetModel.id == "preset_test_rohlik").first()
        self.assertEqual(p2_updated.stock_quantity, 110.0)

        # Check ADJUSTMENT stock movements created
        adj_movements = self.db.query(StockMovementModel).filter(
            StockMovementModel.preset_id.in_(self.test_preset_ids),
            StockMovementModel.movement_type == "ADJUSTMENT"
        ).all()
        self.assertEqual(len(adj_movements), 2)

    def test_inventory_audit_negative_quantity_rejection(self):
        """Test that negative physical quantity raises HTTP 400."""
        payload = {
            "items": [{"preset_id": "preset_test_pivo", "physical_quantity": -5.0}]
        }
        res = self.client.post("/api/v1/inventory/audit", json=payload)
        self.assertEqual(res.status_code, 400)

    def test_inventory_audit_empty_items_rejection(self):
        """Test that empty audit items list raises HTTP 400."""
        payload = {"items": []}
        res = self.client.post("/api/v1/inventory/audit", json=payload)
        self.assertEqual(res.status_code, 400)

    def test_inventory_audit_print_protocol(self):
        """Test thermal inventory protocol print trigger."""
        payload = {
            "protocolData": {
                "protocol_number": "INV-2026-0001",
                "responsible_person": "Josef Novák",
                "total_items_counted": 2,
                "total_surplus_value": 15.0,
                "total_shortage_value": 120.0,
                "items": [
                    {"preset_name": "Pivo Plzeň", "system_quantity": 50.0, "physical_quantity": 45.0, "difference": -5.0, "unit": "ks", "total_cost_impact": -120.0}
                ]
            }
        }
        res = self.client.post("/api/v1/printer/print-inventory", json=payload)
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()["success"])

    # =========================================================================
    # TASK 1.2: Tax Statements & VAT Overview Tests (§ 7b ZDP)
    # =========================================================================

    def test_tax_statement_calculations(self):
        """Test revenue, deductible expenses, stock valuation and net tax base calculation."""
        current_year = datetime.now().year

        sale_payload = {
            "id": "sale_tax_test_01",
            "totalAmount": 1000.0,
            "paymentMethod": "cash",
            "taxSummary": {"21": {"base": 826.45, "vat": 173.55}},
            "items": [{"name": "Zboží", "price": 1000.0, "quantity": 1.0, "vat": 21}]
        }
        res_sale = self.client.post("/api/v1/sales/", json=sale_payload)
        self.assertEqual(res_sale.status_code, 201)

        # Create 1 Stock Intake movement (goods expense)
        intake_mov = StockMovementModel(
            id="sm_intake_test_01",
            preset_id="preset_test_pivo",
            movement_type="RECEIPT",
            quantity_delta=10.0,
            unit_cost=24.0,  # 240 CZK expense
            timestamp=datetime.now()
        )
        # Create 1 Cash Payout movement (operating expense)
        payout_mov = CashMovementModel(
            id="cm_payout_test_01",
            amount=150.0,
            movement_type="PAYOUT",
            reason="Nákup čisticích prostředků",
            created_at=datetime.now()
        )
        self.db.add_all([intake_mov, payout_mov])
        self.db.commit()

        # Query tax statement
        res = self.client.get(f"/api/v1/reports/tax-statement?year={current_year}")
        self.assertEqual(res.status_code, 200)
        data = res.json()

        self.assertEqual(data["year"], current_year)
        self.assertGreaterEqual(data["taxable_revenue"], 1000.0)
        self.assertGreaterEqual(data["goods_expense"], 240.0)
        self.assertGreaterEqual(data["operating_expense"], 150.0)
        self.assertIn("stock_valuation", data)

    def test_vat_overview_tiers(self):
        """Test monthly/quarterly VAT breakdown and net liability."""
        current_year = datetime.now().year
        current_month = datetime.now().month

        sale_payload = {
            "id": "sale_vat_test_01",
            "totalAmount": 121.0,
            "paymentMethod": "card",
            "taxSummary": {"21": {"base": 100.0, "vat": 21.0}},
            "items": [{"name": "Položka 21%", "price": 121.0, "quantity": 1.0, "vat": 21}]
        }
        res_sale = self.client.post("/api/v1/sales/", json=sale_payload)
        self.assertEqual(res_sale.status_code, 201)

        res = self.client.get(f"/api/v1/reports/vat-overview?year={current_year}&month={current_month}")
        self.assertEqual(res.status_code, 200)
        data = res.json()

        self.assertEqual(data["period"]["year"], current_year)
        self.assertGreaterEqual(data["total_output_vat"], 21.0)
        self.assertGreaterEqual(data["total_output_base"], 100.0)

    # =========================================================================
    # TASK 1.3: B2B Invoicing from POS Register Tests
    # =========================================================================

    def test_b2b_invoice_creation_and_sequence(self):
        """Test B2B invoice generation with buyer details and sequential number."""
        current_year = datetime.now().year
        sale_payload = {
            "id": "sale_b2b_test_01",
            "totalAmount": 12100.0,  # > 10 000 CZK
            "paymentMethod": "card",
            "taxSummary": {"21": {"base": 10000.0, "vat": 2100.0}},
            "items": [{"name": "Stavební materiál", "price": 12100.0, "quantity": 1.0, "vat": 21}],
            "isInvoice": True,
            "customerIco": "27082440",
            "customerDic": "CZ27082440",
            "customerName": "Alza.cz a.s.",
            "customerAddress": "Jankovcova 1522/53, Holešovice, 17000 Praha 7"
        }
        res = self.client.post("/api/v1/sales/", json=sale_payload)
        self.assertEqual(res.status_code, 201)
        data = res.json()

        self.assertTrue(data["is_invoice"])
        self.assertTrue(data["invoice_number"].startswith(f"FA-{current_year}-"))
        self.assertEqual(data["customer_ico"], "27082440")
        self.assertEqual(data["customer_name"], "Alza.cz a.s.")

        # Test A4 printable HTML generation endpoint
        res_html = self.client.get(f"/api/v1/sales/{data['sale_id']}/invoice-html")
        self.assertEqual(res_html.status_code, 200)
        self.assertIn("FAKTURA - DAŇOVÝ DOKLAD", res_html.text)
        self.assertIn("27082440", res_html.text)
        self.assertIn("Alza.cz a.s.", res_html.text)

    # =========================================================================
    # TASK 1.4: Deposit Packaging Book Tests (Lahve & Přepravky)
    # =========================================================================

    def test_deposit_movements_and_summary(self):
        """Test bottle & crate intake, customer return, brewery dispatch and summary balance."""
        # 1. Intake 100 beer bottles from brewery (+100)
        res1 = self.client.post("/api/v1/inventory/deposits/movement", json={
            "container_type": "BOTTLE_3CZK",
            "movement_type": "SUPPLIER_INTAKE",
            "quantity": 100,
            "deposit_value": 3.0,
            "document_ref": "DL-PIVO-TEST-001",
            "supplier_ico": "11223344",
            "note": "Závoz piva"
        })
        self.assertEqual(res1.status_code, 201)
        self.assertEqual(res1.json()["quantity_delta"], 100.0)
        self.assertEqual(res1.json()["total_value"], 300.0)

        # 2. Customer returns 20 bottles at counter (+20)
        res2 = self.client.post("/api/v1/inventory/deposits/movement", json={
            "container_type": "BOTTLE_3CZK",
            "movement_type": "CUSTOMER_RETURN",
            "quantity": 20,
            "deposit_value": 3.0
        })
        self.assertEqual(res2.status_code, 201)
        self.assertEqual(res2.json()["quantity_delta"], 20.0)

        # 3. Dispatch 50 bottles back to brewery truck (-50)
        res3 = self.client.post("/api/v1/inventory/deposits/movement", json={
            "container_type": "BOTTLE_3CZK",
            "movement_type": "SUPPLIER_DISPATCH",
            "quantity": 50,
            "deposit_value": 3.0
        })
        self.assertEqual(res3.status_code, 201)
        self.assertEqual(res3.json()["quantity_delta"], -50.0)

        # 4. Check summary balance
        res_sum = self.client.get("/api/v1/inventory/deposits/summary")
        self.assertEqual(res_sum.status_code, 200)
        data = res_sum.json()

        bottle_bal = next((b for b in data["balances"] if b["container_type"] == "BOTTLE_3CZK"), None)
        self.assertIsNotNone(bottle_bal)
        self.assertGreaterEqual(bottle_bal["current_quantity"], 70.0)

        # 5. Dispatching more than available stock raises HTTP 400
        res_overflow = self.client.post("/api/v1/inventory/deposits/movement", json={
            "container_type": "BOTTLE_3CZK",
            "movement_type": "SUPPLIER_DISPATCH",
            "quantity": 9999,
            "deposit_value": 3.0
        })
        self.assertEqual(res_overflow.status_code, 400)

    def test_html_tax_and_vat_reports(self):
        """Test Task 1.1/1.2: Official A4 HTML report generation endpoints."""
        # 1. DPFO Tax Statement HTML
        res_dpfo = self.client.get("/api/v1/reports/tax-statement/html?year=2026")
        self.assertEqual(res_dpfo.status_code, 200)
        self.assertIn("text/html", res_dpfo.headers["content-type"])
        self.assertIn("Příloha č. 1", res_dpfo.text)
        self.assertIn("Tabulka D", res_dpfo.text)

        # 2. VAT Overview HTML
        res_vat = self.client.get("/api/v1/reports/vat-overview/html?year=2026")
        self.assertEqual(res_vat.status_code, 200)
        self.assertIn("text/html", res_vat.headers["content-type"])
        self.assertIn("Přehled DPH", res_vat.text)

    def test_thermal_tax_report_printing(self):
        """Test Task 1.1/1.2: Thermal receipt printer slip for DPFO and VAT statements."""
        # 1. Print DPFO slip
        res_dpfo = self.client.post("/api/v1/printer/print-tax-report", json={
            "reportType": "dpfo",
            "reportData": {
                "year": 2026,
                "taxable_income": 250000.0,
                "tax_deductible_expenses": 180000.0,
                "net_tax_base": 70000.0,
                "beginning_inventory": 50000.0,
                "ending_inventory": 65000.0,
                "inventory_change": 15000.0,
                "inventory_purchases": 120000.0,
                "operating_expenses": 60000.0
            }
        })
        self.assertEqual(res_dpfo.status_code, 200)
        self.assertTrue(res_dpfo.json()["success"])

        # 2. Print VAT slip
        res_vat = self.client.post("/api/v1/printer/print-tax-report", json={
            "reportType": "vat",
            "reportData": {
                "year": 2026,
                "period": "Q3",
                "output_vat": {
                    "rate_21": {"base": 100000.0, "tax": 21000.0},
                    "rate_12": {"base": 50000.0, "tax": 6000.0},
                    "rate_0": {"base": 0.0, "tax": 0.0},
                    "total_output_tax": 27000.0
                },
                "input_vat": {
                    "total_input_tax": 15000.0,
                    "receipts_count": 5
                },
                "net_vat_liability": 12000.0
            }
        })
        self.assertEqual(res_vat.status_code, 200)
        self.assertTrue(res_vat.json()["success"])

    def test_thermal_b2b_invoice_printing(self):
        """Test Task 1.3: Thermal receipt printing with formal B2B invoice layout."""
        from services.escpos_service import ESCPOSPrinterService
        printer = ESCPOSPrinterService(interface_type="DUMMY")
        sale_data = {
            "id": "sale_b2b_inv_01",
            "receiptNumber": "2026-000099",
            "invoiceNumber": "FA-2026-0099",
            "isInvoice": True,
            "customerName": "ACME Industrial s.r.o.",
            "customerIco": "87654321",
            "customerDic": "CZ87654321",
            "customerAddress": "Průmyslová 1, Praha",
            "totalAmount": 1210.0,
            "timestamp": "2026-09-12T10:00:00",
            "paymentMethod": "CASH",
            "items": [
                {
                    "name": "Kladivo",
                    "quantity": 1,
                    "price": 1210.0,
                    "vat": 21,
                    "unit": "ks"
                }
            ],
            "taxSummary": {
                "21": {"rate": 21, "net": 1000.0, "tax": 210.0, "gross": 1210.0}
            }
        }
        store_config = {
            "storeName": "Železářství Himmel",
            "ico": "12345678",
            "dic": "CZ12345678",
            "street": "Hlavní 1",
            "city": "Brno"
        }
        res = printer.print_receipt(sale_data, store_config)
        self.assertTrue(res["success"])


if __name__ == "__main__":
    unittest.main()

