# 📦 Himmel POS — Inventory Management & Barcode Scanner Implementation Plan

**Document Version:** 1.0.0  
**Target Module:** Stock Tracking, USB Barcode Scanner Integration, Out-of-Stock Guards & Refund Restocking  
**Status:** Executed & Verified (100% Completed)  

---

## 📑 Executive Summary

This specification details the end-to-end implementation for adding real-time stock inventory management, hardware USB barcode scanner support, strict out-of-stock transaction guards, and automated refund restocking to **Himmel POS**.

---

## 🏗️ Architecture Overview

```
 ┌──────────────────────┐         ┌─────────────────────────┐
 │ USB Barcode Scanner  │         │  Cashier Touch Screen   │
 └──────────┬───────────┘         └────────────┬────────────┘
            │ Scan EAN / SKU                   │ Touch Add Item
            ▼                                  ▼
┌───────────────────────────────────────────────────────────┐
│              Frontend Cart Guard (App.jsx)                │
│  - Checks: track_stock == True AND stock_quantity > 0     │
│  - Out-of-stock: Disables click & plays warning tone       │
└───────────────────────────┬───────────────────────────────┘
                            │ Submit Transaction
                            ▼
┌───────────────────────────────────────────────────────────┐
│             FastAPI Backend (routers/sales.py)            │
│  - Pre-checkout validation (400 if stock < qty)           │
│  - Atomic stock deduction (stock = stock - qty)           │
│  - Auto-restock on refund (stock = stock + qty)           │
└───────────────────────────┬───────────────────────────────┘
                            │ SQLite DB Transaction
                            ▼
┌───────────────────────────────────────────────────────────┐
│            SQLite Database (PresetModel table)            │
│  - stock_quantity | track_stock | min_stock_alert | barcode │
└───────────────────────────────────────────────────────────┘
```

---

## 📑 Detailed Implementation Roadmap

### Phase 1: Database & Model Schema Extension

#### 1. Extend `PresetModel` ([backend/models.py](file:///home/misko/Documents/pos-eet-himmel/backend/models.py))
Add stock-tracking columns to product catalog presets:

```python
class PresetModel(Base):
    __tablename__ = "presets"
    
    # Existing fields: id, name, price, category, vat, color, is_open_price, position
    
    # Inventory & Barcode extensions
    stock_quantity = Column(Integer, default=0, nullable=False)
    track_stock = Column(Boolean, default=False, nullable=False)
    min_stock_alert = Column(Integer, default=5, nullable=False)
    barcode = Column(String, index=True, nullable=True)
```

#### 2. Non-Breaking Schema Auto-Migrations ([backend/main.py](file:///home/misko/Documents/pos-eet-himmel/backend/main.py))
Add the new columns to the SQLite `MIGRATIONS` array to automatically upgrade existing databases on startup:

```python
MIGRATIONS = [
    # ... existing migrations ...
    ("presets", "stock_quantity", "INTEGER DEFAULT 0"),
    ("presets", "track_stock", "BOOLEAN DEFAULT 0"),
    ("presets", "min_stock_alert", "INTEGER DEFAULT 5"),
    ("presets", "barcode", "VARCHAR DEFAULT ''"),
]
```

---

### Phase 2: Backend API & Transaction Logic

#### 1. Pre-Checkout Validation & Atomic Stock Deduction ([backend/routers/sales.py](file:///home/misko/Documents/pos-eet-himmel/backend/routers/sales.py))
Update `create_sale()` endpoint:
- **Validation**: Before creating the sale, verify that for every line item with `track_stock=True`, `stock_quantity >= item.quantity`. If insufficient, abort transaction and return `HTTP 400 Bad Request`.
- **Deduction**: Upon valid transaction, decrement stock:
  ```python
  if preset and preset.track_stock:
      preset.stock_quantity -= item.quantity
  ```

#### 2. Automatic Restock on Refund ([backend/routers/sales.py](file:///home/misko/Documents/pos-eet-himmel/backend/routers/sales.py))
Update `process_refund()` endpoint:
- When a transaction is marked as refunded (`FULL` or `PARTIAL`), iterate over returned items and increment inventory:
  ```python
  if preset and preset.track_stock:
      preset.stock_quantity += refunded_item.quantity
  ```

