import { describe, it, expect } from 'vitest';
import { newCustomItemId, returnLineName } from './customItemId';

describe('newCustomItemId', () => {
  it('keeps the custom- prefix and never repeats, even within one millisecond', () => {
    const ids = Array.from({ length: 1000 }, () => newCustomItemId());
    expect(new Set(ids).size).toBe(1000);
    expect(ids.every((id) => id.startsWith('custom-'))).toBe(true);
  });
});

describe('returnLineName', () => {
  it('marks a return line with plain text, never an emoji', () => {
    expect(returnLineName('Káva')).toBe('Vratka: Káva');
    expect(returnLineName('Káva')).not.toContain('↩');
  });

  it('leaves already-marked names alone, including old names with the emoji', () => {
    expect(returnLineName('Vratka / Vrácené zboží')).toBe('Vratka / Vrácené zboží');
    expect(returnLineName('VRATKA káva')).toBe('VRATKA káva');
    expect(returnLineName('↩️ Káva')).toBe('↩️ Káva');
  });
});
