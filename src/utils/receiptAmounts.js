import { roundCashTotal } from './tax.js';

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// Receipt money: whole amounts without decimals ("12"), others with two and the Czech comma ("3,50").
// Same rule as the thermal printer (escpos_service.py); the caller appends " Kč".
export function formatReceiptMoney(amount, { signed = false } = {}) {
  const n = round2(Number(amount) || 0);
  const body = Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ',');
  return signed && n > 0 ? `+${body}` : body;
}

const isCash = (sale) => ['cash', 'hotovost'].includes(String(sale.paymentMethod || sale.payment_method || '').toLowerCase());

// A cash sale exists in two shapes. Local: totalAmount is whole koruna and cashRounding is the
// difference to the exact total. Server: total_amount is the exact total and cash_rounding the
// difference. Either way the receipt needs the exact total, the rounding and what the customer pays.
export function receiptTotals(sale) {
  const total = round2(sale.totalAmount ?? sale.total_amount ?? 0);
  if (!isCash(sale)) return { exact: total, rounding: 0, payable: total };

  const payable = roundCashTotal(total);
  const stored = round2(sale.cashRounding ?? sale.cash_rounding ?? 0);
  // A whole stored total with a stored rounding is the local shape: step back to the exact total.
  const exact = Number.isInteger(total) && stored !== 0 ? round2(total - stored) : total;
  return { exact, rounding: round2(payable - exact), payable };
}
