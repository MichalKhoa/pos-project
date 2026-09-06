export function getApiHost() {
  if (typeof window === 'undefined') return '127.0.0.1';
  const hostname = window.location.hostname;
  if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1' || hostname === 'tauri.localhost') {
    return '127.0.0.1';
  }
  return hostname;
}

const API_HOST = getApiHost();
const API_BASE_URL = `http://${API_HOST}:8000/api/v1`;

/**
 * Fetch backend root status
 */
export async function fetchBackendRoot() {
  try {
    const res = await fetch(`${API_BASE_URL}/status`);
    if (!res.ok) return { online: false };
    const data = await res.json();
    return { online: true, ...data };
  } catch (err) {
    return { online: false, error: err.message };
  }
}

/**
 * Fetch EET Status and Certificate metadata from backend
 */
export async function fetchEetStatus() {
  try {
    const res = await fetch(`${API_BASE_URL}/eet/status`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Backend EET status unavailable:', err);
    return null;
  }
}

/**
 * Run verification request (overeni = true) against Finanční správa ČR
 */
export async function verifyEetConnection() {
  try {
    const res = await fetch(`${API_BASE_URL}/eet/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    return {
      status: 'ERROR',
      detail: `Nepodařilo se připojit k Python backendu (http://localhost:8000). Chyba: ${err.message}`
    };
  }
}

/**
 * Upload a PKCS#12 (.p12) merchant certificate file to backend
 */
export async function uploadEetCert(file, password = '', environment = 'playground') {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('password', password);
    formData.append('environment', environment);

    const res = await fetch(`${API_BASE_URL}/eet/upload-cert`, {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || `Chyba při nahrávání certifikátu (${res.status})`);
    }
    return data;
  } catch (err) {
    return {
      status: 'ERROR',
      message: err.message
    };
  }
}

/**
 * Flush offline sales queue in backend
 */
export async function processEetQueue() {
  try {
    const res = await fetch(`${API_BASE_URL}/eet/process-queue`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    return {
      status: 'ERROR',
      message: err.message
    };
  }
}

/**
 * Create a new sale transaction in backend (runs EET fiscalization & database save)
 */
export async function createSaleBackend(saleData) {
  try {
    const res = await fetch(`${API_BASE_URL}/sales/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(saleData)
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Backend sale submission failed, fallback to local standalone mode:', err);
    return null;
  }
}

/**
 * Helper to normalize sale object keys across frontend (camelCase) and backend (snake_case)
 */
export function normalizeSale(sale) {
  if (!sale) return sale;

  let rawItems = sale.items || sale.sale_items || sale.cart_items || [];
  if (typeof rawItems === 'string') {
    try {
      rawItems = JSON.parse(rawItems);
    } catch {
      rawItems = [];
    }
  }

  const normalizedItems = Array.isArray(rawItems) ? rawItems.map((item, idx) => ({
    ...item,
    id: item.id || item.item_id || `item-${idx}`,
    name: item.name || item.title || item.item_name || 'Položka',
    price: item.price !== undefined ? parseFloat(item.price) : (item.unit_price !== undefined ? parseFloat(item.unit_price) : 0),
    quantity: item.quantity !== undefined ? parseInt(item.quantity, 10) : (item.qty !== undefined ? parseInt(item.qty, 10) : 1),
    vat: item.vat !== undefined ? parseInt(item.vat, 10) : (item.vat_rate !== undefined ? parseInt(item.vat_rate, 10) : 21),
    discountPercent: item.discountPercent !== undefined ? parseFloat(item.discountPercent) : (item.discount_percent !== undefined ? parseFloat(item.discount_percent) : 0),
    discount_percent: item.discount_percent !== undefined ? parseFloat(item.discount_percent) : (item.discountPercent !== undefined ? parseFloat(item.discountPercent) : 0),
    refundedQuantity: item.refundedQuantity !== undefined ? parseInt(item.refundedQuantity, 10) : (item.refunded_quantity !== undefined ? parseInt(item.refunded_quantity, 10) : 0),
    refunded_quantity: item.refunded_quantity !== undefined ? parseInt(item.refunded_quantity, 10) : (item.refundedQuantity !== undefined ? parseInt(item.refundedQuantity, 10) : 0),
    remainingQuantity: item.remainingQuantity !== undefined ? parseInt(item.remainingQuantity, 10) : (item.remaining_quantity !== undefined ? parseInt(item.remaining_quantity, 10) : (item.quantity !== undefined ? parseInt(item.quantity, 10) : 1)),
    remaining_quantity: item.remaining_quantity !== undefined ? parseInt(item.remaining_quantity, 10) : (item.remainingQuantity !== undefined ? parseInt(item.remainingQuantity, 10) : (item.quantity !== undefined ? parseInt(item.quantity, 10) : 1))
  })) : [];

  return {
    ...sale,
    id: sale.id,
    receiptNumber: sale.receiptNumber || sale.receipt_number || 'N/A',
    receipt_number: sale.receipt_number || sale.receiptNumber || 'N/A',
    timestamp: sale.timestamp || new Date().toISOString(),
    totalAmount: sale.totalAmount !== undefined ? parseFloat(sale.totalAmount) : (sale.total_amount !== undefined ? parseFloat(sale.total_amount) : 0),
    total_amount: sale.total_amount !== undefined ? parseFloat(sale.total_amount) : (sale.totalAmount !== undefined ? parseFloat(sale.totalAmount) : 0),
    paymentMethod: sale.paymentMethod || sale.payment_method || 'cash',
    payment_method: sale.payment_method || sale.paymentMethod || 'cash',
    cartDiscountPercent: sale.cartDiscountPercent !== undefined ? parseFloat(sale.cartDiscountPercent) : (sale.cart_discount_percent !== undefined ? parseFloat(sale.cart_discount_percent) : 0),
    splitDetails: sale.splitDetails || sale.split_details || null,
    tenderedAmount: sale.tenderedAmount !== undefined ? parseFloat(sale.tenderedAmount) : (sale.tendered_amount !== undefined ? parseFloat(sale.tendered_amount) : 0),
    changeDue: sale.changeDue !== undefined ? parseFloat(sale.changeDue) : (sale.change_due !== undefined ? parseFloat(sale.change_due) : 0),
    taxSummary: sale.taxSummary || sale.tax_summary || {},
    fikCode: sale.fikCode || sale.fik_code || sale.fik || null,
    bkpCode: sale.bkpCode || sale.bkp_code || sale.bkp || null,
    pkpCode: sale.pkpCode || sale.pkp_code || sale.pkp || null,
    fik_code: sale.fik_code || sale.fikCode || sale.fik || null,
    bkp_code: sale.bkp_code || sale.bkpCode || sale.bkp || null,
    pkp_code: sale.pkp_code || sale.pkpCode || sale.pkp || null,
    eet_status: sale.eet_status || sale.eetStatus || 'EVD_OK',
    eetStatus: sale.eetStatus || sale.eet_status || 'EVD_OK',
    isRefund: sale.isRefund !== undefined ? sale.isRefund : (sale.is_refund !== undefined ? sale.is_refund : false),
    is_refund: sale.is_refund !== undefined ? sale.is_refund : (sale.isRefund !== undefined ? sale.isRefund : false),
    originalReceiptNumber: sale.originalReceiptNumber || sale.original_receipt_number || null,
    original_receipt_number: sale.original_receipt_number || sale.originalReceiptNumber || null,
    refundReason: sale.refundReason || sale.refund_reason || null,
    refund_reason: sale.refund_reason || sale.refundReason || null,
    refundStatus: sale.refundStatus || sale.refund_status || 'NONE',
    refund_status: sale.refund_status || sale.refundStatus || 'NONE',
    refundedAmount: sale.refundedAmount !== undefined ? parseFloat(sale.refundedAmount) : (sale.refunded_amount !== undefined ? parseFloat(sale.refunded_amount) : 0),
    refunded_amount: sale.refunded_amount !== undefined ? parseFloat(sale.refunded_amount) : (sale.refundedAmount !== undefined ? parseFloat(sale.refundedAmount) : 0),
    items: normalizedItems
  };
}

/**
 * Update refund status & refunded amount in backend SQLite DB
 */
export async function updateSaleRefundStatusBackend(saleId, refundStatus, refundedAmount) {
  try {
    const res = await fetch(`${API_BASE_URL}/sales/${saleId}/refund-status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refund_status: refundStatus, refunded_amount: refundedAmount })
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Failed to update refund status in backend:', err);
    return null;
  }
}

/**
 * Delete a single test sale transaction from backend SQLite DB (Admin Mode)
 */
export async function deleteSaleBackend(saleId, pin = '') {
  try {
    const headers = {
      'Content-Type': 'application/json',
      'X-Admin-Override': 'true'
    };
    if (pin) headers['X-Admin-PIN'] = pin;
    const res = await fetch(`${API_BASE_URL}/sales/${saleId}`, {
      method: 'DELETE',
      headers
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`Failed to delete sale ${saleId} in backend:`, err);
    return null;
  }
}

/**
 * Purge ALL test sales transactions from backend SQLite DB (Admin Mode)
 */
export async function purgeAllSalesBackend(pin = '') {
  try {
    const headers = {
      'Content-Type': 'application/json',
      'X-Admin-Override': 'true'
    };
    if (pin) headers['X-Admin-PIN'] = pin;
    const res = await fetch(`${API_BASE_URL}/sales/purge-all`, {
      method: 'DELETE',
      headers
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Failed to purge all test sales in backend:', err);
    return null;
  }
}

/**
 * Fetch sale details by receipt number (case-insensitive) with remaining refundable tracking
 */
export async function fetchSaleByReceiptNumber(receiptNumber) {
  if (!receiptNumber) return null;
  try {
    const cleanNum = encodeURIComponent(receiptNumber.trim());
    const res = await fetch(`${API_BASE_URL}/sales/by-receipt/${cleanNum}`);
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`HTTP error ${res.status}`);
    }
    const data = await res.json();
    return data ? normalizeSale(data) : null;
  } catch (err) {
    console.warn(`Failed to fetch sale by receipt number ${receiptNumber}:`, err);
    return null;
  }
}

/**
 * Fetch sales history ledger from backend with optional pagination, search, and filtering
 */
export async function fetchSalesHistoryBackend(options = {}) {
  try {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.append('limit', options.limit);
    if (options.offset !== undefined) params.append('offset', options.offset);
    if (options.fromDate) params.append('from_date', options.fromDate);
    if (options.toDate) params.append('to_date', options.toDate);
    if (options.paymentMethod && options.paymentMethod !== 'all') params.append('payment_method', options.paymentMethod);
    if (options.docType && options.docType !== 'all') params.append('doc_type', options.docType);
    if (options.search) params.append('search', options.search);
    if (options.exportAll) params.append('export_all', 'true');
    if (options.includeItems !== undefined) params.append('include_items', options.includeItems);

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_BASE_URL}/sales/${queryString}`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    const normalized = Array.isArray(data) ? data.map(normalizeSale) : [];

    const totalCountHeader = res.headers.get('X-Total-Count');
    normalized.totalCount = totalCountHeader ? parseInt(totalCountHeader, 10) : normalized.length;

    if (options.returnDetails) {
      return {
        sales: normalized,
        totalCount: normalized.totalCount
      };
    }

    return normalized;
  } catch (err) {
    console.warn('Backend sales history unavailable:', err);
    return null;
  }
}

/**
 * Fetch daily sales statistics grouped by date (for CalendarModal)
 */
export async function fetchDailySalesStats({ month = null, fromDate = null, toDate = null } = {}) {
  try {
    const params = new URLSearchParams();
    if (month) params.append('month', month);
    if (fromDate) params.append('from_date', fromDate);
    if (toDate) params.append('to_date', toDate);

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_BASE_URL}/sales/stats/daily${queryString}`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Daily sales stats unavailable:', err);
    return null;
  }
}

/**
 * Fetch shift / today sales statistics (for ShiftStatsWidget)
 */
export async function fetchShiftStats(dateStr = null) {
  try {
    const params = dateStr ? `?date_str=${dateStr}` : '';
    const res = await fetch(`${API_BASE_URL}/sales/stats/shift${params}`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Shift sales stats unavailable:', err);
    return null;
  }
}


/**
 * Safely request backend service shutdown at end of cashier shift
 */
export async function shutdownBackend() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 800);
    const res = await fetch(`${API_BASE_URL}/system/shutdown`, {
      method: 'POST',
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return res.ok;
  } catch (err) {
    console.warn('Backend shutdown request executed/timed out:', err);
    return true;
  }
}

/**
 * Send print receipt request to backend hardware thermal printer service
 */
export async function printReceiptBackend(saleData, storeConfig) {
  try {
    const res = await fetch(`${API_BASE_URL}/printer/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ saleData, storeConfig })
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Physical hardware printer unavailable:', err);
    return null;
  }
}

/**
 * Send print daily summary slip request to backend hardware thermal printer service
 */
export async function printDailySummaryBackend(summaryData, storeConfig, openDrawer = true) {
  try {
    const res = await fetch(`${API_BASE_URL}/printer/print-daily-summary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summaryData, storeConfig, openDrawer })
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Daily summary thermal printing failed or backend offline:', err);
    return null;
  }
}

