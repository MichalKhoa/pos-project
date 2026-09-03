/**
 * Calculates Easter Sunday for a given year (Meeus/Jones/Butcher algorithm)
 */
export function getEasterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/**
 * Returns Czech Holiday information and Retail Closure Law (Zákon č. 223/2016 Sb.) status
 */
export function getCzechHoliday(dateObj) {
  const d = dateObj.getDate();
  const m = dateObj.getMonth() + 1; // 1-12
  const y = dateObj.getFullYear();

  // Fixed Czech National Holidays
  if (m === 1 && d === 1) return { name: 'Den obnovy samostatného českého státu / Nový rok', isClosed: true };
  if (m === 5 && d === 1) return { name: 'Svátek práce', isClosed: false };
  if (m === 5 && d === 8) return { name: 'Den vítězství', isClosed: true };
  if (m === 7 && d === 5) return { name: 'Den slovanských věrozvěstů Cyrila a Metoděje', isClosed: false };
  if (m === 7 && d === 6) return { name: 'Den upálení mistra Jana Husa', isClosed: false };
  if (m === 9 && d === 28) return { name: 'Den české státnosti (svatý Václav)', isClosed: true };
  if (m === 10 && d === 28) return { name: 'Den vzniku samostatného československého státu', isClosed: true };
  if (m === 11 && d === 17) return { name: 'Den boje za svobodu a demokracii', isClosed: false };
  if (m === 12 && d === 24) return { name: 'Štědrý den (zákaz prodeje od 12:00)', isClosed: true, isHalfDay: true };
  if (m === 12 && d === 25) return { name: '1. svátek vánoční', isClosed: true };
  if (m === 12 && d === 26) return { name: '2. svátek vánoční', isClosed: true };

  // Dynamic Easter Holidays
  const easterSunday = getEasterSunday(y);

  // Good Friday = Easter Sunday - 2 days
  const goodFriday = new Date(easterSunday);
  goodFriday.setDate(easterSunday.getDate() - 2);
  if (goodFriday.getMonth() + 1 === m && goodFriday.getDate() === d) {
    return { name: 'Velký pátek', isClosed: false };
  }

  // Easter Monday = Easter Sunday + 1 day
  const easterMonday = new Date(easterSunday);
  easterMonday.setDate(easterSunday.getDate() + 1);
  if (easterMonday.getMonth() + 1 === m && easterMonday.getDate() === d) {
    return { name: 'Velikonoční pondělí', isClosed: true };
  }

  return null;
}
