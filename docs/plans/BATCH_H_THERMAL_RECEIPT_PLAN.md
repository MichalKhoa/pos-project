# Batch H: Epson Thermal Receipt Correctness — Implementation Plan

Status: APPROVED 2026-11-17, Phase 0 in progress (rechecked against the code on 2026-11-17, see section 8), waiting for approval. Nothing is implemented yet.
Source: the receipt print audit of `backend/services/escpos_service.py` (`_do_print_receipt` and helpers) and `src/components/settings/ReceiptSection.jsx`, done by reading code only. Audit item numbers (A1 to A18) are used below; the list is in section 2.
Target hardware: Epson TM-T20II/III, TM-T88V/VI (80 mm, 576 dots) and TM-m10/m30 (58 mm, 384 dots), over USB, network (port 9100) or the Windows spooler.

## 1. Goal

What comes out of the Epson printer matches the screen preview and the sale: right time, right columns, readable Czech letters, working barcode, and no surprise drawer kicks.

| Repro | Today | Target |
| --- | --- | --- |
| Sale at 15:00 Prague time | prints 14:00 (UTC from `toISOString()`) | prints 15:00 |
| 80 mm, standard font, "42 znaků" selected | every table row is 48 chars on a 42-char line and wraps | rows fit 42 |
| Weighted item "0.350 kg" at 48 cols | row is 49 chars and wraps | fits |
| "Odstranit diakritiku" on | header row and `Kč` still print raw `č`, `Ú` | all ASCII |
| Windows spooler fallback | text encoded cp852, printer on CP437, Czech letters wrong | `ESC t 18` sent, Czech letters right |
| Barcode under the receipt | `CODE128` without `{B` raises, text `\|\|\| 2026-… \|\|\|` prints instead | real barcode |
| Header, EET and footer lines | 42 to 49 chars on a 32 or 48 column roll, wrap mid-word | wrap at word boundaries |
| Total line | same size as the item rows | double height, bold |
| Reprint of an old cash receipt | opens the drawer, prints `Přijatá hotovost 0 Kč` | no drawer kick, no zero lines |

## 2. Findings in scope

| Id | Finding | Phase |
| --- | --- | --- |
| A1 | Timestamp printed in UTC | 2 |
| A2 | Table widths hard-coded for 32, 42, 48, 64; 28, 30, 35, 40, 42 (80 mm), 56 overflow or under-fill | 1 |
| A3 | Weighted quantity wider than the qty column | 1 |
| A4 | `stripDiacritics` skipped for headers, item rows, tax recap | 2 |
| A5 | Win32 fallback `charcode()` does nothing, no `ESC t`, and its `text()` always encodes cp852 even when CP1250 is selected | 3 |
| A6 | CODE128 data lacks `{B` set selector. **Confirmed** with python-escpos 3.1: bare data raises `BarcodeCodeError`, `{B` prints | 3 |
| A7 | USB product id hard-coded `0x0e15`. **Dropped:** dead path (see section 8) | none |
| A8 | Float rounding of line totals vs server `Decimal`; dot vs comma | 4 (decision) |
| A9 | Cash refund and reprint print `0 Kč` cash lines; reprint kicks drawer | 2 |
| A10 | SPAYD QR: negative amount on refund, unsanitised `MSG`, image QR instead of native | 3 |
| A11 | Non-VAT-payer still prints "DAŇOVÝ DOKLAD", per-item DPH and recap | 4 (decision) |
| A12 | No `ESC @` at start or end | 3 |
| A13 | Drawer kicks pin 2 and pin 5 | 3 |
| A14 | `•` not in CP852 (python-escpos prints `?`) | 2 |
| A15 | No cap on top margin; bottom margin silently clamped to 2 | 3 |
| A16 | No paper-out or offline detection | out of scope (section 6) |
| A17 | Name exactly `line_width` long may add a blank line | 1 (hardware check in 6) |
| A18 | Logo dithering | 5 (D7) |

### Design findings (added after the first audit)

