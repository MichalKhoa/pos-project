import { describe, it, expect } from 'vitest';
import {
  calculateEAN13Checksum,
  encodeEAN13,
  encodeCode128B,
  generateBarcodeSVG
} from '../utils/barcodeGenerator';

describe('Barcode Generator Utility', () => {
  it('calculates correct EAN-13 check digit', () => {
    // 859400123456 -> 1 (89 + 1 = 90)
    const check1 = calculateEAN13Checksum('859400123456');
    expect(check1).toBe(1);

    // 400638133393 -> 1 (4*1+0*3+0*1+6*3+3*1+8*3+1*1+3*3+3*1+3*3+9*1+3*3 = 4+0+0+18+3+24+1+9+3+9+9+9 = 89 -> 1)
    const check2 = calculateEAN13Checksum('400638133393');
    expect(check2).toBe(1);
  });

  it('encodes standard 13-digit EAN into bit sequence with left, center, right guards', () => {
    const encoded = encodeEAN13('8594001234561');
    expect(encoded).toBeTruthy();
    expect(encoded.text).toBe('8594001234561');
    expect(encoded.bits.startsWith('101')).toBe(true); // Left guard
    expect(encoded.bits.endsWith('101')).toBe(true);   // Right guard
    expect(encoded.bits.length).toBe(95); // 3 + 42 + 5 + 42 + 3 = 95
  });

  it('automatically appends checksum for 12-digit EAN', () => {
    const encoded = encodeEAN13('859400123456');
    expect(encoded).toBeTruthy();
    expect(encoded.text).toBe('8594001234561');
  });

  it('encodes alphanumeric strings into Code-128 B', () => {
    const encoded = encodeCode128B('HIMMEL-POS-01');
    expect(encoded).toBeTruthy();
    expect(encoded.text).toBe('HIMMEL-POS-01');
    expect(encoded.bits.length).toBeGreaterThan(50);
  });

  it('generates complete SVG rect dimensions for barcode preview', () => {
    const result = generateBarcodeSVG('8594001234567', { height: 50, barWidth: 2 });
    expect(result).toBeTruthy();
    expect(result.type).toBe('EAN-13');
    expect(result.rects.length).toBeGreaterThan(0);
    expect(result.svgHeight).toBe(70);
    expect(result.svgWidth).toBeGreaterThan(100);

    const code128Result = generateBarcodeSVG('ITEM-ABC', { height: 40 });
    expect(code128Result).toBeTruthy();
    expect(code128Result.type).toBe('CODE-128');
  });

  it('returns null for empty or invalid input', () => {
    expect(generateBarcodeSVG('')).toBeNull();
    expect(generateBarcodeSVG(null)).toBeNull();
  });
});
