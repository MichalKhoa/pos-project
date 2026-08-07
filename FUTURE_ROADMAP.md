# Future Improvements & Roadmap (Himmel POS)

This document tracks feature requests, UI/UX refinements, and planned revisions for future development cycles.

---

## ✅ Completed Improvements

### ↩️ 1-Tap "Undo / Storno" Mistake Guard & Safety Net — *COMPLETED*
- **Status**: Completed (August 2026)
- **Target User**: Non-technical parents needing quick, stress-free mistake recovery.
- **Task**: Implement universal 1-tap undo toasts and safe cart recovery.
- **Implemented Refinements**:
  1. **Item Scan/Add & Delete Toasts**: Floating 4s toast (`Přidáno: [Název] — [ZPĚT]` / `Smazáno: [Název] — [ZPĚT]`) with progress timer bar.
  2. **Safe Clear Cart**: When "Vysypat košík" is tapped, preserves cart state in temporary memory for 8s with inline `[Obnovit košík]` countdown banner.
  3. **Visual Cart Removal**: Added large, high-contrast touch targets for line deletion (`🗑️` / `-`) on cart rows.

### 🔍 High-Legibility Mode & Giant Touch Targets — *COMPLETED*
- **Status**: Completed (August 2026)
- **Target User**: Non-technical parents / touch screens with small display area.
- **Task**: Provide a dedicated UX density toggle in register settings for high readability.
- **Implemented Refinements**:
  1. **Size Boost**: 25% larger catalog tiles (min 84px height), cart item rows, and manual keypad action keys.
  2. **Enhanced Contrast & Typography**: High-contrast text labels, bold price badges (18pt+), and bold category badges.
  3. **Simplified Cart View**: Clean single-line cart row layout with 44px+ touch steppers and clear line totals.

### 🔒 Parent Shield Mode & Admin PIN Settings Lock — *COMPLETED*
- **Status**: Completed (August 2026)
- **Target User**: Non-technical parents (prevents accidental misconfigurations).
- **Task**: Lock critical application settings behind a customizable Admin PIN.
- **Implemented Refinements**:
  1. **Read-Only Settings Gate**: Modifying critical settings (EET certs, hardware printer, store profile) prompts a touch keypad PIN modal before saving.
  2. **2-Step Admin PIN Management**: Added "Bezpečnost & Správa Admin PIN" card in Settings with 2-step PIN change workflow (Current PIN -> New PIN -> Confirm).
  3. **Seamless Cashier Experience**: Destructive buttons (Delete Test Sale, Clear All Sales, Edit Category/Presets) are hidden when Admin Mode is OFF.

### 🔊 Audio & Visual Scan Confirmation — *COMPLETED*
- **Status**: Completed (August 2026)
- **Target User**: Non-technical parents needing instant tactile/auditory feedback.
- **Task**: Implement audio sound effects and visual flash cues for scanner and cart actions.
- **Implemented Refinements**:
  1. **Scan Beep**: Crisp Web Audio synthesized scan chime on all item barcode scans and preset touch taps.
  2. **Sale Completed Chime & Flash**: Cash register chime + full-width emerald green top flash banner ("Zaplaceno! [Částka] Kč") on completed checkout.
  3. **Volume Control**: 1-tap `Volume2` / `VolumeX` mute button in top navbar, saved in `localStorage`.

---

## 📌 Backlog / Planned Future Refinements

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

### 📐 Responsive Layout & Small Screen Alignment Overhaul — *COMPLETED*
- **Status**: Completed (August 2026)
- **Target User**: Parents using compact POS screens, smaller desktop windows, or tablets.
- **Task**: Prevent UI element overlap and text crushing when window dimensions decrease.
- **Implemented Refinements**:
  1. **Top Navbar Responsive Collapse & Phone Drawer**: Hamburger menu drawer (`Menu` / `X`) on viewports < 900px containing all main view tabs (Pokladna, Sklad, Katalog, Historie, Nastavení) and status tools with 1-tap auto-close.
  2. **Register 2-Column Flex Split**: Fluid 2-column flex layout (Product Grid + Cart) for 768px–1100px viewports.
  3. **Hybrid Modal Height Guard**: `max-height: 88vh` with inner scrolling on tablets; full-screen `100vh` modals with sticky footers on mobile screens (< 640px).
  4. **Fluid Typography**: Applied CSS `clamp()` fluid font sizing across action buttons and displays.

### 📱 Comprehensive Phone View & Touch Panel Overflow Overhaul
- **Target User**: Cashiers / Store parents using smartphones or compact handheld POS devices (< 640px).
- **Task**: Deep overhaul of phone layout, panel scrolling, and touch target bounds to eliminate content overflow.
- **Planned Refinements**:
  1. **Single-Column Tab Switcher**: Complete single-column isolation for Keypad, Products Grid, and Cart with zero horizontal scroll leakage.
  2. **Panel Scroll Isolation**: Enforce independent vertical scrolling (`overflow-y: auto`, `-webkit-overflow-scrolling: touch`) on each individual mobile panel.
  3. **Touch Card Padding & Alignment**: Recalculate tile sizes, action bar margins, and modal paddings specifically for small mobile screens.
  4. **Overflow Clip Safety**: Enforce `max-width: 100vw; overflow-x: hidden;` across all main view containers.

---

*Last Updated: August 2026*