| Id | Finding | Phase |
| --- | --- | --- |
| D1 | No visual hierarchy: store name and total print at body size (the preview shows them large) | 5 |
| D2 | Two dashed rules in a row above the title | 5 |
| D3 | One detail line per item for DPH, one for discount, no `qty × price` for normal items | 5 |
| D4 | `receiptSeparatorSpacing` setting does nothing on paper | 5 |
| D5 | Amounts mix `12 Kč` and `11.50 Kč`, so columns do not line up | 5 |
| D6 | QR module size 3 is small for a bank-app scan | 5 |
| D7 | Logo is dithered (noisy on line art) | 5 |
| D8 | A refund differs from a sale only by title text | 5 |
| D9 | Preview lacks the `qty × price` line and is not the same renderer as the paper | 5 |
| D10 | Free-text lines overflow (44, 42 and 34 chars on 32 columns) and item names are cut | 1 |
| D11 | Line spacing is not matched to the font: `ESC 2` keeps the printer default (about 1/6 inch), which is a 10-dot gap under Font A and a 17-dot gap under Font B, so the default compact look is airy and wastes paper | 5 |
| D12 | The column picker ignores the paper width: on 58 mm both choices (48, 42) are ignored for standard font and the code uses 32; on 80 mm compact the "42" choice is ignored and 64 is used; options 28, 30, 35, 40, 56 are accepted by the printer code but cannot be chosen in the UI | 1 |
| D13 | Only two sizes exist (Font A 12x24, Font B 9x17); the default is **compact Font B** (model default and `/config` default), the smallest and hardest to read with Czech accents; the printer-side fallback is "standard", the UI and preview fall back to "compact" | decision 13 |
| D14 | Larger type (double width) is never used; the total could print 2x wide when it fits `line_width // 2` | 5 |
| D15 | No way to find out how many columns the printer really prints (576 or 512 dots) | decision 14 |

## 3. Decisions needed from you (defaults in bold)

1. **Money format on the thermal receipt (A8).** **Keep the dot ("3.50 Kč"), as Batch C decided and as `test_receipt_totals.py` asserts.** Alternative: Czech comma, which matches the screen and needs the tests updated.
2. **Line totals (A8).** **Print the stored line total when the sale has one, else compute with `Decimal` HALF_UP like the server.** Alternative: leave float math. Needs a look at what `sales.py` stores per line before Phase 4 starts.
3. **Non-VAT-payer (A11).** **Title "DOKLAD" or "ÚČTENKA", hide per-item DPH and the recap when `receiptVatPayerStatus != "payer"`.** Please confirm with your accountant. Alternative: leave as it is.
4. **Reprint drawer (A9).** **`/printer/print` gets `openDrawer` (default `true`), the same pattern as `/print-daily-summary`; the three reprint paths (`handleReprintSale` in `App.jsx`, `ReceiptModal`, `ReceiptInspectorPanel`) send `false`.** Trade-off: `ReceiptModal` also opens as the fallback after a fresh sale whose direct print failed; then no drawer kick happens and the cashier uses the "open drawer" button. Alternative: never kick from `/print`, only from the sale flow.
5. **Drawer pins (A13).** **Pin 2 only; new setting `drawerPin` (2 or 5, default 2), applied to all four drawer sites (receipt, daily summary, Z report, `open_cash_drawer`).** Alternative: keep both pins everywhere.
6. **Time zone (A1).** **The machine's local zone.** A naive timestamp (the server stores `datetime.utcnow()`, no `Z`) counts as UTC.
7. **Branch.** **New branch `fix/batch-h-thermal-receipt` from `master`.** One PR, one commit per phase.
8. **Hierarchy (D1).** **Store name and total print double height and bold; no new setting.** Alternative: keep one size, or tie it to the existing bold switches.
9. **Item detail lines (D3).** **Merge discount and DPH onto one right-aligned detail line, and show `qty × price` when quantity is not 1.** Alternative: DPH letter codes (`A`, `B`) after the price with a legend in the recap, the usual Czech receipt style, shortest paper but changes what the "DPH per item" setting means.
10. **Spacing (D4).** **Make `receiptSeparatorSpacing` real: 0 / 6 / 16 dots.** Alternative: remove the setting and the preview spacing.
11. **Refund title (D8).** **Reverse print (white on black).** Alternative: plain bold as today.
12. **Preview fidelity (D9).** **Keep the React preview as a visual approximation and add golden-file tests for the paper text.** Alternative (optional Phase 7, about one session): the preview shows a monospace render of the real printer output, parsed from the bytes (bold, size, alignment, the `?` for missing letters), so what you see is exactly what prints.
13. **Font and total size (D13, D14).** **Keep the stored font choice and the compact default for existing installs; change nothing about the default; the total line prints double height, and double width as well when label and value fit `line_width // 2`.** Alternatives: make Font A (standard) the default for new installs (more readable accents, a longer receipt); or double height only.
14. **Column check (D15).** **Add a small "print ruler" test (a button in the printer settings and `POST /printer/print-ruler`) that prints a numbered ruler in Font A and Font B, so you can see the real column count.** Alternative: no UI, Phase 6 uses a one-off script.

