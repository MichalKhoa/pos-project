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
});
