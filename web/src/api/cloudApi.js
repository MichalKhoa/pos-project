/**
 * Unified Web API Client for VoltFlow POS Cloud Dashboard.
 * Supports configurable API base, JWT token storage, dual-mode bypass,
 * automatic 401 interceptor, and typed endpoints for all cloud routers.
 */

export const API_BASE = (import.meta.env.VITE_API_BASE || 'http://localhost:8000/api/v1').replace(/\/+$/, '');
export const TOKEN_KEY = 'voltflow_token';
export const USER_KEY = 'voltflow_user';

/**
 * Builds a URL with query parameters.
 * @param {string} endpoint - API endpoint path or full URL.
 * @param {Record<string, any>} [params] - Optional query parameters.
 * @returns {string} Fully qualified URL string.
 */
export function buildUrl(endpoint, params = {}) {
  let urlStr;
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    urlStr = endpoint;
  } else {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    urlStr = `${API_BASE}${cleanEndpoint}`;
  }

  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      searchParams.append(key, val);
    }
  });

  const query = searchParams.toString();
  if (query) {
    urlStr += (urlStr.includes('?') ? '&' : '?') + query;
  }
  return urlStr;
}

/**
 * Robust fetch wrapper with automatic JWT injection, JSON body stringifying,
 * and 401 auth event dispatching.
 * @param {string} endpoint - API path.
 * @param {RequestInit & { params?: Record<string, any> }} [options] - Fetch options.
 * @returns {Promise<any>}
 */
export async function request(endpoint, options = {}) {
  const { params, headers: customHeaders, body: rawBody, ...restOptions } = options;
  const url = buildUrl(endpoint, params);

  const headers = { ...customHeaders };
  const token = localStorage.getItem(TOKEN_KEY);
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let body = rawBody;
  if (
    body !== undefined &&
    body !== null &&
    typeof body === 'object' &&
    !(body instanceof FormData) &&
    !(body instanceof URLSearchParams) &&
    !(body instanceof Blob)
  ) {
    if (!headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
    body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url, {
      ...restOptions,
      headers,
      body,
    });
  } catch (netErr) {
    throw new Error(netErr.message || 'Network connection failure');
  }

  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:required'));
    }
    let detail = 'Unauthorized';
    try {
      const errJson = await res.json();
      detail = errJson.detail || errJson.message || detail;
    } catch {
      // ignore
    }
    throw new Error(detail);
  }

  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const errJson = await res.json();
      detail = errJson.detail || errJson.message || JSON.stringify(errJson);
    } catch {
      detail = `${detail}: ${res.statusText}`;
    }
    throw new Error(detail);
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return await res.json();
  }
  return await res.text();
}

