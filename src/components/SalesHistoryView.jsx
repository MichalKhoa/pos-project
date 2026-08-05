import React, { useState, useEffect, useMemo } from 'react';
import { Search, DollarSign, Banknote, CreditCard, Receipt, Eye, Lock, Unlock, Trash2, ShieldAlert, Calendar, BarChart3, PieChart, TrendingUp, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Filter, RotateCcw, Download } from 'lucide-react';
import ReceiptModal from './ReceiptModal';
import TouchCalendarModal from './TouchCalendarModal.jsx';
import TouchDateRangeModal from './TouchDateRangeModal.jsx';
import { useTranslation } from '../i18n/LanguageContext.jsx';
import { exportSalesToCSV } from '../utils/csvExporter';

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
  const currentYear = now.getFullYear();

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

  // Stepper helper: move referenceDate backward (-1) or forward (+1) based on active preset mode
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

  // Switch preset mode and reset reference date
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

  // Compute exact start and end Date objects for active period filter & referenceDate
  const computedDateRange = useMemo(() => {
    const ref = new Date(referenceDate);
    const start = new Date(ref);
    const end = new Date(ref);

    if (periodFilter === 'today' || periodFilter === 'yesterday') {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (periodFilter === 'week') {
      const day = ref.getDay();
      const diffToMon = (day === 0 ? -6 : 1 - day);
      start.setDate(ref.getDate() + diffToMon);
      start.setHours(0, 0, 0, 0);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else if (periodFilter === 'month') {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(start.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
    } else if (periodFilter === 'year') {
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(11, 31);
      end.setHours(23, 59, 59, 999);
    } else if (periodFilter === 'custom') {
      const from = fromDate ? new Date(fromDate + 'T00:00:00') : new Date(0);
      const to = toDate ? new Date(toDate + 'T23:59:59') : new Date();
      return { start: from, end: to };
    } else {
      return { start: new Date(0), end: new Date('2099-12-31') };
    }
    return { start, end };
  }, [periodFilter, referenceDate, fromDate, toDate]);

  // Formatted date badge label for active period & stepper
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

  // Apply document type filter (sales vs stornos) and search query
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

  // Detailed Payment Method Analytics (Cash vs Card vs QR vs Split/Other)
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

  // Daily Sales Statistics Breakdown (aggregated per date in period)
  const dailySalesSummary = useMemo(() => {
    const map = {};
    periodFilteredSales.forEach(sale => {
      const dateKey = sale.timestamp ? sale.timestamp.slice(0, 10) : 'N/A';
      if (!map[dateKey]) {
        map[dateKey] = { date: dateKey, txCount: 0, cashTotal: 0, cardTotal: 0, qrTotal: 0, total: 0 };
      }
      const amt = sale.totalAmount !== undefined ? sale.totalAmount : (sale.total_amount || 0);
      const method = (sale.paymentMethod || sale.payment_method || 'cash').toLowerCase();
      
      map[dateKey].txCount += 1;
      map[dateKey].total += amt;
      if (method === 'cash') {
        map[dateKey].cashTotal += amt;
      } else if (method === 'card') {
        map[dateKey].cardTotal += amt;
      } else if (method === 'qr') {
        map[dateKey].qrTotal += amt;
      }
    });
    return Object.values(map).sort((a, b) => b.date.localeCompare(a.date));
  }, [periodFilteredSales]);

  // Calculate Tax Breakdown for selected period
  const periodTaxSummary = useMemo(() => {
    return periodFilteredSales.reduce((acc, sale) => {
      if (sale.taxSummary && Object.keys(sale.taxSummary).length > 0) {
        Object.values(sale.taxSummary).forEach(t => {
          const rate = t.rate;
          if (!acc[rate]) acc[rate] = { rate, gross: 0, net: 0, tax: 0 };
          acc[rate].gross += t.gross || 0;
          acc[rate].net += t.net || 0;
          acc[rate].tax += t.tax || 0;
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

  const totalNetto = useMemo(() => Object.values(periodTaxSummary).reduce((sum, t) => sum + t.net, 0), [periodTaxSummary]);
  const totalVat = useMemo(() => Object.values(periodTaxSummary).reduce((sum, t) => sum + t.tax, 0), [periodTaxSummary]);

  // Category Breakdown for selected period (with storno math fix)
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

  // Day of Week Breakdown (Pondělí - Neděle)
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
          <span>
            {t('history.admin_banner')}
          </span>
        </div>
      )}

      {/* Intuitive Time Period Selector Bar with Segmented Presets & Stepper Navigation */}
      <div className="table-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          
          {/* Segmented Preset Buttons */}
          <div style={{ display: 'flex', gap: '0.35rem', background: 'var(--bg-input)', padding: '0.3rem', borderRadius: 'var(--radius-md)', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              className={`nav-tab ${periodFilter === 'today' ? 'active' : ''}`}
              style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}
              onClick={() => handleSelectPreset('today')}
            >
              {t('history.today')}
            </button>

            <button
              className={`nav-tab ${periodFilter === 'yesterday' ? 'active' : ''}`}
              style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}
              onClick={() => handleSelectPreset('yesterday')}
            >
              {t('history.yesterday')}
            </button>

            <button
              className={`nav-tab ${periodFilter === 'week' ? 'active' : ''}`}
              style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}
              onClick={() => handleSelectPreset('week')}
            >
              {t('history.this_week')}
            </button>

            <button
              className={`nav-tab ${periodFilter === 'month' ? 'active' : ''}`}
              style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}
              onClick={() => handleSelectPreset('month')}
            >
              {t('history.month')}
            </button>

            <button
              className={`nav-tab ${periodFilter === 'year' ? 'active' : ''}`}
              style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}
              onClick={() => handleSelectPreset('year')}
            >
              {t('history.year')}
            </button>

            <button
              className={`nav-tab ${periodFilter === 'all' ? 'active' : ''}`}
              style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}
              onClick={() => handleSelectPreset('all')}
            >
              {t('history.all_period')}
            </button>

            <button
              className={`nav-tab ${periodFilter === 'custom' ? 'active' : ''}`}
              style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              onClick={() => handleSelectPreset('custom')}
            >
              <Filter size={14} />
              <span>{t('history.custom_date')}</span>
            </button>
          </div>

          {/* Stepper Controls (‹ Date Badge ›) */}
          {periodFilter !== 'all' && periodFilter !== 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-input)', padding: '0.3rem 0.6rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <button
                className="nav-tab"
                style={{ padding: '0.35rem 0.65rem', borderRadius: 'var(--radius-sm)' }}
                onClick={() => handleStepPeriod('prev')}
                title={t('history.prev_period')}
              >
                <ChevronLeft size={18} />
              </button>

              <div
                style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0 0.5rem', cursor: 'pointer' }}
                onClick={() => {
                  const iso = computedDateRange.start.toISOString().slice(0, 10);
                  setCalendarModal({ isOpen: true, field: 'reference', initialDate: iso, title: 'Přejít na Datum (Kalendář)' });
                }}
                title="Přejít na přesné datum v kalendáři"
              >
                <Calendar size={16} style={{ color: 'var(--accent-emerald)' }} />
                <span style={{ fontWeight: '800', fontSize: '0.9rem', color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                  {periodBadgeLabel}
                </span>
              </div>

              <button
                className="nav-tab"
                style={{ padding: '0.35rem 0.65rem', borderRadius: 'var(--radius-sm)' }}
                onClick={() => handleStepPeriod('next')}
                title={t('history.next_period')}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>

        {/* Custom Date Range Picker Block with Touch Calendar Buttons & Shortcuts */}
        {periodFilter === 'custom' && (
          <div style={{
            background: 'var(--bg-card)',
            padding: '0.85rem 1.25rem',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--accent-blue)',
            display: 'flex',
            alignItems: 'center',
            justify: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            boxShadow: 'var(--shadow-md)'
          }}>
            {/* Left: Touch Calendar Selector Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              {/* Dual Range Button */}
              <button
                type="button"
                className="primary-btn"
                onClick={() => setIsRangeModalOpen(true)}
                style={{
                  padding: '0.55rem 1rem',
                  background: 'var(--accent-blue)',
                  color: '#ffffff',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: '800',
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: 'pointer',
                  border: 'none',
                  boxShadow: 'var(--shadow-sm)'
                }}
                title="Otevřít vedle sebe dva kalendáře pro rychlý výběr rozsahu OD – DO"
              >
                <Calendar size={18} />
                <span>Vybrat Rozsah Dat (Vedle Sebe)</span>
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="nav-tab"
                  onClick={() => setCalendarModal({ isOpen: true, field: 'from', initialDate: fromDate, title: 'Vyberte Datum OD (Začátek)' })}
                  style={{
                    padding: '0.45rem 0.75rem',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--accent-blue)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.88rem',
                    fontWeight: '800',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    cursor: 'pointer'
                  }}
                >
                  <span>OD: {fromDate ? fromDate.split('-').reverse().join('. ') : 'Vybrat'}</span>
                </button>

                <span style={{ color: 'var(--text-muted)', fontWeight: '800' }}>➔</span>

                <button
                  type="button"
                  className="nav-tab"
                  onClick={() => setCalendarModal({ isOpen: true, field: 'to', initialDate: toDate, title: 'Vyberte Datum DO (Konec)' })}
                  style={{
                    padding: '0.45rem 0.75rem',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--accent-purple)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.88rem',
                    fontWeight: '800',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    cursor: 'pointer'
                  }}
                >
                  <span>DO: {toDate ? toDate.split('-').reverse().join('. ') : 'Vybrat'}</span>
                </button>
              </div>
            </div>

            {/* Middle: Quick Custom Shortcuts */}
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                className="nav-tab"
                style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem' }}
                onClick={() => {
                  const today = new Date();
                  const d = new Date();
                  d.setDate(d.getDate() - 6);
                  setFromDate(d.toISOString().slice(0, 10));
                  setToDate(today.toISOString().slice(0, 10));
                }}
              >
                Posledních 7 dní
              </button>

              <button
                className="nav-tab"
                style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem' }}
                onClick={() => {
                  const today = new Date();
                  const d = new Date();
                  d.setDate(d.getDate() - 29);
                  setFromDate(d.toISOString().slice(0, 10));
                  setToDate(today.toISOString().slice(0, 10));
                }}
              >
                Posledních 30 dní
              </button>

              <button
                className="nav-tab"
                style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem' }}
                onClick={() => {
                  const today = new Date();
                  const firstOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                  const lastOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
                  setFromDate(firstOfLastMonth.toISOString().slice(0, 10));
                  setToDate(lastOfLastMonth.toISOString().slice(0, 10));
                }}
              >
                Minulý měsíc
              </button>
            </div>

            {/* Right: Found Transactions Badge */}
            <span className="status-badge" style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem', fontWeight: '800', background: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent-blue)', borderColor: 'rgba(59, 130, 246, 0.3)' }}>
              {searchFilteredSales.length} transakcí
            </span>
          </div>
        )}
      </div>

      {/* Sub-tab Navigation Switcher Bar */}
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

      {/* Analytics & Statistics Sub-tab View */}
      {activeSubTab === 'analytics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Primary KPI Metrics */}
          <div className="metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
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
                <span className="metric-label">{t('history.cash_revenue')} ({totalRevenue > 0 ? ((cashRevenue / totalRevenue) * 100 || 0).toFixed(0) : 0}%)</span>
                <span className="metric-value">{cashRevenue.toFixed(0)} Kč</span>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon" style={{ background: 'var(--accent-purple)' }}>
                <CreditCard size={24} />
              </div>
              <div className="metric-info">
                <span className="metric-label">{t('payment.card')} ({totalRevenue > 0 ? ((cardRevenue / totalRevenue) * 100 || 0).toFixed(0) : 0}%)</span>
                <span className="metric-value">{cardRevenue.toFixed(0)} Kč</span>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon" style={{ background: 'var(--accent-amber)' }}>
                <Receipt size={24} />
              </div>
              <div className="metric-info">
                <span className="metric-label">{t('payment.qr')} ({totalRevenue > 0 ? ((qrRevenue / totalRevenue) * 100 || 0).toFixed(0) : 0}%)</span>
                <span className="metric-value">{qrRevenue.toFixed(0)} Kč</span>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <Receipt size={24} />
              </div>
              <div className="metric-info">
                <span className="metric-label">{t('history.txn_count')}</span>
                <span className="metric-value">{transactionCount} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>({avgOrderValue.toFixed(0)} Kč)</span></span>
              </div>
            </div>
          </div>

          {/* Row 1: Tax Breakdown & Category Sales */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem', alignItems: 'stretch' }}>
            {/* VAT Tax Summary Table */}
            <div className="table-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', height: '100%' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BarChart3 size={18} style={{ color: 'var(--accent-blue)' }} />
                <span>VAT Breakdown ({getPeriodLabel()})</span>
              </h3>

              <div style={{ flex: 1, overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>VAT %</th>
                      <th style={{ textAlign: 'right' }}>Netto</th>
                      <th style={{ textAlign: 'right' }}>VAT Amount</th>
                      <th style={{ textAlign: 'right' }}>Brutto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.values(periodTaxSummary).map(t => (
                      <tr key={t.rate}>
                        <td style={{ fontWeight: '700', textAlign: 'left' }}>{t.rate}%</td>
                        <td style={{ fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{t.net.toFixed(2)} Kč</td>
                        <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-purple)', fontWeight: '700', textAlign: 'right' }}>
                          {t.tax.toFixed(2)} Kč
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '800', color: 'var(--accent-emerald)', textAlign: 'right' }}>
                          {t.gross.toFixed(2)} Kč
                        </td>
                      </tr>
                    ))}
                    <tr style={{ borderTop: '2px solid var(--border-color)', fontWeight: '800' }}>
                      <td style={{ textAlign: 'left' }}>TOTAL</td>
                      <td style={{ fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{totalNetto.toFixed(2)} Kč</td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-purple)', textAlign: 'right' }}>{totalVat.toFixed(2)} Kč</td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-emerald)', textAlign: 'right' }}>{totalRevenue.toFixed(2)} Kč</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Category Breakdown Table */}
            <div className="table-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', height: '100%' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <PieChart size={18} style={{ color: 'var(--accent-purple)' }} />
                <span>{t('history.category_sales')}</span>
              </h3>

              <div style={{ flex: 1, overflowX: 'auto' }}>
                {sortedCategories.length === 0 ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>No items in selected period.</div>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left' }}>{t('presets.col_category')}</th>
                        <th style={{ textAlign: 'right' }}>{t('history.items_sold')}</th>
                        <th style={{ textAlign: 'right' }}>{t('history.revenue')} (Kč)</th>
                        <th style={{ textAlign: 'right' }}>{t('history.share')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedCategories.map(cat => (
                        <tr key={cat.category}>
                          <td style={{ fontWeight: '700', textTransform: 'capitalize', textAlign: 'left' }}>{cat.category}</td>
                          <td style={{ textAlign: 'right' }}>{cat.quantity} ks</td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', color: 'var(--accent-emerald)', textAlign: 'right' }}>
                            {cat.total.toFixed(0)} Kč
                          </td>
                          <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                            {((cat.total / (totalRevenue || 1)) * 100).toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

          {/* Row 2: Payment Methods, Weekday Comparison & Daily Sales */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', alignItems: 'stretch' }}>
            {/* Payment Method Breakdown Panel */}
            <div className="table-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', height: '100%' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CreditCard size={18} style={{ color: 'var(--accent-emerald)' }} />
                <span>{t('history.payment_breakdown_title')}</span>
              </h3>

              <div style={{ flex: 1, overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>{t('history.col_payment_method')}</th>
                      <th style={{ textAlign: 'right' }}>{t('history.col_tx_count')}</th>
                      <th style={{ textAlign: 'right' }}>{t('history.col_aov')}</th>
                      <th style={{ textAlign: 'right' }}>{t('history.col_total_czk')}</th>
                      <th style={{ textAlign: 'right' }}>{t('history.share')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.4rem', textAlign: 'left' }}>
                        <Banknote size={15} style={{ color: 'var(--accent-blue)' }} /> {t('payment.cash')}
                      </td>
                      <td style={{ textAlign: 'right' }}>{paymentMethodSummary.cash.count} ks</td>
                      <td style={{ fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{paymentMethodSummary.cash.aov.toFixed(0)} Kč</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', color: 'var(--accent-emerald)', textAlign: 'right' }}>
                        {paymentMethodSummary.cash.total.toFixed(0)} Kč
                      </td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                        {totalRevenue > 0 ? ((paymentMethodSummary.cash.total / totalRevenue) * 100).toFixed(1) : '0.0'}%
                      </td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.4rem', textAlign: 'left' }}>
                        <CreditCard size={15} style={{ color: 'var(--accent-purple)' }} /> {t('payment.card')}
                      </td>
                      <td style={{ textAlign: 'right' }}>{paymentMethodSummary.card.count} ks</td>
                      <td style={{ fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{paymentMethodSummary.card.aov.toFixed(0)} Kč</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', color: 'var(--accent-emerald)', textAlign: 'right' }}>
                        {paymentMethodSummary.card.total.toFixed(0)} Kč
                      </td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                        {totalRevenue > 0 ? ((paymentMethodSummary.card.total / totalRevenue) * 100).toFixed(1) : '0.0'}%
                      </td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.4rem', textAlign: 'left' }}>
                        <Receipt size={15} style={{ color: 'var(--accent-amber)' }} /> {t('payment.qr')}
                      </td>
                      <td style={{ textAlign: 'right' }}>{paymentMethodSummary.qr.count} ks</td>
                      <td style={{ fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{paymentMethodSummary.qr.aov.toFixed(0)} Kč</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', color: 'var(--accent-emerald)', textAlign: 'right' }}>
                        {paymentMethodSummary.qr.total.toFixed(0)} Kč
                      </td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                        {totalRevenue > 0 ? ((paymentMethodSummary.qr.total / totalRevenue) * 100).toFixed(1) : '0.0'}%
                      </td>
                    </tr>
                    {paymentMethodSummary.other.count > 0 && (
                      <tr>
                        <td style={{ fontWeight: '700', textAlign: 'left' }}>{t('history.payment_other')}</td>
                        <td style={{ textAlign: 'right' }}>{paymentMethodSummary.other.count} ks</td>
                        <td style={{ fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{paymentMethodSummary.other.aov.toFixed(0)} Kč</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', color: 'var(--accent-emerald)', textAlign: 'right' }}>
                          {paymentMethodSummary.other.total.toFixed(0)} Kč
                        </td>
                        <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                          {totalRevenue > 0 ? ((paymentMethodSummary.other.total / totalRevenue) * 100).toFixed(1) : '0.0'}%
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Day of Week Breakdown Panel */}
            <div className="table-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', height: '100%' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BarChart3 size={18} style={{ color: 'var(--accent-purple)' }} />
                <span>{t('history.weekday_stats_title')}</span>
              </h3>

              <div style={{ flex: 1, overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>{t('history.col_weekday')}</th>
                      <th style={{ textAlign: 'right' }}>{t('history.col_tx_count')}</th>
                      <th style={{ textAlign: 'right' }}>{t('history.col_aov')}</th>
                      <th style={{ textAlign: 'right' }}>{t('history.col_total_czk')}</th>
                      <th style={{ textAlign: 'right' }}>{t('history.share')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weekdaySummary.map(day => (
                      <tr key={day.key}>
                        <td style={{ fontWeight: '700', textAlign: 'left' }}>{day.name}</td>
                        <td style={{ textAlign: 'right' }}>{day.txCount} ks</td>
                        <td style={{ fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{day.aov.toFixed(0)} Kč</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', color: 'var(--accent-emerald)', textAlign: 'right' }}>
                          {day.total.toFixed(0)} Kč
                        </td>
                        <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                          {totalRevenue > 0 ? ((day.total / totalRevenue) * 100).toFixed(1) : '0.0'}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Daily Sales Breakdown Panel */}
            <div className="table-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', height: '100%' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calendar size={18} style={{ color: 'var(--accent-amber)' }} />
                <span>{t('history.daily_stats_title')}</span>
              </h3>

              <div style={{ flex: 1, overflowX: 'auto' }}>
                {dailySalesSummary.length === 0 ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>{t('history.no_daily_sales')}</div>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left' }}>{t('history.col_date')}</th>
                        <th style={{ textAlign: 'right' }}>{t('history.col_tx_count')}</th>
                        <th style={{ textAlign: 'right' }}>{t('payment.cash')}</th>
                        <th style={{ textAlign: 'right' }}>{t('payment.card')}</th>
                        <th style={{ textAlign: 'right' }}>{t('payment.qr')}</th>
                        <th style={{ textAlign: 'right' }}>{t('cart.total')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailySalesSummary.map(day => (
                        <tr key={day.date}>
                          <td style={{ fontWeight: '700', whiteSpace: 'nowrap', textAlign: 'left' }}>
                            {new Date(day.date).toLocaleDateString(language === 'cs' ? 'cs-CZ' : language === 'vi' ? 'vi-VN' : 'en-US')}
                          </td>
                          <td style={{ textAlign: 'right' }}>{day.txCount}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{day.cashTotal.toFixed(0)} Kč</td>
                          <td style={{ fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{day.cardTotal.toFixed(0)} Kč</td>
                          <td style={{ fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{day.qrTotal.toFixed(0)} Kč</td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '800', color: 'var(--accent-emerald)', textAlign: 'right' }}>
                            {day.total.toFixed(0)} Kč
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Ledger Sub-tab View */}
      {activeSubTab === 'receipts' && (
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

                            {sale.eet_status === 'DISABLED' && (
                              <span className="status-badge" style={{ background: 'rgba(148, 163, 184, 0.15)', color: 'var(--text-secondary)', borderColor: 'rgba(148, 163, 184, 0.3)' }}>
                                Bez EET
                              </span>
                            )}
                            {sale.eet_status === 'OFFLINE_PENDING' && (
                              <span className="status-badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-amber)', borderColor: 'rgba(245, 158, 11, 0.3)' }}>
                                EET Čeká
                              </span>
                            )}
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
      )}

      {selectedSale && (
        <ReceiptModal
          saleData={selectedSale}
          storeConfig={storeConfig}
          onClose={() => setSelectedSale(null)}
          onNewSale={() => setSelectedSale(null)}
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
