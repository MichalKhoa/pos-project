import logging
from datetime import datetime, date
from typing import Optional, Dict, Any, List
from decimal import Decimal, ROUND_HALF_UP

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import extract, func, and_

from database import get_db
from models import SaleModel, StockMovementModel, CashMovementModel, PresetModel, StoreConfigModel

logger = logging.getLogger("pos-reports")

router = APIRouter(prefix="/api/v1/reports", tags=["Financial & Tax Reports"])


def _round_czk(value: float) -> float:
    """Rounds monetary value to 2 decimal places using standard accounting half-up."""
    return float(Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


class TaxStatementVatTier(BaseModel):
    vat_rate: int
    base: float
    vat: float
    total: float


class TaxStatementStockValuation(BaseModel):
    start_of_year: float   # Stav zásob k 1.1.
    end_of_year: float     # Stav zásob k 31.12.
    stock_delta: float     # Změna stavu zásob


class TaxStatementResponse(BaseModel):
    year: int
    taxable_revenue: float       # Celkové zdanitelné tržby (§ 7b ZDP)
    gross_sales: float           # Hrubé tržby před vratkami
    total_refunds: float         # Vyplacené vratky / storna
    sales_count: int             # Počet uskutečněných prodejů
    goods_expense: float         # Nákup zásob / zboží z příjemek
    operating_expense: float     # Provozní režie z pokladních výběrů (PAYOUT)
    total_expenses: float        # Celkové daňové výdaje
    tax_base_estimate: float     # Odhad daňového základu (Příjmy - Výdaje)
    stock_valuation: TaxStatementStockValuation
    vat_summary: List[TaxStatementVatTier]
    payment_methods: Dict[str, float]
    generated_at: str


class VatOverviewPeriod(BaseModel):
    year: int
    month: Optional[int] = None
    quarter: Optional[int] = None
    period_label: str


class VatOverviewTier(BaseModel):
    rate: int
    output_base: float
    output_vat: float
    input_base: float
    input_vat: float


class VatOverviewResponse(BaseModel):
    period: VatOverviewPeriod
    tiers: List[VatOverviewTier]
    total_output_base: float
    total_output_vat: float
    total_input_base: float
    total_input_vat: float
    net_vat_liability: float     # output_vat - input_vat (kladné = daňová povinnost, záporné = nadměrný odpočet)
    generated_at: str


@router.get("/tax-statement", response_model=TaxStatementResponse)
def get_tax_statement(
    year: Optional[int] = Query(default=None, description="Tax year (defaults to current year)"),
    db: Session = Depends(get_db)
):
    """
    Generates tax report preparation for Czech Income Tax Return (DPFO Příloha č. 1 - § 7b ZDP).
    Calculates:
    - Net taxable revenue (gross sales - refunds)
    - Deductible expenses: goods intake (Stock Receipts) + cash operating expenses (Payouts)
    - Opening and closing inventory valuation (Stav zásob k 1.1. a k 31.12.)
    - VAT breakdown and payment method distribution
    """
    current_year = datetime.now().year
    target_year = year if year and 2000 <= year <= 2100 else current_year

    # 1. Sales & Revenue Calculation
    sales_query = db.query(SaleModel).filter(extract("year", SaleModel.timestamp) == target_year)
    all_sales = sales_query.all()

    gross_sales_dec = Decimal("0.00")
    total_refunds_dec = Decimal("0.00")
    sales_count = 0
    pm_sums: Dict[str, Decimal] = {"cash": Decimal("0.00"), "card": Decimal("0.00"), "qr": Decimal("0.00"), "split": Decimal("0.00")}

    vat_aggregated: Dict[int, Dict[str, Decimal]] = {
        21: {"base": Decimal("0.00"), "vat": Decimal("0.00")},
        12: {"base": Decimal("0.00"), "vat": Decimal("0.00")},
        0: {"base": Decimal("0.00"), "vat": Decimal("0.00")},
    }

    for s in all_sales:
        amt = Decimal(str(s.total_amount or 0.0))
        ref_amt = Decimal(str(s.refunded_amount or 0.0))
        pm = (s.payment_method or "cash").lower()

        if s.is_refund:
            total_refunds_dec += abs(amt)
        else:
            gross_sales_dec += amt
            total_refunds_dec += ref_amt
            sales_count += 1
            if pm in pm_sums:
                pm_sums[pm] += amt
            else:
                pm_sums[pm] = amt

        # VAT Breakdown from tax_summary
        tax_sum = s.tax_summary or {}
        if isinstance(tax_sum, dict):
            for rate_key, values in tax_sum.items():
                try:
                    rate_int = int(rate_key)
                    if rate_int not in vat_aggregated:
                        vat_aggregated[rate_int] = {"base": Decimal("0.00"), "vat": Decimal("0.00")}
                    if isinstance(values, dict):
                        b_val = values.get("base") if values.get("base") is not None else values.get("net", 0.0)
                        v_val = values.get("vat") if values.get("vat") is not None else values.get("tax", 0.0)
                        b = Decimal(str(b_val))
                        v = Decimal(str(v_val))
                        if s.is_refund:
                            vat_aggregated[rate_int]["base"] -= abs(b)
                            vat_aggregated[rate_int]["vat"] -= abs(v)
                        else:
                            vat_aggregated[rate_int]["base"] += b
                            vat_aggregated[rate_int]["vat"] += v
                except Exception:
                    pass

    taxable_revenue_dec = max(Decimal("0.00"), gross_sales_dec - total_refunds_dec)

    # 2. Deductible Expenses: Goods Receipts (§ 7b ZDP)
    receipt_movements = db.query(StockMovementModel).filter(
        and_(
            StockMovementModel.movement_type == "RECEIPT",
            extract("year", StockMovementModel.timestamp) == target_year
        )
    ).all()

    goods_expense_dec = Decimal("0.00")
    for rm in receipt_movements:
        q = Decimal(str(rm.quantity_delta or 0.0))
        uc = Decimal(str(rm.unit_cost or 0.0))
        goods_expense_dec += (q * uc)

    # 3. Deductible Expenses: Cash Operating Payouts
    payout_movements = db.query(CashMovementModel).filter(
        and_(
            CashMovementModel.movement_type == "PAYOUT",
            extract("year", CashMovementModel.created_at) == target_year
        )
    ).all()

    operating_expense_dec = Decimal("0.00")
    for cm in payout_movements:
        operating_expense_dec += Decimal(str(cm.amount or 0.0))

    total_expenses_dec = goods_expense_dec + operating_expense_dec
    tax_base_dec = taxable_revenue_dec - total_expenses_dec

    # 4. Inventory Valuation: Beginning (1.1.) vs Ending (31.12.)
    presets = db.query(PresetModel).all()
    end_stock_dec = Decimal("0.00")
    start_stock_dec = Decimal("0.00")

    year_deltas: Dict[str, Decimal] = {}
    movements_in_year = db.query(StockMovementModel).filter(
        extract("year", StockMovementModel.timestamp) == target_year
    ).all()
    for m in movements_in_year:
        pid = m.preset_id
        qd = Decimal(str(m.quantity_delta or 0.0))
        year_deltas[pid] = year_deltas.get(pid, Decimal("0.00")) + qd

    for p in presets:
        cp = Decimal(str(p.cost_price or 0.0))
        curr_q = Decimal(str(p.stock_quantity or 0.0))
        end_stock_dec += (curr_q * cp)

        net_delta = year_deltas.get(p.id, Decimal("0.00"))
        start_q = max(Decimal("0.00"), curr_q - net_delta)
        start_stock_dec += (start_q * cp)

    vat_list = []
    for rate, vals in sorted(vat_aggregated.items(), reverse=True):
        b = float(vals["base"].quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
        v = float(vals["vat"].quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
        tot = _round_czk(b + v)
        vat_list.append(TaxStatementVatTier(vat_rate=rate, base=b, vat=v, total=tot))

    pm_dict = {k: float(v.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)) for k, v in pm_sums.items()}

    return TaxStatementResponse(
        year=target_year,
        taxable_revenue=float(taxable_revenue_dec.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
        gross_sales=float(gross_sales_dec.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
        total_refunds=float(total_refunds_dec.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
        sales_count=sales_count,
        goods_expense=float(goods_expense_dec.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
        operating_expense=float(operating_expense_dec.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
        total_expenses=float(total_expenses_dec.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
        tax_base_estimate=float(tax_base_dec.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
        stock_valuation=TaxStatementStockValuation(
            start_of_year=float(start_stock_dec.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            end_of_year=float(end_stock_dec.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            stock_delta=float((end_stock_dec - start_stock_dec).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
        ),
        vat_summary=vat_list,
        payment_methods=pm_dict,
        generated_at=datetime.now().isoformat()
    )


@router.get("/vat-overview", response_model=VatOverviewResponse)
def get_vat_overview(
    year: int = Query(..., description="Calendar year"),
    month: Optional[int] = Query(None, ge=1, le=12, description="Month (1-12) for monthly VAT filers"),
    quarter: Optional[int] = Query(None, ge=1, le=4, description="Quarter (1-4) for quarterly VAT filers"),
    db: Session = Depends(get_db)
):
    """
    Generates Monthly / Quarterly VAT Overview (§ 7b ZDP / Czech VAT Return structure).
    Calculates:
    - Output tax (Daň na výstupu) from completed sales minus refunds broken down into 21%, 12%, 0%
    - Input tax deduction estimate (Odpočet daně na vstupu) from stock intake receipts
    - Net VAT liability (Daňová povinnost / Nadměrný odpočet)
    """
    filters = [extract("year", SaleModel.timestamp) == year]
    intake_filters = [
        StockMovementModel.movement_type == "RECEIPT",
        extract("year", StockMovementModel.timestamp) == year
    ]

    period_label = f"Rok {year}"
    if month:
        filters.append(extract("month", SaleModel.timestamp) == month)
        intake_filters.append(extract("month", StockMovementModel.timestamp) == month)
        period_label = f"{month:02d}/{year}"
    elif quarter:
        quarter_months = {1: [1, 2, 3], 2: [4, 5, 6], 3: [7, 8, 9], 4: [10, 11, 12]}[quarter]
        filters.append(extract("month", SaleModel.timestamp).in_(quarter_months))
        intake_filters.append(extract("month", StockMovementModel.timestamp).in_(quarter_months))
        period_label = f"Q{quarter}/{year}"

    # 1. Output VAT from Sales
    sales = db.query(SaleModel).filter(and_(*filters)).all()
    output_vat: Dict[int, Dict[str, Decimal]] = {
        21: {"base": Decimal("0.00"), "vat": Decimal("0.00")},
        12: {"base": Decimal("0.00"), "vat": Decimal("0.00")},
        0: {"base": Decimal("0.00"), "vat": Decimal("0.00")},
    }

    for s in sales:
        tax_sum = s.tax_summary or {}
        if isinstance(tax_sum, dict):
            for r_key, val in tax_sum.items():
                try:
                    rate = int(r_key)
                    if rate not in output_vat:
                        output_vat[rate] = {"base": Decimal("0.00"), "vat": Decimal("0.00")}
                    if isinstance(val, dict):
                        b_val = val.get("base") if val.get("base") is not None else val.get("net", 0.0)
                        v_val = val.get("vat") if val.get("vat") is not None else val.get("tax", 0.0)
                        b = Decimal(str(b_val))
                        v = Decimal(str(v_val))
                        if s.is_refund:
                            output_vat[rate]["base"] -= abs(b)
                            output_vat[rate]["vat"] -= abs(v)
                        else:
                            output_vat[rate]["base"] += b
                            output_vat[rate]["vat"] += v
                except Exception:
                    pass

    # 2. Input VAT from Stock Intake Receipts
    intakes = db.query(StockMovementModel).filter(and_(*intake_filters)).all()
    presets_map = {p.id: p for p in db.query(PresetModel).all()}

    input_vat: Dict[int, Dict[str, Decimal]] = {
        21: {"base": Decimal("0.00"), "vat": Decimal("0.00")},
        12: {"base": Decimal("0.00"), "vat": Decimal("0.00")},
        0: {"base": Decimal("0.00"), "vat": Decimal("0.00")},
    }

    for im in intakes:
        preset = presets_map.get(im.preset_id)
        vat_rate = preset.vat if preset and preset.vat in (21, 12, 0) else 21
        q = Decimal(str(im.quantity_delta or 0.0))
        uc = Decimal(str(im.unit_cost or 0.0))
        base_amt = q * uc
        vat_amt = (base_amt * Decimal(str(vat_rate)) / Decimal("100.00")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        input_vat[vat_rate]["base"] += base_amt
        input_vat[vat_rate]["vat"] += vat_amt

    tiers = []
    tot_out_base = Decimal("0.00")
    tot_out_vat = Decimal("0.00")
    tot_in_base = Decimal("0.00")
    tot_in_vat = Decimal("0.00")

    for rate in [21, 12, 0]:
        ob = max(Decimal("0.00"), output_vat[rate]["base"])
        ov = max(Decimal("0.00"), output_vat[rate]["vat"])
        ib = max(Decimal("0.00"), input_vat[rate]["base"])
        iv = max(Decimal("0.00"), input_vat[rate]["vat"])

        tot_out_base += ob
        tot_out_vat += ov
        tot_in_base += ib
        tot_in_vat += iv

        tiers.append(VatOverviewTier(
            rate=rate,
            output_base=float(ob.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            output_vat=float(ov.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            input_base=float(ib.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            input_vat=float(iv.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
        ))

    net_liability = tot_out_vat - tot_in_vat

    return VatOverviewResponse(
        period=VatOverviewPeriod(
            year=year,
            month=month,
            quarter=quarter,
            period_label=period_label
        ),
        tiers=tiers,
        total_output_base=float(tot_out_base.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
        total_output_vat=float(tot_out_vat.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
        total_input_base=float(tot_in_base.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
        total_input_vat=float(tot_in_vat.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
        net_vat_liability=float(net_liability.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
        generated_at=datetime.now().isoformat()
    )


@router.get("/tax-statement/html")
def get_tax_statement_html(year: Optional[int] = None, db: Session = Depends(get_db)):
    """Generate printable Czech A4 DPFO Příloha č. 1 Tax Statement HTML."""
    from fastapi.responses import HTMLResponse
    target_year = year or datetime.now().year
    stmt = get_tax_statement(year=target_year, db=db)

    config = db.query(StoreConfigModel).first()
    store_name = config.store_name if config else "VoltFlow Store s.r.o."
    store_ico = config.ico if config else ""
    store_dic = config.dic if config else ""
    store_street = config.street if config else ""
    store_city = config.city if config else ""

    date_now = datetime.now().strftime("%d.%m.%Y")
    time_now = datetime.now().strftime("%H:%M")

    vat_rows = ""
    for vt in (stmt.vat_summary or []):
        vat_rows += f"""
        <tr>
            <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; font-weight: 600;">Sazba {vt.vat_rate}%</td>
            <td style="padding: 6px 10px; text-align: right; border-bottom: 1px solid #e2e8f0;">{vt.base:,.2f} Kč</td>
            <td style="padding: 6px 10px; text-align: right; border-bottom: 1px solid #e2e8f0; color: #2563eb;">{vt.vat:,.2f} Kč</td>
            <td style="padding: 6px 10px; text-align: right; border-bottom: 1px solid #e2e8f0; font-weight: 700;">{vt.total:,.2f} Kč</td>
        </tr>
        """

    pm_rows = ""
    for pm_name, pm_val in stmt.payment_methods.items():
        label = "Hotovost" if pm_name == "cash" else ("Platební karty" if pm_name == "card" else pm_name.upper())
        pm_rows += f"""
        <tr>
            <td style="padding: 5px 10px; border-bottom: 1px solid #e2e8f0;">{label}</td>
            <td style="padding: 5px 10px; text-align: right; border-bottom: 1px solid #e2e8f0; font-weight: 600;">{pm_val:,.2f} Kč</td>
        </tr>
        """

    stock_diff_color = "#16a34a" if stmt.stock_valuation.stock_delta >= 0 else "#dc2626"
    stock_diff_sign = "+" if stmt.stock_valuation.stock_delta >= 0 else ""

    html = f"""<!DOCTYPE html>
<html lang="cs">
<head>
    <meta charset="utf-8">
    <title>Příloha č. 1 DPFO {target_year} - {store_name}</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #1e293b; margin: 0; padding: 40px; background: #f8fafc; }}
        @media print {{
            body {{ padding: 0; background: #fff; }}
            .no-print {{ display: none !important; }}
            .page-container {{ box-shadow: none !important; border: none !important; padding: 0 !important; }}
        }}
        .page-container {{ max-width: 820px; margin: 0 auto; background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 36px; box-shadow: 0 4px 12px rgba(0,0,0,0.06); }}
        .header {{ border-bottom: 3px double #0284c7; padding-bottom: 16px; margin-bottom: 24px; }}
        .header h1 {{ font-size: 20px; font-weight: 800; color: #0369a1; margin: 0 0 6px 0; text-transform: uppercase; letter-spacing: 0.5px; }}
        .header .subtitle {{ font-size: 13px; color: #64748b; font-weight: 600; }}
        .grid-2 {{ display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 22px; }}
        .card {{ background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px 18px; }}
        .card-title {{ font-size: 11px; text-transform: uppercase; font-weight: 800; color: #64748b; letter-spacing: 0.5px; margin-bottom: 6px; }}
        .section-title {{ font-size: 14px; font-weight: 800; color: #0f172a; margin: 20px 0 10px 0; border-left: 4px solid #0284c7; padding-left: 8px; text-transform: uppercase; }}
        table {{ width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 14px; }}
        table th {{ background: #f1f5f9; padding: 8px 10px; text-align: left; font-weight: 700; color: #475569; border-bottom: 2px solid #cbd5e1; }}
        .highlight-row {{ background: #f0fdf4; font-weight: 800; font-size: 14px; }}
        .highlight-row td {{ padding: 10px; border-top: 2px solid #86efac; border-bottom: 2px solid #86efac; }}
        .btn-print {{ background: #0284c7; color: #fff; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 700; margin-bottom: 20px; display: inline-flex; align-items: center; gap: 8px; }}
        .btn-print:hover {{ background: #0369a1; }}
        .signature-block {{ margin-top: 36px; padding-top: 20px; border-top: 1px dashed #cbd5e1; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; font-size: 12px; color: #475569; }}
    </style>
</head>
<body>
    <div class="no-print" style="max-width: 820px; margin: 0 auto 15px auto; display: flex; justify-content: space-between; align-items: center;">
        <button class="btn-print" onclick="window.print()">🖨️ Vytisknout výkaz (A4) / Uložit PDF</button>
        <div style="font-size: 13px; color: #64748b;">VoltFlow POS • Daňová evidence dle § 7b ZDP</div>
    </div>
    <div class="page-container">
        <div class="header">
            <h1>Přehled o příjmech a výdajích ze samostatné činnosti</h1>
            <div class="subtitle">Příloha č. 1 k přiznání k dani z příjmů fyzických osob (DPFO) dle § 7b zákona č. 586/1992 Sb. za rok {target_year}</div>
        </div>
        <div class="grid-2">
            <div class="card">
                <div class="card-title">Poplatník (Daňový subjekt)</div>
                <div style="font-size: 15px; font-weight: 800; color: #0f172a; margin-bottom: 4px;">{store_name}</div>
                <div style="font-size: 13px; color: #334155; line-height: 1.4;">
                    {store_street}, {store_city}<br>
                    <strong>IČO:</strong> {store_ico} &nbsp;|&nbsp; <strong>DIČ:</strong> {store_dic}
                </div>
            </div>
            <div class="card">
                <div class="card-title">Zdaňovací období a systém</div>
                <div style="font-size: 15px; font-weight: 800; color: #0f172a; margin-bottom: 4px;">Rok {target_year} (1. 1. – 31. 12. {target_year})</div>
                <div style="font-size: 13px; color: #334155; line-height: 1.4;">
                    Metoda: Daňová evidence (§ 7b ZDP)<br>
                    Vygenerováno: {date_now} v {time_now}
                </div>
            </div>
        </div>

        <div class="section-title">I. Údaje o příjmech a daňově uznatelných výdajích (§ 7b ZDP)</div>
        <table>
            <thead>
                <tr>
                    <th>Položka</th>
                    <th style="text-align: right; width: 180px;">Částka v Kč</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0;">
                        <strong>Zdanitelné příjmy celkem</strong> (Prodej zboží a služeb po odečtení storen/vratek)<br>
                        <span style="font-size: 11px; color: #64748b;">(Hrubé tržby: {stmt.gross_sales:,.2f} Kč, Vráceno/storna: -{stmt.total_refunds:,.2f} Kč, Počet dokladů: {stmt.sales_count})</span>
                    </td>
                    <td style="padding: 8px 10px; text-align: right; border-bottom: 1px solid #e2e8f0; font-weight: 700; color: #0369a1;">
                        {stmt.taxable_revenue:,.2f} Kč
                    </td>
                </tr>
                <tr>
                    <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0;">
                        <strong>Nákup materiálu a zboží</strong> (Příjemky na sklad od dodavatelů)
                    </td>
                    <td style="padding: 8px 10px; text-align: right; border-bottom: 1px solid #e2e8f0; font-weight: 600;">
                        {stmt.goods_expense:,.2f} Kč
                    </td>
                </tr>
                <tr>
                    <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0;">
                        <strong>Provozní režie a výdaje z pokladny</strong> (Hotovostní výběry / payouts)
                    </td>
                    <td style="padding: 8px 10px; text-align: right; border-bottom: 1px solid #e2e8f0; font-weight: 600;">
                        {stmt.operating_expense:,.2f} Kč
                    </td>
                </tr>
                <tr style="background: #f8fafc; font-weight: 700;">
                    <td style="padding: 8px 10px; border-bottom: 1px solid #cbd5e1;">
                        Daňově uznatelné výdaje celkem (§ 24 ZDP)
                    </td>
                    <td style="padding: 8px 10px; text-align: right; border-bottom: 1px solid #cbd5e1; color: #dc2626;">
                        {stmt.total_expenses:,.2f} Kč
                    </td>
                </tr>
                <tr class="highlight-row">
                    <td>DÍLČÍ ZÁKLAD DANĚ / HOSPODÁŘSKÝ VÝSLEDEK (Příjmy minus výdaje)</td>
                    <td style="text-align: right; font-size: 16px; color: #15803d;">
                        {stmt.tax_base_estimate:,.2f} Kč
                    </td>
                </tr>
            </tbody>
        </table>

        <div class="section-title">II. Tabulka D — Stav zásob a majetku (§ 7b odst. 1 písm. b) ZDP)</div>
        <table>
            <thead>
                <tr>
                    <th>Ukazatel stavu zásob v nákupních cenách</th>
                    <th style="text-align: right; width: 180px;">Ocenění v Kč</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0;">Stav zásob k 1. 1. {target_year} (Počáteční stav)</td>
                    <td style="padding: 8px 10px; text-align: right; border-bottom: 1px solid #e2e8f0; font-weight: 700;">{stmt.stock_valuation.start_of_year:,.2f} Kč</td>
                </tr>
                <tr>
                    <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0;">Stav zásob k 31. 12. {target_year} (Konečný stav z inventury dle § 29 ZoÚ)</td>
                    <td style="padding: 8px 10px; text-align: right; border-bottom: 1px solid #e2e8f0; font-weight: 700;">{stmt.stock_valuation.end_of_year:,.2f} Kč</td>
                </tr>
                <tr style="background: #f8fafc; font-weight: 700;">
                    <td style="padding: 8px 10px; border-bottom: 1px solid #cbd5e1;">Změna stavu zásob (Konečný stav − Počáteční stav)</td>
                    <td style="padding: 8px 10px; text-align: right; border-bottom: 1px solid #cbd5e1; color: {stock_diff_color};">
                        {stock_diff_sign}{stmt.stock_valuation.stock_delta:,.2f} Kč
                    </td>
                </tr>
            </tbody>
        </table>

        <div class="grid-2">
            <div>
                <div class="section-title">III. Rekapitulace DPH z tržeb</div>
                <table>
                    <thead>
                        <tr>
                            <th>Sazba</th>
                            <th style="text-align: right;">Základ</th>
                            <th style="text-align: right;">DPH</th>
                            <th style="text-align: right;">Celkem</th>
                        </tr>
                    </thead>
                    <tbody>
                        {vat_rows}
                    </tbody>
                </table>
            </div>
            <div>
                <div class="section-title">IV. Struktura platebních metod</div>
                <table>
                    <thead>
                        <tr>
                            <th>Platební metoda</th>
                            <th style="text-align: right;">Objem tržeb</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pm_rows}
                    </tbody>
                </table>
            </div>
        </div>

        <div class="signature-block">
            <div>
                <strong>Prohlášení poplatníka:</strong><br>
                Údaje v tomto přehledu odpovídají skutečnosti a byly sestaveny na základě řádně vedené daňové evidence a pokladních knih systému VoltFlow POS.
            </div>
            <div style="text-align: right;">
                V ................................... dne {date_now}<br><br><br>
                .......................................................<br>
                Podpis poplatníka / statutárního zástupce
            </div>
        </div>
    </div>
</body>
</html>
"""
    return HTMLResponse(content=html, status_code=200)


@router.get("/vat-overview/html")
def get_vat_overview_html(
    year: Optional[int] = None,
    period: Optional[str] = "FULL_YEAR",
    month: Optional[int] = None,
    quarter: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Generate printable Czech A4 VAT Overview (Přehled DPH) HTML."""
    from fastapi.responses import HTMLResponse
    target_year = year or datetime.now().year
    vat_data = get_vat_overview(year=target_year, month=month, quarter=quarter, db=db)

    config = db.query(StoreConfigModel).first()
    store_name = config.store_name if config else "VoltFlow Store s.r.o."
    store_ico = config.ico if config else ""
    store_dic = config.dic if config else ""
    store_street = config.street if config else ""
    store_city = config.city if config else ""

    date_now = datetime.now().strftime("%d.%m.%Y")
    time_now = datetime.now().strftime("%H:%M")

    out_rows = ""
    in_rows = ""
    for tier in vat_data.tiers:
        out_rows += f"""
        <tr>
            <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-weight: 600;">Sazba {tier.rate}%</td>
            <td style="padding: 8px 10px; text-align: right; border-bottom: 1px solid #e2e8f0;">{tier.output_base:,.2f} Kč</td>
            <td style="padding: 8px 10px; text-align: right; border-bottom: 1px solid #e2e8f0; color: #2563eb; font-weight: 700;">{tier.output_vat:,.2f} Kč</td>
            <td style="padding: 8px 10px; text-align: right; border-bottom: 1px solid #e2e8f0; font-weight: 700;">{(tier.output_base + tier.output_vat):,.2f} Kč</td>
        </tr>
        """
        in_rows += f"""
        <tr>
            <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-weight: 600;">Sazba {tier.rate}%</td>
            <td style="padding: 8px 10px; text-align: right; border-bottom: 1px solid #e2e8f0;">{tier.input_base:,.2f} Kč</td>
            <td style="padding: 8px 10px; text-align: right; border-bottom: 1px solid #e2e8f0; color: #16a34a; font-weight: 700;">{tier.input_vat:,.2f} Kč</td>
            <td style="padding: 8px 10px; text-align: right; border-bottom: 1px solid #e2e8f0; font-weight: 700;">{(tier.input_base + tier.input_vat):,.2f} Kč</td>
        </tr>
        """

    liability_color = "#dc2626" if vat_data.net_vat_liability >= 0 else "#16a34a"
    liability_text = "Vlastní daňová povinnost (k úhradě FÚ)" if vat_data.net_vat_liability >= 0 else "Nadměrný odpočet (nárok na vrácení)"

    html = f"""<!DOCTYPE html>
<html lang="cs">
<head>
    <meta charset="utf-8">
    <title>Přehled DPH {vat_data.period.period_label} - {store_name}</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #1e293b; margin: 0; padding: 40px; background: #f8fafc; }}
        @media print {{
            body {{ padding: 0; background: #fff; }}
            .no-print {{ display: none !important; }}
            .page-container {{ box-shadow: none !important; border: none !important; padding: 0 !important; }}
        }}
        .page-container {{ max-width: 820px; margin: 0 auto; background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 36px; box-shadow: 0 4px 12px rgba(0,0,0,0.06); }}
        .header {{ border-bottom: 3px double #2563eb; padding-bottom: 16px; margin-bottom: 24px; }}
        .header h1 {{ font-size: 20px; font-weight: 800; color: #1e40af; margin: 0 0 6px 0; text-transform: uppercase; }}
        .header .subtitle {{ font-size: 13px; color: #64748b; font-weight: 600; }}
        .grid-2 {{ display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 22px; }}
        .card {{ background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px 18px; }}
        .card-title {{ font-size: 11px; text-transform: uppercase; font-weight: 800; color: #64748b; letter-spacing: 0.5px; margin-bottom: 6px; }}
        .section-title {{ font-size: 14px; font-weight: 800; color: #0f172a; margin: 20px 0 10px 0; border-left: 4px solid #2563eb; padding-left: 8px; text-transform: uppercase; }}
        table {{ width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 14px; }}
        table th {{ background: #f1f5f9; padding: 8px 10px; text-align: left; font-weight: 700; color: #475569; border-bottom: 2px solid #cbd5e1; }}
        .highlight-card {{ background: #eff6ff; border: 2px solid #93c5fd; border-radius: 8px; padding: 18px 24px; display: flex; justify-content: space-between; align-items: center; margin-top: 24px; }}
        .btn-print {{ background: #2563eb; color: #fff; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 700; margin-bottom: 20px; display: inline-flex; align-items: center; gap: 8px; }}
        .btn-print:hover {{ background: #1d4ed8; }}
        .signature-block {{ margin-top: 36px; padding-top: 20px; border-top: 1px dashed #cbd5e1; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; font-size: 12px; color: #475569; }}
    </style>
</head>
<body>
    <div class="no-print" style="max-width: 820px; margin: 0 auto 15px auto; display: flex; justify-content: space-between; align-items: center;">
        <button class="btn-print" onclick="window.print()">🖨️ Vytisknout výkaz (A4) / Uložit PDF</button>
        <div style="font-size: 13px; color: #64748b;">VoltFlow POS • Daň z přidané hodnoty (§ 235/2004 Sb.)</div>
    </div>
    <div class="page-container">
        <div class="header">
            <h1>Přehled k dani z přidané hodnoty (DPH)</h1>
            <div class="subtitle">Podklad pro daňové přiznání k DPH a kontrolní hlášení • Období: {vat_data.period.period_label}</div>
        </div>
        <div class="grid-2">
            <div class="card">
                <div class="card-title">Plátce daně</div>
                <div style="font-size: 15px; font-weight: 800; color: #0f172a; margin-bottom: 4px;">{store_name}</div>
                <div style="font-size: 13px; color: #334155; line-height: 1.4;">
                    {store_street}, {store_city}<br>
                    <strong>IČO:</strong> {store_ico} &nbsp;|&nbsp; <strong>DIČ:</strong> {store_dic}
                </div>
            </div>
            <div class="card">
                <div class="card-title">Zdaňovací období</div>
                <div style="font-size: 15px; font-weight: 800; color: #0f172a; margin-bottom: 4px;">{vat_data.period.period_label}</div>
                <div style="font-size: 13px; color: #334155; line-height: 1.4;">
                    Vygenerováno: {date_now} v {time_now}<br>
                    Měna: CZK (Česká koruna)
                </div>
            </div>
        </div>

        <div class="section-title">I. Daň na výstupu (Tržby z pokladny dle sazeb DPH)</div>
        <table>
            <thead>
                <tr>
                    <th>Sazba daně</th>
                    <th style="text-align: right;">Základ daně</th>
                    <th style="text-align: right;">Daň na výstupu</th>
                    <th style="text-align: right;">Celkem s DPH</th>
                </tr>
            </thead>
            <tbody>
                {out_rows}
                <tr style="background: #f1f5f9; font-weight: 800;">
                    <td style="padding: 8px 10px; border-top: 2px solid #cbd5e1;">CELKEM VÝSTUP</td>
                    <td style="padding: 8px 10px; text-align: right; border-top: 2px solid #cbd5e1;">{vat_data.total_output_base:,.2f} Kč</td>
                    <td style="padding: 8px 10px; text-align: right; border-top: 2px solid #cbd5e1; color: #2563eb;">{vat_data.total_output_vat:,.2f} Kč</td>
                    <td style="padding: 8px 10px; text-align: right; border-top: 2px solid #cbd5e1;">{(vat_data.total_output_base + vat_data.total_output_vat):,.2f} Kč</td>
                </tr>
            </tbody>
        </table>

        <div class="section-title">II. Daň na vstupu (Nákupy zboží z příjemek od dodavatelů)</div>
        <table>
            <thead>
                <tr>
                    <th>Sazba daně</th>
                    <th style="text-align: right;">Základ daně</th>
                    <th style="text-align: right;">Nárok na odpočet DPH</th>
                    <th style="text-align: right;">Celkem nákup</th>
                </tr>
            </thead>
            <tbody>
                {in_rows}
                <tr style="background: #f1f5f9; font-weight: 800;">
                    <td style="padding: 8px 10px; border-top: 2px solid #cbd5e1;">CELKEM VSTUP</td>
                    <td style="padding: 8px 10px; text-align: right; border-top: 2px solid #cbd5e1;">{vat_data.total_input_base:,.2f} Kč</td>
                    <td style="padding: 8px 10px; text-align: right; border-top: 2px solid #cbd5e1; color: #16a34a;">{vat_data.total_input_vat:,.2f} Kč</td>
                    <td style="padding: 8px 10px; text-align: right; border-top: 2px solid #cbd5e1;">{(vat_data.total_input_base + vat_data.total_input_vat):,.2f} Kč</td>
                </tr>
            </tbody>
        </table>

        <div class="highlight-card">
            <div>
                <div style="font-size: 13px; font-weight: 700; color: #475569; text-transform: uppercase;">III. Výsledek daňového přiznání</div>
                <div style="font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 2px;">{liability_text}</div>
            </div>
            <div style="font-size: 26px; font-weight: 900; color: {liability_color};">
                {abs(vat_data.net_vat_liability):,.2f} Kč
            </div>
        </div>

        <div class="signature-block">
            <div>
                <strong>Prohlášení:</strong><br>
                Tento přehled byl automaticky sestaven z daňových dokladů a skladových příjemek v pokladním systému VoltFlow POS.
            </div>
            <div style="text-align: right;">
                V ................................... dne {date_now}<br><br><br>
                .......................................................<br>
                Podpis plátce / odpovědné osoby
            </div>
        </div>
    </div>
</body>
</html>
"""
    return HTMLResponse(content=html, status_code=200)