export const cloudApi = {
  // --------------------------------------------------------------------------
  // Authentication
  // --------------------------------------------------------------------------
  /**
   * Dual-mode authentication check: returns true if running in development mode,
   * if VITE_BYPASS_AUTH is set, or if a valid JWT token exists in localStorage.
   */
  isAuthenticated() {
    if (this.isBypassMode()) {
      return true;
    }
    return !!localStorage.getItem(TOKEN_KEY);
  },

  /**
   * Checks whether bypass / guest mode is active.
   */
  isBypassMode() {
    if (typeof window !== 'undefined' && localStorage.getItem('voltflow_bypass') === 'true') {
      return true;
    }
    return import.meta.env.DEV || import.meta.env.VITE_BYPASS_AUTH === 'true';
  },

  /**
   * Activates local guest bypass mode.
   */
  bypassAuth() {
    if (typeof window !== 'undefined') {
      localStorage.setItem('voltflow_bypass', 'true');
      window.dispatchEvent(new CustomEvent('auth:updated'));
    }
  },

  /**
   * Retrieves active username or fallback.
   */
  getUsername() {
    return localStorage.getItem(USER_KEY) || 'admin';
  },

  /**
   * Authenticate with username, password, and optional TOTP code.
   * Sends OAuth2 password credentials.
   */
  async login({ username, password, totp_code }) {
    const form = new URLSearchParams();
    form.append('username', username);
    form.append('password', password);
    if (totp_code) {
      form.append('totp_code', totp_code);
    }

    const params = totp_code ? { totp_code } : undefined;
    const data = await request('/auth/login', {
      method: 'POST',
      params,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });

    if (data && data.access_token) {
      localStorage.setItem(TOKEN_KEY, data.access_token);
      localStorage.setItem(USER_KEY, username);
    }
    return data;
  },

  /**
   * Clears stored JWT token and notifies subscribers.
   */
  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:required'));
    }
  },

  /**
   * Fetches TOTP provision URI and secret for 2FA onboarding.
   */
  async getTotpSetup() {
    return request('/auth/totp/setup');
  },

  // --------------------------------------------------------------------------
  // Dashboard Endpoints
  // --------------------------------------------------------------------------
  async getDashboardKpi() {
    return request('/dashboard/kpi');
  },

  async getPaymentSplits() {
    return request('/dashboard/payment-splits');
  },

  async getZReports(limit = 50) {
    return request('/dashboard/zreports', {
      params: { limit },
    });
  },

  async getHealth() {
    return request('/dashboard/health');
  },

  // --------------------------------------------------------------------------
  // Analytics Endpoints
  // --------------------------------------------------------------------------
  async getTopProfit(limit = 10) {
    return request('/analytics/top-profit', {
      params: { limit },
    });
  },

  async getVolumeDrivers(limit = 10) {
    return request('/analytics/volume-drivers', {
      params: { limit },
    });
  },

  async getDeadStock(days = 30) {
    return request('/analytics/dead-stock', {
      params: { days },
    });
  },

  async getHeatmap() {
    return request('/analytics/heatmap');
  },

  async getMarginAlerts() {
    return request('/analytics/margin-alerts');
  },

  // --------------------------------------------------------------------------
  // Catalog Endpoints
  // --------------------------------------------------------------------------
  async getCatalog({ search, category, limit = 100, offset = 0 } = {}) {
    return request('/catalog', {
      params: { search, category, limit, offset },
    });
  },

  async stagePriceChange(data) {
    return request('/staging/price-changes', {
      method: 'POST',
      body: data,
    });
  },

  async stageNewProduct(data) {
    return request('/staging/products', {
      method: 'POST',
      body: data,
    });
  },

  // --------------------------------------------------------------------------
  // Staging & Invoices Endpoints
  // --------------------------------------------------------------------------
  async getStagingIntakes() {
    return request('/staging/intakes');
  },

  async approveIntake(id, payload = null) {
    return request(`/staging/intakes/${encodeURIComponent(id)}/approve`, {
      method: 'POST',
      body: payload || undefined,
    });
  },

  async rejectIntake(id) {
    return request(`/staging/intakes/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  async uploadInvoiceFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    return request('/staging/upload-invoice', {
      method: 'POST',
      body: formData,
    });
  },

  async pollEmail() {
    return request('/staging/fetch-emails', {
      method: 'POST',
    });
  },

  // --------------------------------------------------------------------------
  // Exports Endpoints
  // --------------------------------------------------------------------------
  async getDphSummary({ startDate, endDate } = {}) {
    return request('/exports/dph', {
      params: { start_date: startDate, end_date: endDate },
    });
  },

  async getDpfoSummary({ startDate, endDate } = {}) {
    return request('/exports/dpfo', {
      params: { start_date: startDate, end_date: endDate },
    });
  },

  getPohodaExportUrl({ startDate, endDate } = {}) {
    return buildUrl('/exports/pohoda', {
      start_date: startDate,
      end_date: endDate,
    });
  },

  getCsvExportUrl({ startDate, endDate } = {}) {
    return buildUrl('/exports/csv', {
      start_date: startDate,
      end_date: endDate,
    });
  },

  getTaxStatementHtmlUrl({ startDate, endDate, autoPrint = false } = {}) {
    return buildUrl('/exports/tax-statement/html', {
      start_date: startDate,
      end_date: endDate,
      auto_print: autoPrint ? 'true' : undefined,
    });
  },
};

export default cloudApi;
