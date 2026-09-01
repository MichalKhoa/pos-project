/**
 * Financial calculation & VAT helper utilities for Himmel POS.
 * Enforces Czech 2-decimal precision (roundCZK) and multi-tier tax splits.
 */

export const roundCZK = (v) => {
  if (typeof v !== 'number' || isNaN(v)) return 0;
  return Math.round((v + Number.EPSILON) * 100) / 100;
};

export const calculateItemLineGross = (item) => {
  const price = parseFloat(item.price) || 0;
  const qty = parseInt(item.quantity !== undefined ? item.quantity : (item.qty || 1), 10);
  const discount = parseFloat(item.discountPercent || item.discount_percent || 0);
  const effectivePrice = price * (1 - discount / 100);
  return roundCZK(effectivePrice * qty);
};

export const calculateCartTotals = (cartItems = [], cartDiscountPercent = 0) => {
  const rawSubtotal = roundCZK(
    cartItems.reduce((sum, item) => sum + calculateItemLineGross(item), 0)
  );

  const cartDiscountAmount = roundCZK(rawSubtotal * (cartDiscountPercent / 100));
  const finalGrandTotal = roundCZK(rawSubtotal - cartDiscountAmount);
  const cartDiscountFactor = rawSubtotal !== 0 ? finalGrandTotal / rawSubtotal : 1;

  const taxSummary = cartItems.reduce((acc, item) => {
    const rate = item.vat !== undefined && item.vat !== null
      ? parseInt(item.vat, 10)
      : (item.vat_rate !== undefined ? parseInt(item.vat_rate, 10) : 21);

    const itemGrossBeforeCartDisc = calculateItemLineGross(item);
    const itemFinalGross = roundCZK(itemGrossBeforeCartDisc * cartDiscountFactor);

    let netPrice = itemFinalGross;
    let taxAmount = 0;

    if (rate > 0) {
      netPrice = roundCZK(itemFinalGross / (1 + rate / 100));
      taxAmount = roundCZK(itemFinalGross - netPrice);
    }

    if (!acc[rate]) {
      acc[rate] = { rate, gross: 0, net: 0, tax: 0 };
    }
    acc[rate].gross = roundCZK(acc[rate].gross + itemFinalGross);
    acc[rate].net = roundCZK(acc[rate].net + netPrice);
    acc[rate].tax = roundCZK(acc[rate].tax + taxAmount);
    return acc;
  }, {});

  const sortedRates = Object.values(taxSummary).sort((a, b) => b.rate - a.rate);
  const totalNet = roundCZK(sortedRates.reduce((sum, t) => sum + t.net, 0));
  const totalTax = roundCZK(sortedRates.reduce((sum, t) => sum + t.tax, 0));

  return {
    rawSubtotal,
    cartDiscountAmount,
    finalGrandTotal,
    cartDiscountFactor,
    taxSummary,
    sortedRates,
    totalNet,
    totalTax
  };
};

export const calculateCashChange = (totalAmount, tenderedAmount) => {
  const total = roundCZK(parseFloat(totalAmount) || 0);
  const tendered = roundCZK(parseFloat(tenderedAmount) || 0);
  if (tendered <= total) return 0;
  return roundCZK(tendered - total);
};
