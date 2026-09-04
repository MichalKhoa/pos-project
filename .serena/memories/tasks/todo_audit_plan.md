# Task State Handoff: Roadmap & Plan Cleanup (Complete)

## Status: Fully Resolved & Reorganized (2026-09-05)
- **Archive Completed Plans**:
  - Moved finished milestone documents into `docs/plans/archive/`.
- **Created Master Roadmap (`docs/ROADMAP.md`)**:
  - Outlined verified baseline capabilities (Park Sale, Cash drawer kick, Shift stats widget, Preset search, Banknotes/coins).
  - Defined 8 immediate counter priorities for parents' večerka: Last receipt quick reprint/storno, Price check mode, 1-tap receipt print toggle, Quick multiplier chips (2×/4×/6×/10×/20×), Fast "Volný prodej" keys with VAT, Thermal shelf price tag generator, Low-stock badges on presets, Custom receipt footer note.
  - Defined close future features: ČSOB Move 3500 card refund API and SumUp reader integration.
  - Documented enterprise expansion roadmap (Multi-cashier, Multi-store sync, Bottle deposits, B2B invoicing, etc.).
- **Updated `TODO.md`**:
  - Aligned with the 8 immediate counter priorities and close future tasks.
- **Verification Gates**:
  - `npm run lint`: 0 errors, 0 warnings.
  - `npm run test`: 80/80 passed.
  - `python -m unittest discover -s backend/tests -p "test_*.py"`: 45/45 passed.
