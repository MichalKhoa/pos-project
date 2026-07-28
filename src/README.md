# Himmel POS - React 19 Frontend Documentation

This directory contains the user interface for **Himmel POS**, built with **React 19** and **Vite**. The frontend is engineered specifically for fast, error-free operation on touchscreens, offering real-time cart manipulation, multi-payment options, receipt generation, sales history management, product catalog administration, and store settings configuration.

---

## 📂 Frontend Directory Structure

```
src/
├── api/
│   └── posApi.js               # API service connecting to FastAPI backend
├── assets/                     # Application logos and static assets
├── components/
│   ├── Cart.jsx                # Shopping cart view with item & global discount controls
│   ├── ManualKeypad.jsx        # Touchpad keymat for direct custom price & name input
│   ├── Navbar.jsx              # Navigation header bar with EET status & tab switcher
│   ├── PaymentModal.jsx        # Payment dialog supporting Cash, Card, QR, and Split
│   ├── PresetsCatalogView.jsx  # Product and category CRUD management interface
│   ├── QuickPresetGrid.jsx     # Quick-access product catalog grid with category filters
│   ├── ReceiptModal.jsx        # Printable thermal receipt preview dialog
│   ├── SalesHistoryView.jsx    # Sales ledger table with EET retry, search, and CSV export
│   └── SettingsView.jsx        # Store configuration, hardware, and EET cert management
├── data/
│   └── initialData.js          # Default initial categories, preset items, and store info
├── App.css                     # Component layout, grids, modals, and responsive styling
├── App.jsx                     # Top-level state orchestrator and active view router
├── index.css                   # Global CSS design tokens, color palettes, and typography
└── main.jsx                    # React app initialization and DOM root mounting
```

---

## 🧩 Component Architecture

### 1. [`App.jsx`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/src/App.jsx)
- **Role**: Core application state container and router.
- **State Managed**:
  - `activeTab`: Controls active screen (`register`, `sales`, `catalog`, `settings`).
  - `cart`: Array of items currently selected in cart with quantity, unit price, VAT, and custom discount.
  - `cartDiscount`: Percentage discount applied globally to cart total (0%, 5%, 10%, 15%, 20%).
  - `categories` / `presets`: Product catalog items with fallback to initial defaults and persistent sync to `localStorage`.
  - `storeConfig`: Store details (IČO, DIČ, business premises) synced to `localStorage`.
  - `salesHistory`: Historical sales records synced to `localStorage`.
- **EET Connection**: Polls backend `/api/v1/eet/status` periodically to update connection badge.

---

### 2. Register View Components

#### [`Navbar.jsx`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/src/components/Navbar.jsx)
- Top navigation bar containing app branding, view selector tabs, real-time EET status badge (`Online`, `Offline`, `Playground`), and current date/time ticker.

#### [`QuickPresetGrid.jsx`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/src/components/QuickPresetGrid.jsx)
- Grid layout displaying touch-friendly product buttons with color badges, item prices, and VAT rates.
- Includes category pill filter buttons and live text search input for fast product discovery.

#### [`ManualKeypad.jsx`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/src/components/ManualKeypad.jsx)
- Numeric keypad allowing cashiers to quickly add unlisted or custom items by typing monetary amounts.
- Includes quick tax rate selectors (21% Standard, 12% Reduced, 0% Zero) and custom item name field.

#### [`Cart.jsx`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/src/components/Cart.jsx)
- Displays current shopping cart list with item quantity increment/decrement controls, per-item percentage discounts, and item removal actions.
- Displays summary statistics: Subtotal, total VAT amount, applied cart discount, and final amount due.
- Contains global cart discount selector buttons and clear cart / checkout action triggers.

---

### 3. Payment & Receipt Modals

#### [`PaymentModal.jsx`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/src/components/PaymentModal.jsx)
- Interactive checkout dialog supporting four distinct payment workflows:
  1. **Hotovost (Cash)**: Cash tendered input with quick denomination buttons (+100, +200, +500, +1000 CZK, Exact) and calculated change due.
  2. **Karta (Card)**: Card terminal confirmation workflow.
  3. **QR Platba (QR Payment)**: Generates Czech Short Payment Descriptor (SPD) QR payload and QR image for instant mobile bank transfer.
  4. **Kombinovaná (Split Payment)**: Allows splitting order total between cash and card amounts.
