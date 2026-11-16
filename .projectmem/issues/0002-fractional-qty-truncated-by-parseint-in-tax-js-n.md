# #0002 Fractional qty truncated by parseInt in tax.js/normalizeSale: 0.35 kg sale stored as total 0, qty 0

- 2026-11-16T19:02:35Z `issue`: Fractional qty truncated by parseInt in tax.js/normalizeSale: 0.35 kg sale stored as total 0, qty 0 [src/utils/tax.js:13; src/api/posApi.js normalizeSale]
- 2026-11-16T19:18:58Z `fix`: toQty() replaces parseInt on quantities in tax.js, normalizeSale and ReceiptInspectorPanel; server rejects ZERO_QUANTITY and ZERO_TOTAL. Tests: fractional_quantity.test.js, sale_payload fixtures, test_sale_contract guards. [src/utils/tax.js]
