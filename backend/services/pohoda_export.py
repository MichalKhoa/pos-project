"""
Stormware POHODA 2.0 XML Export Bridge
Generates standard POHODA XML dataPack for Czech accounting software:
- Issued invoices / receipts (<inv:invoice>) with 21%, 12%, 0% VAT breakdowns.
- Cash drawer movements (<vch:voucher>) for float in, payouts, and safe drops.
"""

from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, date
import re
from typing import List, Any, Optional, Dict


def xml_escape(value: Any) -> str:
    """Safely escape XML characters."""
    if value is None:
        return ""
    text = str(value)
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )


def format_pohoda_date(dt: Any) -> str:
    """Formats datetime/date or ISO string to YYYY-MM-DD."""
    if isinstance(dt, (datetime, date)):
        return dt.strftime("%Y-%m-%d")
    if isinstance(dt, str) and len(dt) >= 10:
        return dt[:10]
    return datetime.now().strftime("%Y-%m-%d")


def map_payment_type(payment_method: Optional[str]) -> str:
    """Map POS payment method to Stormware POHODA paymentType."""
    pm = (payment_method or "cash").strip().lower()
    if "cash" in pm:
        return "cash"
    if "card" in pm:
        return "card"
    if "qr" in pm or "bank" in pm:
        return "bank"
    if "split" in pm:
        return "split"
    return "cash"


def map_vat_rate_type(vat_rate: Any) -> str:
    """Map Czech VAT percentage to POHODA vatRate enum ('high', 'low', 'none')."""
    try:
        vat_num = int(vat_rate)
    except (ValueError, TypeError):
        return "high"

    if vat_num == 21:
        return "high"
    if vat_num == 12:
        return "low"
    if vat_num == 0:
        return "none"
    if vat_num >= 20:
        return "high"
    if vat_num > 0:
        return "low"
    return "none"


def calculate_sale_vat_breakdown(sale: Any) -> Dict[str, Decimal]:
    """
    Extract or calculate precise Czech VAT amounts for 21%, 12%, 0% tiers.
    Strictly follows domain invariant: Decimal 2 places, Base + VAT strictly equals Total.
    """
    two_places = Decimal("0.01")
    tax_summary = getattr(sale, "tax_summary", None)
    if tax_summary is None and isinstance(sale, dict):
        tax_summary = sale.get("tax_summary") or sale.get("taxSummary")

    price_high = Decimal("0.00")
    price_high_vat = Decimal("0.00")
    price_low = Decimal("0.00")
    price_low_vat = Decimal("0.00")
    price_none = Decimal("0.00")

    extracted_from_summary = False
    if isinstance(tax_summary, dict) and tax_summary:
        # Check for 21%
        entry21 = tax_summary.get(21) or tax_summary.get("21")
        if isinstance(entry21, dict):
            price_high = Decimal(str(entry21.get("net", 0.0))).quantize(two_places, rounding=ROUND_HALF_UP)
            price_high_vat = Decimal(str(entry21.get("tax", 0.0))).quantize(two_places, rounding=ROUND_HALF_UP)
            extracted_from_summary = True

        # Check for 12%
        entry12 = tax_summary.get(12) or tax_summary.get("12")
        if isinstance(entry12, dict):
            price_low = Decimal(str(entry12.get("net", 0.0))).quantize(two_places, rounding=ROUND_HALF_UP)
            price_low_vat = Decimal(str(entry12.get("tax", 0.0))).quantize(two_places, rounding=ROUND_HALF_UP)
            extracted_from_summary = True

        # Check for 0%
        entry0 = tax_summary.get(0) or tax_summary.get("0")
        if isinstance(entry0, dict):
            price_none = Decimal(str(entry0.get("net", 0.0))).quantize(two_places, rounding=ROUND_HALF_UP)
            extracted_from_summary = True

    # Fallback to items calculation if not extracted from tax_summary
    if not extracted_from_summary:
        items = sale.get("items", []) if isinstance(sale, dict) else getattr(sale, "items", [])

        if items:
            for item in items:
                i_qty = Decimal(str(getattr(item, "quantity", None) if hasattr(item, "quantity") else (item.get("quantity") if isinstance(item, dict) else 1.0) or 1.0))
                i_price = Decimal(str(getattr(item, "price", None) if hasattr(item, "price") else (item.get("price") if isinstance(item, dict) else 0.0) or 0.0))
                i_vat = getattr(item, "vat", None) if hasattr(item, "vat") else (item.get("vat") if isinstance(item, dict) else 21)
                try:
                    vat_int = int(i_vat)
                except (ValueError, TypeError):
                    vat_int = 21

                gross = (i_price * i_qty).quantize(two_places, rounding=ROUND_HALF_UP)
                if vat_int == 21:
                    net = (gross / Decimal("1.21")).quantize(two_places, rounding=ROUND_HALF_UP)
                    tax = gross - net
                    price_high += net
                    price_high_vat += tax
                elif vat_int == 12:
                    net = (gross / Decimal("1.12")).quantize(two_places, rounding=ROUND_HALF_UP)
                    tax = gross - net
                    price_low += net
                    price_low_vat += tax
                else:
                    price_none += gross
        else:
            # Entire amount in default tier or 0%
            raw_total = Decimal(str(getattr(sale, "total_amount", None) if hasattr(sale, "total_amount") else (sale.get("total_amount") if isinstance(sale, dict) else 0.0) or 0.0)).quantize(two_places, rounding=ROUND_HALF_UP)
            price_high = (raw_total / Decimal("1.21")).quantize(two_places, rounding=ROUND_HALF_UP)
            price_high_vat = raw_total - price_high

    raw_total = Decimal(str(getattr(sale, "total_amount", None) if hasattr(sale, "total_amount") else (sale.get("total_amount") if isinstance(sale, dict) else 0.0) or 0.0)).quantize(two_places, rounding=ROUND_HALF_UP)

    return {
        "price_high": price_high,
        "price_high_vat": price_high_vat,
        "price_low": price_low,
        "price_low_vat": price_low_vat,
        "price_none": price_none,
        "price_total": raw_total,
    }


