# Theme Phase 1: Tokens Only

Source: `docs/audit/THEME_DESIGN_AUDIT.md` (C1, C5, C7, E1, T2). Goal: calmer look for older users with the smallest change. Almost all edits are in `src/styles/tokens.css`.

## Changes

1. **Default accent (C1).** Replace default indigo with a new `graphite` default.
   - `tokens.css`: `:root` / `[data-theme='dark']` `--accent-highlight*` set to graphite (light `#1f2937`, hover `#111827`; dark `#e5e7eb`, text `#111827`). Existing `charcoal` option stays; `indigo` stays selectable.
   - `StoreConfigContext.jsx:33,35`: fallback `'indigo'` becomes `'charcoal'`; `LayoutSection.jsx:247`: same fallback. (Reuse existing `charcoal` id, no new option.)
   - Users who already saved a colour keep it.
2. **Warm background (C7).** Light `--bg-main` `#f1f5f9` to `#f5f3ef`; `--bg-input` / `--bg-card-hover` to warm neutrals. Dark theme unchanged.
3. **Remove glows (E1).** Set `--shadow-highlight-glow`, `--shadow-glow`, `--shadow-blue-glow`, `--shadow-hero-glow` to `none` in all theme and accent blocks. This also covers the 10 CSS/JSX users listed in the audit with no file edits. Keep the token names so nothing breaks. Replace the glow on `.latency-dot-online` with no shadow.
4. **Readable text colours (C5).** Add `--text-success` (`#047857`), `--text-warning` (`#b45309`) tokens (dark theme: current bright shades). Switch the 29 `color: var(--accent-emerald|amber)` text uses in `src/styles/*.css` to them. Fills stay unchanged.
5. **Muted text (C5).** Light `--text-muted` `#64748b` to `#586374` (4.5:1 on new background).
6. **Font size (T2).** Remove the compact shrink for `lg` and `xl` in the `max-height: 900px` media query (keep for `sm`/`md`). Default stays `lg` (18px).

## Out of scope

Gradients, blur, motion, 3D keys, banknote colours, category colours, layout, type weights. Those are phases 2 to 5.

## Verify

- `npm run test`, `npm run lint`, `npm run build` pass (tests may assert the `indigo` default: update only those).
- Visual check at 1366x768, light and dark: register, cash modal, settings > Layout accent picker.
- Contrast script rerun on changed pairs: all text pairs at 4.5:1 or better.
- `/code-review` at medium effort before commit (CSS and one default value, no backend).

## Risk

Low. Glow removal is purely visual. Larger default font at 900px height may push the top bar to wrap: check, and note for phase 5 if so.
