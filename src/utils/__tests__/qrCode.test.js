import { describe, it, expect } from 'vitest';
import { createQrMatrix, generateQrSvg, generateQrDataUrl } from '../qrCode.js';

describe('Offline Pure-JS QR Code Generator (qrCode.js)', () => {
  const sampleSpd = 'SPD*1.0*ACC:CZ6508000000001234567890*AM:450.00*CC:CZK*X-VS:87654321*MSG:Platba VoltFlow POS';

  it('generates a square binary matrix with finder patterns', () => {
    const matrix = createQrMatrix(sampleSpd);
    expect(Array.isArray(matrix)).toBe(true);
    expect(matrix.length).toBeGreaterThanOrEqual(21);
    expect(matrix[0].length).toBe(matrix.length);

    // Top-left finder pattern corner check
    expect(matrix[0][0]).toBe(1);
    expect(matrix[0][6]).toBe(1);
    expect(matrix[6][0]).toBe(1);
    expect(matrix[6][6]).toBe(1);
  });

  it('generates a valid SVG string with XML namespaces and rectangles', () => {
    const svg = generateQrSvg(sampleSpd, 220);
    expect(svg).toContain('<svg');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('viewBox="0 0 220 220"');
    expect(svg).toContain('<rect');
    expect(svg).toContain('fill="#000000"');
    expect(svg).toContain('</svg>');
  });

  it('generates a valid data URL containing URL-encoded SVG', () => {
    const dataUrl = generateQrDataUrl(sampleSpd, 200);
    expect(dataUrl.startsWith('data:image/svg+xml;utf8,')).toBe(true);
    expect(dataUrl).toContain('%3Csvg');
    expect(dataUrl).toContain('%3C%2Fsvg%3E');
  });

  it('handles empty and short inputs gracefully', () => {
    const shortData = '123';
    const dataUrl = generateQrDataUrl(shortData);
    expect(dataUrl.startsWith('data:image/svg+xml;utf8,')).toBe(true);
  });
});