def generate_pohoda_datapack_xml(
    sales: List[Any],
    cash_movements: List[Any],
    store_config: Any,
    period_label: str = "export",
) -> str:
    """
    Generate Stormware POHODA 2.0 XML dataPack string.
    Contains:
    - Invoices (<inv:invoice>) for sales and refunds
    - Vouchers (<vch:voucher>) for cash drawer movements
    """
    sanitized_label = re.sub(r"[^A-Za-z0-9_-]", "_", str(period_label or "export"))

    # Store ICO
    ico = "00000000"
    if store_config:
        raw_ico = getattr(store_config, "ico", None) if hasattr(store_config, "ico") else (store_config.get("ico") if isinstance(store_config, dict) else None)
        if raw_ico and str(raw_ico).strip():
            ico = str(raw_ico).strip()

    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<dat:dataPack',
        '    xmlns:dat="http://www.stormware.cz/schema/version_2/data.xsd"',
        '    xmlns:inv="http://www.stormware.cz/schema/version_2/invoice.xsd"',
        '    xmlns:vch="http://www.stormware.cz/schema/version_2/voucher.xsd"',
        '    xmlns:typ="http://www.stormware.cz/schema/version_2/type.xsd"',
        f'    id="EXPORT_{xml_escape(sanitized_label)}"',
        f'    ico="{xml_escape(ico)}"',
        '    application="VoltFlow POS"',
        '    version="2.0"',
        '    note="Export z VoltFlow POS">',
    ]

    # Process Sales
    for sale in (sales or []):
        sale_id = getattr(sale, "id", None) if hasattr(sale, "id") else (sale.get("id") if isinstance(sale, dict) else "")
        receipt_number = getattr(sale, "receipt_number", None) if hasattr(sale, "receipt_number") else (sale.get("receipt_number") or sale.get("receiptNumber") if isinstance(sale, dict) else "")
        raw_ts = getattr(sale, "timestamp", None) if hasattr(sale, "timestamp") else (sale.get("timestamp") or sale.get("created_at") if isinstance(sale, dict) else None)
        date_str = format_pohoda_date(raw_ts)

        is_refund = bool(getattr(sale, "is_refund", False) if hasattr(sale, "is_refund") else (sale.get("is_refund") or sale.get("isRefund") if isinstance(sale, dict) else False))
        payment_method = getattr(sale, "payment_method", None) if hasattr(sale, "payment_method") else (sale.get("payment_method") or sale.get("paymentMethod") if isinstance(sale, dict) else "cash")
        pohoda_payment = map_payment_type(payment_method)

        doc_text = f"Storno {receipt_number}" if is_refund else f"Prodejka {receipt_number}"

        vat_summary = calculate_sale_vat_breakdown(sale)

        lines.append(f'  <dat:dataPackItem id="{xml_escape(sale_id)}" version="2.0">')
        lines.append('    <inv:invoice version="2.0">')
        lines.append('      <inv:invoiceHeader>')
        lines.append('        <inv:invoiceType>issuedInvoice</inv:invoiceType>')
        lines.append('        <inv:number>')
        lines.append(f'          <typ:numberRequested>{xml_escape(receipt_number)}</typ:numberRequested>')
        lines.append('        </inv:number>')
        lines.append(f'        <inv:date>{date_str}</inv:date>')
        lines.append(f'        <inv:dateTax>{date_str}</inv:dateTax>')
        lines.append(f'        <inv:text>{xml_escape(doc_text)}</inv:text>')
        lines.append('        <inv:paymentType>')
        lines.append(f'          <typ:paymentType>{xml_escape(pohoda_payment)}</typ:paymentType>')
        lines.append('        </inv:paymentType>')
        lines.append(f'        <inv:priceHigh>{vat_summary["price_high"]:.2f}</inv:priceHigh>')
        lines.append(f'        <inv:priceHighVAT>{vat_summary["price_high_vat"]:.2f}</inv:priceHighVAT>')
        lines.append(f'        <inv:priceLow>{vat_summary["price_low"]:.2f}</inv:priceLow>')
        lines.append(f'        <inv:priceLowVAT>{vat_summary["price_low_vat"]:.2f}</inv:priceLowVAT>')
        lines.append(f'        <inv:priceNone>{vat_summary["price_none"]:.2f}</inv:priceNone>')
        lines.append(f'        <inv:priceTotal>{vat_summary["price_total"]:.2f}</inv:priceTotal>')
        lines.append('      </inv:invoiceHeader>')

        # Line items in detail
        items = sale.get("items", []) if isinstance(sale, dict) else getattr(sale, "items", [])
        if items:
            lines.append('      <inv:invoiceDetail>')
            for item in items:
                item_name = getattr(item, "name", None) if hasattr(item, "name") else (item.get("name") if isinstance(item, dict) else "Položka")
                item_qty = getattr(item, "quantity", None) if hasattr(item, "quantity") else (item.get("quantity") if isinstance(item, dict) else 1.0)
                item_price = getattr(item, "price", None) if hasattr(item, "price") else (item.get("price") if isinstance(item, dict) else 0.0)
                item_vat = getattr(item, "vat", None) if hasattr(item, "vat") else (item.get("vat") if isinstance(item, dict) else 21)

                try:
                    qty_f = float(item_qty or 1.0)
                except (ValueError, TypeError):
                    qty_f = 1.0
                try:
                    price_f = float(item_price or 0.0)
                except (ValueError, TypeError):
                    price_f = 0.0

                vat_rate_str = map_vat_rate_type(item_vat)

                lines.append('        <inv:invoiceItem>')
                lines.append(f'          <inv:text>{xml_escape(item_name)}</inv:text>')
                lines.append(f'          <inv:quantity>{qty_f:g}</inv:quantity>')
                lines.append(f'          <inv:unitPrice>{price_f:.2f}</inv:unitPrice>')
                lines.append(f'          <inv:vatRate>{vat_rate_str}</inv:vatRate>')
                lines.append('        </inv:invoiceItem>')
            lines.append('      </inv:invoiceDetail>')

        lines.append('    </inv:invoice>')
        lines.append('  </dat:dataPackItem>')

    # Process Cash Movements
    for mov in (cash_movements or []):
        mov_id = getattr(mov, "id", None) if hasattr(mov, "id") else (mov.get("id") if isinstance(mov, dict) else "")
        mov_type = getattr(mov, "movement_type", None) if hasattr(mov, "movement_type") else (mov.get("movement_type") if isinstance(mov, dict) else "")
        raw_created_at = getattr(mov, "created_at", None) if hasattr(mov, "created_at") else (mov.get("created_at") if isinstance(mov, dict) else None)
        mov_date = format_pohoda_date(raw_created_at)
        reason = getattr(mov, "reason", None) if hasattr(mov, "reason") else (mov.get("reason") if isinstance(mov, dict) else "")
        amount = getattr(mov, "amount", None) if hasattr(mov, "amount") else (mov.get("amount") if isinstance(mov, dict) else 0.0)

        # Voucher type: receipt for FLOAT_IN, expense for PAYOUT / SAFE_DROP
        vch_type = "receipt" if str(mov_type).upper() == "FLOAT_IN" else "expense"
        mov_text = reason.strip() if reason and reason.strip() else "Pokladní pohyb"

        try:
            amt_d = Decimal(str(amount or 0.0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        except Exception:
            amt_d = Decimal("0.00")

        lines.append(f'  <dat:dataPackItem id="vch-{xml_escape(mov_id)}" version="2.0">')
        lines.append('    <vch:voucher version="2.0">')
        lines.append('      <vch:voucherHeader>')
        lines.append(f'        <vch:voucherType>{vch_type}</vch:voucherType>')
        lines.append(f'        <vch:date>{mov_date}</vch:date>')
        lines.append(f'        <vch:text>{xml_escape(mov_text)}</vch:text>')
        lines.append(f'        <vch:priceTotal>{amt_d:.2f}</vch:priceTotal>')
        lines.append('      </vch:voucherHeader>')
        lines.append('    </vch:voucher>')
        lines.append('  </dat:dataPackItem>')

    lines.append('</dat:dataPack>')
    return "\n".join(lines)
