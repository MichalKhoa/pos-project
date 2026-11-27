import { describe, it, expect } from 'vitest';
import { receiptColumnOptions, effectiveReceiptColumns } from '../utils/receiptColumns.js';

describe('receiptColumnOptions', () => {
  it('offers the choices the printer code accepts for each paper width and font', () => {
    expect(receiptColumnOptions('80', 'standard')).toEqual([48, 42]);
    expect(receiptColumnOptions('80', 'compact')).toEqual([64, 56]);
    expect(receiptColumnOptions('58', 'standard')).toEqual([32, 30, 28]);
    expect(receiptColumnOptions('58', 'compact')).toEqual([42, 35]);
    expect(receiptColumnOptions('A4', 'compact')).toEqual([80]);
  });

  it('defaults to 80 mm when the paper width is missing', () => {
    expect(receiptColumnOptions(undefined, 'standard')).toEqual([48, 42]);
  });
});

describe('effectiveReceiptColumns', () => {
  it('keeps a saved value that applies', () => {
    expect(effectiveReceiptColumns('58', 'standard', 30)).toBe(30);
    expect(effectiveReceiptColumns('80', 'compact', '56')).toBe(56);
  });

  it('falls back to the default when the saved value is ignored by the printer', () => {
    expect(effectiveReceiptColumns('58', 'standard', 48)).toBe(32);
    expect(effectiveReceiptColumns('80', 'compact', 42)).toBe(64);
    expect(effectiveReceiptColumns('80', 'standard', undefined)).toBe(48);
  });
});
