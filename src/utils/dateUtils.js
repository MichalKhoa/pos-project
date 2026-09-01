/**
 * Himmel POS — Local Timezone Safe Date Utilities
 * Prevents UTC shift bugs where .toISOString() rolls back local dates across timezones.
 */

/**
 * Returns 'YYYY-MM-DD' formatted date string in the client's local timezone.
 * @param {Date|string|number} [dateInput]
 * @returns {string} 'YYYY-MM-DD'
 */
export function formatLocalDate(dateInput) {
  const d = dateInput instanceof Date ? dateInput : (dateInput ? new Date(dateInput) : new Date());
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses a 'YYYY-MM-DD' string into a local Date object at start of day (00:00:00.000).
 * @param {string} dateStr 'YYYY-MM-DD'
 * @returns {Date}
 */
export function parseLocalDateStart(dateStr) {
  if (!dateStr) return new Date(0);
  const parts = dateStr.split('-');
  if (parts.length !== 3) return new Date(dateStr);
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  return new Date(year, month, day, 0, 0, 0, 0);
}

/**
 * Parses a 'YYYY-MM-DD' string into a local Date object at end of day (23:59:59.999).
 * @param {string} dateStr 'YYYY-MM-DD'
 * @returns {Date}
 */
export function parseLocalDateEnd(dateStr) {
  if (!dateStr) return new Date();
  const parts = dateStr.split('-');
  if (parts.length !== 3) return new Date(dateStr);
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  return new Date(year, month, day, 23, 59, 59, 999);
}

/**
 * Computes exact start and end Date range for POS periods.
 * @param {'today'|'yesterday'|'week'|'month'|'year'|'all'|'custom'} periodFilter
 * @param {Date} [referenceDate]
 * @param {string} [fromDate] 'YYYY-MM-DD'
 * @param {string} [toDate] 'YYYY-MM-DD'
 * @returns {{ start: Date, end: Date }}
 */
export function getPeriodDateRange(periodFilter, referenceDate = new Date(), fromDate = '', toDate = '') {
  const ref = new Date(referenceDate);

  if (periodFilter === 'today' || periodFilter === 'yesterday') {
    const start = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 0, 0, 0, 0);
    const end = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 23, 59, 59, 999);
    return { start, end };
  }

  if (periodFilter === 'week') {
    const day = ref.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    const diffToMon = (day === 0 ? -6 : 1 - day);
    const mon = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + diffToMon, 0, 0, 0, 0);
    const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6, 23, 59, 59, 999);
    return { start: mon, end: sun };
  }

  if (periodFilter === 'month') {
    const start = new Date(ref.getFullYear(), ref.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }

  if (periodFilter === 'year') {
    const start = new Date(ref.getFullYear(), 0, 1, 0, 0, 0, 0);
    const end = new Date(ref.getFullYear(), 11, 31, 23, 59, 59, 999);
    return { start, end };
  }

  if (periodFilter === 'custom') {
    const start = fromDate ? parseLocalDateStart(fromDate) : new Date(0);
    const end = toDate ? parseLocalDateEnd(toDate) : new Date();
    return { start, end };
  }

  // 'all'
  return { start: new Date(0), end: new Date(2099, 11, 31, 23, 59, 59, 999) };
}
