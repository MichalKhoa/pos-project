import { describe, it, expect } from 'vitest';
import { toQty, netFromGross, roundCashTotal, calculateItemLineGross, calculateCartTotals } from '../utils/tax';
import { normalizeSale } from '../api/posApi';

describe('fractional quantities (F-027)', () => {
  it('toQty keeps weights and defaults bad input', () => {
    expect(toQty(0.35)).toBe(0.35);
    expect(toQty('1.250')).toBe(1.25);
    expect(toQty(0.3333333)).toBe(0.333);
    expect(toQty(0)).toBe(0);
    expect(toQty(undefined)).toBe(1);
    expect(toQty('abc')).toBe(1);
    expect(toQty(null, 0)).toBe(0);
  });

  it('prices 0.35 kg at 42 Kč/kg as 14.70', () => {
    expect(calculateItemLineGross({ price: 42, quantity: 0.35 })).toBe(14.7);
    expect(calculateCartTotals([{ price: 42, quantity: 0.35, vat: 12 }]).finalGrandTotal).toBe(14.7);
  });

  it('prices 3 x 0.333 kg without losing weight', () => {
    const total = calculateCartTotals([
      { price: 100, quantity: 0.333, vat: 12 },
      { price: 100, quantity: 0.333, vat: 12 },
      { price: 100, quantity: 0.333, vat: 12 }
    ]).finalGrandTotal;
    expect(total).toBe(99.9);
  });

  it('normalizeSale keeps fractional sold, refunded and remaining quantities', () => {
    const sale = normalizeSale({
      id: 's1',
      items: [{ id: 'a', price: 42, quantity: 1.25, refundedQuantity: 0.5, remainingQuantity: 0.75, vat: 12 }]
    });
    const item = sale.items[0];
    expect(item.quantity).toBe(1.25);
    expect(item.refundedQuantity).toBe(0.5);
    expect(item.refunded_quantity).toBe(0.5);
    expect(item.remainingQuantity).toBe(0.75);
    expect(item.remaining_quantity).toBe(0.75);
  });

  it('normalizeSale defaults remaining to quantity and refunded to 0', () => {
    const item = normalizeSale({ id: 's2', items: [{ id: 'a', price: 1, quantity: 0.35 }] }).items[0];
    expect(item.remainingQuantity).toBe(0.35);
    expect(item.refundedQuantity).toBe(0);
  });
});

describe('netFromGross (F-028)', () => {
  it('rounds exact ties half up, like the backend Decimal split', () => {
    expect(netFromGross(14.7, 12)).toBe(13.13);
    expect(netFromGross(3.5, 12)).toBe(3.13);
    expect(netFromGross(-14.7, 12)).toBe(-13.13);
    expect(netFromGross(100, 21)).toBe(82.64);
  });
});

describe('roundCashTotal (cash goes back the way it came in)', () => {
  it('rounds half away from zero, so 3.50 is paid as 4 and refunded as -4', () => {
    expect(roundCashTotal(3.5)).toBe(4);
    expect(roundCashTotal(-3.5)).toBe(-4);
    expect(roundCashTotal(11.49)).toBe(11);
    expect(roundCashTotal(-11.49)).toBe(-11);
    expect(roundCashTotal(12)).toBe(12);
    expect(Object.is(roundCashTotal(0), 0)).toBe(true);
  });
});
