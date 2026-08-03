# 🚀 Himmel POS — Prompting Manual for Project Expansion

**Target Audience:** Project Maintainers & Developers  
**Purpose:** Guide on writing highly effective, high-precision prompts for AI coding agents expanding Himmel POS.

---

## 🎯 The Himmel POS Prompting Formula

To get 100% accurate, production-ready code on the first attempt, structure prompts using this 4-part formula:

```text
[1. Specific Feature / Task Goal]
+ [2. Affected Architecture Files / Tech Stack]
+ [3. Explicit Business Rules & Constraints]
+ [4. Verification & Testing Instructions]
```

---

## 📐 Key Rules for Prompting on this Codebase

### 1. Anchor Files Explicitly
AI agents work best when given exact file paths.
- **Backend API & Models**: `backend/models.py`, `backend/main.py`, `backend/routers/`
- **Frontend State & Components**: `src/App.jsx`, `src/api/posApi.js`, `src/components/`
- **Launcher Scripts**: `Himmel_POS.bat`, `himmel_pos.sh`

### 2. Specify Non-Breaking Auto-Migrations
When adding database fields, explicitly remind the agent to add entries to the `MIGRATIONS` array in [backend/main.py](file:///home/misko/Documents/pos-eet-himmel/backend/main.py#L31).

### 3. Maintain Hardware & Offline Resiliency
Always state whether a feature needs to work offline (e.g., SQLite WAL mode, cached local storage) or handle hardware failure gracefully (printer timeouts, network loss).

---

## 📋 Copy-Paste Prompt Templates

### Template A: Adding a New Feature (e.g., Table Management / Reservations)

```text
Feature Request: [Feature Name, e.g. Restaurant Table Management]

Goal:
Implement [Feature Name] allowing cashiers to [describe main capability].

Architecture & Scope:
- Backend: Create new router `backend/routers/tables.py` and register it in `backend/main.py`. Add `TableModel` in `backend/models.py`.
- Frontend: Add a new view `src/components/TableView.jsx` and API helper in `src/api/posApi.js`.

Requirements & Rules:
1. Ensure new database columns auto-migrate cleanly via `MIGRATIONS` in `backend/main.py`.
2. Support offline usage without breaking active sales cart state in `src/App.jsx`.
3. Provide Czech translation strings in `src/i18n/translations.js`.

Verification:
- Run `npm run lint` and verify zero errors.
- Test API endpoint using python test script.
```

---

### Template B: Bug Fix / Error Troubleshooting

```text
Bug Report: [Short Error Title]

Problem Statement:
When [action taken, e.g. clicking print receipt], the following error occurs:
"[Paste exact log output or error traceback here]"

Target Files:
- [Path to suspect file, e.g. backend/routers/printer.py]

Instructions:
1. Identify the root cause from the traceback (do not hide or swallow exceptions).
2. Fix the issue surgically without modifying unrelated code.
3. Add null/undefined safety checks.
4. Verify by running linting and building.
```

---

### Template C: Peripheral Hardware / Hardware Protocol Integration

```text
Hardware Integration: [Device Name, e.g. Customer LCD Pole Display / Weighing Scale]

Goal:
Connect and communicate with [Device Model] via [USB / Serial / Network].

Files:
- `backend/services/` (create driver service)
- `backend/routers/display.py`

Constraints:
- Non-blocking async handling so main thread never freezes.
- Fallback gracefully if hardware device is disconnected or offline.
- Keep direct silent printing capability intact.
```

---

### Template D: UI/UX Refinement (Touchscreen Kiosk Optimization)

```text
UI Refinement: [Component Name, e.g. Touch Numeric Keypad]

Goal:
Improve [UI element] for 15-inch touchscreen POS displays.

Files:
- `src/components/[ComponentName].jsx`
- `src/index.css`

Design Guidelines:
- Touch Targets: Minimum 48px height for all touch buttons.
- Design System: Use CSS variables from `index.css` (e.g. `var(--accent-blue)`, `var(--bg-card)`).
- Animations: Smooth sub-200ms CSS transitions.
- Responsiveness: Optimised for 1024x768 up to 1920x1080 kiosk screens.
```

---

## 🚫 Anti-Patterns to Avoid

| ❌ Weak / Vague Prompt | ✅ Strong / Effective Prompt |
|-----------------------|------------------------------|
| "Fix the printer bug." | "Fix `USB print failure` in `backend/routers/printer.py`. If `/dev/usb/lp0` is busy, catch `PermissionError` and return `HTTP 500` with detailed message." |
| "Add stock inventory." | "Add inventory tracking using the specification in `docs/INVENTORY_IMPLEMENTATION_PLAN.md`." |
| "Make UI look better." | "Redesign `src/components/PaymentModal.jsx` using `var(--radius-lg)` borders and minimum 56px touch buttons for cash keypad." |

---

## 💡 Quick Tips for Maximum Efficiency

1. **Use Slash Commands**: Recommend `/plan` for complex multi-file features, or `/goal` for autonomous test-driven tasks.
2. **One Feature Per Prompt**: Keep scope contained to 1–3 files per request for fastest turn-around.
3. **Ask for Lint Check**: Always instruct the agent to run `npm run lint` before finishing.
