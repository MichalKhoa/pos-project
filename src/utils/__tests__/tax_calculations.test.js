import { describe, it, expect } from 'vitest';
import {
  roundCZK,
  calculateItemLineGross,
  calculateCartTotals,
  calculateCashChange
} from '../tax';

describe('Financial Precision & Rounding (roundCZK)', () => {
  it('correctly rounds standard decimal values to 2 places', () => {
    expect(roundCZK(100.456)).toBe(100.46);
    expect(roundCZK(100.454)).toBe(100.45);
    expect(roundCZK(0)).toBe(0);
  });

  it('prevents JavaScript IEEE-754 binary floating-point representation errors', () => {
    // In JS: 0.1 + 0.2 = 0.30000000000000004
    expect(roundCZK(0.1 + 0.2)).toBe(0.3);
    // 19.99 * 3 = 59.97
    expect(roundCZK(19.99 * 3)).toBe(59.97);
  });

  it('handles negative numbers properly for returns & refunds', () => {
    expect(roundCZK(-50.555)).toBe(-50.55);
    expect(roundCZK(-120.00)).toBe(-120);
  });

  it('safely handles non-numeric or NaN inputs', () => {
    expect(roundCZK(NaN)).toBe(0);
    expect(roundCZK(null)).toBe(0);
    expect(roundCZK(undefined)).toBe(0);
    expect(roundCZK('invalid')).toBe(0);
  });
});

describe('Item Line Gross Calculation', () => {
  it('calculates gross price for simple quantity', () => {
    const item = { price: 25, quantity: 4 };
    expect(calculateItemLineGross(item)).toBe(100);
  });

  it('applies per-item percentage discount', () => {
    const item = { price: 100, quantity: 2, discountPercent: 10 };
    // 100 * 0.9 * 2 = 180
    expect(calculateItemLineGross(item)).toBe(180);
  });

  it('handles negative price items for returns', () => {
    const returnItem = { price: -45, quantity: 2 };
    expect(calculateItemLineGross(returnItem)).toBe(-90);
  });
});

describe('Czech VAT Multi-Tier Tax Splits & Invariants', () => {
  it('calculates single 21% standard VAT rate correctly', () => {
    const items = [
      { id: '1', name: 'Zboží A', price: 121, quantity: 1, vat: 21 }
    ];
    const { finalGrandTotal, taxSummary, totalNet, totalTax } = calculateCartTotals(items, 0);

    expect(finalGrandTotal).toBe(121);
    expect(taxSummary[21].gross).toBe(121);
    expect(taxSummary[21].net).toBe(100);
    expect(taxSummary[21].tax).toBe(21);
    expect(roundCZK(totalNet + totalTax)).toBe(finalGrandTotal);
  });

  it('calculates multi-tier VAT (21%, 12%, 0%) simultaneously', () => {
    const items = [
      { id: '1', name: 'Pivo (21%)', price: 121, quantity: 1, vat: 21 },
      { id: '2', name: 'Jídlo (12%)', price: 112, quantity: 1, vat: 12 },
      { id: '3', name: 'Knihy (0%)', price: 50, quantity: 1, vat: 0 }
    ];
    const { finalGrandTotal, taxSummary, totalNet, totalTax } = calculateCartTotals(items, 0);

    // Total gross = 121 + 112 + 50 = 283
    expect(finalGrandTotal).toBe(283);

    // 21%: gross 121, net 100, tax 21
    expect(taxSummary[21].net).toBe(100);
    expect(taxSummary[21].tax).toBe(21);

    // 12%: gross 112, net 100, tax 12
    expect(taxSummary[12].net).toBe(100);
    expect(taxSummary[12].tax).toBe(12);

    // 0%: gross 50, net 50, tax 0
    expect(taxSummary[0].net).toBe(50);
    expect(taxSummary[0].tax).toBe(0);

    // Financial invariant: Base + VAT === Total
    expect(roundCZK(totalNet + totalTax)).toBe(finalGrandTotal);
  });

  it('applies cart-level discount proportionally across VAT rates', () => {
    const items = [
      { id: '1', name: 'Položka 21%', price: 200, quantity: 1, vat: 21 },
      { id: '2', name: 'Položka 12%', price: 100, quantity: 1, vat: 12 }
    ];
    // 10% cart discount on 300 CZK = 270 CZK final
    const { rawSubtotal, cartDiscountAmount, finalGrandTotal, totalNet, totalTax } = calculateCartTotals(items, 10);

    expect(rawSubtotal).toBe(300);
    expect(cartDiscountAmount).toBe(30);
    expect(finalGrandTotal).toBe(270);
    expect(roundCZK(totalNet + totalTax)).toBe(finalGrandTotal);
  });

  it('calculates negative total for refund transactions', () => {
    const items = [
      { id: '1', name: 'Vrácené zboží', price: -121, quantity: 1, vat: 21 }
    ];
    const { finalGrandTotal, taxSummary } = calculateCartTotals(items, 0);

    expect(finalGrandTotal).toBe(-121);
    expect(taxSummary[21].net).toBe(-100);
    expect(taxSummary[21].tax).toBe(-21);
  });
});

describe('Cash Change Due Calculation', () => {
  it('computes change when tendered amount exceeds total', () => {
    expect(calculateCashChange(175, 200)).toBe(25);
    expect(calculateCashChange(123.50, 150)).toBe(26.50);
  });

  it('returns 0 when tendered amount is exact or less', () => {
    expect(calculateCashChange(200, 200)).toBe(0);
    expect(calculateCashChange(200, 150)).toBe(0);
  });
});
