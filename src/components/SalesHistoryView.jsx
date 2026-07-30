import React, { useState, useEffect } from 'react';
import { Search, DollarSign, Banknote, CreditCard, Receipt, Eye, Lock, Unlock, Trash2, ShieldAlert, Calendar, BarChart3, PieChart, TrendingUp, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Filter, RotateCcw } from 'lucide-react';
import ReceiptModal from './ReceiptModal';
import { useTranslation } from '../i18n/LanguageContext.jsx';

const CZECH_MONTHS = [
  'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
  'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'
];

export default function SalesHistoryView({
  salesHistory,
  storeConfig,
  isAdminMode,
  onToggleAdminMode,
  onDeleteSale,
  onClearAllTestSales,
  onInitiateRefund,
  initialDateFilter = null
}) {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSale, setSelectedSale] = useState(null);
  const [periodFilter, setPeriodFilter] = useState('month'); // 'today' | 'month' | 'year' | 'all' | 'custom'

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth); // 0-11 or 'all'

  // Extract all unique years present in salesHistory
  const availableYears = Array.from(
    new Set([currentYear, ...salesHistory.map(s => new Date(s.timestamp).getFullYear())])
  ).sort((a, b) => b - a);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Custom date range states (default to first of current month & today)
  const todayStr = now.toISOString().slice(0, 10);
  const firstOfMonthStr = new Date(currentYear, now.getMonth(), 1).toISOString().slice(0, 10);

  const [fromDate, setFromDate] = useState(firstOfMonthStr);
  const [toDate, setToDate] = useState(todayStr);
  const [docTypeFilter, setDocTypeFilter] = useState('all'); // 'all' | 'sales' | 'refunds'

  // Apply initial date filter if passed (e.g. from CalendarModal)
  useEffect(() => {
    if (initialDateFilter) {
      setPeriodFilter('custom');
      setFromDate(initialDateFilter);
      setToDate(initialDateFilter);
    }
  }, [initialDateFilter]);

  // Reset pagination when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, periodFilter, selectedYear, selectedMonth, fromDate, toDate, pageSize, docTypeFilter]);

  // Filter sales by selected time period, year, and month
  const periodFilteredSales = salesHistory.filter(sale => {
    const saleDate = new Date(sale.timestamp);

    if (periodFilter === 'today') {
      return saleDate.toDateString() === now.toDateString();
    }
    if (periodFilter === 'month') {
      const matchYear = saleDate.getFullYear() === selectedYear;
      const matchMonth = selectedMonth === 'all' || saleDate.getMonth() === parseInt(selectedMonth, 10);
      return matchYear && matchMonth;
    }
    if (periodFilter === 'year') {
      return saleDate.getFullYear() === selectedYear;
    }
    if (periodFilter === 'custom') {
      const from = fromDate ? new Date(fromDate + 'T00:00:00') : new Date(0);
      const to = toDate ? new Date(toDate + 'T23:59:59') : new Date();
      return saleDate >= from && saleDate <= to;
    }
    return true; // 'all'
  });

  // Apply document type filter (sales vs stornos) and search query
  const searchFilteredSales = periodFilteredSales.filter(sale => {
    if (!sale) return false;
    if (docTypeFilter === 'sales' && (sale.isRefund || sale.is_refund)) return false;
    if (docTypeFilter === 'refunds' && !(sale.isRefund || sale.is_refund)) return false;

    const term = searchTerm.toLowerCase();
    const rNum = (sale.receiptNumber || sale.receipt_number || '').toString().toLowerCase();
    const origNum = (sale.originalReceiptNumber || sale.original_receipt_number || '').toString().toLowerCase();
    const pMethod = (sale.paymentMethod || sale.payment_method || '').toLowerCase();
    const reason = (sale.refundReason || sale.refund_reason || '').toLowerCase();
    const itemsList = Array.isArray(sale.items) ? sale.items : [];
    return (
      rNum.includes(term) ||
      origNum.includes(term) ||
      pMethod.includes(term) ||
      reason.includes(term) ||
      itemsList.some(i => (i.name || '').toLowerCase().includes(term))
    );
  });

  // Calculate Pagination Slices
  const totalItems = searchFilteredSales.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedSales = searchFilteredSales.slice(startIndex, endIndex);

  // Calculate Metrics for selected period
  const totalRevenue = periodFilteredSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
  const cashRevenue = periodFilteredSales.filter(s => s.paymentMethod === 'cash').reduce((sum, s) => sum + (s.totalAmount || 0), 0);
  const cardRevenue = periodFilteredSales.filter(s => s.paymentMethod !== 'cash').reduce((sum, s) => sum + (s.totalAmount || 0), 0);
  const transactionCount = periodFilteredSales.length;
  const avgOrderValue = transactionCount > 0 ? totalRevenue / transactionCount : 0;

  // Calculate Tax Breakdown for selected period
  const periodTaxSummary = periodFilteredSales.reduce((acc, sale) => {
    if (sale.taxSummary) {
      Object.values(sale.taxSummary).forEach(t => {
        const rate = t.rate;
        if (!acc[rate]) acc[rate] = { rate, gross: 0, net: 0, tax: 0 };
        acc[rate].gross += t.gross || 0;
        acc[rate].net += t.net || 0;
        acc[rate].tax += t.tax || 0;
      });
    } else {
      sale.items.forEach(item => {
        const rate = item.vat !== undefined ? parseInt(item.vat, 10) : 21;
        const gross = parseFloat(item.price) * item.quantity;
        const net = rate > 0 ? gross / (1 + rate / 100) : gross;
        const tax = gross - net;
        if (!acc[rate]) acc[rate] = { rate, gross: 0, net: 0, tax: 0 };
        acc[rate].gross += gross;
        acc[rate].net += net;
        acc[rate].tax += tax;
      });
    }
    return acc;
  }, {});

  const totalNetto = Object.values(periodTaxSummary).reduce((sum, t) => sum + t.net, 0);
  const totalVat = Object.values(periodTaxSummary).reduce((sum, t) => sum + t.tax, 0);

  // Category Breakdown for selected period
  const categorySummary = periodFilteredSales.reduce((acc, sale) => {
    sale.items.forEach(item => {
      const cat = item.category || 'Ostatní';
      const gross = parseFloat(item.price) * item.quantity;
      if (!acc[cat]) acc[cat] = { category: cat, total: 0, quantity: 0 };
      acc[cat].total += gross;
      acc[cat].quantity += item.quantity;
    });
    return acc;
  }, {});

  const sortedCategories = Object.values(categorySummary).sort((a, b) => b.total - a.total);

  const getPeriodLabel = () => {
    if (periodFilter === 'today') return 'Dnes';
    if (periodFilter === 'year') return `Rok ${selectedYear}`;
    if (periodFilter === 'month') {
      const monthText = selectedMonth === 'all' ? 'Všechny měsíce' : CZECH_MONTHS[selectedMonth];
      return `${monthText} ${selectedYear}`;
    }
    if (periodFilter === 'custom') return `Období ${fromDate} do ${toDate}`;
    return 'Všechna data';
  };

  return (
    <div className="full-view-container">
      <div className="section-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <div className="section-title" style={{ fontSize: '1.4rem' }}>
          <TrendingUp size={26} style={{ color: 'var(--accent-emerald)' }} />
          <span>{t('history.stats_title')}</span>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {isAdminMode && (
            <button
              className="clear-cart-btn"
              style={{ padding: '0.4rem 0.85rem' }}
              onClick={onClearAllTestSales}
              title={t('history.delete_test_sales')}
            >
              <Trash2 size={16} />
              <span>{t('history.delete_test_sales')}</span>
            </button>
          )}

          <button
            className="nav-tab"
            style={{
              padding: '0.45rem 0.85rem',
              fontSize: '0.85rem',
              background: isAdminMode ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.06)',
              color: isAdminMode ? 'var(--accent-amber)' : 'var(--text-secondary)',
              border: isAdminMode ? '1px solid var(--accent-amber)' : '1px solid var(--border-color)',
              fontWeight: '700'
            }}
            onClick={onToggleAdminMode}
          >
            {isAdminMode ? <Unlock size={16} /> : <Lock size={16} />}
            <span>{isAdminMode ? t('history.admin_active') : t('history.admin_activate')}</span>
          </button>
        </div>
      </div>

      {isAdminMode && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: 'var(--radius-md)',
          padding: '0.75rem 1rem',
          fontSize: '0.85rem',
          color: 'var(--accent-amber)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem'
        }}>
          <ShieldAlert size={18} />
          <span>
            {t('history.admin_banner')}
          </span>
        </div>
      )}

      {/* Time Period Selector Bar with Month & Year Selectors */}
      <div className="table-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Calendar size={20} style={{ color: 'var(--accent-blue)' }} />
            <span style={{ fontWeight: '800', fontSize: '1rem' }}>{t('history.select_period')}</span>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Year Selector Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--bg-input)', padding: '0.25rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>{t('history.year_label')}:</span>
              <select
                value={selectedYear}
                onChange={e => {
                  setSelectedYear(parseInt(e.target.value, 10));
                  if (periodFilter === 'today') setPeriodFilter('month');
                }}
                style={{ background: 'transparent', border: 'none', color: 'var(--accent-emerald)', fontWeight: '800', fontSize: '0.9rem', cursor: 'pointer' }}
              >
                {availableYears.map(year => (
                  <option key={year} value={year} style={{ background: 'var(--bg-card)', color: '#fff' }}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            {/* Month Selector Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--bg-input)', padding: '0.25rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>Měsíc:</span>
              <select
                value={selectedMonth}
                onChange={e => {
                  setSelectedMonth(e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10));
                  setPeriodFilter('month');
                }}
                style={{ background: 'transparent', border: 'none', color: 'var(--accent-blue)', fontWeight: '800', fontSize: '0.9rem', cursor: 'pointer' }}
              >
                <option value="all" style={{ background: 'var(--bg-card)', color: '#fff' }}>Všechny měsíce (Celý rok)</option>
                {CZECH_MONTHS.map((monthName, idx) => (
                  <option key={idx} value={idx} style={{ background: 'var(--bg-card)', color: '#fff' }}>
                    {monthName}
                  </option>
                ))}
              </select>
            </div>

            <button
              className={`nav-tab ${periodFilter === 'today' ? 'active' : ''}`}
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
              onClick={() => setPeriodFilter('today')}
            >
              {t('history.today')}
            </button>

            <button
              className={`nav-tab ${periodFilter === 'month' ? 'active' : ''}`}
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
              onClick={() => setPeriodFilter('month')}
            >
              {t('history.month')}
            </button>

            <button
              className={`nav-tab ${periodFilter === 'year' ? 'active' : ''}`}
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
              onClick={() => setPeriodFilter('year')}
            >
              {t('history.year')} {selectedYear}
            </button>

            <button
              className={`nav-tab ${periodFilter === 'all' ? 'active' : ''}`}
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
              onClick={() => setPeriodFilter('all')}
            >
              {t('history.all_period')}
            </button>

            <button
              className={`nav-tab ${periodFilter === 'custom' ? 'active' : ''}`}
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
              onClick={() => setPeriodFilter('custom')}
            >
              <Filter size={14} />
              <span>{t('history.custom_date')}</span>
            </button>
          </div>
        </div>

        {/* Custom Date Range Picker Block */}
        {periodFilter === 'custom' && (
          <div style={{
            background: 'var(--bg-input)',
            padding: '1rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            <div style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Calendar size={16} />
              <span>Zadejte Přesné Období Od - Do</span>
            </div>

            <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                  Datum OD (Od začátku dne)
                </label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={e => setFromDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    color: '#ffffff',
                    fontFamily: 'var(--font-main)',
                    fontSize: '0.95rem'
                  }}
                />
              </div>

              <div style={{ flex: 1, minWidth: '200px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                  Datum DO (Do konce dne)
                </label>
                <input
                  type="date"
                  value={toDate}
                  onChange={e => setToDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    color: '#ffffff',
                    fontFamily: 'var(--font-main)',
                    fontSize: '0.95rem'
                  }}
                />
              </div>

              <div style={{ alignSelf: 'flex-end', paddingTop: '1.4rem' }}>
                <span className="status-badge" style={{ padding: '0.6rem 1rem', fontSize: '0.85rem' }}>
                  Nalezeno {searchFilteredSales.length} transakcí
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Primary KPI Metrics */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon" style={{ background: 'var(--accent-emerald)' }}>
            <DollarSign size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-label">{t('history.revenue')} ({getPeriodLabel()})</span>
            <span className="metric-value">{totalRevenue.toFixed(0)} Kč</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon" style={{ background: 'var(--accent-blue)' }}>
            <Banknote size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-label">{t('history.cash_revenue')} ({transactionCount > 0 ? ((cashRevenue / totalRevenue) * 100 || 0).toFixed(0) : 0}%)</span>
            <span className="metric-value">{cashRevenue.toFixed(0)} Kč</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon" style={{ background: 'var(--accent-purple)' }}>
            <CreditCard size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-label">{t('history.card_revenue')} / QR ({transactionCount > 0 ? ((cardRevenue / totalRevenue) * 100 || 0).toFixed(0) : 0}%)</span>
            <span className="metric-value">{cardRevenue.toFixed(0)} Kč</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon" style={{ background: 'var(--accent-amber)' }}>
            <Receipt size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-label">{t('history.txn_count')}</span>
            <span className="metric-value">{transactionCount} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>({avgOrderValue.toFixed(0)} Kč)</span></span>
          </div>
        </div>
      </div>

      {/* Tax & Category Analytical Panels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
        {/* VAT Tax Summary Table */}
        <div className="table-card" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BarChart3 size={18} style={{ color: 'var(--accent-blue)' }} />
            <span>VAT Breakdown ({getPeriodLabel()})</span>
          </h3>

          <table className="data-table">
            <thead>
              <tr>
                <th>VAT %</th>
                <th>Netto</th>
                <th>VAT Amount</th>
                <th>Brutto</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(periodTaxSummary).map(t => (
                <tr key={t.rate}>
                  <td style={{ fontWeight: '700' }}>{t.rate}%</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{t.net.toFixed(2)} Kč</td>
                  <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-purple)', fontWeight: '700' }}>
                    {t.tax.toFixed(2)} Kč
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '800', color: 'var(--accent-emerald)' }}>
                    {t.gross.toFixed(2)} Kč
                  </td>
                </tr>
              ))}
              <tr style={{ borderTop: '2px solid var(--border-color)', fontWeight: '800' }}>
                <td>TOTAL</td>
                <td style={{ fontFamily: 'var(--font-mono)' }}>{totalNetto.toFixed(2)} Kč</td>
                <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-purple)' }}>{totalVat.toFixed(2)} Kč</td>
                <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-emerald)' }}>{totalRevenue.toFixed(2)} Kč</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Category Breakdown Table */}
        <div className="table-card" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <PieChart size={18} style={{ color: 'var(--accent-purple)' }} />
            <span>{t('history.category_sales')}</span>
          </h3>

          {sortedCategories.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>No items in selected period.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('presets.col_category')}</th>
                  <th>{t('history.items_sold')}</th>
                  <th>{t('history.revenue')} (Kč)</th>
                  <th>{t('history.share')}</th>
                </tr>
              </thead>
              <tbody>
                {sortedCategories.map(cat => (
                  <tr key={cat.category}>
                    <td style={{ fontWeight: '700', textTransform: 'capitalize' }}>{cat.category}</td>
                    <td>{cat.quantity} ks</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', color: 'var(--accent-emerald)' }}>
                      {cat.total.toFixed(0)} Kč
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {((cat.total / (totalRevenue || 1)) * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Transaction Ledger Table with Search & Full Pagination */}
      <div className="table-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Receipt size={20} style={{ color: 'var(--accent-blue)' }} />
            <span>Seznam Vystavených Účtenek ({totalItems})</span>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Filter by document type: All vs Sales vs Refunds */}
            <div style={{ display: 'flex', gap: '0.3rem', background: 'var(--bg-input)', padding: '0.2rem', borderRadius: 'var(--radius-md)' }}>
              <button
                className={`nav-tab ${docTypeFilter === 'all' ? 'active' : ''}`}
                style={{ padding: '0.3rem 0.7rem', fontSize: '0.8rem' }}
                onClick={() => setDocTypeFilter('all')}
              >
                {t('history.all_docs')}
              </button>
              <button
                className={`nav-tab ${docTypeFilter === 'sales' ? 'active' : ''}`}
                style={{ padding: '0.3rem 0.7rem', fontSize: '0.8rem' }}
                onClick={() => setDocTypeFilter('sales')}
              >
                {t('history.sales_only')}
              </button>
              <button
                className={`nav-tab ${docTypeFilter === 'refunds' ? 'active' : ''}`}
                style={{ padding: '0.3rem 0.7rem', fontSize: '0.8rem', color: docTypeFilter === 'refunds' ? '#ef4444' : 'var(--text-secondary)' }}
                onClick={() => setDocTypeFilter('refunds')}
              >
                {t('history.refunds_only')}
              </button>
            </div>

            <div className="keypad-input-container" style={{ width: '260px' }}>
              <Search size={16} style={{ color: 'var(--text-muted)', marginRight: '8px' }} />
              <input
                type="text"
                className="keypad-label-input"
                placeholder={t('history.search_placeholder')}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '600' }}>
              <span>{t('history.per_page')}:</span>
              <select
                value={pageSize}
                onChange={e => setPageSize(parseInt(e.target.value, 10))}
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  fontWeight: '700',
                  padding: '0.35rem 0.6rem',
                  cursor: 'pointer'
                }}
              >
                <option value={10} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>10 účtenek</option>
                <option value={25} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>25 účtenek</option>
                <option value={50} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>50 účtenek</option>
                <option value={100} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>100 účtenek</option>
              </select>
            </div>
          </div>
        </div>

        {searchFilteredSales.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Nebyly nalezeny žádné transakce ve vybraném období.
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '150px', whiteSpace: 'nowrap' }}>{t('history.col_receipt')}</th>
                    <th style={{ width: '140px', whiteSpace: 'nowrap' }}>{t('history.col_date')}</th>
                    <th>Položky</th>
                    <th style={{ width: '160px' }}>{t('history.col_method')}</th>
                    <th style={{ width: '120px', textAlign: 'right', whiteSpace: 'nowrap' }}>{t('history.col_total')}</th>
                    <th style={{ width: '220px', textAlign: 'right' }}>{t('history.col_actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSales.map((sale) => {
                    const isRefund = sale.isRefund || sale.is_refund;
                    const isFullyRefunded = sale.refundStatus === 'FULL' || sale.refund_status === 'FULL';
                    const isPartiallyRefunded = sale.refundStatus === 'PARTIAL' || sale.refund_status === 'PARTIAL';

                    return (
                      <tr key={sale.id} style={{ background: isRefund ? 'rgba(239, 68, 68, 0.04)' : 'transparent' }}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', whiteSpace: 'nowrap' }}>
                          <div>#{sale.receiptNumber}</div>
                          {isRefund && sale.originalReceiptNumber && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                              K účtence: #{sale.originalReceiptNumber}
                            </div>
                          )}
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: '0.85rem' }}>
                            {new Date(sale.timestamp).toLocaleString('cs-CZ')}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.85rem', color: isRefund ? '#ef4444' : 'var(--text-secondary)' }}>
                            {sale.items.map(i => `${i.name} (${i.quantity}x)`).join(', ')}
                          </span>
                          {isRefund && sale.refundReason && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '2px' }}>
                              Důvod: {sale.refundReason}
                            </div>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                            {isRefund ? (
                              <span className="status-badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)' }}>
                                STORNO DOKLAD
                              </span>
                            ) : isFullyRefunded ? (
                              <span className="status-badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)' }}>
                                VRÁCENO KOMPLETNĚ
                              </span>
                            ) : isPartiallyRefunded ? (
                              <span className="status-badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-amber)', borderColor: 'rgba(245, 158, 11, 0.4)' }}>
                                ČÁSTEČNĚ VRÁCENO (-{(sale.refundedAmount || 0).toFixed(0)} Kč)
                              </span>
                            ) : null}

                            <span className="status-badge" style={{
                              background: sale.paymentMethod === 'cash' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                              color: sale.paymentMethod === 'cash' ? 'var(--accent-emerald)' : 'var(--accent-blue)',
                              borderColor: sale.paymentMethod === 'cash' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(59, 130, 246, 0.3)'
                            }}>
                              {sale.paymentMethod === 'cash' ? 'Hotovost' : sale.paymentMethod === 'card' ? 'Karta' : 'QR'}
                            </span>
                          </div>
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '800', textAlign: 'right', color: isRefund ? '#ef4444' : 'var(--accent-emerald)', whiteSpace: 'nowrap' }}>
                          {sale.totalAmount.toFixed(0)} Kč
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem' }}>
                            {!isRefund && !isFullyRefunded && onInitiateRefund && (
                              <button
                                className="nav-tab"
                                style={{
                                  padding: '0.35rem 0.65rem',
                                  fontSize: '0.8rem',
                                  background: 'rgba(239, 68, 68, 0.1)',
                                  color: '#ef4444',
                                  borderColor: 'rgba(239, 68, 68, 0.3)',
                                  whiteSpace: 'nowrap',
                                  fontWeight: '700'
                                }}
                                onClick={() => onInitiateRefund(sale)}
                                title="Vystavit vratku / storno účtenky"
                              >
                                <RotateCcw size={14} />
                                <span>Storno / Vratka</span>
                              </button>
                            )}

                            <button
                              className="nav-tab"
                              style={{
                                padding: '0.35rem 0.65rem',
                                fontSize: '0.8rem',
                                whiteSpace: 'nowrap',
                                fontWeight: '700'
                              }}
                              onClick={() => setSelectedSale(sale)}
                            >
                              <Eye size={14} />
                              <span>Detail / Tisk</span>
                            </button>

                            {isAdminMode && (
                              <button
                                className="delete-item-btn"
                                onClick={() => onDeleteSale(sale.id)}
                                title="Smazat testovací prodej"
                                style={{ padding: '0.35rem 0.5rem', whiteSpace: 'nowrap' }}
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Full Pagination Controls Footer */}
            <div style={{
              padding: '1rem 1.25rem',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justify: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
              background: 'var(--bg-main)'
            }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Zobrazeno <strong>{startIndex + 1}–{endIndex}</strong> z <strong>{totalItems}</strong> účtenek
              </div>

              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <button
                  className="nav-tab"
                  style={{ padding: '0.35rem 0.6rem' }}
                  disabled={validCurrentPage === 1}
                  onClick={() => setCurrentPage(1)}
                  title="První stránka"
                >
                  <ChevronsLeft size={16} />
                </button>

                <button
                  className="nav-tab"
                  style={{ padding: '0.35rem 0.6rem' }}
                  disabled={validCurrentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  title="Předchozí stránka"
                >
                  <ChevronLeft size={16} />
                </button>

                <span style={{ fontSize: '0.85rem', fontWeight: '700', padding: '0 0.5rem' }}>
                  Stránka {validCurrentPage} z {totalPages}
                </span>

                <button
                  className="nav-tab"
                  style={{ padding: '0.35rem 0.6rem' }}
                  disabled={validCurrentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  title="Následující stránka"
                >
                  <ChevronRight size={16} />
                </button>

                <button
                  className="nav-tab"
                  style={{ padding: '0.35rem 0.6rem' }}
                  disabled={validCurrentPage === totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                  title="Poslední stránka"
                >
                  <ChevronsRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {selectedSale && (
        <ReceiptModal
          saleData={selectedSale}
          storeConfig={storeConfig}
          onClose={() => setSelectedSale(null)}
          onNewSale={() => setSelectedSale(null)}
        />
      )}
    </div>
  );
}
