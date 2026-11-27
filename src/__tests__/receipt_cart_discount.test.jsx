import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import ReceiptPreviewPaper from '../components/receipt/ReceiptPreviewPaper';
import { generateReceiptHtml } from '../utils/receiptHtmlGenerator';
import { receiptLineTotals } from '../utils/receiptAmounts';

// Same case as CartDiscountLineSumTests in backend/tests/test_receipt_money_vat.py:
// the thermal printer prints 90 and 45 for a 10 % cart discount, the screen must too.
const items = [
  { name: 'Víno', price: 100, quantity: 1, vat: 21 },
  { name: 'Sýr', price: 50, quantity: 1, vat: 12 }
];
const sale = { receiptNumber: '2026-000001', timestamp: '2026-11-16T10:00:00', taxSummary: {}, paymentMethod: 'card', totalAmount: 135, cartDiscountPercent: 10 };

describe('receipt line totals with a cart discount', () => {
  it('scales every line by the cart discount like the printer', () => {
    expect(receiptLineTotals(items, 10)).toEqual([90, 45]);
    expect(receiptLineTotals(items, 0)).toEqual([100, 50]);
    // 85 / 100 factor, rounded per line: 28.33 + 56.67 = 85
    expect(receiptLineTotals([{ price: 33.33, quantity: 1 }, { price: 66.67, quantity: 1 }], 15)).toEqual([28.33, 56.67]);
  });

  it('applies the line discount first, then the cart discount, also on refund lines', () => {
    const mixed = [{ price: 100, quantity: 1, discountPercent: 10 }, { price: 50, quantity: 2 }];
    expect(receiptLineTotals(mixed, 10)).toEqual([81, 90]);
    expect(receiptLineTotals(items.map(i => ({ ...i, quantity: -1 })), 10)).toEqual([-90, -45]);
  });

  it('shows an invoice unit price that adds up to the discounted line total', () => {
    const b2b = { ...sale, isInvoice: true, invoiceNumber: 'F-1' };
    const out = render(<ReceiptPreviewPaper saleData={b2b} storeConfig={{}} resolvedItems={items} is58mm={false} />).container.textContent;
    expect(out).toContain('74.38'); // 90 / 1.21
    expect(out).not.toContain('82.64'); // 100 / 1.21, the undiscounted price
  });

  it('shows the discounted line amounts in the screen preview', () => {
    const out = render(<ReceiptPreviewPaper saleData={sale} storeConfig={{}} resolvedItems={items} is58mm={false} />)
      .container.textContent.replace(/\u00a0/g, ' ');
    expect(out).toContain('90 Kč');
    expect(out).toContain('45 Kč');
    expect(out).not.toContain('100 Kč');
  });

  it('reads the server field name cart_discount_percent too', () => {
    const out = render(<ReceiptPreviewPaper saleData={{ ...sale, cartDiscountPercent: undefined, cart_discount_percent: 10 }} storeConfig={{}} resolvedItems={items} is58mm={false} />)
      .container.textContent.replace(/\u00a0/g, ' ');
    expect(out).toContain('90 Kč');
  });

  it('shows the discounted line amounts in the HTML receipt', () => {
    const out = generateReceiptHtml({ saleData: sale, items, storeConfig: {}, paperWidth: '80' });
    expect(out).toContain('90&nbsp;Kč');
    expect(out).toContain('45&nbsp;Kč');
    expect(out).not.toContain('100&nbsp;Kč');
  });

  it('shows the discounted line amounts on the A4 invoice', () => {
    const out = generateReceiptHtml({ saleData: sale, items, storeConfig: {}, paperWidth: 'A4' });
    expect(out).toContain('90.00 Kč');
    expect(out).not.toContain('100.00 Kč');
  });
});
