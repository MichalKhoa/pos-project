import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import ReceiptPreviewPaper from '../components/receipt/ReceiptPreviewPaper';

const items = [{ name: 'Rohlík', price: 3.5, quantity: 1, vat: 12 }];
const base = { receiptNumber: '2026-000001', timestamp: '2026-11-16T10:00:00', taxSummary: {} };
const text = (sale) => render(
  <ReceiptPreviewPaper saleData={{ ...base, ...sale }} storeConfig={{}} resolvedItems={items} is58mm={false} />
).container.textContent.replace(/ /g, ' ');

describe('ReceiptPreviewPaper amounts', () => {
  it('prints 3,50 on the line and the total for a card sale', () => {
    const out = text({ paymentMethod: 'card', totalAmount: 3.5 });
    expect(out).toContain('3,50 Kč');
    expect(out).not.toContain('4 Kč');
    expect(out).not.toContain('Zaokrouhlení');
  });
  it('prints subtotal, rounding and payable for cash 11.50', () => {
    const out = text({ paymentMethod: 'cash', totalAmount: 12, cashRounding: 0.5, tenderedAmount: 20, changeDue: 8 });
    expect(out).toContain('Mezisoučet');
    expect(out).toContain('11,50 Kč');
    expect(out).toContain('Zaokrouhlení');
    expect(out).toContain('+0,50 Kč');
    expect(out).toContain('CELKEM K ÚHRADĚ12 Kč');
    expect(out).toContain('Přijatá hotovost:20 Kč');
    expect(out).toContain('Vrácená hotovost:8 Kč');
  });
  it('prints decimals in split parts and change', () => {
    const out = text({ paymentMethod: 'split', totalAmount: 3.5, splitDetails: { cash: 1.5, card: 2 } });
    expect(out).toContain('Uhrazeno Hotově:1,50 Kč');
    expect(out).toContain('Uhrazeno Kartou:2 Kč');
  });
});
