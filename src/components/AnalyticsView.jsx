import React, { useState, useMemo } from 'react';
import { BarChart3, Download } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext.jsx';
import { exportSalesToCSV } from '../utils/csvExporter';
import SalesPeriodBar from './history/SalesPeriodBar.jsx';
import SalesAnalyticsCharts from './history/SalesAnalyticsCharts.jsx';
import TouchCalendarModal from './TouchCalendarModal.jsx';
import TouchDateRangeModal from './TouchDateRangeModal.jsx';
import { formatLocalDate, getPeriodDateRange } from '../utils/dateUtils';

export default function AnalyticsView({
  salesHistory = []
}) {
  const { t, language } = useTranslation();
  const [periodFilter, setPeriodFilter] = useState('month');
  const [referenceDate, setReferenceDate] = useState(new Date());
  const [calendarModal, setCalendarModal] = useState({ isOpen: false, field: 'from', initialDate: '', title: '' });
  const [isRangeModalOpen, setIsRangeModalOpen] = useState(false);

  const now = new Date();
  const todayStr = formatLocalDate(now);
  const firstOfMonthStr = formatLocalDate(new Date(now.getFullYear(), now.getMonth(), 1));

  const [fromDate, setFromDate] = useState(firstOfMonthStr);
  const [toDate, setToDate] = useState(todayStr);

  // Stepper helper for date navigation
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

  const computedDateRange = useMemo(() => {
    return getPeriodDateRange(periodFilter, referenceDate, fromDate, toDate);
  }, [periodFilter, referenceDate, fromDate, toDate]);

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
      return start.toLocaleDateString(localeStr, { month: 'long', year: 'numeric' });
    }
    if (periodFilter === 'year') {
      return `Rok ${start.getFullYear()}`;
    }
    return '';
  }, [periodFilter, computedDateRange, fromDate, toDate, language, t]);

  const periodFilteredSales = useMemo(() => {
    if (periodFilter === 'all') return salesHistory;
    const { start, end } = computedDateRange;
    return salesHistory.filter(sale => {
      const saleDate = new Date(sale.timestamp || sale.created_at || sale.date);
      return saleDate >= start && saleDate <= end;
    });
  }, [salesHistory, periodFilter, computedDateRange]);

  // Financial Metrics Calculations
  const {
    totalRevenue,
    cashRevenue,
    cardRevenue,
    qrRevenue,
    transactionCount,
    avgOrderValue,
    totalNetto,
    totalVat,
    periodTaxSummary,
    paymentMethodSummary
  } = useMemo(() => {
    let rev = 0;
    let cash = 0;
    let card = 0;
    let qr = 0;
    let netto = 0;
    let vat = 0;

    const taxMap = {
      21: { rate: 21, gross: 0, net: 0, tax: 0 },
      12: { rate: 12, gross: 0, net: 0, tax: 0 },
      0: { rate: 0, gross: 0, net: 0, tax: 0 }
    };

    const payMap = {
      cash: { count: 0, total: 0, aov: 0 },
      card: { count: 0, total: 0, aov: 0 },
      qr: { count: 0, total: 0, aov: 0 },
      other: { count: 0, total: 0, aov: 0 }
    };

    periodFilteredSales.forEach(sale => {
      const amount = parseFloat(sale.totalAmount !== undefined ? sale.totalAmount : (sale.total_amount || 0)) || 0;
      rev += amount;

      if (sale.cashAmount !== undefined || sale.cardAmount !== undefined || sale.cash_amount !== undefined || sale.card_amount !== undefined) {
        cash += parseFloat(sale.cashAmount || sale.cash_amount || 0);
        card += parseFloat(sale.cardAmount || sale.card_amount || 0);
      } else if (sale.paymentMethod === 'cash' || sale.payment_method === 'cash') {
        cash += amount;
      } else if (sale.paymentMethod === 'card' || sale.payment_method === 'card') {
        card += amount;
      } else if (sale.paymentMethod === 'qr' || sale.payment_method === 'qr') {
        qr += amount;
      }

      const method = (sale.paymentMethod || sale.payment_method || 'cash').toLowerCase();
      if (method === 'cash') {
        payMap.cash.count += 1;
        payMap.cash.total += amount;
      } else if (method === 'card') {
        payMap.card.count += 1;
        payMap.card.total += amount;
      } else if (method === 'qr') {
        payMap.qr.count += 1;
        payMap.qr.total += amount;
      } else {
        payMap.other.count += 1;
        payMap.other.total += amount;
      }

      if (sale.tax_summary && typeof sale.tax_summary === 'object') {
        Object.entries(sale.tax_summary).forEach(([rateStr, tData]) => {
          const r = parseInt(rateStr, 10);
          if (taxMap[r]) {
            taxMap[r].net += parseFloat(tData.base || tData.base_amount || 0);
            taxMap[r].tax += parseFloat(tData.vat || tData.vat_amount || 0);
            taxMap[r].gross += parseFloat(tData.total || 0);
          }
        });
      } else if (Array.isArray(sale.items)) {
        const isRefund = sale.isRefund || sale.is_refund;
        sale.items.forEach(item => {
          const r = item.vat !== undefined ? parseInt(item.vat, 10) : 21;
          let lineGross = (parseFloat(item.price) || 0) * (item.quantity || 1) * (1 - (item.discountPercent || 0) / 100);
          if (isRefund && lineGross > 0) lineGross = -lineGross;
          const divisor = 1 + r / 100;
          const lineNet = lineGross / divisor;
          const lineTax = lineGross - lineNet;

          if (taxMap[r]) {
            taxMap[r].net += lineNet;
            taxMap[r].tax += lineTax;
            taxMap[r].gross += lineGross;
          }
        });
      }
    });

    payMap.cash.aov = payMap.cash.count > 0 ? payMap.cash.total / payMap.cash.count : 0;
    payMap.card.aov = payMap.card.count > 0 ? payMap.card.total / payMap.card.count : 0;
    payMap.qr.aov = payMap.qr.count > 0 ? payMap.qr.total / payMap.qr.count : 0;
    payMap.other.aov = payMap.other.count > 0 ? payMap.other.total / payMap.other.count : 0;

    Object.values(taxMap).forEach(tInfo => {
      netto += tInfo.net;
      vat += tInfo.tax;
    });

    const count = periodFilteredSales.length;
    const aov = count > 0 ? rev / count : 0;

    return {
      totalRevenue: rev,
      cashRevenue: cash,
      cardRevenue: card,
      qrRevenue: qr,
      transactionCount: count,
      avgOrderValue: aov,
      totalNetto: netto,
      totalVat: vat,
      periodTaxSummary: taxMap,
      paymentMethodSummary: payMap
    };
  }, [periodFilteredSales]);

  // Top Best-Selling Products (Ranked by Revenue & Qty)
  const topProducts = useMemo(() => {
    const prodMap = {};
    periodFilteredSales.forEach(sale => {
      const isRefund = sale.isRefund || sale.is_refund;
      const items = Array.isArray(sale.items) ? sale.items : [];
      items.forEach(item => {
        const name = item.name || 'Neznámá položka';
        const qty = item.quantity !== undefined ? item.quantity : 1;
        const price = parseFloat(item.price || 0);
        let gross = price * qty;
        if (isRefund && gross > 0) gross = -gross;
        if (!prodMap[name]) {
          prodMap[name] = { name, category: item.category || 'Ostatní', quantity: 0, totalRevenue: 0 };
        }
        prodMap[name].quantity += isRefund ? -qty : qty;
        prodMap[name].totalRevenue += gross;
      });
    });

    const list = Object.values(prodMap).filter(p => p.quantity > 0 || p.totalRevenue > 0);
    list.sort((a, b) => b.totalRevenue - a.totalRevenue);
    const topList = list.slice(0, 8);
    const maxItemRevenue = topList.length > 0 ? Math.max(1, topList[0].totalRevenue) : 1;

    return topList.map((p, idx) => ({
      ...p,
      rank: idx + 1,
      relativeBar: Math.min(100, Math.max(12, Math.round((p.totalRevenue / maxItemRevenue) * 100))),
      sharePercent: totalRevenue > 0 ? ((p.totalRevenue / totalRevenue) * 100).toFixed(1) : '0.0'
    }));
  }, [periodFilteredSales, totalRevenue]);

  // Hourly Sales & Rush Hour Traffic (07:00 – 22:00)
  const hourlySales = useMemo(() => {
    const hours = [];
    for (let h = 7; h <= 22; h++) {
      hours.push({
        hour: h,
        label: `${h.toString().padStart(2, '0')}:00`,
        count: 0,
        revenue: 0
      });
    }

    periodFilteredSales.forEach(sale => {
      const isRefund = sale.isRefund || sale.is_refund;
      const d = new Date(sale.timestamp || sale.created_at || sale.date);
      const h = d.getHours();
      const amt = parseFloat(sale.totalAmount !== undefined ? sale.totalAmount : (sale.total_amount || 0)) || 0;
      const target = hours.find(x => x.hour === h);
      if (target) {
        target.count += 1;
        target.revenue += isRefund ? -Math.abs(amt) : amt;
      }
    });

    const maxRev = Math.max(1, ...hours.map(h => Math.max(0, h.revenue)));
    let peak = null;
    hours.forEach(h => {
      if (h.revenue > 0 && (!peak || h.revenue > peak.revenue)) {
        peak = h;
      }
    });

    return {
      hours,
      maxRevenue: maxRev,
      peakHour: peak
    };
  }, [periodFilteredSales]);

  // Refund and Cancellation Metrics
  const refundMetrics = useMemo(() => {
    let count = 0;
    let amount = 0;
    periodFilteredSales.forEach(sale => {
      if (sale.isRefund || sale.is_refund) {
        count += 1;
        amount += Math.abs(parseFloat(sale.totalAmount !== undefined ? sale.totalAmount : (sale.total_amount || 0)) || 0);
      } else if (sale.refundedAmount || sale.refunded_amount) {
        amount += parseFloat(sale.refundedAmount || sale.refunded_amount || 0);
      }
    });
    return { count, amount };
  }, [periodFilteredSales]);

  // Category Breakdown
  const sortedCategories = useMemo(() => {
    const categorySummary = periodFilteredSales.reduce((acc, sale) => {
      const isRefund = sale.isRefund || sale.is_refund;
      const items = Array.isArray(sale.items) ? sale.items : [];
      items.forEach(item => {
        const cat = item.category || 'Ostatní';
        const qty = item.quantity !== undefined ? item.quantity : 1;
        const price = parseFloat(item.price || 0);
        let gross = price * qty;
        if (isRefund && gross > 0) gross = -gross;
        if (!acc[cat]) acc[cat] = { category: cat, total: 0, quantity: 0 };
        acc[cat].total += gross;
        acc[cat].quantity += qty;
      });
      return acc;
    }, {});

    return Object.values(categorySummary)
      .filter(c => c.total > 0 || c.quantity > 0)
      .sort((a, b) => b.total - a.total);
  }, [periodFilteredSales]);

  const getPeriodLabel = () => {
    return periodBadgeLabel || t('history.all_period');
  };

  return (
    <div className="full-view-container">
      {/* View Header */}
      <div className="section-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
        <div className="section-title" style={{ fontSize: '1.3rem' }}>
          <BarChart3 size={24} style={{ color: 'var(--accent-blue)' }} />
          <span>{t('analytics.title') || 'Analytika & Přehled tržeb'}</span>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className="checkout-btn"
            style={{
              padding: '0.4rem 0.85rem',
              fontSize: '0.82rem',
              background: 'var(--accent-emerald)',
              color: '#ffffff',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontWeight: '700'
            }}
            onClick={() => exportSalesToCSV(periodFilteredSales, getPeriodLabel())}
            title={t('history.export_csv_title')}
          >
            <Download size={15} />
            <span>{t('history.export_csv')}</span>
          </button>
        </div>
      </div>

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
        totalMatchingSales={periodFilteredSales.length}
      />

      {/* Visual Analytics Dashboard */}
      <SalesAnalyticsCharts
        periodLabel={getPeriodLabel()}
        totalRevenue={totalRevenue}
        cashRevenue={cashRevenue}
        cardRevenue={cardRevenue}
        qrRevenue={qrRevenue}
        transactionCount={transactionCount}
        avgOrderValue={avgOrderValue}
        totalNetto={totalNetto}
        totalVat={totalVat}
        periodTaxSummary={periodTaxSummary}
        paymentMethodSummary={paymentMethodSummary}
        sortedCategories={sortedCategories}
        topProducts={topProducts}
        hourlySales={hourlySales}
        refundMetrics={refundMetrics}
      />

      {/* Touch Calendar Date Modals */}
      <TouchCalendarModal
        isOpen={calendarModal.isOpen}
        onClose={() => setCalendarModal(prev => ({ ...prev, isOpen: false }))}
        title={calendarModal.title}
        initialDate={calendarModal.initialDate}
        onConfirm={(selectedDate) => {
          if (calendarModal.field === 'from') {
            setFromDate(selectedDate);
            setPeriodFilter('custom');
          } else if (calendarModal.field === 'to') {
            setToDate(selectedDate);
            setPeriodFilter('custom');
          }
          setCalendarModal(prev => ({ ...prev, isOpen: false }));
        }}
      />

      <TouchDateRangeModal
        isOpen={isRangeModalOpen}
        onClose={() => setIsRangeModalOpen(false)}
        initialFromDate={fromDate}
        initialToDate={toDate}
        onConfirmRange={(fromD, toD) => {
          setFromDate(fromD);
          setToDate(toD);
          setPeriodFilter('custom');
        }}
      />
    </div>
  );
}