/**
 * Send print barcode shelf label request to backend hardware thermal printer service
 */
export async function printBarcodeLabelBackend(itemData, copies = 1, storeConfig = {}) {
  try {
    const res = await fetch(`${API_BASE_URL}/printer/print-label`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemData, storeConfig, copies })
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Barcode label thermal printing failed or backend offline:', err);
    return null;
  }
}

/**
 * Trigger physical cash drawer release pulse via printer service
 */
export async function openCashDrawerBackend() {
  try {
    const res = await fetch(`${API_BASE_URL}/printer/open-drawer`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Physical cash drawer pulse failed or backend offline:', err);
    return { success: true, physical: false, status: 'SIMULATED' };
  }
}


/**
 * Scan and fetch list of connected hardware printer devices from backend
 */
export async function fetchPrinterDevices() {
  try {
    const res = await fetch(`${API_BASE_URL}/printer/devices`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    return data?.devices || [];
  } catch (err) {
    console.warn('Failed to scan printer devices:', err);
    return [];
  }
}

/**
 * Fetch product categories from backend database
 */
export async function fetchCategoriesBackend() {
  try {
    const res = await fetch(`${API_BASE_URL}/catalog/categories`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Backend categories unavailable:', err);
    return null;
  }
}

/**
 * Save/update a category in backend database
 */
export async function saveCategoryBackend(category) {
  try {
    const res = await fetch(`${API_BASE_URL}/catalog/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(category)
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Failed to save category to backend:', err);
    return null;
  }
}

/**
 * Delete a category in backend database
 */
export async function deleteCategoryBackend(catId) {
  try {
    const res = await fetch(`${API_BASE_URL}/catalog/categories/${catId}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Failed to delete category in backend:', err);
    return null;
  }
}

/**
 * Bulk reorder categories in backend database
 */
export async function reorderCategoriesBackend(categories) {
  try {
    const res = await fetch(`${API_BASE_URL}/catalog/categories/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categories })
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Failed to reorder categories in backend:', err);
    return null;
  }
}

/**
 * Fetch presets from backend database
 */
export async function fetchPresetsBackend() {
  try {
    const res = await fetch(`${API_BASE_URL}/catalog/presets`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Backend presets unavailable:', err);
    return null;
  }
}

/**
 * Save/update a preset in backend database
 */
export async function savePresetBackend(preset) {
  try {
    const res = await fetch(`${API_BASE_URL}/catalog/presets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(preset)
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Failed to save preset to backend:', err);
    return null;
  }
}

/**
 * Bulk save/update presets in backend database (e.g. from CSV import)
 */
export async function bulkSavePresetsBackend(presets) {
  try {
    const res = await fetch(`${API_BASE_URL}/catalog/presets/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(presets)
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Failed to bulk save presets to backend:', err);
    return null;
  }
}

/**
 * Bulk reorder presets in backend database
 */
export async function reorderPresetsBackend(presets) {
  try {
    const res = await fetch(`${API_BASE_URL}/catalog/presets/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presets })
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Failed to reorder presets in backend:', err);
    return null;
  }
}

/**
 * Delete a preset in backend database
 */
export async function deletePresetBackend(presetId) {
  try {
    const res = await fetch(`${API_BASE_URL}/catalog/presets/${presetId}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Failed to delete preset in backend:', err);
    return null;
  }
}

/**
 * 1-Tap toggle: Pin or unpin a preset to/from register touchscreen
 */
export async function togglePresetPinBackend(presetId) {
  try {
    const res = await fetch(`${API_BASE_URL}/catalog/presets/${presetId}/toggle-pin`, {
      method: 'PATCH'
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Failed to toggle preset pin in backend:', err);
    return null;
  }
}

/**
 * Fetch Git system update status from backend
 */
export async function fetchUpdateStatus() {
  try {
    const res = await fetch(`${API_BASE_URL}/update/status`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Backend update status unavailable:', err);
    return null;
  }
}

/**
 * Trigger remote system update & restart from backend
 */
export async function applySystemUpdate() {
  try {
    const res = await fetch(`${API_BASE_URL}/update/apply`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('System update application failed:', err);
    return null;
  }
}

/**
 * Fetch ČSOB Ingenico Move 3500 terminal configuration from backend
 */
export async function fetchTerminalConfig() {
  try {
    const res = await fetch(`${API_BASE_URL}/payments/terminal/config`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Terminal config unavailable:', err);
    return null;
  }
}

/**
 * Save ČSOB terminal settings to backend SQLite database
 */
export async function saveTerminalConfig(terminalConfig) {
  try {
    const res = await fetch(`${API_BASE_URL}/payments/terminal/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(terminalConfig)
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Failed to save terminal config:', err);
    return { status: 'ERROR', message: err.message };
  }
}

/**
 * Test TCP connection (ping) to ČSOB terminal IP & Port
 */
export async function pingTerminal(ip = null, port = null) {
  try {
    const res = await fetch(`${API_BASE_URL}/payments/terminal/ping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, port })
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    return { success: false, status: 'ERROR', message: err.message };
  }
}

/**
 * Send payment transaction to ČSOB payment terminal
 */
export async function payWithTerminal(amount, variableSymbol = '') {
  try {
    const res = await fetch(`${API_BASE_URL}/payments/terminal/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, variableSymbol })
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    return { success: false, status: 'CONNECTION_ERROR', message: err.message };
  }
}

/**
 * Send end-of-day reconciliation command (uzávěrka) to ČSOB terminal
 */
export async function reconcileTerminal() {
  try {
    const res = await fetch(`${API_BASE_URL}/payments/terminal/reconcile`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    return { success: false, status: 'ERROR', message: err.message };
  }
}

/**
 * Fetch store configuration settings from SQLite database backend
 */
export async function fetchStoreConfigBackend() {
  try {
    const res = await fetch(`${API_BASE_URL}/config`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Backend store config unavailable:', err);
    return null;
  }
}

/**
 * Save store configuration settings to SQLite database backend
 */
export async function saveStoreConfigBackend(storeConfig) {
  try {
    const res = await fetch(`${API_BASE_URL}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(storeConfig)
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Failed to save store config to backend DB:', err);
    return { status: 'ERROR', message: err.message };
  }
}

/**
 * Verify cashier PIN against hashed value in backend database
 * @returns {Promise<{valid: boolean}>} - valid=true on success, throws on failure
 */
export async function verifyPinBackend(pin) {
  try {
    const res = await fetch(`${API_BASE_URL}/config/verify-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin })
    });
    if (res.status === 401) return { valid: false };
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('PIN verification failed (backend offline, falling back):', err);
    return { valid: null, error: err.message };
  }
}

/**
 * Verify Technician/Admin PIN against backend (/config/verify-admin-pin)
 * @param {string} pin - 4+ digit PIN or Master Recovery Key
 * @returns {Promise<{valid: boolean, is_master?: boolean, error?: string}>}
 */
export async function verifyAdminPinBackend(pin) {
  try {
    const res = await fetch(`${API_BASE_URL}/config/verify-admin-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin })
    });
    if (res.status === 401 || res.status === 403) return { valid: false };
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Admin PIN verification failed (backend offline, falling back):', err);
    return { valid: null, error: err.message };
  }
}

/**
 * Verify Master Recovery Code (PUK) to reset PIN to 1234
 */
export async function verifyPukBackend(puk) {
  try {
    const res = await fetch(`${API_BASE_URL}/config/verify-puk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ puk })
    });
    if (res.status === 401) return { valid: false };
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

/**
 * Fetch Litestream replication status and SQLite WAL metrics
 */
export async function fetchLitestreamStatus() {
  try {
    const res = await fetch(`${API_BASE_URL}/system/litestream-status`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Litestream status check failed:', err);
    return null;
  }
}

/**
 * Broadcast display event to secondary customer screens / phone displays
 */
export async function broadcastCustomerDisplay(payload) {
  try {
    const res = await fetch(`${API_BASE_URL}/display/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Failed to broadcast customer display payload:', err);
    return null;
  }
}

/**
 * Fetch SQLite database backup metrics and last snapshot time
 */
export async function fetchDatabaseBackupStatus() {
  try {
    const res = await fetch(`${API_BASE_URL}/system/backup-status`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Failed to fetch database backup status:', err);
    return null;
  }
}

/**
 * Trigger immediate online SQLite database backup snapshot (.zip)
 */
export async function triggerDatabaseBackup() {
  try {
    const res = await fetch(`${API_BASE_URL}/system/trigger-backup`, {
      method: 'POST'
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `HTTP error ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.error('Failed to trigger database backup:', err);
    return { status: 'ERROR', message: err.message };
  }
}

/**
 * Fetch available database backup archive files
 */
export async function fetchDatabaseBackups() {
  try {
    const res = await fetch(`${API_BASE_URL}/system/backups`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Failed to list database backups:', err);
    return [];
  }
}

/**
 * Restore SQLite database from selected backup archive
 */
export async function restoreDatabaseBackup(filename) {
  try {
    const res = await fetch(`${API_BASE_URL}/system/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename })
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `HTTP error ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.error('Failed to restore database backup:', err);
    return { status: 'ERROR', message: err.message };
  }
}

/**
 * Fetch cloud backup configuration and sync status
 * @param {string|null} pin - Technician Admin PIN or master key
 */
export async function fetchCloudBackupStatus(pin = null) {
  try {
    const headers = {};
    if (pin) headers['X-Admin-PIN'] = pin;
    const res = await fetch(`${API_BASE_URL}/system/cloud-backup/status`, { headers });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `HTTP error ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.warn('Failed to fetch cloud backup status:', err);
    return { status: 'ERROR', message: err.message };
  }
}

/**
 * Test S3/R2 cloud storage connectivity
 * @param {Object} payload - { endpoint, bucket, access_key, secret_key, region_name }
 * @param {string|null} pin - Technician Admin PIN or master key
 */
export async function testCloudBackupConnection(payload = {}, pin = null) {
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (pin) headers['X-Admin-PIN'] = pin;
    const res = await fetch(`${API_BASE_URL}/system/cloud-backup/test`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `HTTP error ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.error('Failed to test cloud backup connection:', err);
    return { status: 'ERROR', message: err.message };
  }
}

/**
 * Configure and save cloud backup settings
 * @param {Object} payload - { enabled, endpoint, bucket, access_key, secret_key, prefix, retention_days }
 * @param {string|null} pin - Technician Admin PIN or master key
 */
export async function configureCloudBackup(payload, pin = null) {
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (pin) headers['X-Admin-PIN'] = pin;
    const res = await fetch(`${API_BASE_URL}/system/cloud-backup/configure`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `HTTP error ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.error('Failed to configure cloud backup:', err);
    return { status: 'ERROR', message: err.message };
  }
}

/**
 * Trigger immediate snapshot creation and cloud upload
 * @param {string|null} pin - Technician Admin PIN or master key
 */
export async function triggerCloudBackupUpload(pin = null) {
  try {
    const headers = {};
    if (pin) headers['X-Admin-PIN'] = pin;
    const res = await fetch(`${API_BASE_URL}/system/cloud-backup/upload-now`, {
      method: 'POST',
      headers
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `HTTP error ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.error('Failed to trigger cloud backup upload:', err);
    return { status: 'ERROR', message: err.message };
  }
}

/**
 * Fetch available remote cloud backup archives
 * @param {string|null} pin - Technician Admin PIN or master key
 */
export async function fetchRemoteCloudBackups(pin = null) {
  try {
    const headers = {};
    if (pin) headers['X-Admin-PIN'] = pin;
    const res = await fetch(`${API_BASE_URL}/system/cloud-backup/backups`, { headers });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `HTTP error ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.warn('Failed to list remote cloud backups:', err);
    return [];
  }
}

/**
 * Restore SQLite database from remote cloud backup archive
 * @param {string} filename - Remote backup zip filename
 * @param {string|null} pin - Technician Admin PIN or master key
 */
export async function restoreRemoteCloudBackup(filename, pin = null) {
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (pin) headers['X-Admin-PIN'] = pin;
    const res = await fetch(`${API_BASE_URL}/system/cloud-backup/restore`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ filename })
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `HTTP error ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.error('Failed to restore remote cloud backup:', err);
    return { status: 'ERROR', message: err.message };
  }
}


/**
 * Fetch full technician diagnostic telemetry
 * @param {string|null} pin - Technician Admin PIN or master key
 */
export async function fetchSystemDiagnostics(pin = null) {
  try {
    const headers = {};
    if (pin) headers['X-Admin-PIN'] = pin;
    const res = await fetch(`${API_BASE_URL}/system/diagnostics`, { headers });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `HTTP error ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.warn('Failed to fetch system diagnostics:', err);
    return { status: 'ERROR', error: err.message };
  }
}

/**
 * Execute SQLite VACUUM and WAL checkpoint to optimize database storage
 * @param {string|null} pin - Technician Admin PIN or master key
 */
export async function triggerDbVacuum(pin = null) {
  try {
    const headers = {};
    if (pin) headers['X-Admin-PIN'] = pin;
    const res = await fetch(`${API_BASE_URL}/system/db/vacuum`, {
      method: 'POST',
      headers
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `HTTP error ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.error('Failed to trigger database vacuum:', err);
    return { status: 'ERROR', error: err.message };
  }
}

/**
 * Fetch recent tail of backend rotating log file
 * @param {Object} options - { lines, level, search, pin }
 */
export async function fetchSystemLogs({ lines = 200, level = null, search = null, pin = null } = {}) {
  try {
    const params = new URLSearchParams();
    if (lines) params.append('lines', lines.toString());
    if (level && level !== 'ALL') params.append('level', level);
    if (search && search.trim()) params.append('search', search.trim());

    const headers = {};
    if (pin) headers['X-Admin-PIN'] = pin;

    const res = await fetch(`${API_BASE_URL}/system/logs?${params.toString()}`, { headers });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `HTTP error ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.warn('Failed to fetch system logs:', err);
    return { status: 'ERROR', error: err.message, lines: [] };
  }
}

/**
 * Download database snapshot archive (.zip)
 * @param {string|null} pin - Technician Admin PIN or master key
 */
export async function downloadDatabaseSnapshot(pin = null) {
  try {
    const headers = {};
    if (pin) headers['X-Admin-PIN'] = pin;
    const res = await fetch(`${API_BASE_URL}/system/db/backup`, { headers });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `HTTP error ${res.status}`);
    }
    const blob = await res.blob();
    const disposition = res.headers.get('content-disposition');
    let filename = `pos_store_snapshot_${new Date().toISOString().slice(0, 10)}.zip`;
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) filename = match[1];
    }
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);
    return { success: true, filename };
  } catch (err) {
    console.error('Failed to download database snapshot:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Restore SQLite database from an uploaded .db or .zip snapshot
 * @param {File} file - Database or zip backup file
 * @param {string|null} pin - Technician Admin PIN or master key
 */
export async function restoreDatabaseSnapshot(file, pin = null) {
  try {
    const formData = new FormData();
    formData.append('file', file);
    const headers = {};
    if (pin) headers['X-Admin-PIN'] = pin;
    const res = await fetch(`${API_BASE_URL}/system/db/restore`, {
      method: 'POST',
      headers,
      body: formData
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `HTTP error ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.error('Failed to restore database snapshot:', err);
    return { status: 'ERROR', error: err.message };
  }
}

/**
 * Export and download full diagnostic bundle (.zip)
 * @param {string|null} pin - Technician Admin PIN or master key
 */
export async function downloadDiagnosticBundle(pin = null) {
  try {
    const headers = {};
    if (pin) headers['X-Admin-PIN'] = pin;
    const res = await fetch(`${API_BASE_URL}/system/export-bundle`, { headers });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `HTTP error ${res.status}`);
    }
    const blob = await res.blob();
    const disposition = res.headers.get('content-disposition');
    let filename = `voltflow_diagnostic_bundle_${new Date().toISOString().slice(0, 10)}.zip`;
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) filename = match[1];
    }
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);
    return { success: true, filename };
  } catch (err) {
    console.error('Failed to download diagnostic bundle:', err);
    return { success: false, error: err.message };
  }
}


