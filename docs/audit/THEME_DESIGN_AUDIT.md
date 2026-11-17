# Theme and Design Audit

Date: 2026-11-17. Scope: look and feel of the cashier app (`src/styles/*.css`, `src/components/**`), checked in the running app at 1366x768 in light and dark mode. Audit only. No code was changed.

Goal: calmer, more trustworthy look for a less tech-savvy, older cashier. Less "AI dashboard", more "ordinary shop till".

## Summary

The structure is sound: big touch targets (`--touch-min: 44px`), clear left cart / right catalog split, three languages, light and dark themes. The "too AI" feeling comes from a recognisable stack of trends, not from layout:

1. Indigo/violet as the main brand colour (Tailwind `indigo-500/600` is the generic AI-product colour).
2. Gradients, glows and lifted shadows on ordinary buttons.
3. Too many saturated hues competing on one screen (catalog stripes, six banknote gradients, coloured toasts, coloured status pills).
4. Very heavy type (800/900) and tiny text (12 to 13 px) at the same time.
5. Decorative micro-motion (scale, rotate, pulse) that adds noise but no meaning.

Colour is also doing too much work. Older users read position, label and shape first; a colour should mean one thing (for example "money / confirm" or "danger") and nothing else.

## Evidence

| Measure | Count |
|---|---|
| CSS lines in `src/styles` | 7,822 |
| `gradient` uses | 38 (modals 15, register 11, notifications 7, history 3, customer display 2) |
| `box-shadow` rules | 170 (register 74, layout 40, modals 29) |
| `backdrop-filter` blur rules | 4 (navbar, cart column, modal overlay, register) |
| Hover / press transforms (`scale`, `translateY`, `rotate`) | about 20 |
| `font-weight` 800 or 900 | 103 of 172 weight declarations (60%) |
| Font sizes below 0.8 rem | 39 of 243 declarations |
| Hue families used as accents | blue, emerald, amber, rose, purple, indigo (6) plus 28 category colours |
| Selectable accent colours | 7 (emerald, blue, amber, rose, purple, charcoal, indigo), default indigo |

Measured contrast (WCAG AA needs 4.5:1 for normal text, 3:1 for large):

| Pair | Ratio | Result |
|---|---|---|
| `--text-muted` on `--bg-main` (light) | 4.34 | fail |
| `--text-muted` on white card | 4.76 | pass, barely |
| Emerald `#059669` text on white (the green prices) | 3.77 | fail for small text |
| Amber `#d97706` text on white | 3.19 | fail |
| White text on `#10b981` (dark-theme emerald button) | 2.54 | fail |
| White text on `#f59e0b` (amber accent, dark theme) | 2.15 | fail (the code already switches to black text here) |
| Rose `#e11d48` on white | 4.70 | pass |
| White on blue `#2563eb` | 5.17 | pass |
| White on indigo `#4f46e5` | 6.29 | pass |

Rendered text on the register at 1366x768: most labels are 12 to 15 px; only prices and the total reach 17 px or more.

## Findings

Severity: **H** hurts the target user directly, **M** adds to the "AI" feel or to noise, **L** polish.

### Colour

