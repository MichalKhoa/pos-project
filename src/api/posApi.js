const API_HOST = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
const API_BASE_URL = `http://${API_HOST}:8000/api/v1`;

/**
 * Fetch backend root status
 */
export async function fetchBackendRoot() {
  try {
    const res = await fetch(`http://${API_HOST}:8000/api/v1/status`);
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
    discount_percent: item.discount_percent !== undefined ? parseFloat(item.discount_percent) : (item.discountPercent !== undefined ? parseFloat(item.discountPercent) : 0)
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
export async function deleteSaleBackend(saleId) {
  try {
    const res = await fetch(`${API_BASE_URL}/sales/${saleId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Override': 'true'
      }
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
export async function purgeAllSalesBackend() {
  try {
    const res = await fetch(`${API_BASE_URL}/sales/purge-all`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Override': 'true'
      }
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Failed to purge all test sales in backend:', err);
    return null;
  }
}

/**
 * Fetch sales history ledger from backend
 */
export async function fetchSalesHistoryBackend() {
  try {
    const res = await fetch(`${API_BASE_URL}/sales/`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data.map(normalizeSale) : [];
  } catch (err) {
    console.warn('Backend sales history unavailable:', err);
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

