/**
 * Himmel POS — Multi-Period Comparison Data Aggregator
 * Computes comparative statistics for Last 30 Days, Last 12 Weeks, and Last 12 Months.
 */
import { formatLocalDate } from './dateUtils';

/**
 * Aggregates sales for the last N calendar days.
 * @param {Array} sales
 * @param {number} [daysCount=30]
 * @param {Date} [referenceDate=new Date()]
 * @param {string} [locale='cs']
 * @returns {{ items: Array, totalRevenue: number, totalCount: number, avgRevenue: number, maxRevenue: number }}
 */
export function aggregateDailyStats(sales = [], daysCount = 30, referenceDate = new Date(), locale = 'cs') {
  const ref = new Date(referenceDate);
  const localeStr = locale === 'cs' ? 'cs-CZ' : locale === 'vi' ? 'vi-VN' : 'en-US';

  // Map sales by YYYY-MM-DD
  const salesByDate = new Map();
  sales.forEach(sale => {
    const rawDate = sale.created_at || sale.timestamp || sale.date;
    if (!rawDate) return;
    const dateKey = formatLocalDate(rawDate);
    const amt = parseFloat(sale.totalAmount !== undefined ? sale.totalAmount : (sale.total_amount || 0)) || 0;
    
    if (!salesByDate.has(dateKey)) {
      salesByDate.set(dateKey, { revenue: 0, count: 0 });
    }
    const entry = salesByDate.get(dateKey);
    entry.revenue += amt;
    entry.count += 1;
  });

  const items = [];
  let totalRevenue = 0;
  let totalCount = 0;
  let maxRevenue = 0;

  const todayKey = formatLocalDate(ref);
  const yesterdayDate = new Date(ref);
  yesterdayDate.setDate(ref.getDate() - 1);
  const yesterdayKey = formatLocalDate(yesterdayDate);

  for (let i = 0; i < daysCount; i++) {
    const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - i);
    const dateKey = formatLocalDate(d);
    const stat = salesByDate.get(dateKey) || { revenue: 0, count: 0 };

    let label;
    if (dateKey === todayKey) {
      label = locale === 'cs' ? 'Dnes' : locale === 'vi' ? 'Hôm nay' : 'Today';
    } else if (dateKey === yesterdayKey) {
      label = locale === 'cs' ? 'Včera' : locale === 'vi' ? 'Hôm qua' : 'Yesterday';
    } else {
      label = d.toLocaleDateString(localeStr, { weekday: 'short', day: 'numeric', month: 'numeric' });
    }

    const shortDate = d.toLocaleDateString(localeStr, { day: 'numeric', month: 'numeric' });

    totalRevenue += stat.revenue;
    totalCount += stat.count;
    if (stat.revenue > maxRevenue) maxRevenue = stat.revenue;

    items.push({
      dateKey,
      label,
      shortDate,
      revenue: stat.revenue,
      count: stat.count,
      isCurrent: dateKey === todayKey
    });
  }

  // Calculate relative bars
  const safeMax = maxRevenue > 0 ? maxRevenue : 1;
  items.forEach(item => {
    item.relativePercent = Math.round((item.revenue / safeMax) * 100);
  });

  const avgRevenue = daysCount > 0 ? totalRevenue / daysCount : 0;

  return {
    items,
    totalRevenue,
    totalCount,
    avgRevenue,
    maxRevenue
  };
}

/**
 * Aggregates sales for the last N calendar weeks (Monday–Sunday).
 * @param {Array} sales
 * @param {number} [weeksCount=12]
 * @param {Date} [referenceDate=new Date()]
 * @param {string} [locale='cs']
 * @returns {{ items: Array, totalRevenue: number, totalCount: number, avgRevenue: number, maxRevenue: number }}
 */