- **C1 (H) Indigo is the default accent.** `tokens.css:29` and `StoreConfigContext.jsx:33` default to indigo. The "All items" chip, active nav tab and focus rings are all violet. Change the default to a calm neutral (charcoal/graphite) or one deep, muted blue. Keep the other choices as options.
- **C2 (H) Six hues on screen at once.** Catalog cards get a coloured left stripe plus a tinted gradient (`register.css:422`, `:459`) from 28 category colours (`src/data/initialData.js:5`, including fuchsia, plum, lime, magenta). Result: a rainbow grid where colour carries no meaning. Reduce to a muted palette of about 8 earthy tones, or make the stripe optional and keep cards white.
- **C3 (H) Payment banknote buttons are six different saturated gradients** (`modals.css:512` to `:562`: green, orange, red, purple, olive, blue). Real Czech banknotes are colour-coded, so this has some logic, but the rendering is loud and competes with the real action ("Dokončit a vytisknout"). Use one neutral button style with the denomination large and a thin note-colour edge only.
- **C4 (M) Green, blue and purple primaries side by side.** Cash is green, Card/QR is blue, plus indigo highlight and purple VAT amounts (`accent-purple` in the cart summary). Pick one primary action colour. Let Cash and Card differ by label and icon, not hue.
- **C5 (M) Text-colour contrast failures** (table above). Green and amber text used for prices, badges and shift totals is below AA. Use darker shades for text (`#047857`, `#b45309`) and keep the bright ones for fills only.
- **C6 (M) Toast banners use saturated gradients** (`notifications.css:73` to `:143`). Use a flat tint with a dark text and an icon.
- **C7 (L) Page background is cool slate-blue (`#f1f5f9`, dark `#0a0e17`).** A warm off-white (`#f5f3ef` to `#f7f5f2`) and a softer charcoal dark theme feel less "tech product" and less tiring.
- **C8 (L) Hard-coded hex values** (about 180, 72 of them `#ffffff`) bypass the tokens, so a palette change needs many edits. Move repeated colours to tokens as part of any redesign.

### Effects and motion

- **E1 (H) Glows.** `--shadow-highlight-glow`, `--shadow-glow`, `--shadow-blue-glow`, `--shadow-hero-glow` give coloured halos around buttons and the total. Glow is the strongest "AI/crypto dashboard" signal. Remove all four tokens; use a plain 1 px border and one soft grey shadow.
- **E2 (M) Gradients on buttons and cards** (38 uses). Replace with flat fills. Keep at most one subtle gradient or none.
- **E3 (M) Glass blur** on navbar and cart column (`layout.css:61`, `:422`, `register.css:475`). Makes the bar look floating and translucent. Use an opaque bar with a bottom border.
- **E4 (M) Playful motion.** `scale(1.08)` on hover, `scale(1.3) rotate(-8deg)` (`register.css:686`), close button `rotate(90deg)` (`modals.css:69`), pulsing status dot (`tokens.css:236`). Touch screens have no hover, and older users can read movement as an error. Keep only a short press-darken. Respect `prefers-reduced-motion`.
- **E5 (M) Skeuomorphic 3D keys** (`--shadow-key`: 3 px solid under-edge). Fine for tactile feedback, but combined with rounded cards and glows it reads as a toy. Flat keys with a clear border and a pressed state are enough.
- **E6 (L) Pill-shaped chips and `border-radius: 9999px`** (19 uses) mixed with 4 px and 16 px. Pick two radii (for example 6 px controls, 12 px cards).

### Typography

- **T1 (H) Small text.** 39 declarations are below 0.8 rem (about 11 to 12 px after the compact scaling). Small grey captions (tax rate "21%", line detail "0.5 kg x 42.00 Kc", "Zakladni dane") are hard to read. Set a floor of 14 px for anything the cashier must read, 16 px for body.
- **T2 (H) Compact root scaling.** `tokens.css:298` drops the root font to 14.5 px when the window height is 900 px or less. That is most POS monitors. This works against the goal. Raise the default root to 16 px or 17 px and offer a size choice (the app already has `data-font-size` sm/md/lg/xl; lg is the better default for this user).
- **T3 (M) Over-bold.** 60% of weights are 800 or 900. When everything is extra bold nothing stands out. Use 400 for body, 600 for labels and buttons, 700 for prices and the total.
- **T4 (M) Uppercase micro-labels** (for example "CISTA HMOTNOST (NETTO)", "TARA (OBAL)", "CESKE BANKOVKY") with letter-spacing, 11 to 12 px. Uppercase plus tiny size is the worst case for older eyes. Use sentence case at 14 px.
- **T5 (L) Monospace (JetBrains Mono) for totals and prices.** Reads as developer tooling. Inter with `font-variant-numeric: tabular-nums` keeps alignment without the code-editor look.

