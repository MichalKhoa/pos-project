# 📋 Himmel POS — Feature Prompt Questionnaire

Fill in this quick questionnaire when planning a new feature or expansion, then copy the generated section at the bottom to send to an AI assistant.

---

### 1. Feature Definition
- **Feature Name:** `[e.g. Discount Coupon System]`
- **User Story:** As a cashier, I want to `[e.g. enter a promo code at checkout]` so that `[e.g. customer gets 10% off cart]`.

---

### 2. Architecture & Components (Check all that apply)
- [ ] **Backend Database**: New table/columns in `backend/models.py`
- [ ] **Backend Router**: New API endpoints in `backend/routers/`
- [ ] **Frontend State**: Updates to `src/App.jsx` or `src/api/posApi.js`
- [ ] **Frontend UI**: New modal/view in `src/components/`
- [ ] **Hardware Protocol**: Thermal printer, barcode scanner, or CSOB terminal

---

### 3. Business Logic & Edge Cases
- **Offline Behavior:** `[e.g. Must cache promo codes locally when internet is offline]`
- **Out of Stock / Invalid State:** `[e.g. Show red alert if promo code is expired]`
- **Receipt Printing:** `[e.g. Print discount breakdown on receipt]`

---

### 4. Copy-Paste Generated Prompt

```text
Please implement [Feature Name] for Himmel POS based on these requirements:

Goal:
Allow cashiers to [User Story].

Scope:
- Backend: Update `backend/models.py` and `backend/routers/`.
- Frontend: Add UI in `src/components/` and helper in `src/api/posApi.js`.

Constraints:
1. Include non-breaking DB migrations in `backend/main.py` if new columns are added.
2. Support offline usage and 15-inch kiosk touchscreen interface (>=48px touch targets).
3. Add Czech translations in `src/i18n/translations.js`.

Verification:
- Run `npm run lint` and verify zero errors.
```
