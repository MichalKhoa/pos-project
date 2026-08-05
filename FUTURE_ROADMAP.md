# Future Improvements & Roadmap (Himmel POS)

This document tracks feature requests, UI/UX refinements, and planned revisions for future development cycles.

---

## 📌 Backlog / Planned Future Refinements

### ↩️ 1-Tap "Undo / Storno" Mistake Guard & Safety Net
- **Target User**: Non-technical parents needing quick, stress-free mistake recovery.
- **Task**: Implement universal 1-tap undo toasts and safe cart recovery.
- **Planned Refinements**:
  1. **Item Addition Toast**: Show floating toast on item scan/tap (`Přidáno: [Název] — [ZPĚT]`) auto-dismissing after 4s. Tapping `ZPĚT` instantly reverts item addition.
  2. **Safe Clear Cart**: When "Vysypat košík" is tapped, preserve cart state in temporary memory for 8s with an `[Obnovit košík]` undo button.
  3. **Visual Cart Removal**: Add large, high-contrast touch targets for line deletion (`🗑️` / `-`) on cart rows to prevent mis-taps.

---

### 🔍 High-Legibility Mode & Giant Touch Targets
- **Target User**: Non-technical parents / touch screens with small display area.
- **Task**: Provide a dedicated UX density toggle in register header for high readability.
- **Planned Refinements**:
  1. **Size Boost**: 25% larger catalog tiles, cart item rows, and action keys.
  2. **Enhanced Contrast & Typography**: High-contrast text labels, bold price badges (e.g. 18pt+), and clear color coding per category.
  3. **Simplified Cart View**: Clean cart layout with explicit single-line rows, avoiding complex nested dropdowns during basic checkout.

---

### 🔒 Parent Shield Mode & Admin PIN Settings Lock
- **Target User**: Non-technical parents (prevents accidental misconfigurations).
- **Task**: Lock critical application settings behind a customizable Admin PIN.
- **Planned Refinements**:
  1. **Settings Lock**: Hide/lock Settings (`Nastavení`), EET certs, hardware printer configs, and catalog management behind a touch keypad PIN modal.
  2. **PIN Management**: Allow setting/changing the Admin PIN *only* inside Admin mode once authenticated.
  3. **Seamless Cashier Experience**: Parent register view stays clean and focused strictly on Register, Cart, and Sales operations without clutter or dangerous buttons.

---

### 🔊 Audio & Visual Scan Confirmation
- **Target User**: Non-technical parents needing instant tactile/auditory feedback.
- **Task**: Implement audio sound effects and visual flash cues for scanner and cart actions.
- **Planned Refinements**:
  1. **Scan Beep**: Crisp sound effect on successful barcode/SKU scan or item touch tap.
  2. **Sale Completed Chime**: Distinct cash register sound effect ("cha-ching") + full-screen green flash banner on successful checkout.
  3. **Error Buzz**: Soft low-pitch warning sound if a barcode is unrecognized or cart operation fails.
  4. **Volume Control**: Simple mute/volume toggle in top navbar.

---

### 💳 Integrated Card Terminal Reversal & Refund Workflow
- **Target User**: Retail store parents handling customer card returns.
- **Task**: Connect card refund transactions directly to payment terminal integration API.
- **Planned Refinements**:
  1. **Terminal Refund Dispatch**: When refunding a card payment, dispatch automated reversal/refund API call to hardware terminal (`/api/v1/payments/card-refund`).
  2. **Terminal Prompt Modal**: Show visual prompt asking customer to tap/insert card on terminal for refund processing.
  3. **Auth Code & Receipt Print**: Save terminal authorization code (`authCode`/`RRN`) on storno receipt and print physical card refund slip.

---

### 📱 SumUp Card Terminal Integration (SumUp Air / Solo)
- **Target User**: Retail store parents using SumUp mobile card readers.
- **Task**: Connect register directly to SumUp Bluetooth reader & Cloud REST API.
- **Planned Refinements**:
  1. **SumUp Configuration & Pairing**: Add SumUp provider option in Settings (`Nastavení` -> Card Terminals) with OAuth / API key authentication and reader pairing.
  2. **Automated Checkout Push**: Selecting "Karta" payment pushes charge amount directly to paired SumUp terminal (`/api/v1/payments/sumup/pay`).
  3. **Live Status & Auto-Close**: Show clear visual modal ("Přiložte kartu k SumUp...") and auto-close checkout once SumUp approves transaction.
  4. **SumUp Card Refunds**: Support direct SumUp card refunds from Sales History using transaction ID.

---

### 📐 Responsive Layout & Small Screen Alignment Overhaul
- **Target User**: Parents using compact POS screens, smaller desktop windows, or tablets.
- **Task**: Prevent UI element overlap and text crushing when window dimensions decrease.
- **Planned Refinements**:
  1. **Top Navbar Responsive Collapse**: Wrap/truncate status badges, language selector, and navigation tabs into a clean hamburger menu on viewports < 900px.
  2. **Register/Cart Flex Split**: Replace fixed side-by-side grids with fluid flex layout (`minmax(320px, 1fr)`), seamlessly switching to tabbed/stacked view on small screens.
  3. **Modal Boundary Guard**: Apply strict `max-height: 88vh` with auto-scrolling to all modals (Payment, Keypad, Settings, Sales History) to guarantee action buttons never spill offscreen.
  4. **Fluid Typography & Touch Spacing**: Implement `clamp()` fluid font sizing and container queries so buttons scale proportionally without overlapping adjacent elements.

---

*Last Updated: August 2026*





