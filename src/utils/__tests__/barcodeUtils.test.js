import { describe, it, expect } from 'vitest';
import { parseScaleBarcode } from '../barcodeUtils.js';

describe('Weighed Scale Barcode Parser (EAN-13 prefixes 28 & 29)', () => {
  it('parses weight-embedded barcode (prefix 29)', () => {
    // 29 + 12345 (sku) + 00650 (650 grams) + 8 (check digit)
    const result = parseScaleBarcode('2912345006508');
    expect(result.isScaleBarcode).toBe(true);
    expect(result.prefix).toBe('29');
    expect(result.sku).toBe('12345');
    expect(result.weightGrams).toBe(650);
    expect(result.weightKg).toBe(0.65);
    expect(result.totalPrice).toBeNull();
    expect(result.type).toBe('WEIGHT');
  });

  it('parses price-embedded barcode (prefix 28)', () => {
    // 28 + 12345 (sku) + 01450 (14.50 CZK) + 2 (check digit)
    const result = parseScaleBarcode('2812345014502');
    expect(result.isScaleBarcode).toBe(true);
    expect(result.prefix).toBe('28');
    expect(result.sku).toBe('12345');
    expect(result.totalPrice).toBe(14.50);
    expect(result.weightKg).toBeNull();
    expect(result.type).toBe('PRICE');
  });

  it('returns false for standard non-scale barcodes', () => {
    expect(parseScaleBarcode('8594001234567').isScaleBarcode).toBe(false);
    expect(parseScaleBarcode('4006381333931').isScaleBarcode).toBe(false);
  });

  it('returns false for invalid inputs or lengths', () => {
    expect(parseScaleBarcode('').isScaleBarcode).toBe(false);
    expect(parseScaleBarcode(null).isScaleBarcode).toBe(false);
    expect(parseScaleBarcode(undefined).isScaleBarcode).toBe(false);
    expect(parseScaleBarcode('2912345').isScaleBarcode).toBe(false);
    expect(parseScaleBarcode('2912345006508123').isScaleBarcode).toBe(false);
    expect(parseScaleBarcode('29ABC45006508').isScaleBarcode).toBe(false);
  });
});