export function aggregateWeeklyStats(sales = [], weeksCount = 12, referenceDate = new Date(), locale = 'cs') {
  const ref = new Date(referenceDate);
  const localeStr = locale === 'cs' ? 'cs-CZ' : locale === 'vi' ? 'vi-VN' : 'en-US';

  // Find Monday of the reference week
  const day = ref.getDay(); // 0 = Sun, 1 = Mon
  const diffToMon = day === 0 ? -6 : 1 - day;
  const currentMonday = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + diffToMon, 0, 0, 0, 0);

  const weekBuckets = [];
  for (let w = 0; w < weeksCount; w++) {
    const mon = new Date(currentMonday.getFullYear(), currentMonday.getMonth(), currentMonday.getDate() - (w * 7), 0, 0, 0, 0);
    const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6, 23, 59, 59, 999);

    let label;
    if (w === 0) {
      label = locale === 'cs' ? 'Tento týden' : locale === 'vi' ? 'Tuần này' : 'This Week';
    } else if (w === 1) {
      label = locale === 'cs' ? 'Minulý týden' : locale === 'vi' ? 'Tuần trước' : 'Last Week';
    } else {
      label = `${mon.toLocaleDateString(localeStr, { day: 'numeric', month: 'numeric' })} – ${sun.toLocaleDateString(localeStr, { day: 'numeric', month: 'numeric' })}`;
    }

    weekBuckets.push({
      index: w,
      start: mon,
      end: sun,
      label,
      shortRange: `${mon.toLocaleDateString(localeStr, { day: 'numeric', month: 'numeric' })} – ${sun.toLocaleDateString(localeStr, { day: 'numeric', month: 'numeric' })}`,
      revenue: 0,
      count: 0,
      isCurrent: w === 0
    });
  }

  // Assign sales to week buckets
  sales.forEach(sale => {
    const rawDate = sale.created_at || sale.timestamp || sale.date;
    if (!rawDate) return;
    const saleTime = new Date(rawDate).getTime();
    const amt = parseFloat(sale.totalAmount !== undefined ? sale.totalAmount : (sale.total_amount || 0)) || 0;

    for (const wb of weekBuckets) {
      if (saleTime >= wb.start.getTime() && saleTime <= wb.end.getTime()) {
        wb.revenue += amt;
        wb.count += 1;
        break;
      }
    }
  });

  let totalRevenue = 0;
  let totalCount = 0;
  let maxRevenue = 0;

  weekBuckets.forEach(wb => {
    totalRevenue += wb.revenue;
    totalCount += wb.count;
    if (wb.revenue > maxRevenue) maxRevenue = wb.revenue;
  });

  const safeMax = maxRevenue > 0 ? maxRevenue : 1;
  weekBuckets.forEach(wb => {
    wb.relativePercent = Math.round((wb.revenue / safeMax) * 100);
  });

  const avgRevenue = weeksCount > 0 ? totalRevenue / weeksCount : 0;

  return {
    items: weekBuckets,
    totalRevenue,
    totalCount,
    avgRevenue,
    maxRevenue
  };
}

/**
 * Aggregates sales for the last N calendar months.
 * @param {Array} sales
 * @param {number} [monthsCount=12]
 * @param {Date} [referenceDate=new Date()]
 * @param {string} [locale='cs']
 * @returns {{ items: Array, totalRevenue: number, totalCount: number, avgRevenue: number, maxRevenue: number }}
 */
export function aggregateMonthlyStats(sales = [], monthsCount = 12, referenceDate = new Date(), locale = 'cs') {
  const ref = new Date(referenceDate);
  const localeStr = locale === 'cs' ? 'cs-CZ' : locale === 'vi' ? 'vi-VN' : 'en-US';

  const monthBuckets = [];
  for (let m = 0; m < monthsCount; m++) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - m, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const start = new Date(year, month, 1, 0, 0, 0, 0);
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999);

    const fullMonthName = d.toLocaleDateString(localeStr, { month: 'long', year: 'numeric' });
    const capitalizedMonth = fullMonthName.charAt(0).toUpperCase() + fullMonthName.slice(1);
    const shortLabel = d.toLocaleDateString(localeStr, { month: 'short' });

    monthBuckets.push({
      year,
      month,
      start,
      end,
      label: capitalizedMonth,
      shortLabel,
      revenue: 0,
      count: 0,
      isCurrent: m === 0
    });
  }

  // Assign sales to month buckets
  sales.forEach(sale => {
    const rawDate = sale.created_at || sale.timestamp || sale.date;
    if (!rawDate) return;
    const saleTime = new Date(rawDate).getTime();
    const amt = parseFloat(sale.totalAmount !== undefined ? sale.totalAmount : (sale.total_amount || 0)) || 0;

    for (const mb of monthBuckets) {
      if (saleTime >= mb.start.getTime() && saleTime <= mb.end.getTime()) {
        mb.revenue += amt;
        mb.count += 1;
        break;
      }
    }
  });

  let totalRevenue = 0;
  let totalCount = 0;
  let maxRevenue = 0;

  monthBuckets.forEach(mb => {
    totalRevenue += mb.revenue;
    totalCount += mb.count;
    if (mb.revenue > maxRevenue) maxRevenue = mb.revenue;
  });

  const safeMax = maxRevenue > 0 ? maxRevenue : 1;
  monthBuckets.forEach(mb => {
    mb.relativePercent = Math.round((mb.revenue / safeMax) * 100);
  });

  const avgRevenue = monthsCount > 0 ? totalRevenue / monthsCount : 0;

  return {
    items: monthBuckets,
    totalRevenue,
    totalCount,
    avgRevenue,
    maxRevenue
  };
}
