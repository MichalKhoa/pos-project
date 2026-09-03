import { describe, it, expect } from 'vitest';
import { getCzechCashBreakdown } from '../utils/currencyBreakdown';

describe('getCzechCashBreakdown', () => {
  it('returns empty array for zero or negative change', () => {
    expect(getCzechCashBreakdown(0)).toEqual([]);
    expect(getCzechCashBreakdown(-50)).toEqual([]);
    expect(getCzechCashBreakdown(null)).toEqual([]);
  });

  it('correctly breaks down 145 Kč into 1x 100, 2x 20, 1x 5', () => {
    const result = getCzechCashBreakdown(145);
    expect(result).toEqual([
      { value: 100, label: '100 Kč', isNote: true, count: 1 },
      { value: 20, label: '20 Kč', isNote: false, count: 2 },
      { value: 5, label: '5 Kč', isNote: false, count: 1 }
    ]);
  });

  it('correctly breaks down 368 Kč into notes and coins', () => {
    const result = getCzechCashBreakdown(368);
    expect(result).toEqual([
      { value: 200, label: '200 Kč', isNote: true, count: 1 },
      { value: 100, label: '100 Kč', isNote: true, count: 1 },
      { value: 50, label: '50 Kč', isNote: false, count: 1 },
      { value: 10, label: '10 Kč', isNote: false, count: 1 },
      { value: 5, label: '5 Kč', isNote: false, count: 1 },
      { value: 2, label: '2 Kč', isNote: false, count: 1 },
      { value: 1, label: '1 Kč', isNote: false, count: 1 }
    ]);
  });

  it('correctly breaks down 3800 Kč with large notes', () => {
    const result = getCzechCashBreakdown(3800);
    expect(result).toEqual([
      { value: 2000, label: '2 000 Kč', isNote: true, count: 1 },
      { value: 1000, label: '1 000 Kč', isNote: true, count: 1 },
      { value: 500, label: '500 Kč', isNote: true, count: 1 },
      { value: 200, label: '200 Kč', isNote: true, count: 1 },
      { value: 100, label: '100 Kč', isNote: true, count: 1 }
    ]);
  });
});
