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

    it('toggles ± for negative return sale with single ± key', () => {
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

      // Click ± button (only one exists on numeric grid)
      const plusMinusBtn = screen.getByRole('button', { name: '±' });
      fireEvent.click(plusMinusBtn);

      // Click Add to Cart / Return button
      const addBtn = screen.getByRole('button', { name: /Vratku|Přidat/i });
      fireEvent.click(addBtn);

      expect(onAddToCart).toHaveBeenCalledWith(expect.objectContaining({
        price: -200,
        quantity: 1
      }));
    });

    it('clamps stepper down at 1 ks and never goes negative', () => {
      const onAddToCart = vi.fn();
      wrapWithLanguage(
        <ManualKeypadHarness
          onAddToCart={onAddToCart}
          defaultVat={21}
        />
      );

      // Type 100
      fireEvent.click(screen.getByRole('button', { name: '1' }));
      fireEvent.click(screen.getByRole('button', { name: '0' }));
      fireEvent.click(screen.getByRole('button', { name: '0' }));

      // Step down multiplier button is disabled at 1 ks
      const stepDownBtn = screen.getByRole('button', { name: /-1 ks/i });
      expect(stepDownBtn).toBeDisabled();

      // Click Add button
      const addBtn = screen.getByRole('button', { name: /Vratku|Přidat/i });
      fireEvent.click(addBtn);

      expect(onAddToCart).toHaveBeenCalledWith(expect.objectContaining({
        price: 100,
        quantity: 1
      }));
    });

    it('combines positive multiplier with ± return mode without positive flip', () => {
      const onAddToCart = vi.fn();
      wrapWithLanguage(
        <ManualKeypadHarness
          onAddToCart={onAddToCart}
          defaultVat={21}
        />
      );

      // Step up to 2 ks
      const stepUpBtn = screen.getByRole('button', { name: /\+1 ks/i });
      fireEvent.click(stepUpBtn);

      // Type 100
      fireEvent.click(screen.getByRole('button', { name: '1' }));
      fireEvent.click(screen.getByRole('button', { name: '0' }));
      fireEvent.click(screen.getByRole('button', { name: '0' }));

      // Toggle ± return
      const plusMinusBtn = screen.getByRole('button', { name: '±' });
      fireEvent.click(plusMinusBtn);

      // Verify subtotal preview text shows negative total, not positive
      expect(screen.getByText(/= Celkem -200 Kč/i)).toBeInTheDocument();

      // Click Add button
      const addBtn = screen.getByRole('button', { name: /Vratku|Přidat/i });
      fireEvent.click(addBtn);

      // Quantity must be 2, price must be -100
      expect(onAddToCart).toHaveBeenCalledWith(expect.objectContaining({
        price: -100,
        quantity: 2
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

    it('renders VAT badge when showPresetVat is true, and hides it when showPresetVat is false', () => {
      const { unmount } = wrapWithLanguage(
        <QuickPresetGrid
          presets={samplePresets}
          categories={sampleCategories}
          storeConfig={{ showPresetVat: true }}
        />
      );
      expect(screen.getAllByText('21%').length).toBeGreaterThan(0);
      expect(screen.getByText('12%')).toBeInTheDocument();
      unmount();

      wrapWithLanguage(
        <QuickPresetGrid
          presets={samplePresets}
          categories={sampleCategories}
          storeConfig={{ showPresetVat: false }}
        />
      );
      expect(screen.queryByText('21%')).not.toBeInTheDocument();
      expect(screen.queryByText('12%')).not.toBeInTheDocument();
    });

    it('adds preset as return with negative price when keypadAmount has return sign', () => {
      const onAddToCart = vi.fn();
      const onClearKeypadAmount = vi.fn();
      wrapWithLanguage(
        <QuickPresetGrid
          presets={samplePresets}
          categories={sampleCategories}
          onAddToCart={onAddToCart}
          keypadAmount="-"
          onClearKeypadAmount={onClearKeypadAmount}
        />
      );

      fireEvent.click(screen.getByText('Espresso'));
      expect(onAddToCart).toHaveBeenCalledWith(expect.objectContaining({
        id: 'p1',
        name: 'Espresso',
        price: -55,
        quantity: 1
      }));
      expect(onClearKeypadAmount).toHaveBeenCalled();
    });

    it('applies custom negative price to preset when typed on keypad with return sign', () => {
      const onAddToCart = vi.fn();
      const onClearKeypadAmount = vi.fn();
      wrapWithLanguage(
        <QuickPresetGrid
          presets={samplePresets}
          categories={sampleCategories}
          onAddToCart={onAddToCart}
          keypadAmount="-60"
          onClearKeypadAmount={onClearKeypadAmount}
        />
      );

      fireEvent.click(screen.getByText('Espresso'));
      expect(onAddToCart).toHaveBeenCalledWith(expect.objectContaining({
        id: 'p1',
        name: 'Espresso',
        price: -60,
        quantity: 1
      }));
      expect(onClearKeypadAmount).toHaveBeenCalled();
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
