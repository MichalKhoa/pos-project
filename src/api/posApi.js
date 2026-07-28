const API_BASE_URL = 'http://localhost:8000/api/v1';

/**
 * Fetch backend root status
 */
export async function fetchBackendRoot() {
  try {
    const res = await fetch('http://localhost:8000/');
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
  return {
    ...sale,
    id: sale.id,
    receiptNumber: sale.receiptNumber || sale.receipt_number || 'N/A',
    receipt_number: sale.receipt_number || sale.receiptNumber || 'N/A',
    timestamp: sale.timestamp || new Date().toISOString(),
    totalAmount: sale.totalAmount !== undefined ? sale.totalAmount : (sale.total_amount !== undefined ? sale.total_amount : 0),
    total_amount: sale.total_amount !== undefined ? sale.total_amount : (sale.totalAmount !== undefined ? sale.totalAmount : 0),
    paymentMethod: sale.paymentMethod || sale.payment_method || 'cash',
    payment_method: sale.payment_method || sale.paymentMethod || 'cash',
    cartDiscountPercent: sale.cartDiscountPercent !== undefined ? sale.cartDiscountPercent : (sale.cart_discount_percent !== undefined ? sale.cart_discount_percent : 0),
    splitDetails: sale.splitDetails || sale.split_details || null,
    tenderedAmount: sale.tenderedAmount !== undefined ? sale.tenderedAmount : (sale.tendered_amount !== undefined ? sale.tendered_amount : 0),
    changeDue: sale.changeDue !== undefined ? sale.changeDue : (sale.change_due !== undefined ? sale.change_due : 0),
    taxSummary: sale.taxSummary || sale.tax_summary || {},
    fikCode: sale.fikCode || sale.fik_code || sale.fik || null,
    bkpCode: sale.bkpCode || sale.bkp_code || sale.bkp || null,
    pkpCode: sale.pkpCode || sale.pkp_code || sale.pkp || null,
    fik_code: sale.fik_code || sale.fikCode || sale.fik || null,
    bkp_code: sale.bkp_code || sale.bkpCode || sale.bkp || null,
    pkp_code: sale.pkp_code || sale.pkpCode || sale.pkp || null,
    eet_status: sale.eet_status || sale.eetStatus || 'EVD_OK',
    eetStatus: sale.eetStatus || sale.eet_status || 'EVD_OK',
    items: Array.isArray(sale.items) ? sale.items.map(item => ({
      ...item,
      id: item.id || item.item_id,
      name: item.name || 'Položka',
      price: item.price !== undefined ? item.price : 0,
      quantity: item.quantity !== undefined ? item.quantity : 1,
      vat: item.vat !== undefined ? item.vat : 21,
      discountPercent: item.discountPercent !== undefined ? item.discountPercent : (item.discount_percent !== undefined ? item.discount_percent : 0)
    })) : []
  };
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
