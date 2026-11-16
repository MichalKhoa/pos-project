import { describe, it, expect } from 'vitest';
import { countCartItems } from '../utils/cartCount';

describe('countCartItems (F-003: kilograms are not items)', () => {
  it('counts pieces by quantity', () => {
    expect(countCartItems([{ id: 'a', quantity: 3 }, { id: 'b', quantity: 2 }])).toBe(5);
  });

  it('counts a weighed line as one item whatever its weight', () => {
    expect(countCartItems([{ id: 'a', quantity: 350, unit: 'kg', isWeighted: true }, { id: 'b', quantity: 1 }])).toBe(2);
  });

  it('treats a fractional quantity as weighed', () => {
    expect(countCartItems([{ id: 'a', quantity: 0.35 }])).toBe(1);
  });

  it('counts returns as negative', () => {
    expect(countCartItems([{ id: 'a', quantity: -2 }, { id: 'b', quantity: -0.5, unit: 'kg' }])).toBe(-3);
  });

  it('is zero for an empty cart', () => {
    expect(countCartItems([])).toBe(0);
  });
});
