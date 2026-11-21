import React, { useState } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CartItemInspector from '../components/cart/CartItemInspector';
import CartComponent from '../components/Cart';
import { LanguageProvider } from '../i18n/LanguageContext';
import { setStorageItem } from '../utils/storage';

function Harness({ initial }) {
  const [item, setItem] = useState(initial);
  return (
    <LanguageProvider>
      <CartItemInspector
        item={item}
        onClose={() => {}}
        onRemoveItem={() => {}}
        onUpdateDetails={(_id, updates) => setItem((prev) => ({ ...prev, ...updates }))}
      />
      <output data-testid="qty">{item.quantity}</output>
    </LanguageProvider>
  );
}

const piece = { id: 1, name: 'Rohlik', price: 4, quantity: 1, vat: 12 };
const weighed = { id: 2, name: 'Syr', price: 120, quantity: 1, unit: 'kg', isWeighted: true, vat: 12 };

describe('CartItemInspector quantity field', () => {
  it('lets the cashier clear the field and type a new quantity', () => {
    render(<Harness initial={piece} />);
    const input = document.querySelector('input.cart-stepper-num');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '' } });
    expect(input.value).toBe('');
    fireEvent.change(input, { target: { value: '1' } });
    fireEvent.change(input, { target: { value: '12' } });
    expect(screen.getByTestId('qty').textContent).toBe('12');
  });

  it('accepts decimal typing for weighed items', () => {
    render(<Harness initial={weighed} />);
    const input = document.querySelector('input.cart-stepper-num');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '0' } });
    fireEvent.change(input, { target: { value: '0.' } });
    fireEvent.change(input, { target: { value: '0.5' } });
    expect(input.value).toBe('0.5');
    expect(screen.getByTestId('qty').textContent).toBe('0.5');
  });

  it('restores the last valid quantity when blurred empty', () => {
    render(<Harness initial={piece} />);
    const input = document.querySelector('input.cart-stepper-num');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(input.value).toBe('1');
    expect(screen.getByTestId('qty').textContent).toBe('1');
  });

  it('keeps the field in sync with the plus button', () => {
    render(<Harness initial={piece} />);
    const input = document.querySelector('input.cart-stepper-num');
    fireEvent.click(screen.getByTitle('+1 ks'));
    expect(input.value).toBe('2');
  });
});

describe('Cart row (plan phase 2)', () => {
  const baseProps = {
    onUpdateQty: () => {}, onUpdateItemDetails: () => {}, onRemoveItem: () => {}, onClearCart: () => {}, onOpenPayment: () => {}
  };
  const renderCart = (items) => render(
    <LanguageProvider><CartComponent cartItems={items} {...baseProps} /></LanguageProvider>
  );

  it('shows no VAT text and no duplicated total on weighed rows', () => {
    const { container } = renderCart([{ ...weighed, quantity: 0.35 }]);
    const details = container.querySelector('.cart-item-unit-details').textContent;
    expect(details).not.toMatch(/DPH|VAT|%/);
    expect(details).not.toContain('=');
  });

  it('tints the minus at quantity 1 (no second trash icon) and keeps a plain minus at quantity 2', () => {
    const { container, rerender } = renderCart([piece]);
    expect(container.querySelector('.cart-stepper-btn-minus.is-last svg.lucide-minus')).not.toBeNull();
    expect(container.querySelector('.cart-stepper-btn-minus svg.lucide-trash-2')).toBeNull();
    rerender(<LanguageProvider><CartComponent cartItems={[{ ...piece, quantity: 2 }]} {...baseProps} /></LanguageProvider>);
    expect(container.querySelector('.cart-stepper-btn-minus svg.lucide-minus')).not.toBeNull();
  });
});

