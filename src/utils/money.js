// Cart amounts: always two decimals, thousands grouped with a non-breaking space ("12 345.50").
// The decimal dot matches the payment modal; a Czech comma should be an app-wide change.
export function formatKc(amount) {
  const n = Number(amount) || 0;
  const fixed = Math.abs(n).toFixed(2);
  const [whole, decimals] = fixed.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${n < 0 && fixed !== '0.00' ? '-' : ''}${grouped}.${decimals}`;
}
