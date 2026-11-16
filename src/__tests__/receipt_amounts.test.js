import { describe, it, expect } from 'vitest';
import { formatReceiptMoney, receiptTotals } from '../utils/receiptAmounts';
import { generateReceiptHtml } from '../utils/receiptHtmlGenerator';

describe('formatReceiptMoney', () => {
  it('drops decimals only for whole amounts and uses the Czech comma', () => {
    expect(formatReceiptMoney(12)).toBe('12');
    expect(formatReceiptMoney(3.5)).toBe('3,50');
    expect(formatReceiptMoney(0.1 + 0.2)).toBe('0,30');
    expect(formatReceiptMoney(-4)).toBe('-4');
    expect(formatReceiptMoney(-3.5)).toBe('-3,50');
    expect(formatReceiptMoney(0)).toBe('0');
    expect(formatReceiptMoney(undefined)).toBe('0');
  });
  it('shows an explicit sign when asked', () => {
    expect(formatReceiptMoney(0.5, { signed: true })).toBe('+0,50');
    expect(formatReceiptMoney(-0.5, { signed: true })).toBe('-0,50');
  });
});

describe('receiptTotals', () => {
  it('keeps the exact total for card, QR and split', () => {
    for (const paymentMethod of ['card', 'qr', 'split']) {
      expect(receiptTotals({ paymentMethod, totalAmount: 3.5 })).toEqual({ exact: 3.5, rounding: 0, payable: 3.5 });
    }
  });
  it('reads the local cash shape (whole total + cashRounding)', () => {
    expect(receiptTotals({ paymentMethod: 'cash', totalAmount: 12, cashRounding: 0.5 }))
      .toEqual({ exact: 11.5, rounding: 0.5, payable: 12 });
    expect(receiptTotals({ paymentMethod: 'cash', totalAmount: 11, cashRounding: -0.4 }))
      .toEqual({ exact: 11.4, rounding: -0.4, payable: 11 });
  });
  it('reads the server cash shape (exact total + cash_rounding)', () => {
    expect(receiptTotals({ payment_method: 'cash', total_amount: 11.5, cash_rounding: 0.5 }))
      .toEqual({ exact: 11.5, rounding: 0.5, payable: 12 });
  });
  it('derives the rounding when only an exact cash total is known', () => {
    expect(receiptTotals({ paymentMethod: 'cash', totalAmount: 11.5 }))
      .toEqual({ exact: 11.5, rounding: 0.5, payable: 12 });
  });
  it('shows no rounding for a whole cash total or a legacy whole sale', () => {
    expect(receiptTotals({ paymentMethod: 'cash', totalAmount: 12 })).toEqual({ exact: 12, rounding: 0, payable: 12 });
    expect(receiptTotals({ paymentMethod: 'cash', totalAmount: 12, cashRounding: 0 })).toEqual({ exact: 12, rounding: 0, payable: 12 });
  });
  it('rounds a cash refund away from zero and keeps the sign', () => {
    expect(receiptTotals({ paymentMethod: 'cash', totalAmount: -4, cashRounding: -0.5 }))
      .toEqual({ exact: -3.5, rounding: -0.5, payable: -4 });
    expect(receiptTotals({ payment_method: 'cash', total_amount: -3.5, cash_rounding: -0.5 }))
      .toEqual({ exact: -3.5, rounding: -0.5, payable: -4 });
  });
});

describe('generateReceiptHtml amounts', () => {
  const items = [{ name: 'Rohlík', price: 3.5, quantity: 1, vat: 12 }];
  const base = { receiptNumber: '2026-000001', timestamp: '2026-11-16T10:00:00', taxSummary: {} };
  const html = (sale) => generateReceiptHtml({ saleData: { ...base, ...sale }, items, storeConfig: {}, paperWidth: '80' });

  it('prints 3,50 for a card sale, not 4', () => {
    const out = html({ paymentMethod: 'card', totalAmount: 3.5 });
    expect(out).toContain('3,50 Kč');
    expect(out).not.toMatch(/>\s*4 Kč/);
    expect(out).not.toContain('Zaokrouhlení');
  });
  it('prints subtotal, rounding and payable for cash 11.50', () => {
    const out = html({ paymentMethod: 'cash', totalAmount: 12, cashRounding: 0.5, tenderedAmount: 20, changeDue: 8 });
    expect(out).toContain('Mezisoučet');
    expect(out).toContain('11,50 Kč');
    expect(out).toContain('Zaokrouhlení');
    expect(out).toContain('+0,50 Kč');
    expect(out).toMatch(/ÚHRADĚ<\/span>\s*<span>12 Kč/);
    expect(out).toContain('20 Kč');
  });
  it('prints decimals in split parts', () => {
    const out = html({ paymentMethod: 'split', totalAmount: 3.5, splitDetails: { cash: 1.5, card: 2 } });
    expect(out).toContain('1,50 Kč');
    expect(out).toContain('2 Kč');
  });
});
