import { describe, it, expect } from 'vitest';
import { normalizePresetStyle, readableTextOn } from '../utils/presetTileStyle';

describe('normalizePresetStyle', () => {
  it('keeps valid styles', () => {
    expect(normalizePresetStyle('tinted')).toBe('tinted');
    expect(normalizePresetStyle('color-fill')).toBe('color-fill');
  });
  it('maps legacy and unknown values to tinted', () => {
    for (const v of ['left-stripe', 'modern-card', 'modern-glass', '', null, undefined]) {
      expect(normalizePresetStyle(v)).toBe('tinted');
    }
  });
});

describe('readableTextOn', () => {
  it('uses dark text on light colours and white on dark', () => {
    expect(readableTextOn('#ffffff')).toBe('#111827');
    expect(readableTextOn('#facc15')).toBe('#111827');
    expect(readableTextOn('#000000')).toBe('#ffffff');
    expect(readableTextOn('#dc2626')).toBe('#ffffff');
  });
  it('handles short hex and invalid input', () => {
    expect(readableTextOn('#fff')).toBe('#111827');
    expect(readableTextOn('nope')).toBe('#ffffff');
  });
});
