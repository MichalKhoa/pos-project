import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCart } from '../hooks/useCart';

vi.mock('../utils/audio', () => ({
  soundFx: {
    playScanChime: vi.fn(),
    playSuccessChime: vi.fn(),
    playDeleteTone: vi.fn(),
    playErrorChime: vi.fn()
  }
}));

describe('useCart', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('merges matching non-custom items with 3-decimal rounding and keeps custom or differently-priced items separate', () => {
    const { result } = renderHook(() => useCart());

    act(() => {
      result.current.addToCart({ id: 'w1', name: 'Jablka', price: 42, vat: 12 }, 0.35);
    });
    act(() => {
      result.current.addToCart({ id: 'w1', name: 'Jablka', price: 42, vat: 12 }, 0.15);
      result.current.addToCart({ id: 'w1', name: 'Jablka', price: 45, vat: 12 }, 1);
      result.current.addToCart({ id: 'c1', name: 'Custom', price: 100, isCustom: true }, 1);
      result.current.addToCart({ id: 'c1', name: 'Custom', price: 100, isCustom: true }, 1);
    });

    expect(result.current.cartItems).toHaveLength(4);
    expect(result.current.cartItems[0].quantity).toBe(0.5);
    expect(result.current.cartItems[1].price).toBe(45);
    expect(result.current.cartItems[2].isCustom).toBe(true);
    expect(result.current.cartItems[3].isCustom).toBe(true);
  });

  it('updateQuantity supports id or index, clamps to 9999, and removes when <= 0', () => {
    const { result } = renderHook(() => useCart());

    act(() => {
      result.current.addToCart({ id: 'p1', name: 'Rohlík', price: 3.5, vat: 12 }, 1);
    });

    act(() => {
      result.current.updateQuantity('p1', 12345);
    });
    expect(result.current.cartItems[0].quantity).toBe(9999);

    act(() => {
      result.current.updateQuantity(0, 1.23456);
    });
    expect(result.current.cartItems[0].quantity).toBe(1.235);

    act(() => {
      result.current.updateQuantity('p1', 0);
    });
    expect(result.current.cartItems).toHaveLength(0);
    expect(result.current.undoToast?.type).toBe('REMOVE');
  });

  it('updateItemDiscount and updateItemDetails update fields and remove on non-positive quantity', () => {
    const { result } = renderHook(() => useCart());

    act(() => {
      result.current.addToCart({ id: 'p1', name: 'Káva', price: 60, vat: 21 }, 1);
    });

    act(() => {
      result.current.updateItemDiscount('p1', 15);
      result.current.updateItemDetails('p1', { name: 'Nový název', price: 99, quantity: 2 });
    });

    expect(result.current.cartItems[0]).toMatchObject({
      id: 'p1',
      name: 'Nový název',
      price: 99,
      quantity: 2,
      discountPercent: 15
    });

    act(() => {
      result.current.updateItemDetails('p1', { quantity: 0 });
    });
    expect(result.current.cartItems).toHaveLength(0);
    expect(result.current.undoToast?.type).toBe('REMOVE');
  });

  it('removeItem and 4s undo toast restore previous cart state or auto-expire', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCart());

    act(() => {
      result.current.addToCart({ id: 'p1', name: 'Mléko', price: 25, vat: 12 }, 1);
      result.current.setCartDiscountPercent(10);
    });
    act(() => {
      result.current.removeItem('p1');
    });

    expect(result.current.cartItems).toHaveLength(0);
    expect(result.current.undoToast?.type).toBe('REMOVE');

    act(() => {
      result.current.undoLastAction();
    });
    expect(result.current.cartItems).toHaveLength(1);
    expect(result.current.cartDiscountPercent).toBe(10);
    expect(result.current.undoToast).toBeNull();

    act(() => {
      result.current.addToCart({ id: 'p2', name: 'Máslo', price: 55, vat: 12 }, 1);
    });
    expect(result.current.undoToast?.type).toBe('ADD');

    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(result.current.undoToast).toBeNull();

    act(() => {
      result.current.addToCart({ id: 'p3', name: 'Sýr', price: 40, vat: 12 }, 1);
    });
    expect(result.current.undoToast).not.toBeNull();

    act(() => {
      result.current.dismissUndoToast();
    });
    expect(result.current.undoToast).toBeNull();
  });

  it('clearCart saves 8s recovery snapshot, restores full cart, and expires after 8s', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCart());

    act(() => {
      result.current.addToCart({ id: 'p1', name: 'Chléb', price: 45, vat: 12 }, 1);
      result.current.setCartDiscountPercent(5);
      result.current.setItemMultiplier(3);
    });
    act(() => {
      result.current.clearCart();
    });

    expect(result.current.cartItems).toHaveLength(0);
    expect(result.current.cartDiscountPercent).toBe(0);
    expect(result.current.itemMultiplier).toBe(1);
    expect(result.current.clearedCartSnapshot).not.toBeNull();

    act(() => {
      result.current.restoreClearedCart();
    });
    expect(result.current.cartItems).toHaveLength(1);
    expect(result.current.cartDiscountPercent).toBe(5);
    expect(result.current.itemMultiplier).toBe(3);
    expect(result.current.clearedCartSnapshot).toBeNull();

    act(() => {
      result.current.clearCart();
    });
    expect(result.current.clearedCartSnapshot).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(8000);
    });
    expect(result.current.clearedCartSnapshot).toBeNull();

    act(() => {
      result.current.addToCart({ id: 'p2', name: 'Voda', price: 15, vat: 12 }, 1);
    });
    act(() => {
      result.current.clearCart();
    });
    expect(result.current.clearedCartSnapshot).not.toBeNull();
    act(() => {
      result.current.dismissClearedCartSnapshot();
    });
    expect(result.current.clearedCartSnapshot).toBeNull();
  });

  it('parkCurrentCart, restoreParkedCart (with seamless swap), note edit, delete, and localStorage persistence', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-19T10:00:00Z'));

    const { result, unmount } = renderHook(() => useCart());

    let emptyHold;
    act(() => {
      emptyHold = result.current.parkCurrentCart();
    });
    expect(emptyHold).toBeNull();

    act(() => {
      result.current.addToCart({ id: 'p1', name: 'Zboží', price: 100, vat: 21, discountPercent: 10 }, 2);
      result.current.setCartDiscountPercent(10);
    });

    let hold;
    act(() => {
      hold = result.current.parkCurrentCart('Stůl 4');
    });
    expect(hold).not.toBeNull();
    expect(result.current.cartItems).toHaveLength(0);
    expect(result.current.parkedCarts).toHaveLength(1);
    expect(result.current.parkedCarts[0].note).toBe('Stůl 4');
    expect(result.current.parkedCarts[0].totalAmount).toBeCloseTo(162, 5);
    expect(result.current.parkedCarts[0].itemCount).toBe(2);

    const saved = JSON.parse(localStorage.getItem('voltflow_pos_parked_carts'));
    expect(saved).toHaveLength(1);
    expect(saved[0].id).toBe(hold.id);

    act(() => {
      result.current.updateParkedCartNote(hold.id, 'Stůl 5');
    });
    expect(result.current.parkedCarts[0].note).toBe('Stůl 5');

    act(() => {
      vi.advanceTimersByTime(100);
      result.current.addToCart({ id: 'active-1', name: 'Aktivní', price: 50, vat: 21 }, 1);
    });

    let swapResult;
    act(() => {
      swapResult = result.current.restoreParkedCart(hold.id);
    });
    expect(swapResult.autoParked).toBe(true);
    expect(swapResult.restored.note).toBe('Stůl 5');
    expect(result.current.cartItems).toHaveLength(1);
    expect(result.current.cartItems[0].id).toBe('p1');
    expect(result.current.cartDiscountPercent).toBe(10);
    expect(result.current.parkedCarts).toHaveLength(1);
    expect(result.current.parkedCarts[0].items[0].id).toBe('active-1');

    const swappedId = result.current.parkedCarts[0].id;
    unmount();

    const rehydrated = renderHook(() => useCart());
    expect(rehydrated.result.current.parkedCarts).toHaveLength(1);
    expect(rehydrated.result.current.parkedCarts[0].id).toBe(swappedId);

    act(() => {
      rehydrated.result.current.deleteParkedCart(swappedId);
    });
    expect(rehydrated.result.current.parkedCarts).toHaveLength(0);
    rehydrated.unmount();

    localStorage.setItem('voltflow_pos_parked_carts', '{corrupt-json');
    const fallback = renderHook(() => useCart());
    expect(fallback.result.current.parkedCarts).toEqual([]);
  });

  describe('two lines of the same product', () => {
    const setup = () => {
      const hook = renderHook(() => useCart());
      act(() => { hook.result.current.addToCart({ id: 'p1', name: 'Rohlík', price: 100, vat: 12 }, 1); });
      act(() => { hook.result.current.updateItemDetails('p1', { price: 80 }); });
      act(() => { hook.result.current.addToCart({ id: 'p1', name: 'Rohlík', price: 100, vat: 12 }, 1); });
      expect(hook.result.current.cartItems).toHaveLength(2);
      return hook;
    };

    it('updateQuantity by lineId changes only that line', () => {
      const { result } = setup();
      const second = result.current.cartItems[1];
      act(() => { result.current.updateQuantity(second.lineId, 5); });
      expect(result.current.cartItems.map((i) => i.quantity)).toEqual([1, 5]);
    });

    it('updateItemDiscount and updateItemDetails by lineId touch only that line', () => {
      const { result } = setup();
      const second = result.current.cartItems[1];
      act(() => { result.current.updateItemDiscount(second.lineId, 10); });
      act(() => { result.current.updateItemDetails(second.lineId, { note: 'x' }); });
      expect(result.current.cartItems.map((i) => i.discountPercent || 0)).toEqual([0, 10]);
      expect(result.current.cartItems.map((i) => i.note)).toEqual([undefined, 'x']);
    });

    it('removeItem by lineId removes only that line', () => {
      const { result } = setup();
      const second = result.current.cartItems[1];
      act(() => { result.current.removeItem(second.lineId); });
      expect(result.current.cartItems).toHaveLength(1);
      expect(result.current.cartItems[0].price).toBe(80);
    });

    it('gives every line a unique lineId and backfills restored legacy parked lines', () => {
      const { result } = setup();
      const ids = result.current.cartItems.map((i) => i.lineId);
      expect(new Set(ids).size).toBe(2);

      localStorage.setItem('voltflow_pos_parked_carts', JSON.stringify([{
        id: 'hold-legacy', items: [{ id: 'a', name: 'A', price: 1, quantity: 1 }, { id: 'a', name: 'A', price: 2, quantity: 1 }]
      }]));
      const fresh = renderHook(() => useCart());
      act(() => { fresh.result.current.restoreParkedCart('hold-legacy'); });
      const restored = fresh.result.current.cartItems;
      expect(restored).toHaveLength(2);
      expect(restored[0].lineId).toBeTruthy();
      expect(restored[0].lineId).not.toBe(restored[1].lineId);
    });
  });
});