## 4. Phases

Each phase fits one session, ends in one commit with its tests, and stops for review. Tests go first and must fail on today's code. Gates after every phase:

```bash
npm run lint && npm run test && npm run build
python -m unittest discover -s backend/tests -p "test_*.py"
```

Then `/code-review`: **high** for Phase 2 and Phase 4 (refunds, VAT output, cash amounts), **medium** for Phases 0, 1, 3 and 5. Fix or report every finding. Log each fix in projectmem and sync `.serena/memories/`.

### Phase 0: Test harness (prerequisite, small)

Session start: read `backend/tests/test_receipt_totals.py` (it mocks `printer.text`).

- Reuse `escpos.printer.Dummy` from python-escpos (it records every byte in `.output` and runs the real encoder, so `ESC t`, `?` for unencodable letters and barcode validation behave like a real printer). Do not write a custom fake. Checked in `backend/venv` (python-escpos 3.1).
- New `backend/tests/escpos_helpers.py`: `print_sale(sale, store_config) -> Dummy` (patches `_get_printer_device` like the existing test), `receipt_lines(dummy)` (decode `.output` as CP852 or CP1250, split on `\n`, drop `ESC` sequences), and `assert_fits(lines, width)` (1 byte per char).
- For `Win32SpoolerRawFallback` tests use a subclass whose `_raw` appends to a list.
- Pin `python-escpos==3.1` in `backend/requirements.txt` (currently `>=3.0.0`; 3.1 is what the venv has and what the checks above ran on). The release workflow installs from this file.
- Done when: one smoke test prints a plain sale through `Dummy` and the existing 9 tests in `test_receipt_totals.py` still pass.

### Phase 1: Column layout engine and text wrapping (A2, A3, A17, D10, D12)

Files: `backend/services/escpos_service.py` (retail table L719-761, invoice table L621-665, tax recap L825-869), new tests.

- One pure function `receipt_columns(line_width, kind)` that returns column widths for `retail`, `invoice` and `tax_recap`, computed from `line_width` (name takes the remainder after fixed columns), valid for 28, 30, 32, 35, 40, 42, 48, 56, 64 and 80 (A4 paper uses 80; today it falls in the `>= 64` branch and under-fills). No branch on `is_58mm` for widths.
- One row formatter `format_item_row(name, qty_text, price_text, widths)` that returns 1 to 2 lines, never longer than `line_width`: the name wraps (not cut), qty and price stay right-aligned on the last line.
- Weighted quantity: short form `0.350kg` in the qty column, the long form stays on the detail line below (`0.350 kg × 89.90 Kč`, already printed).
- Free-text lines wrap at word boundaries with one `wrap_text(text, width)` helper (centred or left as today): IČO/DIČ line L515 (44 chars with the VAT badge), contact line L525, EET title and FIK/BKP lines L880-887 (BKP is 44 chars plus the label, over 48), framed and banner titles L678-682, branding line L945 (42 chars), footer lines L941, custom header L533. Item names wrap instead of being cut at `line_width` (L652, L663, L759). If this makes the session too long, split into 1a (tables) and 1b (free text).
- Tax recap uses the same widths function; drop the `Celkem` column on narrow widths as today.
- Tests: matrix widths × {plain, weighted, long name, 7-digit price, discount, refund with negative qty} × {retail, invoice}: every line is at most `line_width`; a second matrix covers the header, title, EET and footer lines with long values. The matrix fails today at 40, 42 (80 mm), 28, 30, 35 and for every weighted row at 48 and 32.
- Settings UI (D12): `ReceiptSection.jsx` offers the same two column choices for every paper width, so several are silently ignored. Offer only what applies: 80 mm Font A 48 or 42, Font B 64 or 56; 58 mm Font A 32 or 30 or 28, Font B 42 or 35. Rename the labels to what they mean: the number of characters your printer really prints per line (a 512-dot print area gives 42 for Font A and 56 for Font B, the 576-dot area gives 48 and 64). The 28, 30, 35, 40, 56 values stay accepted by the printer code.
- Done when: matrix green, old tests green, no change in output for widths 32, 48 and 64 for non-weighted short names (snapshot test of one standard receipt).