describe('Cart auto-scroll (plan phase 3)', () => {
  const originalScroll = Element.prototype.scrollIntoView;
  afterEach(() => { Element.prototype.scrollIntoView = originalScroll; vi.useRealTimers(); });

  const baseProps = {
    onUpdateQty: () => {}, onUpdateItemDetails: () => {}, onRemoveItem: () => {}, onClearCart: () => {}, onOpenPayment: () => {}
  };
  const mk = (n, qty = 1) => Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `P${i + 1}`, price: 10, quantity: qty, vat: 21 }));
  const ui = (items) => <LanguageProvider><CartComponent cartItems={items} {...baseProps} /></LanguageProvider>;

  it('scrolls and flashes on add and on quantity increase, not on removal', () => {
    const calls = [];
    Element.prototype.scrollIntoView = vi.fn(function () { calls.push(this.getAttribute('data-line-index')); });
    const items = mk(3);
    const { container, rerender } = render(ui(items));
    expect(calls).toEqual([]);

    rerender(ui([...items, { id: 4, name: 'P4', price: 10, quantity: 1, vat: 21 }]));
    expect(calls).toEqual(['3']);
    expect(container.querySelector('[data-line-index="3"]').className).toContain('is-flash');

    const bumped = [...items, { id: 4, name: 'P4', price: 10, quantity: 1, vat: 21 }].map((i) => (i.id === 2 ? { ...i, quantity: 2 } : i));
    rerender(ui(bumped));
    expect(calls).toEqual(['3', '1']);

    rerender(ui(bumped.slice(0, 3)));
    expect(calls).toEqual(['3', '1']);
  });

  it('flashes the restored middle line when a removal is undone', () => {
    Element.prototype.scrollIntoView = vi.fn();
    const items = mk(4);
    const { container, rerender } = render(ui(items.filter((i) => i.id !== 2)));
    rerender(ui(items));
    expect(container.querySelector('[data-line-index="1"]').className).toContain('is-flash');
    expect(container.querySelector('[data-line-index="3"]').className).not.toContain('is-flash');
  });

  it('clears the flash after 600ms even if the cart changes meanwhile', () => {
    vi.useFakeTimers();
    Element.prototype.scrollIntoView = vi.fn();
    const items = mk(2);
    const { container, rerender } = render(ui(items));
    const added = [...items, { id: 3, name: 'P3', price: 10, quantity: 1, vat: 21 }];
    rerender(ui(added));
    rerender(ui(added.map((i) => (i.id === 3 ? { ...i, note: 'x' } : i))));
    vi.advanceTimersByTime(700);
    expect(container.querySelector('.is-flash')).toBeNull();
  });
});

describe('Cart line identity (item 3)', () => {
  it('addresses the tapped line by lineId when two lines share a product id', () => {
    const calls = [];
    const items = [
      { id: 'p1', lineId: 'L1', name: 'Rohlik', price: 80, quantity: 1, vat: 12 },
      { id: 'p1', lineId: 'L2', name: 'Rohlik', price: 100, quantity: 1, vat: 12 }
    ];
    const { container } = render(
      <LanguageProvider>
        <CartComponent
          cartItems={items}
          onUpdateQty={(id, q) => calls.push(['qty', id, q])}
          onUpdateItemDetails={() => {}}
          onRemoveItem={(id) => calls.push(['remove', id])}
          onClearCart={() => {}}
          onOpenPayment={() => {}}
        />
      </LanguageProvider>
    );
    const second = container.querySelector('[data-line-index="1"]');
    fireEvent.click(second.querySelector('.cart-stepper-btn-plus'));
    fireEvent.click(second.querySelector('.cart-del-btn'));
    expect(calls).toEqual([['qty', 'L2', 2], ['remove', 'L2']]);

    fireEvent.click(second);
    expect(container.querySelectorAll('.cart-item-card.is-active')).toHaveLength(1);
    expect(container.querySelector('[data-line-index="1"]').className).toContain('is-active');
  });
});

describe('Cart footer (compaction)', () => {
  const baseProps = { onUpdateQty: () => {}, onUpdateItemDetails: () => {}, onRemoveItem: () => {}, onClearCart: () => {} };
  const items = [{ id: 'p1', lineId: 'L1', name: 'Rohlik', price: 112, quantity: 1, vat: 12 }];
  const renderFooter = (cartItems, extra = {}) => render(
    <LanguageProvider>
      <CartComponent cartItems={cartItems} onOpenPayment={() => {}} {...baseProps} {...extra} />
    </LanguageProvider>
  );

  it('shows base and VAT on one summary line', () => {
    const { container } = renderFooter(items);
    const rows = container.querySelectorAll('.summary-row');
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('100.00 Kč');
    expect(rows[0].textContent).toContain('12.00 Kč');
  });

  it('drawer button works with items (compact, named) and with an empty cart (labelled)', () => {
    let opened = 0;
    const onOpenCashDrawer = () => { opened += 1; };
    const full = renderFooter(items, { onOpenCashDrawer });
    let btn = full.container.querySelector('.cart-drawer-btn');
    expect(btn.className).toContain('is-compact');
    expect(btn.getAttribute('aria-label')).toBeTruthy();
    expect(btn.textContent).toBe('');
    fireEvent.click(btn);
    full.unmount();

    const empty = renderFooter([], { onOpenCashDrawer });
    btn = empty.container.querySelector('.cart-drawer-btn');
    expect(btn.className).not.toContain('is-compact');
    expect(btn.textContent).not.toBe('');
    expect(empty.container.querySelector('.split-pay-btn')).toBeNull();
    fireEvent.click(btn);
    expect(opened).toBe(2);
  });

  it('split button still opens split payment', () => {
    const modes = [];
    const { container } = renderFooter(items, { onOpenPayment: (m) => modes.push(m), onOpenCashDrawer: () => {} });
    fireEvent.click(container.querySelector('.split-pay-btn'));
    expect(modes).toEqual(['split']);
  });
});