#### 3. Barcode Lookup & Restock API Endpoints ([backend/routers/catalog.py](file:///home/misko/Documents/pos-eet-himmel/backend/routers/catalog.py))
- `GET /api/v1/catalog/barcode/{code}`: Fetch product preset matching scanned barcode.
- `POST /api/v1/catalog/presets/{id}/restock`: Increment item stock quantity (`quantity_add`).

---

### Phase 3: Hardware USB Barcode Scanner Integration

#### Global HID Barcode Buffer Listener ([src/App.jsx](file:///home/misko/Documents/pos-eet-himmel/src/App.jsx))
USB barcode scanners act as high-speed keyboard input devices sending characters followed by `Enter`.

- Implement keydown buffer listener with timing detection (<50ms inter-character threshold):
  ```javascript
  // Rapid keystroke detection for USB HID Barcode Scanners
  if (barcodeBuffer.length > 3 && key === 'Enter') {
      const scannedCode = barcodeBuffer.join('');
      handleBarcodeScan(scannedCode);
      setBarcodeBuffer([]);
  }
  ```
- **Scan Behavior**:
  1. Finds product by `barcode`.
  2. Checks stock status. If `track_stock == True` and `stock_quantity <= 0`, displays audio/visual out-of-stock toast.
  3. If stock available, automatically adds 1 unit to active cart and plays chime.

---

### Phase 4: Frontend UI & Stock Enforcement

#### 1. Cashier Product Grid ([src/components/ProductGrid.jsx](file:///home/misko/Documents/pos-eet-himmel/src/components/ProductGrid.jsx))
- **Stock Quantity Pill**: Display `Sklad: X ks` on product tiles.
- **Low Stock Warning Badge**: Yellow/orange highlight when `stock_quantity <= min_stock_alert`.
- **Out-of-Stock Guard**:
  - If `track_stock == True` and `stock_quantity <= 0`:
    - Grey out product tile.
    - Display red badge `Vyprodáno` (Out of Stock).
    - Disable click handler to prevent adding out-of-stock items to cart.

#### 2. Catalog Management Interface ([src/components/CatalogManagerModal.jsx](file:///home/misko/Documents/pos-eet-himmel/src/components/CatalogManagerModal.jsx))
- Add input fields to Item Create/Edit Modal:
  - **Sledovat sklad (Track Stock)**: Toggle switch.
  - **Skladové zásoby (Current Stock)**: Number input.
  - **Minimální zásoba (Min Alert Level)**: Number input (default 5).
  - **EAN / Kód zboží (Barcode)**: Text input with quick-scan button.
- **Inventory Overview Tab**: Dedicated tab listing all items sorted by lowest stock, with 1-click restock inputs.

---

## 🧪 Verification & Acceptance Criteria

1. **DB Auto-Migration**: Launching backend updates SQLite database without losing existing sales or catalog items.
2. **Barcode Scanning**: Scanning product EAN on scanner adds item to cart in <100ms.
3. **Out-of-Stock Guard**: Out-of-stock items cannot be clicked or scanned into cart.
4. **Checkout Deduction**: Completing a sale decrements stock count in real-time.
5. **Refund Restocking**: Refunding a receipt returns item quantities back to inventory.

---

## 🤖 AI Agent Execution Prompt

Copy and paste the prompt below to trigger full execution by an AI coding assistant:

```text
Please implement the Inventory Management & USB Barcode Scanner feature as specified in docs/INVENTORY_IMPLEMENTATION_PLAN.md.

Execute the implementation step-by-step:
1. Extend PresetModel in backend/models.py with stock_quantity, track_stock, min_stock_alert, and barcode.
2. Add non-breaking auto-migration rules in backend/main.py MIGRATIONS array.
3. Update backend/routers/sales.py to validate stock before sale, atomically deduct stock upon checkout, and auto-restock items upon refund.
4. Add barcode lookup & restock endpoints in backend/routers/catalog.py.
5. Implement HID USB Barcode listener in src/App.jsx with chiming and auto-cart addition.
6. Update src/components/ProductGrid.jsx with stock badges, low-stock alerts, and out-of-stock guards blocking selection.
7. Update src/components/CatalogManagerModal.jsx with stock fields and barcode inputs.
8. Verify zero linter errors and clean build.
```