### Phase 2: Text and content correctness (A1, A4, A9 part 1, A14)

Files: `escpos_service.py`, receipt tests. Review at **high**.

- A1: one `_local_dt(ts)` helper: parse ISO, naive means UTC, convert with `astimezone()`. Used by the retail and invoice branches (L598, L702, also DUZP) and by the write-off and inventory protocols (L1556, L1710 strip the `Z` and so print UTC as local; same bug, two lines each). Z report, daily summary and cash slip use `datetime.now()` or client-formatted strings: no change.
- A4: reuse the existing `write_receipt_text` (it already strips diacritics and falls back on encoding errors); do not add a second helper. Move the raw `printer.text(f"...")` calls that carry Czech text (table headers L625-631 and L738, item rows L650-665 and L757-761, tax recap L836-869) to it. Pure-ASCII separators stay on `printer.text`.
- Strip mode: `write_receipt_text` uses NFKD plus ASCII `ignore`, which drops `×` (weighted detail line) and `Đ`/`đ` (Vietnamese product names). Map `×` to `x`, `Đ` to `D`, `đ` to `d` before the NFKD step.
- A14: replace `•` with `|` in the contact line (L525).
- A9 part 1: for a refund, skip "Přijatá hotovost" and "Vrácená hotovost" lines. For a cash sale with no stored tendered amount (reprint), skip both lines instead of printing `0 Kč`.
- Tests: timestamp `2026-11-16T14:00:00Z` prints `15:00:00` (winter) and a July one prints `+2h`; naive `2026-11-16T14:00:00` prints `15:00` (set `TZ=Europe/Prague` and call `time.tzset()` in the test, restore after); the protocols print local time; with `stripDiacritics` the whole output decodes as ASCII and keeps `x` and `D`; refund and reprint have no zero cash lines; the contact line has no `•`.
- Check against the screen preview: `ReceiptPreviewPaper.jsx` uses JS `Date` (local), so paper and screen should now agree. Confirm in the browser pane with one sale.

### Phase 3: Epson hardware layer (A5, A6, A9 part 2, A10, A12, A13, A15)

Files: `escpos_service.py`, `routers/printer.py`, `ReceiptModal.jsx`, `ReceiptInspectorPanel.jsx`, `App.jsx`, `posApi.js`, settings (`drawerPin`), `src/__tests__/price_check_and_last_receipt.test.jsx`.

