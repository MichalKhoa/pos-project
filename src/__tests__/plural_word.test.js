import { describe, it, expect } from 'vitest';
import { pluralWord } from '../utils/pluralWord';

const t = (key) => ({
  'x.one': 'účtenka', 'x.few': 'účtenky', 'x.many': 'účtenky', 'x.other': 'účtenek'
}[key.replace('_', '.')] ?? key);

describe('pluralWord', () => {
  it.each([[1, 'účtenka'], [2, 'účtenky'], [4, 'účtenky'], [5, 'účtenek'], [11, 'účtenek'], [0, 'účtenek']])(
    'Czech %i -> %s', (n, word) => {
      expect(pluralWord(t, 'cs', 'x', n)).toBe(word);
    }
  );
  it('falls back to the other form when the category has no key', () => {
    expect(pluralWord((k) => (k === 'x_other' ? 'items' : k), 'en', 'x', 1)).toBe('items');
  });
});