- Triggers transaction saving and EET signing via backend API.

#### [`ReceiptModal.jsx`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/src/components/ReceiptModal.jsx)
- Displays formatted thermal receipt preview including store details, receipt number, itemized rows, tax summary table, and EET fiscal signatures (FIK, BKP, PKP).
- Actions: Direct physical thermal print via `python-escpos` backend, browser window print, and receipt text copy.

---

### 4. Admin & Backoffice Views

#### [`SalesHistoryView.jsx`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/src/components/SalesHistoryView.jsx)
- Comprehensive sales ledger view listing past completed transactions.
- Filter by payment method, search by receipt number, filter by date range.
- Shows EET fiscal status for each sale (`EVD_OK`, `OFFLINE_PENDING`, `VERIFIED_ONLY`).
- Allows manual re-submission of pending EET transactions to Finanční správa ČR.
- Export transaction records to CSV file.

#### [`PresetsCatalogView.jsx`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/src/components/PresetsCatalogView.jsx)
- Interface for adding, editing, and deleting product categories and preset product items.
- Configurable fields: Product name, price, category, VAT rate (21%, 12%, 0%), SKU code, and color badge.

#### [`SettingsView.jsx`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/src/components/SettingsView.jsx)
- Store metadata settings: Business name, address, IČO, DIČ, register ID (`id_pokl`), premises ID (`id_provozovny`).
- Hardware ESC/POS settings: Interface mode (USB, Serial, Network), device path / IP address, receipt header and footer text.
- Czech EET 2.0 settings: Certificate `.p12` file path, password, environment (`playground` vs `production`).
- LocalStorage backup download and JSON restore utilities.

---

## 💾 LocalStorage Persistence Keys

The application uses standard `localStorage` keys to persist client state across browser restarts:

| Key | Description | Default Fallback |
| :--- | :--- | :--- |
| `himmel_pos_categories` | Array of product categories | `DEFAULT_CATEGORIES` in [`initialData.js`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/src/data/initialData.js) |
| `himmel_pos_presets` | Array of quick-preset products | `DEFAULT_PRESETS` in [`initialData.js`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/src/data/initialData.js) |
| `himmel_pos_config` | Store & hardware configuration | `DEFAULT_STORE_CONFIG` in [`initialData.js`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/src/data/initialData.js) |
| `himmel_pos_sales` | Sales history ledger array | Initial sample transaction |

---

## 📡 API Service Layer ([`posApi.js`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/src/api/posApi.js))

The API service abstracts communicate with the Python FastAPI backend running at `http://localhost:8000`:

- **`createSaleBackend(saleData)`**: Posts transaction details to `/api/v1/sales/` for SQLite persistence and EET signing.
- **`fetchEetStatus()`**: Queries `/api/v1/eet/status` to determine online status and certificate loading.
- **`printReceiptBackend(saleData, storeConfig)`**: Sends print job payload to `/api/v1/printer/print`.
- **`resendEetBackend(saleId)`**: Triggers manual EET re-sending for offline pending sales via `/api/v1/eet/resend/{id}`.
- **`generateQrStringBackend(paymentInfo)`**: Generates Czech SPD format string via `/api/v1/payments/generate-qr-string`.

*Graceful Degradation*: If backend calls fail due to network or server unavailability, `posApi.js` catches errors gracefully and allows local client processing.

---

## 🎨 Design System & CSS Variables ([`index.css`](file:///c:/Users/micha/Documents/GitHub/pos-project-himmel/src/index.css))

The UI relies on vanilla CSS custom properties (variables) defining dark glassmorphism styling and vibrant color accents:

```css
:root {
  --bg-dark: #0f172a;
  --bg-card: #1e293b;
  --accent-primary: #6366f1;
  --accent-success: #10b981;
  --accent-warning: #f59e0b;
  --accent-danger: #ef4444;
  --text-main: #f8fafc;
  --text-muted: #94a3b8;
}
```

---

## 🛠️ Development Scripts

```bash
# Start development server with HMR
npm run dev

# Production build output to /dist
npm run build

# Preview production build locally
npm run preview

# Run Oxlint linting
npm run lint
```