### Layout and density

- **L1 (H) Top bar is crowded.** At 1366 px it holds status pill, 6 tabs, language, 6 icon-only tools (display, theme, text size, sound, printer, clock) and power. Icons are 17 px and mostly unlabelled. Move rarely used tools (theme, sound, text size, language) into Settings, keep tabs, clock and one lock/exit.
- **L2 (M) Settings sidebar truncates text** ("Rozvrzeni & Zobraze", "Platebni Termina", "Bezpecnost & PI"). Widen the column or shorten the labels. Each item also has a two-line grey subtitle that adds noise.
- **L3 (M) Catalog cards are small and dense.** Name wraps to two lines, price sits on a third line ("39.9 / Kc" wraps in the screenshot), tax percentage and icon fight for space. Fewer columns with larger cards help more than more information per card. Remove the VAT % from the card face.
- **L4 (M) Cart and total area.** Good hierarchy overall, but the green total box with its glow and the purple VAT number add colour that is not needed. Make the total large black on white and the pay buttons the only coloured elements.
- **L5 (L) Icon on every control.** Lucide icons are used on almost every button, label and heading. Keep icons only where they speed recognition (payment, delete, print); text labels do the rest.
- **L6 (L) Emoji and coin illustrations** in the cash panel (`CashPaymentPanel.jsx`). Replace with plain denomination text.

### Dark theme

- **D1 (M)** Dark theme uses the same neon accents (`#10b981`, `#6366f1`, `#f59e0b`) which look more saturated on near-black. If dark mode stays, desaturate accents and keep text at 7:1 or better. It is a minor concern if the shop uses light mode.

### Customer display

- **CD1 (L)** Navy gradient background (`customer-display.css:229`) and a green radial glow (`:422`). The customer sees this screen, so keep it plainer: white or very dark flat, large price, store name.

## Proposed direction

"Ordinary shop till": quiet, flat, high contrast, big text, one accent.

- Neutral warm background, white cards, 1 px grey borders, one soft shadow.
- One accent colour (deep blue or graphite) for selected state and the primary action. Semantic colours only for meaning: green = paid/success, red = delete/error, amber = warning.
- No gradients, glows, blur or decorative motion.
- Base text 16 px or larger, weights 400/600/700, sentence case labels, no monospace on prices.
- Fewer, larger controls on the top bar; labelled where possible.
- Category colours muted and optional.

## Suggested order of work

Each phase touches mostly `tokens.css` first so the change spreads through the app. Per project rules, each needs an implementation plan and `/code-review` before commit. Snapshot tests that assert class names or style tokens may need updates.

1. **Tokens only (low risk, biggest effect).** New default accent, warm background, remove glow tokens (set them to `none`), darker text shades for green and amber, default font size to lg, remove the 900px root shrink. Covers C1, C5, C7, E1, T2.
2. **Flatten.** Remove gradients, blur and hover/rotate motion from `register.css`, `layout.css`, `modals.css`, `notifications.css`. Add `prefers-reduced-motion`. Covers E2 to E6, C6.
3. **Colour reduction.** Neutral banknote buttons, muted category palette, one primary action colour, simpler total box. Covers C2 to C4, L4.
4. **Type and density.** Font floor 14 px, weight scale, sentence-case labels, Inter for numbers. Covers T1, T3 to T5.
5. **Layout.** Top bar clean-up, settings sidebar widths, bigger catalog cards, customer display. Covers L1 to L3, L5, L6, CD1.

## Open questions for the owner

1. Is dark mode used in the shop? If not, D1 can be dropped.
2. Is the 28-colour category stripe part of the owner's workflow (colour = product group), or decoration?
3. Keep the coloured banknote buttons for fast recognition, or neutral?
4. Preferred accent: graphite/black, deep blue, or the shop's brand colour?
5. What screen size and resolution does the shop use? It decides the right base font size and card grid.
