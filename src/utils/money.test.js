import { describe, it, expect } from 'vitest';
import { formatKc } from './money';

describe('formatKc', () => {
  it('uses two decimals and groups thousands with a non-breaking space', () => {
    expect(formatKc(0)).toBe('0.00');
    expect(formatKc(3.5)).toBe('3.50');
    expect(formatKc(12345.5)).toBe('12 345.50');
    expect(formatKc(1234567.891)).toBe('1 234 567.89');
  });

  it('keeps the sign for negatives and never prints -0.00', () => {
    expect(formatKc(-1234.5)).toBe('-1 234.50');
    expect(formatKc(-0.001)).toBe('0.00');
  });

  it('treats non-numbers as zero', () => {
    expect(formatKc(undefined)).toBe('0.00');
    expect(formatKc('abc')).toBe('0.00');
  });
});
