from typing import Optional, Dict, Any, List
from decimal import Decimal, ROUND_HALF_UP
import io
import csv
import logging
from fastapi import APIRouter, Query
from fastapi.responses import Response

try:
    from backend_cloud.snapshot_service import snapshot_service
except ImportError:
    from snapshot_service import snapshot_service

logger = logging.getLogger("exports-router")

TWO_PLACES = Decimal("0.01")


def to_dec(val: Any) -> Decimal:
    """Safely converts input to Decimal, returning Decimal('0.00') on failure."""
    if val is None:
        return Decimal("0.00")
    if isinstance(val, Decimal):
        return val
    try:
        return Decimal(str(val))
    except Exception:
        return Decimal("0.00")


def round_dec(val: Decimal) -> Decimal:
    """Rounds Decimal using Czech standard ROUND_HALF_UP to 2 decimal places."""
    return val.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def format_dec(val: Any) -> str:
    """Formats Decimal value to string with exactly 2 decimal places."""
    return str(round_dec(to_dec(val)))


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


def map_payment_type(payment_method: Optional[str]) -> str:
    """Map POS payment method to Stormware POHODA paymentType."""
    pm = (payment_method or "cash").strip().lower()
    if "cash" in pm or "hotovost" in pm:
        return "cash"
    if "card" in pm or "karta" in pm:
        return "card"
    if "qr" in pm or "bank" in pm:
        return "bank"
    if "split" in pm:
        return "split"
    return "cash"


def map_vat_rate(vat: Any) -> str:
    """Map VAT percentage to POHODA vatRate enum ('high', 'low', 'none')."""
    try:
        vat_num = int(vat)
    except (ValueError, TypeError):
        return "high"
    if vat_num >= 21:
        return "high"
    if vat_num > 0:
        return "low"
    return "none"


def generate_pohoda_xml(records: List[Dict[str, Any]]) -> str:
    """
    Generates Stormware POHODA 2.0 XML dataPack string from snapshot sales records.
    Conforms to Stormware POHODA 2.0 dataPack schema.
    """
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<dat:dataPack',
        '    xmlns:dat="http://www.stormware.cz/schema/version_2/data.xsd"',
        '    xmlns:inv="http://www.stormware.cz/schema/version_2/invoice.xsd"',
        '    xmlns:typ="http://www.stormware.cz/schema/version_2/type.xsd"',
        '    id="EXPORT_pohoda"',
        '    ico="00000000"',
        '    application="VoltFlow POS"',
        '    version="2.0"',
        '    note="Export z VoltFlow POS">',
    ]

    for r in records:
        r_id = r.get("id", "")
        receipt_num = r.get("receipt_number", "")
        r_date = r.get("date") or (r.get("timestamp")[:10] if r.get("timestamp") else "2026-01-01")
        is_ref = r.get("is_refund", False)
        doc_text = f"Storno {receipt_num}" if is_ref else f"Prodejka {receipt_num}"
        pohoda_payment = map_payment_type(r.get("payment_method"))

        lines.append(f'  <dat:dataPackItem id="{xml_escape(r_id)}" version="2.0">')
        lines.append('    <inv:invoice version="2.0">')
        lines.append('      <inv:invoiceHeader>')
        lines.append('        <inv:invoiceType>issuedInvoice</inv:invoiceType>')
        lines.append('        <inv:number>')
        lines.append(f'          <typ:numberRequested>{xml_escape(receipt_num)}</typ:numberRequested>')
        lines.append('        </inv:number>')
        lines.append(f'        <inv:date>{r_date}</inv:date>')
        lines.append(f'        <inv:dateTax>{r_date}</inv:dateTax>')
        lines.append(f'        <inv:text>{xml_escape(doc_text)}</inv:text>')
        lines.append('        <inv:paymentType>')
        lines.append(f'          <typ:paymentType>{xml_escape(pohoda_payment)}</typ:paymentType>')
        lines.append('        </inv:paymentType>')
        lines.append(f'        <inv:priceHigh>{r.get("price_high", "0.00")}</inv:priceHigh>')
        lines.append(f'        <inv:priceHighVAT>{r.get("price_high_vat", "0.00")}</inv:priceHighVAT>')
        lines.append(f'        <inv:priceLow>{r.get("price_low", "0.00")}</inv:priceLow>')
        lines.append(f'        <inv:priceLowVAT>{r.get("price_low_vat", "0.00")}</inv:priceLowVAT>')
        lines.append(f'        <inv:priceNone>{r.get("price_none", "0.00")}</inv:priceNone>')
        lines.append(f'        <inv:priceTotal>{r.get("price_total", r.get("total_amount", "0.00"))}</inv:priceTotal>')
        lines.append('      </inv:invoiceHeader>')

        items = r.get("items", [])
        if items:
            lines.append('      <inv:invoiceDetail>')
            for item in items:
                item_name = item.get("name", "Položka")
                item_qty = item.get("quantity", 1.0)
                item_price = item.get("price", "0.00")
                item_vat = item.get("vat", 21)
                vat_str = map_vat_rate(item_vat)

                try:
                    qty_f = float(item_qty or 1.0)
                except (ValueError, TypeError):
                    qty_f = 1.0

                lines.append('        <inv:invoiceItem>')
                lines.append(f'          <inv:text>{xml_escape(item_name)}</inv:text>')
                lines.append(f'          <inv:quantity>{qty_f:g}</inv:quantity>')
                lines.append(f'          <inv:unitPrice>{to_dec(item_price):.2f}</inv:unitPrice>')
                lines.append(f'          <inv:vatRate>{vat_str}</inv:vatRate>')
                lines.append('        </inv:invoiceItem>')
            lines.append('      </inv:invoiceDetail>')

        lines.append('    </inv:invoice>')
        lines.append('  </dat:dataPackItem>')

    lines.append('</dat:dataPack>')
    return "\n".join(lines)


