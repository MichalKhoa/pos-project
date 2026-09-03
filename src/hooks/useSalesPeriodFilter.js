import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '../i18n/LanguageContext.jsx';
import { formatLocalDate, getPeriodDateRange } from '../utils/dateUtils';

export function useSalesPeriodFilter({ salesHistory = [], initialDateFilter = null } = {}) {
  const { t, language } = useTranslation();
  const [periodFilter, setPeriodFilter] = useState('month'); // 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'all' | 'custom'
  const [referenceDate, setReferenceDate] = useState(new Date());
  const [calendarModal, setCalendarModal] = useState({ isOpen: false, field: 'from', initialDate: '', title: '' });
  const [isRangeModalOpen, setIsRangeModalOpen] = useState(false);

  const now = new Date();
  const todayStr = formatLocalDate(now);
  const firstOfMonthStr = formatLocalDate(new Date(now.getFullYear(), now.getMonth(), 1));

  const [fromDate, setFromDate] = useState(firstOfMonthStr);
  const [toDate, setToDate] = useState(todayStr);

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
      return start.toLocaleDateString(localeStr, { month: 'long', year: 'numeric' });
    }
    if (periodFilter === 'year') {
      return `Rok ${start.getFullYear()}`;
    }
    return '';
  }, [periodFilter, computedDateRange, fromDate, toDate, language, t]);

  // Filter sales by computed date range
  const periodFilteredSales = useMemo(() => {
    if (periodFilter === 'all') return salesHistory;
    const { start, end } = computedDateRange;
    return salesHistory.filter(sale => {
      const saleDate = new Date(sale.timestamp || sale.created_at || sale.date);
      return saleDate >= start && saleDate <= end;
    });
  }, [salesHistory, periodFilter, computedDateRange]);

  return {
    periodFilter,
    setPeriodFilter,
    referenceDate,
    setReferenceDate,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    calendarModal,
    setCalendarModal,
    isRangeModalOpen,
    setIsRangeModalOpen,
    handleStepPeriod,
    handleSelectPreset,
    computedDateRange,
    periodBadgeLabel,
    periodFilteredSales
  };
}
