# #0001 Cash sales with fractional total rejected by backend 422 TOTAL_MISMATCH; UI shows success, sale never persisted

- 2026-11-16T18:46:27Z `issue`: Cash sales with fractional total rejected by backend 422 TOTAL_MISMATCH; UI shows success, sale never persisted [src/App.jsx handleCompleteSale; backend/routers/sales.py:939]
- 2026-11-16T19:22:29Z `fix`: Server accepts whole-koruna cash totals within 0.50 of exact total, stores exact total_amount plus cash_rounding; Z-report cash adds rounding. Tests: test_cash_rounding.py, contract fixtures cash_11_50 and cash_weight_0_35kg now 201. [backend/routers/sales.py create_sale; backend/routers/cash.py]