router = APIRouter(
    prefix="/api/v1/exports",
    tags=["Exports"]
)


@router.get("/dph")
def get_dph(
    start_date: Optional[str] = Query(None, description="Start date filter (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date filter (YYYY-MM-DD)"),
):
    """
    Czech VAT return summary (DPH Přehled).
    Returns base and tax amounts for 21%, 12%, 0% tiers, plus total_tax.
    """
    dph_data = snapshot_service.get_dph_summary(start_date=start_date, end_date=end_date)
    return {
        "base_21": dph_data.get("base_21", "0.00"),
        "tax_21": dph_data.get("tax_21", "0.00"),
        "base_12": dph_data.get("base_12", "0.00"),
        "tax_12": dph_data.get("tax_12", "0.00"),
        "base_0": dph_data.get("base_0", "0.00"),
        "tax_0": dph_data.get("tax_0", "0.00"),
        "total_tax": dph_data.get("total_tax", "0.00"),
        "total_base": dph_data.get("total_base", "0.00"),
        "total_gross": dph_data.get("total_gross", "0.00"),
    }


@router.get("/dpfo")
def get_dpfo(
    start_date: Optional[str] = Query(None, description="Start date filter (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date filter (YYYY-MM-DD)"),
):
    """
    Calculates § 7b tax overview (Příloha č. 1 DPFO - Daňová evidence).
    - total_income: gross sales minus refunds (taxable income)
    - expenses / purchase_cost: tax deductible purchase costs of goods and cash operating expenses
    - tax_base: total_income - expenses
    """
    default_dpfo = {
        "total_income": "0.00",
        "gross_sales": "0.00",
        "income": "0.00",
        "total_refunds": "0.00",
        "purchase_cost": "0.00",
        "operating_expenses": "0.00",
        "expenses": "0.00",
        "deductible_expenses": "0.00",
        "tax_base": "0.00",
        "base": "0.00",
    }

    if not snapshot_service.is_available():
        return default_dpfo

    try:
        with snapshot_service.get_connection() as conn:
            if not snapshot_service._table_exists(conn, "sales"):
                return default_dpfo

            cursor = conn.cursor()
            where_clauses = []
            params: List[Any] = []
            if start_date:
                where_clauses.append("timestamp >= ?")
                params.append(start_date)
            if end_date:
                where_clauses.append("timestamp <= ?")
                params.append(end_date)

            where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

            # 1. Total Income (Gross sales minus refunds)
            cursor.execute(
                f"""
                SELECT id, total_amount, is_refund, refunded_amount
                FROM sales
                {where_sql}
                """,
                tuple(params),
            )
            sales = cursor.fetchall()

            gross_sales = Decimal("0.00")
            total_refunds = Decimal("0.00")
            non_refund_sale_ids = []

            for s in sales:
                tot = to_dec(s["total_amount"])
                ref = to_dec(s["refunded_amount"])
                is_ref = bool(s["is_refund"])

                if is_ref:
                    total_refunds += abs(tot)
                else:
                    gross_sales += tot
                    total_refunds += abs(ref)
                    non_refund_sale_ids.append(s["id"])

            total_income = max(Decimal("0.00"), gross_sales - total_refunds)

            # 2. Tax Deductible Purchase Cost / Goods Expenses
            goods_expense = Decimal("0.00")
            has_stock_movements = snapshot_service._table_exists(conn, "stock_movements")
            stock_movement_receipts_found = False

            if has_stock_movements:
                sm_where = ["movement_type = 'RECEIPT'"]
                sm_params: List[Any] = []
                if start_date:
                    sm_where.append("timestamp >= ?")
                    sm_params.append(start_date)
                if end_date:
                    sm_where.append("timestamp <= ?")
                    sm_params.append(end_date)

                cursor.execute(
                    f"""
                    SELECT quantity_delta, unit_cost
                    FROM stock_movements
                    WHERE {' AND '.join(sm_where)}
                    """,
                    tuple(sm_params),
                )
                sm_rows = cursor.fetchall()
                if sm_rows:
                    stock_movement_receipts_found = True
                    for sm in sm_rows:
                        q = to_dec(sm["quantity_delta"])
                        uc = to_dec(sm["unit_cost"])
                        goods_expense += round_dec(q * uc)

            # If no stock_movements receipts were recorded, compute purchase cost from sold items (COGS)
            if not stock_movement_receipts_found:
                presets_cost: Dict[str, Decimal] = {}
                presets_name_cost: Dict[str, Decimal] = {}
                if snapshot_service._table_exists(conn, "presets"):
                    cursor.execute("SELECT id, name, cost_price FROM presets")
                    for p in cursor.fetchall():
                        cp = to_dec(p["cost_price"])
                        presets_cost[p["id"]] = cp
                        presets_name_cost[p["name"]] = cp

                if snapshot_service._table_exists(conn, "sale_items") and non_refund_sale_ids:
                    for i in range(0, len(non_refund_sale_ids), 500):
                        chunk = non_refund_sale_ids[i : i + 500]
                        ph = ",".join("?" * len(chunk))
                        cursor.execute(
                            f"SELECT sale_id, item_id, name, quantity FROM sale_items WHERE sale_id IN ({ph})",
                            tuple(chunk),
                        )
                        for it in cursor.fetchall():
                            it_qty = to_dec(it["quantity"])
                            cp = presets_cost.get(it["item_id"]) or presets_name_cost.get(it["name"]) or Decimal("0.00")
                            goods_expense += round_dec(it_qty * cp)

            # 3. Cash Operating Expenses (PAYOUT from cash_movements)
            operating_expenses = Decimal("0.00")
            if snapshot_service._table_exists(conn, "cash_movements"):
                cursor.execute("PRAGMA table_info(cash_movements)")
                cols = [col["name"] for col in cursor.fetchall()]
                ts_col = "created_at" if "created_at" in cols else "timestamp"

                cm_where = ["movement_type = 'PAYOUT'"]
                cm_params: List[Any] = []
                if start_date and ts_col in cols:
                    cm_where.append(f"{ts_col} >= ?")
                    cm_params.append(start_date)
                if end_date and ts_col in cols:
                    cm_where.append(f"{ts_col} <= ?")
                    cm_params.append(end_date)

                cursor.execute(
                    f"SELECT amount FROM cash_movements WHERE {' AND '.join(cm_where)}",
                    tuple(cm_params),
                )
                for cm in cursor.fetchall():
                    operating_expenses += to_dec(cm["amount"])

            total_expenses = round_dec(goods_expense + operating_expenses)
            tax_base = round_dec(total_income - total_expenses)

            return {
                "total_income": format_dec(total_income),
                "gross_sales": format_dec(gross_sales),
                "income": format_dec(total_income),
                "total_refunds": format_dec(total_refunds),
                "purchase_cost": format_dec(goods_expense),
                "operating_expenses": format_dec(operating_expenses),
                "expenses": format_dec(total_expenses),
                "deductible_expenses": format_dec(total_expenses),
                "tax_base": format_dec(tax_base),
                "base": format_dec(tax_base),
            }
    except Exception as e:
        logger.error(f"Error calculating DPFO overview: {e}")
        return default_dpfo


