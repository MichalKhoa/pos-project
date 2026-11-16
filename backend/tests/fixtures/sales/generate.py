"""Regenerates the golden sale fixtures next to this file.

Run from anywhere: backend/venv/bin/python backend/tests/fixtures/sales/generate.py
Edit the make(...) calls at the bottom, regenerate, commit the JSON. The tax_summary
reference is an independent exact-decimal calculation, not the server code under test.
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.abspath(os.path.join(HERE, '..', '..', '..')))
from routers.sales import CreateSaleSchema, recalculate_sale_totals
from decimal import Decimal, ROUND_HALF_UP

def q(d):
    return Decimal(d).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

def exact_tax(items, cart_disc):
    # independent exact-decimal reference (half-up on true quotients), per item like the app
    grosses=[q(Decimal(str(i['price']))*Decimal(str(i['quantity']))*(1-Decimal(str(i['discount_percent']))/100)) for i in items]
    raw=q(sum(grosses)); final=q(raw-q(raw*Decimal(str(cart_disc))/100)); f=(final/raw) if raw!=0 else Decimal(1)
    out={}
    for it,g in zip(items,grosses):
        r=it['vat']; fg=q(g*f); net=q(fg/(1+Decimal(r)/100)) if r>0 else fg; tax=fg-net
        e=out.setdefault(str(r),{'rate':r,'gross':Decimal(0),'net':Decimal(0),'tax':Decimal(0)})
        e['gross']+=fg; e['net']+=net; e['tax']+=tax
    return {k:{kk:(vv if kk=='rate' else float(vv)) for kk,vv in v.items()} for k,v in out.items()}

OUT = HERE

TS = "2026-11-16T10:00:00.000Z"

def item(i, name, price, qty, vat, disc=0):
    return {"id": i, "name": name, "price": price, "quantity": qty, "vat": vat, "discount_percent": disc}

def make(name, description, items, method, tendered, change, total_client, cash_rounding=0.0,
         cart_disc=0, split=None, known=None, frontend=True, refund=False, expected_total=None, rn="2026-000001"):
    # taxSummary from the server's own pure function (not under change in Batch A)
    probe = CreateSaleSchema(id="probe", paymentMethod=method, totalAmount=0, taxSummary={},
                             cartDiscountPercent=cart_disc, items=items)
    computed, tax = recalculate_sale_totals(probe)
    tax_summary = exact_tax(items, cart_disc)
    server_tax = {str(k): v for k, v in tax.items()}
    if server_tax != tax_summary:
        known = dict(known or {}); known['backendTaxSummary'] = 'F-028'
    payload = {
        "id": f"fixture-{name}", "receiptNumber": rn, "timestamp": TS,
        "items": items, "totalAmount": total_client, "cashRounding": cash_rounding,
        "cartDiscountPercent": cart_disc, "paymentMethod": method, "splitDetails": split,
        "tenderedAmount": tendered, "changeDue": change, "taxSummary": tax_summary,
    }
    if refund:
        payload.update({"isRefund": True, "originalReceiptNumber": "2026-000001", "refundReason": "fixture"})
    fx = {"name": name, "description": description,
          "payload": payload, "expectedServer": {"total_amount": expected_total if expected_total is not None else computed, "cash_rounding": cash_rounding,
          "items": [{"item_id": i["id"], "quantity": i["quantity"]} for i in items]}}
    if known:
        fx["knownBugs"] = known
    if frontend:
        fx["input"] = {
            "id": payload["id"], "receiptNumber": rn, "timestamp": TS,
            "cartItems": [{"id": i["id"], "name": i["name"], "price": i["price"], "quantity": i["quantity"],
                           "vat": i["vat"], "discountPercent": i["discount_percent"]} for i in items],
            "cartDiscountPercent": cart_disc, "method": method,
            "tenderedAmount": tendered, "changeDue": change, "splitDetails": split,
        }
    with open(f"{OUT}/{name}.json", "w", encoding="utf-8") as f:
        json.dump(fx, f, ensure_ascii=False, indent=2); f.write("\n")
    print(name, computed, tax_summary)

make("cash_exact_12", "Cash, whole-koruna total, two VAT rates.",
     [item("fx-a", "Volný prodej", 8, 1, 21), item("fx-b", "Pečivo", 4, 1, 12)], "cash", 20, 8, 12)
make("cash_11_50", "Cash, fractional total: client rounds to 12 and sends cashRounding 0.5 (F-001, fixed in Batch A Phase 2).",
     [item("fx-a", "Volný prodej", 8, 1, 21), item("fx-c", "Rohlík tukový", 3.5, 1, 12)], "cash", 20, 8, 12, cash_rounding=0.5, expected_total=11.5)
make("card_3_50", "Card, fractional total, no rounding.",
     [item("fx-c", "Rohlík tukový", 3.5, 1, 12)], "card", 3.5, 0, 3.5)
make("card_weight_0_35kg", "Card, 0.35 kg of apples at 42 Kč/kg (F-027: client truncates quantity to 0).",
     [item("fx-d", "Jablka Gala", 42, 0.35, 12)], "card", 14.7, 0, 14.7)
make("cash_weight_0_35kg", "Cash, 0.35 kg of apples: total 14.70 rounds to 15 (F-027 client, F-001 server).",
     [item("fx-d", "Jablka Gala", 42, 0.35, 12)], "cash", 20, 5, 15, cash_rounding=0.3, expected_total=14.7)
make("split_100_50", "Split cash 100 + card 50; split totals are not rounded.",
     [item("fx-e", "Dárkový poukaz", 150, 1, 21)], "split", 150, 0, 150, split={"cash": 100, "card": 50})
make("cart_discount_10_cash", "Cash with 10% cart discount, two VAT rates, whole-koruna result 135.",
     [item("fx-f", "Boty", 100, 1, 21), item("fx-g", "Ponožky", 50, 1, 12)], "cash", 200, 65, 135, cart_disc=10)
make("refund_cash_12", "Storno of a 12 Kč cash sale as built by handleProcessRefund (backend-only fixture).",
     [item("fx-a", "STORNO: Pečivo", 12, -1, 21)], "cash", -12, 0, -12, frontend=False, refund=True, rn="STORNO-2026-000002")
