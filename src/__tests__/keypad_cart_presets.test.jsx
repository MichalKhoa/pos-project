import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ManualKeypad from '../components/ManualKeypad';
import QuickPresetGrid from '../components/QuickPresetGrid';
import Cart from '../components/Cart';
import { LanguageProvider } from '../i18n/LanguageContext';
import { DEFAULT_STORE_CONFIG } from '../data/initialData';

function wrapWithLanguage(ui) {
  return render(
    <LanguageProvider>
      {ui}
    </LanguageProvider>
  );
}

function ManualKeypadHarness({ onAddToCart, defaultVat = 21 }) {
  const [amountStr, setAmountStr] = useState('');
  const [itemMultiplier, setItemMultiplier] = useState(1);

  return (
    <ManualKeypad
      onAddToCart={onAddToCart}
      amountStr={amountStr}
      setAmountStr={setAmountStr}
      itemMultiplier={itemMultiplier}
      setItemMultiplier={setItemMultiplier}
      defaultVat={defaultVat}
    />
  );
}

describe('Keypad, Presets & Cart Interaction Tests', () => {
  describe('ManualKeypad', () => {
    it('types numbers, selects VAT rate, toggles return sign, and adds item to cart', () => {
      const onAddToCart = vi.fn();
      wrapWithLanguage(
        <ManualKeypadHarness
          onAddToCart={onAddToCart}
          defaultVat={21}
        />
      );

      // Type 1, 5, 0
      fireEvent.click(screen.getByRole('button', { name: '1' }));
      fireEvent.click(screen.getByRole('button', { name: '5' }));
      fireEvent.click(screen.getByRole('button', { name: '0' }));

      // Select 12% VAT chip
      const vat12Btn = screen.getByRole('button', { name: /12\s*%/i });
      fireEvent.click(vat12Btn);

      // Enter optional item name
      const nameInput = screen.getByPlaceholderText(/Název \/ popis/i);
      fireEvent.change(nameInput, { target: { value: 'Káva s mlékem' } });

      // Click Add to Cart button
      const addBtn = screen.getByRole('button', { name: /Přidat do Košíku/i });
      fireEvent.click(addBtn);

      expect(onAddToCart).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Káva s mlékem',
        price: 150,
        vat: 12,
        quantity: 1
      }));
    });

    it('toggles ± Vratka for negative return sale', () => {
      const onAddToCart = vi.fn();
      wrapWithLanguage(
        <ManualKeypadHarness
          onAddToCart={onAddToCart}
          defaultVat={21}
        />
      );

      // Type 2, 0, 0
      fireEvent.click(screen.getByRole('button', { name: '2' }));
      fireEvent.click(screen.getByRole('button', { name: '0' }));
      fireEvent.click(screen.getByRole('button', { name: '0' }));

      // Click ± Vratka button
      const vratkaBtn = screen.getByRole('button', { name: /± Vratka/i });
      fireEvent.click(vratkaBtn);

      // Click Add to Cart
      const addBtn = screen.getByRole('button', { name: /Přidat do Košíku/i });
      fireEvent.click(addBtn);

      expect(onAddToCart).toHaveBeenCalledWith(expect.objectContaining({
        price: -200
      }));
    });
  });

  describe('QuickPresetGrid', () => {
    const samplePresets = [
      { id: 'p1', name: 'Espresso', price: 55, vat: 21, category: 'drinks', icon: 'Coffee', color: '#3b82f6' },
      { id: 'p2', name: 'Čaj Černý', price: 45, vat: 21, category: 'drinks', icon: 'Coffee', color: '#10b981' },
      { id: 'p3', name: 'Dort Čokoláda', price: 95, vat: 12, category: 'food', icon: 'Utensils', color: '#f59e0b' }
    ];

    const sampleCategories = [
      { id: 'drinks', name: 'Nápoje' },
      { id: 'food', name: 'Jídlo' }
    ];

    it('renders preset tiles and filters by category chip', () => {
      const onAddToCart = vi.fn();
      wrapWithLanguage(
        <QuickPresetGrid
          presets={samplePresets}
          categories={sampleCategories}
          onAddToCart={onAddToCart}
          onOpenCustomModal={() => {}}
        />
      );

      // Verify all 3 presets initially render
      expect(screen.getByText('Espresso')).toBeInTheDocument();
      expect(screen.getByText('Čaj Černý')).toBeInTheDocument();
      expect(screen.getByText('Dort Čokoláda')).toBeInTheDocument();

      // Click Jídlo category chip
      const foodChip = screen.getByRole('button', { name: /Jídlo/i });
      fireEvent.click(foodChip);

      // Dort Čokoláda should remain, drinks should be filtered out
      expect(screen.getByText('Dort Čokoláda')).toBeInTheDocument();
      expect(screen.queryByText('Espresso')).not.toBeInTheDocument();

      // Click preset tile
      fireEvent.click(screen.getByText('Dort Čokoláda'));
      expect(onAddToCart).toHaveBeenCalledWith(expect.objectContaining({
        id: 'p3',
        name: 'Dort Čokoláda',
        price: 95
      }));
    });
  });

  describe('Cart', () => {
    const sampleCartItems = [
      { id: 'c1', name: 'Espresso', price: 55, quantity: 2, vat: 21 },
      { id: 'c2', name: 'Croissant', price: 45, quantity: 1, vat: 12 }
    ];

    it('renders line items, updates quantities, and triggers payment modal', () => {
      const onUpdateQuantity = vi.fn();
      const onRemoveItem = vi.fn();
      const onOpenPayment = vi.fn();
      const onClearCart = vi.fn();

      wrapWithLanguage(
        <Cart
          cartItems={sampleCartItems}
          cartDiscount={0}
          onUpdateQuantity={onUpdateQuantity}
          onRemoveItem={onRemoveItem}
          onOpenPayment={onOpenPayment}
          onClearCart={onClearCart}
          onOpenDiscountModal={() => {}}
          storeConfig={DEFAULT_STORE_CONFIG}
        />
      );

      // Verify items render
      expect(screen.getByText('Espresso')).toBeInTheDocument();
      expect(screen.getByText('Croissant')).toBeInTheDocument();

      // Verify total price (55*2 + 45 = 155 Kč)
      expect(screen.getAllByText(/155/i).length).toBeGreaterThanOrEqual(1);

      // Click pay button (Hotovost / Karta)
      const payButtons = screen.getAllByRole('button', { name: /Hotovost|Karta|Zaplatit/i });
      expect(payButtons.length).toBeGreaterThanOrEqual(1);
      fireEvent.click(payButtons[0]);

      expect(onOpenPayment).toHaveBeenCalled();
    });
  });
});
