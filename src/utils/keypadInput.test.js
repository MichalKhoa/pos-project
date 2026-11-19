import { describe, it, expect } from 'vitest';
import { appendDigit, appendDecimal, applyMultiply } from './keypadInput.js';

const type = (keys, start = '') => keys.reduce((s, k) => (k === ',' ? appendDecimal(s) : appendDigit(s, k)), start);

describe('appendDigit', () => {
  it('drops leading zeros', () => {
    expect(type(['0', '0', '5'])).toBe('5');
    expect(type(['00'])).toBe('0');
    expect(type(['0', '00'])).toBe('0');
    expect(type(['0', '7'])).toBe('7');
  });

  it('keeps zeros after a decimal point', () => {
    expect(type(['0', ',', '0', '5'])).toBe('0.05');
  });

  it('limits decimals to two, also for 00', () => {
    expect(type(['1', ',', '5', '00'])).toBe('1.50');
    expect(type(['1', ',', '00'])).toBe('1.00');
    expect(type(['1', ',', '0', '5', '5'])).toBe('1.05');
  });

  it('limits length to 8 characters and ignores the sign', () => {
    expect(type(['1', '2', '3', '4', '5', '6', '7', '8', '9'])).toBe('12345678');
    expect(type(['1', '2', '3', '4', '5', '6', '7', '00'])).toBe('12345670');
    expect(type(['5', '0'], '-')).toBe('-50');
    expect(appendDecimal('1234567')).toBe('1234567');
    expect(type(['1', '2', '3', '4', '5', '6', '7', '8', '9'], '-')).toBe('-12345678');
  });
});

describe('appendDecimal', () => {
  it('starts with 0. and accepts one dot', () => {
    expect(appendDecimal('')).toBe('0.');
    expect(appendDecimal('-')).toBe('-0.');
    expect(appendDecimal('5')).toBe('5.');
    expect(appendDecimal('5.')).toBe('5.');
  });
});

describe('applyMultiply', () => {
  it('turns a typed whole number into the multiplier', () => {
    expect(applyMultiply('12', 1)).toEqual({ amountStr: '', itemMultiplier: 12 });
  });

  it('rejects decimals, zero, empty and quantities above 99', () => {
    expect(applyMultiply('12.5', 1)).toBeNull();
    expect(applyMultiply('0', 1)).toBeNull();
    expect(applyMultiply('', 1)).toBeNull();
    expect(applyMultiply('100', 1)).toBeNull();
  });

  it('keeps return mode: signed amount or negative multiplier', () => {
    expect(applyMultiply('-5', 1)).toEqual({ amountStr: '', itemMultiplier: -5 });
    expect(applyMultiply('5', -1)).toEqual({ amountStr: '', itemMultiplier: -5 });
    expect(applyMultiply('', -1)).toEqual({ amountStr: '', itemMultiplier: 1 });
    expect(applyMultiply('', 1)).toBeNull();
  });

  it('toggles a positive multiplier off and keeps the typed amount', () => {
    expect(applyMultiply('7', 3)).toEqual({ amountStr: '7', itemMultiplier: 1 });
  });
});
