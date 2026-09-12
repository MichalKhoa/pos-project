"""
VoltFlow POS — Czech ISDOC 5.2 / 6.0 XML Parser
Zero external dependencies (pure Python stdlib xml.etree.ElementTree + zipfile).
Supports plain .isdoc / .xml files and .isdocx ZIP archives.
"""

import io
import zipfile
import xml.etree.ElementTree as ET
from decimal import Decimal
from typing import Dict, Any, List, Optional


def _strip_namespace(elem: ET.Element) -> ET.Element:
    """Removes XML namespaces from element tags in-place for clean tag matching."""
    for el in elem.iter():
        if "}" in el.tag:
            el.tag = el.tag.split("}", 1)[1]
    return elem


def _get_text(elem: Optional[ET.Element], path: str, default: str = "") -> str:
    """Safely extracts trimmed text from a subelement path."""
    if elem is None:
        return default
    target = elem.find(path)
    if target is not None and target.text:
        return target.text.strip()
    return default


def _get_float(elem: Optional[ET.Element], path: str, default: float = 0.0) -> float:
    """Safely extracts float/decimal value from a subelement path."""
    val_str = _get_text(elem, path)
    if not val_str:
        return default
    try:
        return float(val_str.replace(",", ".").strip())
    except (ValueError, TypeError):
        return default


def parse_isdoc_bytes(data: bytes) -> Dict[str, Any]:
    """
    Parses raw bytes of an .isdoc XML or .isdocx ZIP archive.
    Returns normalized invoice dictionary ready for staging queue.
    """
    xml_content = None
    attachment_name = None

    # Check if the file is a ZIP archive (.isdocx)
    if zipfile.is_zipfile(io.BytesIO(data)):
        with zipfile.ZipFile(io.BytesIO(data), "r") as zf:
            namelist = zf.namelist()
            # Look for .isdoc or .xml
            isdoc_file = next((name for name in namelist if name.lower().endswith((".isdoc", ".xml"))), None)
            if not isdoc_file:
                raise ValueError("ISDOC archive does not contain an .isdoc or .xml document.")
            xml_content = zf.read(isdoc_file)
            
            # Check for attached PDF if any
            pdf_file = next((name for name in namelist if name.lower().endswith(".pdf")), None)
            if pdf_file:
                attachment_name = pdf_file
    else:
        xml_content = data

    return parse_isdoc_xml(xml_content, attachment_name=attachment_name)


def parse_isdoc_xml(xml_content: bytes | str, attachment_name: Optional[str] = None) -> Dict[str, Any]:
    """
    Parses ISDOC XML string or bytes and returns normalized dictionary.
    """
    if isinstance(xml_content, str):
        xml_content = xml_content.encode("utf-8")

    try:
        root = ET.fromstring(xml_content)
    except ET.ParseError as e:
        raise ValueError(f"Invalid XML / ISDOC document: {str(e)}")

    # Strip XML namespaces for clean querying
    _strip_namespace(root)

    # Header metadata
    document_id = _get_text(root, "ID")
    uuid_str = _get_text(root, "UUID")
    issue_date = _get_text(root, "IssueDate")
    tax_point_date = _get_text(root, "TaxPointDate")
    
    # Payment / Due date
    due_date = _get_text(root, ".//PaymentDueDate")
    if not due_date:
        due_date = _get_text(root, "PaymentMeans/Payment/Details/PaymentDueDate")

    # Supplier (AccountingSupplierParty)
    supplier_party = root.find(".//AccountingSupplierParty/Party")
    supplier_name = _get_text(supplier_party, "PartyName/Name")
    supplier_ico = _get_text(supplier_party, "PartyIdentification/ID")
    supplier_dic = _get_text(supplier_party, "PartyTaxScheme/CompanyID")

    supplier_address_parts = [
        _get_text(supplier_party, "PostalAddress/StreetName"),
        _get_text(supplier_party, "PostalAddress/BuildingNumber"),
        _get_text(supplier_party, "PostalAddress/CityName"),
        _get_text(supplier_party, "PostalAddress/PostalZone"),
    ]
    supplier_address = " ".join(p for p in supplier_address_parts if p).strip()

    # Customer (AccountingCustomerParty)
    customer_party = root.find(".//AccountingCustomerParty/Party")
    customer_name = _get_text(customer_party, "PartyName/Name")
    customer_ico = _get_text(customer_party, "PartyIdentification/ID")
    customer_dic = _get_text(customer_party, "PartyTaxScheme/CompanyID")

    # Invoice Lines
    items: List[Dict[str, Any]] = []
    lines = root.findall(".//InvoiceLine")
    if not lines:
        lines = root.findall(".//CreditNoteLine")

    for line in lines:
        line_id = _get_text(line, "ID")
        item_name = _get_text(line, "Item/Description")
        if not item_name:
            item_name = _get_text(line, "Item/Name", default=f"Položka {line_id}")

        # EAN / Barcode search priority
        ean = _get_text(line, "Item/StandardItemIdentification/ID")
        seller_sku = _get_text(line, "Item/SellersItemIdentification/ID")
        secondary_sku = _get_text(line, "Item/SecondarySellersItemIdentification/ID")

        barcode = ean or secondary_sku or seller_sku or ""

        qty = _get_float(line, "InvoicedQuantity", default=1.0)
        unit_price_ex_vat = _get_float(line, "UnitPrice", default=0.0)
        line_total_ex_vat = _get_float(line, "LineExtensionAmount", default=0.0)

        # VAT percentage
        vat_rate = _get_float(line, "ClassifiedTaxCategory/Percent", default=21.0)
        if vat_rate == 0.0:
            vat_rate = _get_float(line, ".//Percent", default=21.0)

        unit_price_inc_vat = _get_float(line, "UnitPriceTaxInclusive", default=0.0)
        if unit_price_inc_vat == 0.0 and unit_price_ex_vat > 0:
            unit_price_inc_vat = round(unit_price_ex_vat * (1.0 + vat_rate / 100.0), 2)

        if line_total_ex_vat == 0.0 and qty > 0 and unit_price_ex_vat > 0:
            line_total_ex_vat = round(qty * unit_price_ex_vat, 2)

        items.append({
            "line_id": line_id,
            "name": item_name,
            "ean": barcode,
            "supplier_sku": seller_sku,
            "quantity": qty,
            "unit_price_ex_vat": unit_price_ex_vat,
            "unit_price_inc_vat": unit_price_inc_vat,
            "vat_rate": vat_rate,
            "total_ex_vat": line_total_ex_vat,
            "retail_price": 0.0, # Default to be set or matched with catalog
        })

    # Legal monetary totals
    total_ex_vat = _get_float(root, ".//TaxExclusiveAmount", default=0.0)
    total_inc_vat = _get_float(root, ".//TaxInclusiveAmount", default=0.0)
    payable_amount = _get_float(root, ".//PayableAmount", default=total_inc_vat)
    if payable_amount == 0.0:
        payable_amount = total_inc_vat

    return {
        "source": "ISDOC",
        "document_id": document_id,
        "uuid": uuid_str,
        "issue_date": issue_date,
        "tax_point_date": tax_point_date,
        "due_date": due_date,
        "supplier": {
            "name": supplier_name,
            "ico": supplier_ico,
            "dic": supplier_dic,
            "address": supplier_address,
        },
        "customer": {
            "name": customer_name,
            "ico": customer_ico,
            "dic": customer_dic,
        },
        "items": items,
        "total_ex_vat": total_ex_vat,
        "total_inc_vat": total_inc_vat,
        "payable_amount": payable_amount,
        "attachment_name": attachment_name,
    }
