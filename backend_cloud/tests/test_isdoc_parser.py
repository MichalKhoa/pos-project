import io
import zipfile
import unittest
import sys
import os

# Ensure backend_cloud is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from services.isdoc_parser import parse_isdoc_xml, parse_isdoc_bytes

SAMPLE_ISDOC_XML = """<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="http://isdoc.cz/namespace/2013" version="6.0.1">
    <DocumentType>1</DocumentType>
    <ID>2026-MAKRO-0042</ID>
    <UUID>4a781b0a-31b3-4f92-9b24-9b2512f4621a</UUID>
    <IssueDate>2026-09-12</IssueDate>
    <TaxPointDate>2026-09-12</TaxPointDate>
    <VATApplicable>true</VATApplicable>
    <AccountingSupplierParty>
        <Party>
            <PartyIdentification>
                <ID>26450691</ID>
            </PartyIdentification>
            <PartyName>
                <Name>MAKRO Cash &amp; Carry ČR s.r.o.</Name>
            </PartyName>
            <PostalAddress>
                <StreetName>Jeremiášova</StreetName>
                <BuildingNumber>1249/7</BuildingNumber>
                <CityName>Praha 5</CityName>
                <PostalZone>15580</PostalZone>
            </PostalAddress>
            <PartyTaxScheme>
                <CompanyID>CZ26450691</CompanyID>
                <TaxScheme>
                    <ID>VAT</ID>
                </TaxScheme>
            </PartyTaxScheme>
        </Party>
    </AccountingSupplierParty>
    <AccountingCustomerParty>
        <Party>
            <PartyIdentification>
                <ID>12345678</ID>
            </PartyIdentification>
            <PartyName>
                <Name>Večerka u Potoka</Name>
            </PartyName>
            <PartyTaxScheme>
                <CompanyID>CZ12345678</CompanyID>
            </PartyTaxScheme>
        </Party>
    </AccountingCustomerParty>
    <InvoiceLines>
        <InvoiceLine>
            <ID>1</ID>
            <InvoicedQuantity unitCode="PCE">24.0</InvoicedQuantity>
            <LineExtensionAmount>720.00</LineExtensionAmount>
            <LineExtensionAmountTaxInclusive>871.20</LineExtensionAmountTaxInclusive>
            <LineExtensionTaxAmount>151.20</LineExtensionTaxAmount>
            <UnitPrice>30.00</UnitPrice>
            <UnitPriceTaxInclusive>36.30</UnitPriceTaxInclusive>
            <ClassifiedTaxCategory>
                <Percent>21.0</Percent>
            </ClassifiedTaxCategory>
            <Item>
                <Description>Pilsner Urquell 0.5L plechovka</Description>
                <StandardItemIdentification>
                    <ID>8594001234567</ID>
                </StandardItemIdentification>
                <SellersItemIdentification>
                    <ID>MK-PU-05</ID>
                </SellersItemIdentification>
            </Item>
        </InvoiceLine>
        <InvoiceLine>
            <ID>2</ID>
            <InvoicedQuantity unitCode="PCE">50.0</InvoicedQuantity>
            <LineExtensionAmount>150.00</LineExtensionAmount>
            <LineExtensionAmountTaxInclusive>168.00</LineExtensionAmountTaxInclusive>
            <LineExtensionTaxAmount>18.00</LineExtensionTaxAmount>
            <UnitPrice>3.00</UnitPrice>
            <UnitPriceTaxInclusive>3.36</UnitPriceTaxInclusive>
            <ClassifiedTaxCategory>
                <Percent>12.0</Percent>
            </ClassifiedTaxCategory>
            <Item>
                <Description>Rohlík tukový 43g</Description>
                <StandardItemIdentification>
                    <ID>8591234567890</ID>
                </StandardItemIdentification>
            </Item>
        </InvoiceLine>
    </InvoiceLines>
    <LegalMonetaryTotal>
        <TaxExclusiveAmount>870.00</TaxExclusiveAmount>
        <TaxInclusiveAmount>1039.20</TaxInclusiveAmount>
        <PayableAmount>1039.20</PayableAmount>
    </LegalMonetaryTotal>
    <PaymentMeans>
        <Payment>
            <Details>
                <PaymentDueDate>2026-09-26</PaymentDueDate>
            </Details>
        </Payment>
    </PaymentMeans>
</Invoice>
"""

class TestIsdocParser(unittest.TestCase):
    def test_parse_isdoc_xml(self):
        parsed = parse_isdoc_xml(SAMPLE_ISDOC_XML)
        
        self.assertEqual(parsed["source"], "ISDOC")
        self.assertEqual(parsed["document_id"], "2026-MAKRO-0042")
        self.assertEqual(parsed["issue_date"], "2026-09-12")
        self.assertEqual(parsed["due_date"], "2026-09-26")
        
        # Supplier
        self.assertEqual(parsed["supplier"]["ico"], "26450691")
        self.assertEqual(parsed["supplier"]["name"], "MAKRO Cash & Carry ČR s.r.o.")
        self.assertIn("Praha 5", parsed["supplier"]["address"])
        
        # Items
        self.assertEqual(len(parsed["items"]), 2)
        item1 = parsed["items"][0]
        self.assertEqual(item1["name"], "Pilsner Urquell 0.5L plechovka")
        self.assertEqual(item1["ean"], "8594001234567")
        self.assertEqual(item1["quantity"], 24.0)
        self.assertEqual(item1["unit_price_ex_vat"], 30.0)
        self.assertEqual(item1["vat_rate"], 21.0)
        self.assertEqual(item1["total_ex_vat"], 720.0)

        item2 = parsed["items"][1]
        self.assertEqual(item2["name"], "Rohlík tukový 43g")
        self.assertEqual(item2["ean"], "8591234567890")
        self.assertEqual(item2["quantity"], 50.0)
        self.assertEqual(item2["unit_price_ex_vat"], 3.0)
        self.assertEqual(item2["vat_rate"], 12.0)
        
        # Totals
        self.assertEqual(parsed["total_ex_vat"], 870.0)
        self.assertEqual(parsed["total_inc_vat"], 1039.2)
        self.assertEqual(parsed["payable_amount"], 1039.2)

    def test_parse_isdocx_zip(self):
        # Create a mock .isdocx archive in memory
        zip_buf = io.BytesIO()
        with zipfile.ZipFile(zip_buf, "w") as zf:
            zf.writestr("document.isdoc", SAMPLE_ISDOC_XML)
            zf.writestr("attachment.pdf", b"%PDF-1.4 mock pdf content")

        zip_data = zip_buf.getvalue()
        parsed = parse_isdoc_bytes(zip_data)

        self.assertEqual(parsed["document_id"], "2026-MAKRO-0042")
        self.assertEqual(parsed["attachment_name"], "attachment.pdf")
        self.assertEqual(len(parsed["items"]), 2)

    def test_invalid_xml(self):
        with self.assertRaises(ValueError):
            parse_isdoc_xml("<InvalidRoot>broken xml")

if __name__ == "__main__":
    unittest.main()
