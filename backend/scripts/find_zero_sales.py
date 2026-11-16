"""Read-only report: stored sales with total 0 or a zero-quantity line (audit F-027).

Usage: backend/venv/bin/python backend/scripts/find_zero_sales.py
Changes nothing. Review each row by hand; the cashier may need to re-enter the sale.
"""
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import or_

from database import SessionLocal
from models import SaleItemModel, SaleModel


def main():
    db = SessionLocal()
    try:
        zero_qty = {r[0] for r in db.query(SaleItemModel.sale_id).filter(SaleItemModel.quantity == 0)}
        sales = (
            db.query(SaleModel)
            .filter(SaleModel.is_refund == False)  # noqa: E712
            .filter(or_(SaleModel.total_amount == 0, SaleModel.id.in_(zero_qty)))
            .order_by(SaleModel.timestamp)
            .all()
        )
        print(f"{len(sales)} suspicious sale(s)")
        for s in sales:
            print(f"{s.timestamp}  {s.receipt_number}  total={s.total_amount}  "
                  f"tendered={s.tendered_amount}  zero_qty_line={'yes' if s.id in zero_qty else 'no'}  id={s.id}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
