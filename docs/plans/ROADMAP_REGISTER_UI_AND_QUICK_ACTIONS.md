# Roadmap: Register UI & Keypad Quick Action Dock

## 1. Overview
As part of the register ergonomics and touch-screen layout redesign, a dedicated **Bottom Action Dock** has been introduced directly below the manual keypad matrix (`KeypadNumberGrid`) in [`src/components/ManualKeypad.jsx`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/src/components/ManualKeypad.jsx).

Currently, this slot exists as a sleek, theme-blended placeholder slot (`+`) without assigned function or description, pre-architected as a responsive grid (`gridTemplateColumns: repeat(N, 1fr)`) ready for immediate activation or multi-button expansion.

---

## 2. Proposed Quick Menu / Dock Candidates

The following high-value actions have been identified for future assignment to the dock button or its associated popover menu:

### Priority 1: Cash Management & Hardware Operations
1. **Otevřít pokladní zásuvku (Kick Cash Drawer)**
   - *Behavior*: Sends ESC/POS pulse to the RJ11 cash drawer via `/api/v1/printer/open-drawer` without requiring an active sale.
   - *Use Case*: Fast cash changes, drawer counting, opening drawer for customer change.
2. **Vklad do pokladny (Cash In / Float)**
   - *Behavior*: Records cash drop / float into current shift balance without an EET receipt.
3. **Výběr z pokladny (Cash Out / Payout)**
   - *Behavior*: Records petty cash withdrawal or mid-shift bank deposit with reason note.
4. **Zkušební tisk / Feed (Thermal Printer Test & Paper Feed)**
   - *Behavior*: Tests paper roll feed and verifies printer connection status.

### Priority 2: Cart & Receipt Adjustments
5. **Sleva na celý nákup (Cart Discount Modal)**
   - *Behavior*: Opens the cart discount modal to apply percentage (%) or fixed CZK discount across all items.
6. **Poznámka k účtence (Custom Receipt Note)**
   - *Behavior*: Allows cashier to attach table number, customer name, or custom note onto the receipt.
7. **Rychlá vratka / Refundace (Refund Mode Toggle)**
   - *Behavior*: Toggles register into return/refund mode with distinct visual red indicator.
8. **Vysypat košík (Clear Cart Action)**
   - *Behavior*: 1-tap cart reset with confirmation prompt to prevent accidental clears.

### Priority 3: Shift Reporting & Security
9. **Mezisoučet směny (X-Report / Reading)**
   - *Behavior*: Displays on-screen summary or prints X-report slip of current turnover, cash, and card totals without closing the shift.
10. **Tisk denního souhrnu (Z-Report Slip)**
    - *Behavior*: 1-click thermal printout of the daily financial summary.
11. **Rychlé uzamčení pokladny (Lock Register)**
    - *Behavior*: Instantly locks screen to the PIN unlock keypad when leaving the register unattended.

---

## 3. Configuration & Customization Plan

In future milestones, merchants may configure the Bottom Action Dock via **Nastavení -> Pokladna**:
- **Single Master Button**: Opens a multi-action touch popover (e.g. Quick Menu).
- **Split Multi-Button Dock (2 to 3 buttons)**: Allows direct 1-tap assignment of the merchant's most frequent actions (e.g. `[ 💵 Zásuvka ] [ 🏷️ Sleva ] [ ⚡ Menu ]`).
- **Permission Guard**: Restrict sensitive actions (e.g. Cash Out, X-Report, Manual Drawer Kick) behind employee PIN roles (`admin` / `manager`).
