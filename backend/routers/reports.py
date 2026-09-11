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
            total_refunds_dec += amt
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
                        b = Decimal(str(values.get("base", 0.0)))
                        v = Decimal(str(values.get("vat", 0.0)))
                        if s.is_refund:
                            vat_aggregated[rate_int]["base"] -= b
                            vat_aggregated[rate_int]["vat"] -= v
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
                        b = Decimal(str(val.get("base", 0.0)))
                        v = Decimal(str(val.get("vat", 0.0)))
                        if s.is_refund:
                            output_vat[rate]["base"] -= b
                            output_vat[rate]["vat"] -= v
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
