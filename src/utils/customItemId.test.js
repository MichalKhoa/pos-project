import { describe, it, expect } from 'vitest';
import { newCustomItemId } from './customItemId';

describe('newCustomItemId', () => {
  it('keeps the custom- prefix and never repeats, even within one millisecond', () => {
    const ids = Array.from({ length: 1000 }, () => newCustomItemId());
    expect(new Set(ids).size).toBe(1000);
    expect(ids.every((id) => id.startsWith('custom-'))).toBe(true);
  });
});