- A12: `ESC @` at job start (before the codepage, because `ESC @` resets it) and at job end (after the cut). One helper `begin_job(printer, encoding)` and `end_job(printer)`, used by the receipt only.
- A5: `Win32SpoolerRawFallback.charcode(code)` stores the encoding, sends `ESC t n` with `{CP852: 18, CP1250: 45}`, and `text()` encodes with the stored encoding (today it always uses cp852). Checked: python-escpos 3.1 sends `ESC t 18` for CP852 and `ESC t 45` for CP1250, so the same slots are used on the normal path. Confirm on the real printer in Phase 6.
- A6: `printer.barcode("{B" + receipt_num, "CODE128", ...)`; the text fallback and the QR failure note log at `warning`, not `debug`. Test against `Dummy` (real library): no exception, and the bytes contain `{B`.
- A9 part 2: `PrintReceiptRequest.openDrawer: bool = True`; the service gets `open_drawer`. `printReceiptBackend(saleData, storeConfig, openDrawer = true)` follows `printDailySummaryBackend`; the three reprint callers (`App.jsx` `handleReprintSale` L257, `ReceiptModal.jsx` L49, `ReceiptInspectorPanel.jsx` L89) pass `false`. The sale flow (`App.jsx` L902) stays as is. Update the `toHaveBeenCalledWith` in `price_check_and_last_receipt.test.jsx` L198.
- A13: `drawerPin` config (default 2) and one helper `kick_drawer(printer, pin)` replacing the six `cashdraw(2)` / `cashdraw(5)` pairs (receipt L959-965, daily summary L1078-1082, Z report L1312-1316, `_do_open_cash_drawer` L1361-1365).
- A15: `top_margin` clamped 0 to 5; `bottom_margin` clamped 0 to 5 (it is only a feed before the cut; today it is silently forced to 1-2).
- A10: SPAYD: `AM` is the absolute amount and the QR is skipped for refunds, `MSG` is ASCII upper case without `*`, `qr(..., native=True)` (works in python-escpos 3.1); the payload is built in one tested function.
- Tests: output starts with `ESC @` and the first `ESC t` comes after it; the barcode bytes contain `{B`; `/print` with `openDrawer=false` writes no `ESC p`; `drawerPin` 5 writes `ESC p 1`; the SPAYD builder (refund, star in name, diacritics); margin clamp; the Win32 stub `charcode('CP852')` writes `\x1bt\x12` and its `text()` then encodes cp852, and the same with CP1250 and `\x1bt-`.
- Done when: all pass and the router test for `openDrawer` passes. No hardware needed yet.

### Phase 4: Money and VAT presentation (A8, A11), decision-gated

Do not start before decisions 1 to 3 are answered. Review at **high**.

- Read how `backend/routers/sales.py` rounds per line, then pick the single source for line totals (stored value, else `Decimal` HALF_UP).
- Non-payer: title, per-item DPH and recap follow decision 3.
- Tests: a fixture where float rounding differs from `Decimal` (price 2.675, quantity 0.1 and similar) prints the stored value; a non-payer receipt has no DPH lines.
- Done when: the printed lines sum to the printed total for all `backend/tests/fixtures/sales/*.json`.

### Phase 5: Receipt design (D1 to D9, D11, D14, D15), decision-gated

Do not start before decisions 8 to 14 are answered. Files: `escpos_service.py`, `ReceiptPreviewPaper.jsx` and `receiptHtmlGenerator.js` (only the parity points below), tests. Review at **medium**. Section 9 shows the receipt today and the proposed look.

- D1 hierarchy: store name and the `CELKEM` line print double height and bold (`set_escpos_font(double_height=True, bold=True)`, which already exists and is never used on the receipt; it sends `ESC !` with the 0x10 bit). Width stays normal, so the column math does not change. Reset to normal after each line.
- D14 size rules: the total line (and the store name when it fits) prints double width and double height only when `len(label) + len(value) + 1 <= line_width // 2`, otherwise double height only. Double width halves the columns, so the check uses the half width; the 32-column receipt therefore keeps double height only for `CELKEM K ÚHRADĚ:`.
- D11 line spacing: replace `ESC 2` with `ESC 3 n` per font, named constants at the top of the module (`LINE_DOTS_FONT_A`, `LINE_DOTS_FONT_B`, starting at 28 and 21 dots, a 4-dot gap, the font height plus a gap), and restore `ESC 2` in `end_job`. These are hardware calibration knobs: tune them in Phase 6, never inline them.
- D15 ruler: `print_ruler(printer, line_width)` prints `1234567890` repeated to 64 characters in Font A, then in Font B, with a `|` at the configured width and the printer's own wrap showing the real limit. `POST /printer/print-ruler` plus one button next to the column choice.
- D2 duplicate rule: the header separator (L619) plus the title rule print two dashed lines in a row. Print the header separator only when the title style adds no rule of its own (`minimal`).
- D3 item detail line: show `qty × unit price` whenever quantity is not 1 (today only weighted items show it), and put the discount and the DPH rate on the same detail line, right-aligned, instead of one line each. A line with only a DPH rate prints only when `receiptShowItemVat` is on and no other detail exists.
- D4 spacing: print `receiptSeparatorSpacing` (it is in settings and in the preview, but the printer ignores it). `ESC J n` feeds n dots: compact 0, standard 6, spacious 16, around each separator. Confirm the dot values in Phase 6.
- D5 money format on the paper: whole amounts print `12 Kč`, others `11.50 Kč`, so a column of prices does not line up. Print every amount with two decimals in tables (items, recap, subtotal); the big total keeps the current whole-koruna form for cash. Depends on decision 1 (dot or comma).
- D6 QR and barcode: native QR size 5 on 80 mm and 4 on 58 mm (today 3, about 14 mm for a SPAYD code); barcode height 46 stays, width 2 stays for 80 mm and drops to 1 only if the number does not fit 58 mm.
- D7 logo: replace Floyd-Steinberg dithering (`convert('1')`) with auto-contrast and a threshold, so line-art logos stay clean instead of noisy.
- D8 refund title: print the title of a refund in reverse (white on black, `GS B 1` then `GS B 0`); keeps `STORNO` unmistakable on a black-and-white roll.
- D9 preview parity: the React preview already shows the large store name and total, so after D1 they agree. Add the missing `qty × price` line to `ReceiptPreviewPaper.jsx`; the preview stays a visual approximation (see decision 12).
- Golden files: `backend/tests/fixtures/receipts/standard_48.txt`, `standard_32.txt` and `compact_64.txt` hold the decoded text of one fixed sale; the test compares the output, so every later design change shows up as a readable diff.
- Tests: ruler line lengths; double width only when it fits (48 columns yes, 32 no); `ESC 3` bytes follow the font; `ESC 2` restored at the end; double-height bytes before the store name and the total line and a reset after; no two separator lines in a row; qty 2 prints `2 × 28.80 Kč`; `ESC J` values per spacing; QR size byte per paper width; logo with a grey gradient has only black and white pixels; refund title is wrapped in `GS B 1` / `GS B 0`; the width matrix from Phase 1 still passes with the new lines.
- Done when: golden files updated and reviewed by you as text, matrix green.

