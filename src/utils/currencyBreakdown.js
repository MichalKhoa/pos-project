/**
 * Czech Republic (CZK) Cash Denomination Breakdown Helper
 * Greedy change calculation for cashiers to instantly see coin/note breakdown.
 */

export const CZK_DENOMINATIONS = [
  { value: 2000, label: '2 000 Kč', isNote: true },
  { value: 1000, label: '1 000 Kč', isNote: true },
  { value: 500, label: '500 Kč', isNote: true },
  { value: 200, label: '200 Kč', isNote: true },
  { value: 100, label: '100 Kč', isNote: true },
  { value: 50, label: '50 Kč', isNote: false },
  { value: 20, label: '20 Kč', isNote: false },
  { value: 10, label: '10 Kč', isNote: false },
  { value: 5, label: '5 Kč', isNote: false },
  { value: 2, label: '2 Kč', isNote: false },
  { value: 1, label: '1 Kč', isNote: false }
];

/**
 * Returns breakdown of change amount into notes and coins.
 * @param {number} changeAmount - Change to return in CZK
 * @returns {Array<{ value: number, label: string, isNote: boolean, count: number }>}
 */
export function getCzechCashBreakdown(changeAmount) {
  const rounded = Math.round(Number(changeAmount) || 0);
  if (rounded <= 0) return [];

  let remaining = rounded;
  const breakdown = [];

  for (const denom of CZK_DENOMINATIONS) {
    if (remaining >= denom.value) {
      const count = Math.floor(remaining / denom.value);
      remaining %= denom.value;
      breakdown.push({
        value: denom.value,
        label: denom.label,
        isNote: denom.isNote,
        count
      });
    }
  }

  return breakdown;
}
