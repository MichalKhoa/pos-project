export const CZECH_MONTHS = [
  'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
  'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'
];

export const WEEKDAY_NAMES = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];

/**
 * Generates a 42-cell calendar grid for a given year and month (0-indexed).
 * Each cell contains: { type: 'prev' | 'current' | 'next', day, month, year, iso }
 */
export function buildCalendarGrid(yr, mo) {
  const cells = [];
  const firstDay = new Date(yr, mo, 1);
  const daysInActive = new Date(yr, mo + 1, 0).getDate();
  const daysInPrev = new Date(yr, mo, 0).getDate();

  const dayOfWeek = firstDay.getDay();
  const leadCount = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  for (let i = leadCount - 1; i >= 0; i--) {
    const prevDay = daysInPrev - i;
    const prevMo = mo === 0 ? 11 : mo - 1;
    const prevYr = mo === 0 ? yr - 1 : yr;
    const iso = `${prevYr}-${(prevMo + 1).toString().padStart(2, '0')}-${prevDay.toString().padStart(2, '0')}`;
    cells.push({ type: 'prev', day: prevDay, month: prevMo, year: prevYr, iso });
  }

  for (let d = 1; d <= daysInActive; d++) {
    const iso = `${yr}-${(mo + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
    cells.push({ type: 'current', day: d, month: mo, year: yr, iso });
  }

  const fillCount = 42 - cells.length;
  for (let n = 1; n <= fillCount; n++) {
    const nextMo = mo === 11 ? 0 : mo + 1;
    const nextYr = mo === 11 ? yr + 1 : yr;
    const iso = `${nextYr}-${(nextMo + 1).toString().padStart(2, '0')}-${n.toString().padStart(2, '0')}`;
    cells.push({ type: 'next', day: n, month: nextMo, year: nextYr, iso });
  }

  return cells;
}

/**
 * Steps month forward or backward, returning { year, month }.
 */
export function stepMonth(year, month, direction) {
  if (direction === 'prev') {
    if (month === 0) return { year: year - 1, month: 11 };
    return { year, month: month - 1 };
  }
  if (month === 11) return { year: year + 1, month: 0 };
  return { year, month: month + 1 };
}