### Phase 6: Real Epson check and docs

- Print on a real Epson (80 mm and 58 mm if available) and tick the checklist in section 5 (it includes the design items).
- Sync: `CLAUDE.md` test counts, `docs/audit` entries, `.serena/memories/`, projectmem notes (`gotcha:` for the codepage slots and the `{B` prefix), plan result sections.

## 5. Hardware checklist (Phase 6)

1. Czech letters `ěščřžýáíéúůďťň` and `Kč` print right with CP852 and with CP1250; strip mode prints plain ASCII.
2. 42, 48 and 64 columns fill the roll edge to edge without wrapping (80 mm); 32 and 42 on 58 mm.
3. Weighted item, long name, discount, refund, 2-copy mode.
4. Barcode scans back to the receipt number; QR scans in a bank app.
5. Cut position: no text lost, no wasted paper. Drawer opens once for cash, not on reprint.
6. A name exactly `line_width` long: no blank line (A17).
7. Time on paper equals wall clock.
8. Windows spooler path (`Win32SpoolerRawFallback`) with CP852 and CP1250: Czech letters right on both.

9. Font and size: the ruler shows 48 or 42 (Font A) and 64 or 56 (Font B) on 80 mm, 32 and 42 on 58 mm, and the column choice in the settings matches; line spacing gives no clipped accents and no big gaps in Font A and Font B; the total in double size does not wrap.
10. Design: store name and total are visibly larger; no double rule above the title; spacing setting changes the gaps; QR scans from about 15 cm in two bank apps; the logo is clean; the refund title is readable in reverse; amounts line up.

## 6. Risks and what stays out

1. **Codepage slot numbers differ by model and firmware.** The map in Phase 3 covers Epson TM-T20/T88/m series; other brands (Star, Bixolon) can differ. The Windows driver path is unchanged except for the added `ESC t`.
2. **Layout change on existing installs.** Phase 1 should not change widths 32, 48 and 64 for normal rows; the snapshot test guards that. Weighted rows will look different on purpose.
3. **Vietnamese product names.** CP852 and CP1250 have no Vietnamese letters; python-escpos prints `?` (checked: `Đường` prints as `?` plus `?`). Phase 2 only keeps strip mode readable. Real support would need a different codepage or image text; out of scope.
4. **Left out:** paper-out and offline detection (A16, needs bidirectional status and a UI), logo dithering (A18), the Z report, cash slip, daily summary and label printers (same helpers, but not audited; list as a follow-up), and the A4 invoice total from Batch C.
5. **Not testable without hardware:** paper output, cut position, drawer timing. Covered by the Phase 6 checklist.

