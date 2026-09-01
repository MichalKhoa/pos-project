import React, { useState, useEffect, useMemo } from 'react';
import { TrendingUp, Trash2, Unlock, Lock, ShieldAlert, Download, Receipt, BarChart3 } from 'lucide-react';
import ReceiptModal from './ReceiptModal';
import TouchCalendarModal from './TouchCalendarModal.jsx';
import TouchDateRangeModal from './TouchDateRangeModal.jsx';
import { useTranslation } from '../i18n/LanguageContext.jsx';
import { exportSalesToCSV } from '../utils/csvExporter';
import SalesMetricsCards from './history/SalesMetricsCards.jsx';
import SalesPeriodBar from './history/SalesPeriodBar.jsx';
import SalesAnalyticsCharts from './history/SalesAnalyticsCharts.jsx';
import SalesLedgerTable from './history/SalesLedgerTable.jsx';
import { formatLocalDate, getPeriodDateRange } from '../utils/dateUtils';

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
  const { t, language } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSale, setSelectedSale] = useState(null);
  const [periodFilter, setPeriodFilter] = useState('month'); // 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'all' | 'custom'
  const [referenceDate, setReferenceDate] = useState(new Date());
  const [activeSubTab, setActiveSubTab] = useState('receipts'); // 'receipts' | 'analytics'
  const [calendarModal, setCalendarModal] = useState({ isOpen: false, field: 'from', initialDate: '', title: '' });
  const [isRangeModalOpen, setIsRangeModalOpen] = useState(false);

  const now = new Date();

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Custom date range states (default to first of current month & today)
  const todayStr = formatLocalDate(now);
  const firstOfMonthStr = formatLocalDate(new Date(now.getFullYear(), now.getMonth(), 1));

  const [fromDate, setFromDate] = useState(firstOfMonthStr);
  const [toDate, setToDate] = useState(todayStr);
  const [docTypeFilter, setDocTypeFilter] = useState('all'); // 'all' | 'sales' | 'refunds'

  // Apply initial date filter if passed
  useEffect(() => {
    if (initialDateFilter) {
      setPeriodFilter('custom');
      setFromDate(initialDateFilter);
      setToDate(initialDateFilter);
    }
  }, [initialDateFilter]);

  // Stepper helper
  const handleStepPeriod = (direction) => {
    setReferenceDate(prevDate => {
      const newD = new Date(prevDate);
      if (periodFilter === 'today' || periodFilter === 'yesterday') {
        newD.setDate(newD.getDate() + (direction === 'prev' ? -1 : 1));
      } else if (periodFilter === 'week') {
        newD.setDate(newD.getDate() + (direction === 'prev' ? -7 : 7));
      } else if (periodFilter === 'month') {
        newD.setMonth(newD.getMonth() + (direction === 'prev' ? -1 : 1));
      } else if (periodFilter === 'year') {
        newD.setFullYear(newD.getFullYear() + (direction === 'prev' ? -1 : 1));
      }
      return newD;
    });
  };

  // Switch preset mode
  const handleSelectPreset = (mode) => {
    setPeriodFilter(mode);
    if (mode === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      setReferenceDate(y);
    } else {
      setReferenceDate(new Date());
    }
  };

  // Compute exact start and end Date objects
  const computedDateRange = useMemo(() => {
    return getPeriodDateRange(periodFilter, referenceDate, fromDate, toDate);
  }, [periodFilter, referenceDate, fromDate, toDate]);

  // Formatted date badge label
  const periodBadgeLabel = useMemo(() => {
    if (periodFilter === 'all') return t('history.all_period');
    if (periodFilter === 'custom') return `${t('history.custom_date')} (${fromDate} – ${toDate})`;

    const { start, end } = computedDateRange;
    const localeStr = language === 'cs' ? 'cs-CZ' : language === 'vi' ? 'vi-VN' : 'en-US';

    if (periodFilter === 'today' || periodFilter === 'yesterday') {
      return start.toLocaleDateString(localeStr, { weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric' });
    }
    if (periodFilter === 'week') {
      return `${start.toLocaleDateString(localeStr, { day: 'numeric', month: 'numeric' })} – ${end.toLocaleDateString(localeStr, { day: 'numeric', month: 'numeric', year: 'numeric' })}`;
    }
    if (periodFilter === 'month') {
      const monthName = start.toLocaleDateString(localeStr, { month: 'long', year: 'numeric' });
      return `${monthName}`;
    }
    if (periodFilter === 'year') {
      return `Rok ${start.getFullYear()}`;
    }
    return '';
  }, [periodFilter, computedDateRange, fromDate, toDate, language, t]);

  // Reset pagination when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, periodFilter, referenceDate, fromDate, toDate, pageSize, docTypeFilter]);

  // Filter sales by computed date range
  const periodFilteredSales = useMemo(() => {
    if (periodFilter === 'all') return salesHistory;
    const { start, end } = computedDateRange;
    return salesHistory.filter(sale => {
      const saleDate = new Date(sale.timestamp);
      return saleDate >= start && saleDate <= end;
    });
  }, [salesHistory, periodFilter, computedDateRange]);

  // Apply document type filter and search query
  const searchFilteredSales = useMemo(() => {
    return periodFilteredSales.filter(sale => {
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
  }, [periodFilteredSales, docTypeFilter, searchTerm]);

  // Calculate Pagination Slices
  const totalItems = searchFilteredSales.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedSales = useMemo(() => {
    return searchFilteredSales.slice(startIndex, endIndex);
  }, [searchFilteredSales, startIndex, endIndex]);

  // Calculate Metrics for selected period
  const totalRevenue = useMemo(() => {
    return periodFilteredSales.reduce((sum, s) => sum + (s.totalAmount !== undefined ? s.totalAmount : (s.total_amount || 0)), 0);
  }, [periodFilteredSales]);

  const cashRevenue = useMemo(() => {
    return periodFilteredSales.filter(s => (s.paymentMethod || s.payment_method) === 'cash')
      .reduce((sum, s) => sum + (s.totalAmount !== undefined ? s.totalAmount : (s.total_amount || 0)), 0);
  }, [periodFilteredSales]);

  const cardRevenue = useMemo(() => {
    return periodFilteredSales.filter(s => (s.paymentMethod || s.payment_method) === 'card')
      .reduce((sum, s) => sum + (s.totalAmount !== undefined ? s.totalAmount : (s.total_amount || 0)), 0);
  }, [periodFilteredSales]);

  const qrRevenue = useMemo(() => {
    return periodFilteredSales.filter(s => (s.paymentMethod || s.payment_method) === 'qr')
      .reduce((sum, s) => sum + (s.totalAmount !== undefined ? s.totalAmount : (s.total_amount || 0)), 0);
  }, [periodFilteredSales]);

  const transactionCount = periodFilteredSales.length;
  const avgOrderValue = transactionCount > 0 ? totalRevenue / transactionCount : 0;

  // Detailed Payment Method Analytics
  const paymentMethodSummary = useMemo(() => {
    const acc = {
      cash: { count: 0, total: 0, aov: 0 },
      card: { count: 0, total: 0, aov: 0 },
      qr: { count: 0, total: 0, aov: 0 },
      other: { count: 0, total: 0, aov: 0 }
    };
    periodFilteredSales.forEach(s => {
      const method = (s.paymentMethod || s.payment_method || 'cash').toLowerCase();
      const amt = s.totalAmount !== undefined ? s.totalAmount : (s.total_amount || 0);
      if (method === 'cash') {
        acc.cash.count += 1;
        acc.cash.total += amt;
      } else if (method === 'card') {
        acc.card.count += 1;
        acc.card.total += amt;
      } else if (method === 'qr') {
        acc.qr.count += 1;
        acc.qr.total += amt;
      } else {
        acc.other.count += 1;
        acc.other.total += amt;
      }
    });
    acc.cash.aov = acc.cash.count > 0 ? acc.cash.total / acc.cash.count : 0;
    acc.card.aov = acc.card.count > 0 ? acc.card.total / acc.card.count : 0;
    acc.qr.aov = acc.qr.count > 0 ? acc.qr.total / acc.qr.count : 0;
    acc.other.aov = acc.other.count > 0 ? acc.other.total / acc.other.count : 0;
    return acc;
  }, [periodFilteredSales]);

  // Tax Breakdown for selected period
  const periodTaxSummary = useMemo(() => {
    return periodFilteredSales.reduce((acc, sale) => {
      if (sale.taxSummary && Object.keys(sale.taxSummary).length > 0) {
        Object.values(sale.taxSummary).forEach(tItem => {
          const rate = tItem.rate;
          if (!acc[rate]) acc[rate] = { rate, gross: 0, net: 0, tax: 0 };
          acc[rate].gross += tItem.gross || 0;
          acc[rate].net += tItem.net || 0;
          acc[rate].tax += tItem.tax || 0;
        });
      } else if (Array.isArray(sale.items)) {
        const isRefund = sale.isRefund || sale.is_refund;
        sale.items.forEach(item => {
          const rate = item.vat !== undefined ? parseInt(item.vat, 10) : 21;
          let gross = parseFloat(item.price || 0) * (item.quantity !== undefined ? item.quantity : 1);
          if (isRefund && gross > 0) gross = -gross;
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
  }, [periodFilteredSales]);

  const totalNetto = useMemo(() => Object.values(periodTaxSummary).reduce((sum, tItem) => sum + tItem.net, 0), [periodTaxSummary]);
  const totalVat = useMemo(() => Object.values(periodTaxSummary).reduce((sum, tItem) => sum + tItem.tax, 0), [periodTaxSummary]);

  // Category Breakdown
  const categorySummary = useMemo(() => {
    return periodFilteredSales.reduce((acc, sale) => {
      const isRefund = sale.isRefund || sale.is_refund;
      const items = Array.isArray(sale.items) ? sale.items : [];
      items.forEach(item => {
        const cat = item.category || 'Ostatní';
        let qty = item.quantity !== undefined ? item.quantity : 1;
        let price = parseFloat(item.price || 0);
        let gross = price * qty;
        if (isRefund && gross > 0) gross = -gross;
        if (!acc[cat]) acc[cat] = { category: cat, total: 0, quantity: 0 };
        acc[cat].total += gross;
        acc[cat].quantity += qty;
      });
      return acc;
    }, {});
  }, [periodFilteredSales]);

  const sortedCategories = useMemo(() => {
    return Object.values(categorySummary).sort((a, b) => b.total - a.total);
  }, [categorySummary]);

  // Day of Week Breakdown
  const weekdaySummary = useMemo(() => {
    const daysOrder = [
      { key: 1, name: t('history.weekdays_full.mon') },
      { key: 2, name: t('history.weekdays_full.tue') },
      { key: 3, name: t('history.weekdays_full.wed') },
      { key: 4, name: t('history.weekdays_full.thu') },
      { key: 5, name: t('history.weekdays_full.fri') },
      { key: 6, name: t('history.weekdays_full.sat') },
      { key: 0, name: t('history.weekdays_full.sun') }
    ];

    const map = {
      1: { txCount: 0, total: 0 },
      2: { txCount: 0, total: 0 },
      3: { txCount: 0, total: 0 },
      4: { txCount: 0, total: 0 },
      5: { txCount: 0, total: 0 },
      6: { txCount: 0, total: 0 },
      0: { txCount: 0, total: 0 }
    };

    periodFilteredSales.forEach(sale => {
      const dayIdx = new Date(sale.timestamp).getDay();
      const amt = sale.totalAmount !== undefined ? sale.totalAmount : (sale.total_amount || 0);
      if (map[dayIdx]) {
        map[dayIdx].txCount += 1;
        map[dayIdx].total += amt;
      }
    });

    return daysOrder.map(d => {
      const data = map[d.key];
      const aov = data.txCount > 0 ? data.total / data.txCount : 0;
      return { ...d, txCount: data.txCount, total: data.total, aov };
    });
  }, [periodFilteredSales, t]);

  const getPeriodLabel = () => {
    return periodBadgeLabel || t('history.all_period');
  };

  return (
    <div className="full-view-container">
      <div className="section-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <div className="section-title" style={{ fontSize: '1.4rem' }}>
          <TrendingUp size={26} style={{ color: 'var(--accent-emerald)' }} />
          <span>{t('history.stats_title')}</span>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className="checkout-btn"
            style={{
              padding: '0.45rem 0.95rem',
              fontSize: '0.85rem',
              background: 'var(--accent-emerald)',
              color: '#ffffff',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontWeight: '700'
            }}
            onClick={() => exportSalesToCSV(searchFilteredSales, getPeriodLabel())}
            title={t('history.export_csv_title')}
          >
            <Download size={16} />
            <span>{t('history.export_csv')}</span>
          </button>

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
          <span>{t('history.admin_banner')}</span>
        </div>
      )}

      {/* Top Metrics Cards */}
      <SalesMetricsCards
        metrics={{
          totalRevenue,
          cashRevenue,
          cardRevenue,
          txnCount: transactionCount,
          avgTicket: avgOrderValue
        }}
      />

      {/* Time Period Selector Bar */}
      <SalesPeriodBar
        periodFilter={periodFilter}
        onSelectPreset={handleSelectPreset}
        periodBadgeLabel={periodBadgeLabel}
        onStepPeriod={handleStepPeriod}
        fromDate={fromDate}
        toDate={toDate}
        setFromDate={setFromDate}
        setToDate={setToDate}
        onOpenCalendar={(field) => {
          const iso = computedDateRange.start.toISOString().slice(0, 10);
          setCalendarModal({ isOpen: true, field, initialDate: field === 'from' ? fromDate : field === 'to' ? toDate : iso, title: 'Výběr data' });
        }}
        onOpenRangeModal={() => setIsRangeModalOpen(true)}
        totalMatchingSales={searchFilteredSales.length}
      />

      {/* Subtab Switcher (Receipts vs Analytics) */}
      <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg-card)', padding: '0.35rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
        <button
          className={`nav-tab ${activeSubTab === 'receipts' ? 'active' : ''}`}
          style={{
            flex: 1,
            padding: '0.65rem 1.25rem',
            fontSize: '0.95rem',
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.55rem'
          }}
          onClick={() => setActiveSubTab('receipts')}
        >
          <Receipt size={18} />
          <span>{t('history.subtab_receipts')}</span>
          <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.15)', padding: '0.15rem 0.55rem', borderRadius: 'var(--radius-full)' }}>
            {totalItems}
          </span>
        </button>

        <button
          className={`nav-tab ${activeSubTab === 'analytics' ? 'active' : ''}`}
          style={{
            flex: 1,
            padding: '0.65rem 1.25rem',
            fontSize: '0.95rem',
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.55rem'
          }}
          onClick={() => setActiveSubTab('analytics')}
        >
          <BarChart3 size={18} />
          <span>{t('history.subtab_analytics')}</span>
        </button>
      </div>

      {/* Subtabs Rendering */}
      {activeSubTab === 'analytics' && (
        <SalesAnalyticsCharts
          periodLabel={getPeriodLabel()}
          totalRevenue={totalRevenue}
          cashRevenue={cashRevenue}
          cardRevenue={cardRevenue}
          qrRevenue={qrRevenue}
          transactionCount={transactionCount}
          avgOrderValue={avgOrderValue}
          periodTaxSummary={periodTaxSummary}
          totalNetto={totalNetto}
          totalVat={totalVat}
          sortedCategories={sortedCategories}
          paymentMethodSummary={paymentMethodSummary}
          dayOfWeekSummary={weekdaySummary}
        />
      )}

      {activeSubTab === 'receipts' && (
        <SalesLedgerTable
          totalItems={totalItems}
          docTypeFilter={docTypeFilter}
          setDocTypeFilter={setDocTypeFilter}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          pageSize={pageSize}
          setPageSize={setPageSize}
          searchFilteredSales={searchFilteredSales}
          paginatedSales={paginatedSales}
          onInitiateRefund={onInitiateRefund}
          onSelectSale={setSelectedSale}
          isAdminMode={isAdminMode}
          onDeleteSale={onDeleteSale}
          startIndex={startIndex}
          endIndex={endIndex}
          validCurrentPage={validCurrentPage}
          totalPages={totalPages}
          setCurrentPage={setCurrentPage}
        />
      )}

      {selectedSale && (
        <ReceiptModal
          saleData={selectedSale}
          storeConfig={storeConfig}
          onClose={() => setSelectedSale(null)}
          onNewSale={() => setSelectedSale(null)}
          disableAutoPrint={true}
        />
      )}

      <TouchCalendarModal
        isOpen={calendarModal.isOpen}
        title={calendarModal.title}
        initialDate={calendarModal.initialDate}
        onClose={() => setCalendarModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={(newIsoDate) => {
          if (calendarModal.field === 'from') {
            setFromDate(newIsoDate);
          } else if (calendarModal.field === 'to') {
            setToDate(newIsoDate);
          } else if (calendarModal.field === 'reference') {
            setReferenceDate(new Date(newIsoDate + 'T12:00:00'));
          }
        }}
      />

      <TouchDateRangeModal
        isOpen={isRangeModalOpen}
        initialFromDate={fromDate}
        initialToDate={toDate}
        onClose={() => setIsRangeModalOpen(false)}
        onConfirmRange={(newFrom, newTo) => {
          setFromDate(newFrom);
          setToDate(newTo);
        }}
      />
    </div>
  );
}
