import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { LanguageProvider } from '../i18n/LanguageContext';
import UnknownBarcodeModal from '../components/UnknownBarcodeModal';
import { usePosKeyboardShortcuts } from '../hooks/usePosKeyboardShortcuts';

function wrapWithLanguage(ui) {
  return render(
    <LanguageProvider>
      {ui}
    </LanguageProvider>
  );
}

// Harness to test usePosKeyboardShortcuts with barcode scanner simulation
function ScannerHarness({ presets, onAddToCart, onUnknownBarcode, onBarcodeScanned, initialMultiplier = 1 }) {
  const [keypadAmount, setKeypadAmount] = useState('');
  const [itemMultiplier, setItemMultiplier] = useState(initialMultiplier);

  usePosKeyboardShortcuts({
    isAppLocked: false,
    activeTab: 'register',
    keypadAmount,
    setKeypadAmount,
    setItemMultiplier,
    itemMultiplier,
    cartItems: [],
    paymentModalMethod: null,
    setPaymentModalMethod: vi.fn(),
    handleAddToCart: onAddToCart,
    storeConfig: { defaultVat: 21 },
    presets,
    onUnknownBarcode,
    onBarcodeScanned
  });

  return (
    <div>
      <div data-testid="keypad-amount">{keypadAmount}</div>
      <div data-testid="multiplier">{itemMultiplier}</div>
    </div>
  );
}

describe('Barcode Scanner & Unknown Barcode Modal (RET-01 & RET-02)', () => {
  const mockPresets = [
    {
      id: 'p1',
      name: 'Kofola 0.5L',
      price: 28,
      vat: 21,
      barcode: '8594001234567'
    },
    {
      id: 'p2',
      name: 'Pilsner Urquell 0.5L',
      price: 36,
      vat: 21,
      barcode: '8594009999999, 8594008888888'
    }
  ];

  it('scans known barcode with multiplier and adds to cart', () => {
    const handleAddToCart = vi.fn();
    const handleBarcodeScanned = vi.fn();
    const handleUnknownBarcode = vi.fn();

    render(
      <ScannerHarness
        presets={mockPresets}
        onAddToCart={handleAddToCart}
        onBarcodeScanned={handleBarcodeScanned}
        onUnknownBarcode={handleUnknownBarcode}
        initialMultiplier={3}
      />
    );

    // Simulate USB scanner: rapid keydown events (<50ms) ending with Enter
    const barcode = '8594001234567';
    act(() => {
      for (const char of barcode) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
      }
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    // Expect preset found and added with quantity 3
    expect(handleAddToCart).toHaveBeenCalledTimes(1);
    expect(handleAddToCart).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Kofola 0.5L',
        price: 28,
        quantity: 3
      })
    );
    expect(handleBarcodeScanned).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Kofola 0.5L' }),
      3
    );
    expect(handleUnknownBarcode).not.toHaveBeenCalled();
  });

  it('handles comma-separated secondary barcodes', () => {
    const handleAddToCart = vi.fn();

    render(
      <ScannerHarness
        presets={mockPresets}
        onAddToCart={handleAddToCart}
        onBarcodeScanned={vi.fn()}
        onUnknownBarcode={vi.fn()}
      />
    );

    const secondaryBarcode = '8594008888888';
    act(() => {
      for (const char of secondaryBarcode) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
      }
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(handleAddToCart).toHaveBeenCalledTimes(1);
    expect(handleAddToCart).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Pilsner Urquell 0.5L',
        quantity: 1
      })
    );
  });

  it('triggers onUnknownBarcode when an unrecognized code is scanned', () => {
    const handleAddToCart = vi.fn();
    const handleUnknownBarcode = vi.fn();

    render(
      <ScannerHarness
        presets={mockPresets}
        onAddToCart={handleAddToCart}
        onBarcodeScanned={vi.fn()}
        onUnknownBarcode={handleUnknownBarcode}
      />
    );

    const unknownCode = '8590000000001';
    act(() => {
      for (const char of unknownCode) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
      }
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(handleAddToCart).not.toHaveBeenCalled();
    expect(handleUnknownBarcode).toHaveBeenCalledTimes(1);
    expect(handleUnknownBarcode).toHaveBeenCalledWith('8590000000001');
  });

  it('renders UnknownBarcodeModal and submits new product to cart', () => {
    const handleSaveAndAdd = vi.fn();
    const handleClose = vi.fn();

    wrapWithLanguage(
      <UnknownBarcodeModal
        scannedBarcode="8591122334455"
        categories={[{ id: 'drinks', name: 'Nápoje' }]}
        defaultVat={21}
        itemMultiplier={2}
        onSaveAndAdd={handleSaveAndAdd}
        onClose={handleClose}
      />
    );

    // Verify barcode display
    expect(screen.getByText('8591122334455')).toBeInTheDocument();

    // Fill in product name and price
    const nameInput = screen.getByPlaceholderText(/Kofola/i);
    const priceInput = screen.getByPlaceholderText('0.00');

    fireEvent.change(nameInput, { target: { value: 'Birell Pomelo 0.5L' } });
    fireEvent.change(priceInput, { target: { value: '26.50' } });

    // Submit form
    const submitBtn = screen.getByText(/Uložit & do košíku/i);
    fireEvent.click(submitBtn);

    expect(handleSaveAndAdd).toHaveBeenCalledTimes(1);
    expect(handleSaveAndAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Birell Pomelo 0.5L',
        price: 26.5,
        vat: 21,
        barcode: '8591122334455'
      }),
      2
    );
  });
});