## 7. Session order and why

0 → 1 → 2 → 3 → 4 → 5 → 6. Phase 0 gives every later phase the same test tool. Phase 1 comes before 2 because Phase 2 moves the raw text calls through `write_receipt_text` and the new row formatter. Phase 3 is independent of 1 and 2 and may run in a separate session if needed, as long as the two never edit `_do_print_receipt` at the same time. Phase 4 waits for decisions 1 to 3. Phase 5 (design) comes after 1 and 2 because it changes the same rows and uses the same helpers, and before 6 so the hardware check sees the final look. Phase 5 waits for decisions 8 to 14.

### Between phases (rule)

At the end of every phase the agent tells you to run `/compact` and switch to the model and effort recommended for the next phase, then waits. One phase per session.

| Phase | Model | Effort | `/code-review` |
| --- | --- | --- | --- |
| 0. Test harness | Sonnet 5.5 | low | medium |
| 1. Column layout and wrapping | Sonnet 5.5 | medium | medium |
| 2. Text and content | Opus 5.5 | high | high |
| 3. Epson hardware layer | Sonnet 5.5 | high | medium |
| 4. Money and VAT | Opus 5.5 | high | high |
| 5. Design and font sizing | Sonnet 5.5 | medium | medium |
| 6. Hardware check and docs | Haiku 5.5 or Sonnet 5.5 | low | none (docs) |

## 8. Recheck log (2026-11-17)

The plan was checked line by line against `escpos_service.py`, `routers/printer.py`, `printer_discovery.py`, the frontend call sites and python-escpos 3.1 in `backend/venv`. Changes made:

1. **A6 confirmed.** Bare `CODE128` data raises `BarcodeCodeError`; `{B...` prints. Today the barcode never prints and the `|||` text shows instead.
2. **A7 dropped.** `Usb(0x04b8, 0x0e15, 0)` is reached only when the interface is `USB`, `/dev/usb/lp0` does not exist and the OS is not Windows. `pyusb` is not in `requirements.txt` and not installed, so the call fails with `ModuleNotFoundError` and the code falls back to simulation (the frontend then opens the preview). `printer_discovery.py` also returns no vendor or product id, so the old plan step could not work. Not worth fixing now; mention in the audit docs.
3. **Phase 0 simplified.** `escpos.printer.Dummy` already records bytes and runs the real encoder; no custom `FakePrinter`.
4. **Phase 2: no new `emit` helper.** `write_receipt_text` already does stripping and the encoding fallback. Added: protocols at L1556 and L1710 have the same UTC bug; strip mode drops `×` and `Đ`/`đ`.
5. **Phase 3, A5.** The Win32 fallback `text()` ignores the chosen encoding, so only sending `ESC t 45` for CP1250 would have made it worse. The encoding is now stored and used.
6. **Phase 3, A9.** There are three reprint paths, not two: `handleReprintSale` in `App.jsx` was missing. One existing test asserts the call arguments and needs an update.
7. **Phase 3, A13.** The `drawerPin` setting must cover all four drawer sites, or the receipt and the Z report would disagree.
8. **Phase 1.** A4 paper uses 80 columns; added to the width matrix.
9. **Pin.** `python-escpos==3.1` (what the venv has), not just "pin".
10. **Verified without change:** cash-rounding lines, `receipt_totals`, margins L430-431 and L948, SPAYD L892-903, partial cut `GS V 65 2`, `ESC t 18` for CP852, `ESC t 45` for CP1250, native QR works, `•` prints `?`, the 9 existing tests, the `physical !== false` check in the frontend.
11. **Design added (user request after the recheck).** D1 to D10 and decisions 8 to 12; Phase 5 is the new design phase, the hardware check moved to Phase 6. Font sizing added: D11 to D15, decisions 13 and 14. The earlier note "Settings UI: no change needed" in Phase 1 was wrong (D12) and is replaced. The "today" sample in section 9 was produced by running the current code through `Dummy`; it also showed the double rule, the mixed money format, the 32-column overflows and the cut item name.

## 9. Receipt design: today and proposed

