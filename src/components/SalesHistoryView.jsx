import React, { useState, useEffect } from 'react';
import { Search, DollarSign, Banknote, CreditCard, Receipt, Eye, Lock, Unlock, Trash2, ShieldAlert, Calendar, BarChart3, PieChart, TrendingUp, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Filter } from 'lucide-react';
import ReceiptModal from './ReceiptModal';

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
  onClearAllTestSales
}) {
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

  // Reset pagination when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, periodFilter, selectedYear, selectedMonth, fromDate, toDate, pageSize]);

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

  // Apply search query filter over period filtered sales
  const searchFilteredSales = periodFilteredSales.filter(sale => {
    if (!sale) return false;
    const term = searchTerm.toLowerCase();
    const rNum = (sale.receiptNumber || sale.receipt_number || '').toString().toLowerCase();
    const pMethod = (sale.paymentMethod || sale.payment_method || '').toLowerCase();
    const itemsList = Array.isArray(sale.items) ? sale.items : [];
    return (
      rNum.includes(term) ||
      pMethod.includes(term) ||
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
          <span>Statistiky Prodejů & Z-Zpráva</span>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {isAdminMode && (
            <button
              className="clear-cart-btn"
              style={{ padding: '0.4rem 0.85rem' }}
              onClick={onClearAllTestSales}
              title="Smazat všechny testovací prodeje"
            >
              <Trash2 size={16} />
              <span>Smazat Všechny Testovací Prodeje</span>
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
            <span>{isAdminMode ? 'Admin Režim: AKTIVNÍ' : 'Aktivovat Admin Režim'}</span>
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
            <strong>Režim Správce (Admin) je aktivní:</strong> Můžete mazat testovací prodeje, které nemají vstupovat do účetnictví. Mazáním se okamžitě přepočítá denní tržba.
          </span>
        </div>
      )}

      {/* Time Period Selector Bar with Month & Year Selectors */}
      <div className="table-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Calendar size={20} style={{ color: 'var(--accent-blue)' }} />
            <span style={{ fontWeight: '800', fontSize: '1rem' }}>Vyberte Časové Období:</span>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Year Selector Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--bg-input)', padding: '0.25rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>Rok:</span>
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
              Dnes
            </button>

            <button
              className={`nav-tab ${periodFilter === 'month' ? 'active' : ''}`}
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
              onClick={() => setPeriodFilter('month')}
            >
              Vybraný Měsíc
            </button>

            <button
              className={`nav-tab ${periodFilter === 'year' ? 'active' : ''}`}
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
              onClick={() => setPeriodFilter('year')}
            >
              Celý Rok {selectedYear}
            </button>

            <button
              className={`nav-tab ${periodFilter === 'all' ? 'active' : ''}`}
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
              onClick={() => setPeriodFilter('all')}
            >
              Všechna Data
            </button>

            <button
              className={`nav-tab ${periodFilter === 'custom' ? 'active' : ''}`}
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
              onClick={() => setPeriodFilter('custom')}
            >
              <Filter size={14} />
              <span>Vlastní Období</span>
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
            <span className="metric-label">Tržba ({getPeriodLabel()})</span>
            <span className="metric-value">{totalRevenue.toFixed(0)} Kč</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon" style={{ background: 'var(--accent-blue)' }}>
            <Banknote size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Hotovost ({transactionCount > 0 ? ((cashRevenue / totalRevenue) * 100 || 0).toFixed(0) : 0}%)</span>
            <span className="metric-value">{cashRevenue.toFixed(0)} Kč</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon" style={{ background: 'var(--accent-purple)' }}>
            <CreditCard size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Karta / QR ({transactionCount > 0 ? ((cardRevenue / totalRevenue) * 100 || 0).toFixed(0) : 0}%)</span>
            <span className="metric-value">{cardRevenue.toFixed(0)} Kč</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon" style={{ background: 'var(--accent-amber)' }}>
            <Receipt size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Počet Účtenek (Průměr)</span>
            <span className="metric-value">{transactionCount} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>({avgOrderValue.toFixed(0)} Kč/nákup)</span></span>
          </div>
        </div>
      </div>

      {/* Tax & Category Analytical Panels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
        {/* VAT Tax Summary Table */}
        <div className="table-card" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BarChart3 size={18} style={{ color: 'var(--accent-blue)' }} />
            <span>Rozpis DPH ({getPeriodLabel()})</span>
          </h3>

          <table className="data-table">
            <thead>
              <tr>
                <th>Sazba DPH</th>
                <th>Základ (Netto)</th>
                <th>Daň (DPH)</th>
                <th>Brutto (Celkem)</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(periodTaxSummary).map(t => (
                <tr key={t.rate}>
                  <td style={{ fontWeight: '700' }}>{t.rate}%</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{t.net.toFixed(2)} Kč</td>
                  <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-purple)', fontWeight: '700' }}>
                    {t.rate === 0 ? 'Osvobozeno' : `${t.tax.toFixed(2)} Kč`}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '800', color: 'var(--accent-emerald)' }}>
                    {t.gross.toFixed(2)} Kč
                  </td>
                </tr>
              ))}
              <tr style={{ borderTop: '2px solid var(--border-color)', fontWeight: '800' }}>
                <td>CELKEM</td>
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
            <span>Tržby podle Kategorií Produktů</span>
          </h3>

          {sortedCategories.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>Žádné položky v tomto období.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Kategorie</th>
                  <th>Prodáno ks</th>
                  <th>Tržba (Kč)</th>
                  <th>Podíl</th>
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
            <div className="keypad-input-container" style={{ width: '280px' }}>
              <Search size={16} style={{ color: 'var(--text-muted)', marginRight: '8px' }} />
              <input
                type="text"
                className="keypad-label-input"
                placeholder="Hledat č. účtenky / položku..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '600' }}>
              <span>Na stránku:</span>
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
                    <th>Číslo účtenky</th>
                    <th>Datum & Čas</th>
                    <th>Položky</th>
                    <th>Způsob úhrady</th>
                    <th>Částka celkem</th>
                    <th style={{ textAlign: 'right' }}>Akce</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSales.map((sale) => (
                    <tr key={sale.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '700' }}>
                        #{sale.receiptNumber}
                      </td>
                      <td>
                        <span style={{ fontSize: '0.85rem' }}>
                          {new Date(sale.timestamp).toLocaleString('cs-CZ')}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          {sale.items.map(i => `${i.name} (${i.quantity}x)`).join(', ')}
                        </span>
                      </td>
                      <td>
                        <span className="status-badge" style={{
                          background: sale.paymentMethod === 'cash' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                          color: sale.paymentMethod === 'cash' ? 'var(--accent-emerald)' : 'var(--accent-blue)',
                          borderColor: sale.paymentMethod === 'cash' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(59, 130, 246, 0.3)'
                        }}>
                          {sale.paymentMethod === 'cash' ? 'Hotovost' : sale.paymentMethod === 'card' ? 'Karta' : 'QR'}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '800', color: 'var(--accent-emerald)' }}>
                        {sale.totalAmount.toFixed(0)} Kč
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="nav-tab"
                          style={{ padding: '0.35rem 0.75rem', display: 'inline-flex', marginRight: isAdminMode ? '0.5rem' : '0' }}
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
                            style={{ padding: '0.35rem 0.5rem' }}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
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
