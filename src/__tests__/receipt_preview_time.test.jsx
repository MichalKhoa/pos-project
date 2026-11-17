import React from 'react';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { render } from '@testing-library/react';
import ReceiptPreviewPaper from '../components/receipt/ReceiptPreviewPaper';
import { generateReceiptHtml } from '../utils/receiptHtmlGenerator';
import { parseSaleTimestamp } from '../utils/dateUtils';

const UTC_14 = Date.UTC(2026, 10, 16, 14, 0, 0);

describe('parseSaleTimestamp', () => {
  it('reads a timestamp without a zone as UTC (server stores utcnow)', () => {
    expect(parseSaleTimestamp('2026-11-16T14:00:00').getTime()).toBe(UTC_14);
    expect(parseSaleTimestamp('2026-11-16T14:00:00.123456').getTime()).toBe(UTC_14 + 123);
  });
  it('keeps an explicit zone', () => {
    expect(parseSaleTimestamp('2026-11-16T14:00:00Z').getTime()).toBe(UTC_14);
    expect(parseSaleTimestamp('2026-11-16T15:00:00+01:00').getTime()).toBe(UTC_14);
  });
  it('passes Date objects and numbers through', () => {
    expect(parseSaleTimestamp(new Date(UTC_14)).getTime()).toBe(UTC_14);
    expect(parseSaleTimestamp(UTC_14).getTime()).toBe(UTC_14);
  });
});

describe('receipt time matches the printed receipt', () => {
  let oldTz;
  beforeAll(() => { oldTz = process.env.TZ; process.env.TZ = 'Europe/Prague'; });
  afterAll(() => { if (oldTz === undefined) delete process.env.TZ; else process.env.TZ = oldTz; });

  const sale = { receiptNumber: '2026-000001', timestamp: '2026-11-16T14:00:00', taxSummary: {}, paymentMethod: 'card', totalAmount: 3.5 };
  const items = [{ name: 'Rohlík', price: 3.5, quantity: 1, vat: 12 }];

  it('preview shows a naive server time as local time', () => {
    const out = render(<ReceiptPreviewPaper saleData={sale} storeConfig={{}} resolvedItems={items} is58mm={false} />).container.textContent;
    expect(out).toContain('15:00:00');
    expect(out).not.toContain('14:00:00');
  });

  it('HTML receipt shows a naive server time as local time', () => {
    const html = generateReceiptHtml({ saleData: sale, items, storeConfig: {}, paperWidth: '80' });
    expect(html).toContain('15:00:00');
    expect(html).not.toContain('14:00:00');
  });
});

describe('preview cash lines match the printed receipt', () => {
  const items = [{ name: 'Rohlík', price: 4, quantity: 1, vat: 12 }];
  const text = (sale) => render(
    <ReceiptPreviewPaper saleData={{ receiptNumber: '1', timestamp: '2026-11-16T10:00:00Z', taxSummary: {}, paymentMethod: 'cash', ...sale }}
      storeConfig={{}} resolvedItems={items} is58mm={false} />
  ).container.textContent;

  it('shows tendered and change for a paid cash sale', () => {
    expect(text({ totalAmount: 4, tenderedAmount: 10, changeDue: 6 })).toContain('Přijatá hotovost');
  });
  it('hides them on a cash refund', () => {
    expect(text({ totalAmount: -4, isRefund: true })).not.toContain('Přijatá hotovost');
  });
  it('hides them on a reprint without a tendered amount', () => {
    expect(text({ totalAmount: 4 })).not.toContain('Přijatá hotovost');
  });
  it('HTML receipt follows the same rule', () => {
    const html = (sale) => generateReceiptHtml({ saleData: { receiptNumber: '1', timestamp: '2026-11-16T10:00:00Z', taxSummary: {}, paymentMethod: 'cash', ...sale }, items, storeConfig: {}, paperWidth: '80' });
    expect(html({ totalAmount: 4, tenderedAmount: 10, changeDue: 6 })).toContain('Přijatá hotovost');
    expect(html({ totalAmount: -4, isRefund: true })).not.toContain('Přijatá hotovost');
    expect(html({ totalAmount: 4 })).not.toContain('Přijatá hotovost');
  });
});