Today: a real print of a fixed sale through python-escpos `Dummy` at 48 columns (the sale was 15:05 local; the paper says 14:05, finding A1). Marked lines are the defects described above.

```text
Potraviny Novak
Hlavni 12
110 00 Praha 1
IČO: 12345678 | DIČ: CZ12345678 (Plátce DPH)
Tel: +420 123 456 789 ? Email: info@novak.cz      <- "?" is the bullet (A14)
Provozovna: 11 | Pokladna #01
------------------------------------------------
------------------------------------------------   <- double rule (D2)
══ DAŇOVÝ DOKLAD č. 2026-000123 ══
------------------------------------------------
Datum a čas: 16.11.2026 14:05:09                   <- UTC (A1)
Obsluha: Jana
------------------------------------------------
Položka                      Ks             Cena
------------------------------------------------
Rohlik tukovy                 3         11.70 Kč
  DPH 12%                                          <- one line per item (D3)
Mleko polotucne 1,5% trvanlive 1l Madeta
                              1         29.90 Kč
  DPH 12%
Salam Vysocina             0.350 kg      31.46 Kč  <- 49 chars, wraps (A3)
  0.350 kg × 89.90 Kč
  DPH 12%
Cola 0,5l                     2         57.60 Kč
  (-10% sleva)
  DPH 21%
------------------------------------------------
================================================
Mezisoučet:                             11.50 Kč
Zaokrouhlení:                           +0.50 Kč
CELKEM K ÚHRADĚ:                           12 Kč   <- body size, "12" vs "11.50" (D1, D5)
================================================
...
||| 2026-000123 |||                                <- barcode failed, text shown (A6)
```

On 32 columns the same sale also prints the IČO line at 44 chars, the title at 34, the branding line at 42 and the weighted row at 35, and cuts the long item name at 32 characters (D10).

Proposed (decisions 8 and 9 at their defaults; one fixed sale, 48 columns, local time):

```text
                POTRAVINY NOVAK                    <- double height, bold
                   Hlavni 12
                 110 00 Praha 1
        IČO: 12345678 | DIČ: CZ12345678
                   Plátce DPH                      <- wrapped, not cut
     Tel: +420 123 456 789 | info@novak.cz
         Provozovna: 11 | Pokladna #01
------------------------------------------------   <- one rule
       ══ DAŇOVÝ DOKLAD č. 2026-000123 ══
------------------------------------------------
Datum a čas: 16.11.2026 15:05:09
Obsluha: Jana
------------------------------------------------
Položka                      Ks            Cena
------------------------------------------------
Rohlik tukovy                 3        11.70 Kč
  3 × 3.90 Kč                            DPH 12%   <- detail and VAT on one line
Mleko polotucne 1,5%                               <- name wraps
trvanlive 1l Madeta           1        29.90 Kč
                                         DPH 12%
Salam Vysocina             0.350kg     31.46 Kč
  0.350 kg × 89.90 Kč                    DPH 12%
Cola 0,5l                     2        57.60 Kč
  2 × 28.80 Kč (-10%)                    DPH 21%
------------------------------------------------
================================================
Mezisoučet:                             11.50 Kč
Zaokrouhlení:                           +0.50 Kč
CELKEM K ÚHRADĚ:                           12 Kč   <- double height, bold
================================================
```

The rest (payment lines, VAT recap, barcode, footer) keeps today's order. Phase 5 writes this as the golden file so you can review the design as text before any paper is printed.

### Font and size reference (from the Epson specs, confirm in Phase 6)

| Paper | Printable dots | Font A 12x24 | Font B 9x17 | Double width, Font A |
| --- | --- | --- | --- | --- |
| 80 mm | 576 | 48 columns | 64 columns | 24 |
| 80 mm, 512-dot print area | 512 | 42 | 56 | 21 |
| 58 mm | 384 | 32 | 42 | 16 |

At 203 dpi a Font A cell is about 1.5 x 3.0 mm and a Font B cell about 1.1 x 2.1 mm. The column choice in the settings is the real number of characters the printer prints per line, not a margin: when it is smaller than the paper allows, the printer is set to a smaller print area, so the layout fills it and no left margin command (`GS L`) is used (it could push text past a 512-dot area).