@router.get("/pohoda")
def get_pohoda(
    start_date: Optional[str] = Query(None, description="Start date filter (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date filter (YYYY-MM-DD)"),
):
    """
    Stormware POHODA 2.0 XML Export.
    """
    records = snapshot_service.get_pohoda_records(start_date=start_date, end_date=end_date)
    xml_str = generate_pohoda_xml(records)
    return Response(
        content=xml_str,
        media_type="application/xml",
        headers={"Content-Disposition": 'attachment; filename="pohoda_export.xml"'},
    )


@router.get("/csv")
def get_csv(
    start_date: Optional[str] = Query(None, description="Start date filter (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date filter (YYYY-MM-DD)"),
):
    """
    CSV format export of sales transactions with receipt_number, timestamp, payment_method, total_amount, tax.
    """
    records = snapshot_service.get_pohoda_records(start_date=start_date, end_date=end_date)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["receipt_number", "timestamp", "payment_method", "total_amount", "tax"])

    for r in records:
        price_high_vat = to_dec(r.get("price_high_vat", 0.0))
        price_low_vat = to_dec(r.get("price_low_vat", 0.0))
        tot_tax = round_dec(price_high_vat + price_low_vat)

        writer.writerow([
            r.get("receipt_number", ""),
            r.get("timestamp", ""),
            r.get("payment_method", ""),
            r.get("total_amount", "0.00"),
            format_dec(tot_tax),
        ])

    csv_str = output.getvalue()
    return Response(
        content=csv_str,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="sales_export.csv"'},
    )
