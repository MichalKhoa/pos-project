# Frontend Development Rules & Guidelines — Himmel POS

This document defines the strict UI/UX, styling, responsiveness, and architecture rules for frontend development in Himmel POS.

---

## 1. Touch Ergonomics & Component Sizing

- **Minimum Touch Target**: All interactive buttons, chips, and input controls intended for POS touchscreens MUST have a minimum height of **40px–44px** (e.g., `.category-chip` has `height: 42px`).
- **Pill & Badge Heights**: Secondary navbar controls, action buttons, and status pills MUST maintain a standardized height (e.g., **36px** in `.navbar`).
- **No Text Wrapping in Buttons**: All button labels and chips MUST set `white-space: nowrap` and `flex-shrink: 0` to prevent ugly multi-line text height expansion.

---

## 2. Top Bar & Navigation Discipline

- **Single-Row Alignment**: The header (`.navbar`) must maintain a single-row flex layout (`align-items: center; justify-content: space-between`).
- **Scrollable Navigation**: Navigation tabs (`.nav-tabs`) and Category filters (`.category-bar`) must use `overflow-x: auto` with smooth scrolling (`scroll-behavior: smooth`) and hidden native scrollbars (`scrollbar-width: none`).
- **Responsive Collapse (Media Queries)**:
  - At `<= 1440px`: Hide secondary date strings or display compact clock format.
  - At `<= 1280px`: Collapse text labels in action badges (Shutdown, Admin, Sync) to icon-only mode with full hover tooltips.
  - At `<= 1080px`: Tighten margins and padding while keeping full functionality accessible.

---

## 3. Internationalization (i18n)

- **Translation Keys**: All UI text MUST use `useTranslation()` (`t('key.path')`).
- **Multi-Language Support**: Every new translation string MUST be added to [src/i18n/translations.js](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/src/i18n/translations.js) for `cs` (Czech), `vi` (Vietnamese), and `en` (English).
- **Concise Translations**: Keep button and tab translations short (e.g., Czech: "Historie", Vietnamese: "Lịch sử", English: "History") to avoid horizontal overflow on small displays.
- **Locale Formatting**: Dates, currency, and numbers must use active locale strings (`t('locale')`).

---

## 4. Design System & CSS Rules

- **CSS Variables**: Use global CSS variables defined in [src/index.css](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/src/index.css):
  - Backgrounds: `var(--bg-main)`, `var(--bg-card)`, `var(--bg-card-hover)`, `var(--bg-input)`
  - Accents: `var(--accent-blue)`, `var(--accent-emerald)`, `var(--accent-amber)`, `var(--accent-rose)`, `var(--accent-purple)`
  - Borders & Text: `var(--border-color)`, `var(--text-primary)`, `var(--text-secondary)`, `var(--text-muted)`
  - Radii: `var(--radius-sm)`, `var(--radius-md)`, `999px` (pills)
- **Icon Consistency**: Use icons strictly from `lucide-react`. Maintain consistent sizing (`size={14}` for micro-badges, `size={16-18}` for buttons, `size={20-24}` for titles).

---

## 5. Verification & Code Quality

- **Linting**: Code MUST pass `npm run lint` (`oxlint`) with **0 errors and 0 warnings** before finalizing edits.
- **Build Verification**: Project MUST build cleanly via `npm run build` (`vite build`).
- **No Orphaned Imports**: Remove unused imports, variables, or props when refactoring.
