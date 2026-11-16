# #0003 F-028: server VAT split differs from client by 0.01 Kč (float division; server 3.12 vs client 3.13). Covered by backendTaxSummary known-bug marker.

- 2026-11-16T19:13:10Z `issue`: F-028: server VAT split differs from client by 0.01 Kč (float division; server 3.12 vs client 3.13). Covered by backendTaxSummary known-bug marker. [backend/routers/sales.py recalculate_sale_totals]
- 2026-11-16T19:18:59Z `fix`: Server nets VAT with Decimal division; client uses integer-cent netFromGross (float 14.70/1.12 gave 13.12). Fixture tax_summary now equal on both sides; backendTaxSummary markers removed. [backend/routers/sales.py recalculate_sale_totals; src/utils/tax.js]
