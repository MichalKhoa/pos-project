/**
 * VoltFlow POS - Scale Barcode Utility Engine
 * Supports standard retail weighed scale EAN-13 barcodes with prefixes:
 * - 29: Weight-embedded barcode (29 + 5-digit SKU/PLU + 5-digit weight in grams + 1 check digit)
 * - 28: Price-embedded barcode (28 + 5-digit SKU/PLU + 5-digit price in hellers/cents + 1 check digit)
 */

export function parseScaleBarcode(barcode) {
  if (!barcode || typeof barcode !== 'string') {
    return { isScaleBarcode: false };
  }

  const clean = barcode.trim();
  if (!/^\d{13}$/.test(clean)) {
    return { isScaleBarcode: false };
  }

  const prefix = clean.slice(0, 2);
  const sku = clean.slice(2, 7);
  const checkDigit = clean.slice(12, 13);

  if (prefix === '29') {
    // Prefix 29: Weight-embedded (grams)
    const weightGrams = parseInt(clean.slice(7, 12), 10);
    const weightKg = Math.round(weightGrams) / 1000;
    return {
      isScaleBarcode: true,
      prefix: '29',
      sku,
      weightGrams,
      weightKg,
      totalPrice: null,
      checkDigit,
      type: 'WEIGHT'
    };
  }

  if (prefix === '28') {
    // Prefix 28: Price-embedded (hundredths of CZK)
    const priceHundredths = parseInt(clean.slice(7, 12), 10);
    const totalPrice = Math.round(priceHundredths) / 100;
    return {
      isScaleBarcode: true,
      prefix: '28',
      sku,
      weightGrams: null,
      weightKg: null,
      totalPrice,
      checkDigit,
      type: 'PRICE'
    };
  }

  return { isScaleBarcode: false };
}
