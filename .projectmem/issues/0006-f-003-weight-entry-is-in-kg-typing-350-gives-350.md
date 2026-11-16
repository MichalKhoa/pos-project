# #0006 F-003: weight entry is in kg, typing 350 gives 350 kg = 14,700 Kč; F-015 shift widget vs Z-report vs Historie disagree on cash total

- 2026-11-16T19:13:16Z `issue`: F-003: weight entry is in kg, typing 350 gives 350 kg = 14,700 Kč; F-015 shift widget vs Z-report vs Historie disagree on cash total [src/App.jsx; backend/routers/cash.py _calculate_shift_metrics]
- 2026-11-16T20:07:16Z `fix`: F-003 fixed: WeightEntryModal enters grams by default with g/kg toggle, >25 kg needs second tap, cart counts weighed line as one item. Tests: WeightEntryModal.test.jsx, cart_count.test.js; live check in browser pane. [src/components/presets/WeightEntryModal.jsx]