describe('Cart polish (items 4, 7, 9, 10)', () => {
  const baseProps = { onUpdateQty: () => {}, onUpdateItemDetails: () => {}, onRemoveItem: () => {}, onClearCart: () => {}, onOpenPayment: () => {} };

  it('header icon buttons keep accessible names and the cart discount still shows its percent', () => {
    render(
      <LanguageProvider>
        <CartComponent cartItems={[piece]} cartDiscountPercent={15} onParkCart={() => {}} onOpenCustomDiscount={() => {}} {...baseProps} />
      </LanguageProvider>
    );
    const discount = screen.getByRole('button', { name: /sleva na košík/i });
    expect(discount.textContent).toContain('-15%');
    expect(screen.getByRole('button', { name: 'Odložit nákup' }).textContent).toBe('');
    expect(screen.getByRole('button', { name: 'Vysypat' }).textContent).toBe('');
    expect(screen.getAllByRole('button', { name: /Přidat množství/ }).length).toBeGreaterThan(0);
  });

  it('an English refund cart shows no Czech refund text', () => {
    setStorageItem('lang', 'en');
    try {
      const refundLine = { id: 'r1', lineId: 'R1', name: 'Shirt', price: -100, quantity: 1, vat: 21 };
      const { container } = render(
        <LanguageProvider>
          <CartComponent cartItems={[refundLine]} {...baseProps} />
        </LanguageProvider>
      );
      const text = container.textContent;
      expect(text).toContain('RETURN');
      expect(text).toContain('REFUND DUE');
      expect(text).toContain('Refund Cash');
      expect(text).not.toMatch(/VRATKA|K VRÁCENÍ|Vrátit/);
    } finally {
      setStorageItem('lang', 'cs');
    }
  });

  it('Escape saves a typed unit price before closing', () => {
    const calls = [];
    let closed = 0;
    render(
      <LanguageProvider>
        <CartItemInspector
          item={piece}
          onClose={() => { closed += 1; }}
          onRemoveItem={() => {}}
          onUpdateDetails={(id, u) => calls.push(u)}
        />
      </LanguageProvider>
    );
    const price = document.querySelector('input[step="any"]');
    fireEvent.change(price, { target: { value: '7.5' } });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(calls).toContainEqual({ price: 7.5 });
    expect(closed).toBe(1);
  });

  it('Escape discards an invalid price without updating the line', () => {
    const calls = [];
    render(
      <LanguageProvider>
        <CartItemInspector item={piece} onClose={() => {}} onRemoveItem={() => {}} onUpdateDetails={(id, u) => calls.push(u)} />
      </LanguageProvider>
    );
    const price = document.querySelector('input[step="any"]');
    fireEvent.change(price, { target: { value: '-3' } });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(calls.filter((u) => 'price' in u)).toEqual([]);
  });

  it('shows large amounts grouped', () => {
    const { container } = render(
      <LanguageProvider>
        <CartComponent cartItems={[{ id: 'b1', lineId: 'B1', name: 'TV', price: 12345.5, quantity: 1, vat: 21 }]} {...baseProps} />
      </LanguageProvider>
    );
    expect(container.querySelector('.total-hero-amount').textContent).toBe('12 345.50 Kč');
  });
});

describe('Cart cash rounding hint', () => {
  const baseProps = { onUpdateQty: () => {}, onUpdateItemDetails: () => {}, onRemoveItem: () => {}, onClearCart: () => {}, onOpenPayment: () => {} };
  const line = (price, qty = 1) => [{ id: 'x', lineId: 'X', name: 'X', price, quantity: qty, vat: 21 }];
  const badge = (items, extra = {}) => {
    const { container } = render(
      <LanguageProvider><CartComponent cartItems={items} {...baseProps} {...extra} /></LanguageProvider>
    );
    return container.querySelector('.total-items-badge').textContent;
  };

  it('shows the whole-koruna cash amount only when it differs from the total', () => {
    expect(badge(line(3.5))).toContain('hotově 4 Kč');
    expect(badge(line(4))).not.toContain('hotově');
    expect(badge([])).not.toContain('hotově');
  });

  it('shows the absolute cash amount for a refund', () => {
    expect(badge(line(-3.5))).toContain('hotově 4 Kč');
  });
});
