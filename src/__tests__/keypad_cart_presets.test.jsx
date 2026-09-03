import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ManualKeypad from '../components/ManualKeypad';
import QuickPresetGrid from '../components/QuickPresetGrid';
import Cart from '../components/Cart';
import ParkedCartsDrawer from '../components/keypad/ParkedCartsDrawer';
import InventoryStockTable from '../components/inventory/InventoryStockTable.jsx';
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

    it('steps multiplier down to negative to enter return mode', () => {
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

      // Step down multiplier from 1 to -1 (activates return)
      const stepDownBtn = screen.getByRole('button', { name: /snížit|−1|-1/i });
      fireEvent.click(stepDownBtn);

      // Verify subtotal preview text shows return total
      expect(screen.getByText(/= Celkem -100 Kč/i)).toBeInTheDocument();

      // Click Add button
      const addBtn = screen.getByRole('button', { name: /Vratku|Přidat/i });
      fireEvent.click(addBtn);

      expect(onAddToCart).toHaveBeenCalledWith(expect.objectContaining({
        price: -100,
        quantity: 1
      }));
    });

    it('pressing ± while in negative stepper return mode toggles return off without positive flip', () => {
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

      // Step down into return mode (-1)
      const stepDownBtn = screen.getByRole('button', { name: /snížit|−1|-1/i });
      fireEvent.click(stepDownBtn);
      expect(screen.getByText(/= Celkem -100 Kč/i)).toBeInTheDocument();

      // Press ± to toggle return mode OFF
      const plusMinusBtn = screen.getByRole('button', { name: '±' });
      fireEvent.click(plusMinusBtn);

      // Total must be positive 100, not double-negated
      const addBtn = screen.getByRole('button', { name: /Vložit do košíku|Přidat/i });
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
      const stepUpBtn = screen.getByRole('button', { name: /zvýšit|\+1/i });
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

    it('renders parked carts restore button in Cart header when parkedCartsCount > 0', () => {
      const onOpenParkedModal = vi.fn();
      wrapWithLanguage(
        <Cart
          cartItems={[]}
          parkedCartsCount={2}
          onOpenParkedModal={onOpenParkedModal}
          storeConfig={DEFAULT_STORE_CONFIG}
        />
      );

      const restoreBadgeBtn = screen.getByRole('button', { name: /Obnovit \(2\)/i });
      expect(restoreBadgeBtn).toBeInTheDocument();

      fireEvent.click(restoreBadgeBtn);
      expect(onOpenParkedModal).toHaveBeenCalledTimes(1);
    });
  });

  describe('ParkedCartsDrawer & Localization', () => {
    const mockParkedCarts = [
      {
        id: 'hold-1',
        timeStr: '14:30',
        note: 'Stůl 5',
        totalAmount: 180,
        itemCount: 2,
        items: [{ id: '1', name: 'Pivo', price: 50, quantity: 2 }]
      }
    ];

    it('renders localized drawer controls and opens modal with parked items', () => {
      const onParkCart = vi.fn();
      const onRestoreParkedCart = vi.fn();
      const onDeleteParkedCart = vi.fn();
      const onUpdateParkedCartNote = vi.fn();

      wrapWithLanguage(
        <ParkedCartsDrawer
          hasCartItems={true}
          parkedCarts={mockParkedCarts}
          onParkCart={onParkCart}
          onRestoreParkedCart={onRestoreParkedCart}
          onDeleteParkedCart={onDeleteParkedCart}
          onUpdateParkedCartNote={onUpdateParkedCartNote}
        />
      );

      // Verify localized card header
      expect(screen.getByText(/Odložené Nákupy/i)).toBeInTheDocument();

      // Click Obnovit (1) to open modal
      const openModalBtn = screen.getByRole('button', { name: /Obnovit \(1\)/i });
      fireEvent.click(openModalBtn);

      // Modal is visible
      expect(screen.getByText(/Odložené nákupy \(1\)/i)).toBeInTheDocument();
      expect(screen.getByText('Stůl 5')).toBeInTheDocument();
      expect(screen.getByText(/180\.00 Kč/i)).toBeInTheDocument();

      // Click Obnovit inside modal
      const restoreBtn = screen.getByRole('button', { name: /^Obnovit$/i });
      fireEvent.click(restoreBtn);
      expect(onRestoreParkedCart).toHaveBeenCalledWith('hold-1');
    });

    it('requires 2 taps to delete a parked cart (safety confirmation)', () => {
      const onDeleteParkedCart = vi.fn();

      wrapWithLanguage(
        <ParkedCartsDrawer
          hasCartItems={false}
          parkedCarts={mockParkedCarts}
          onDeleteParkedCart={onDeleteParkedCart}
          isOpen={true}
        />
      );

      // First tap on delete
      const deleteBtn = screen.getByTitle(/Smazat tento odložený nákup/i);
      fireEvent.click(deleteBtn);

      // Callback not called yet; confirmation prompt appears
      expect(onDeleteParkedCart).not.toHaveBeenCalled();
      expect(screen.getByText(/Opravdu smazat\?/i)).toBeInTheDocument();

      // Second tap confirms deletion
      fireEvent.click(screen.getByText(/Opravdu smazat\?/i));
      expect(onDeleteParkedCart).toHaveBeenCalledWith('hold-1');
    });
  });

  describe('InventoryStockTable', () => {
    const mockPresets = [
      {
        id: 'p-1',
        name: 'Káva Espresso',
        category: 'drinks',
        price: 50,
        costPrice: 20,
        trackStock: true,
        stockQuantity: 15,
        minStockAlert: 5,
        barcode: '111111',
        showInPresets: true
      },
      {
        id: 'p-2',
        name: 'Croissant',
        category: 'food',
        price: 35,
        costPrice: 15,
        trackStock: true,
        stockQuantity: 3,
        minStockAlert: 5,
        barcode: '222222',
        showInPresets: false
      },
      {
        id: 'p-3',
        name: 'Čaj Bylinkový',
        category: 'drinks',
        price: 45,
        trackStock: true,
        stockQuantity: 0,
        minStockAlert: 5,
        barcode: '333333',
        showInPresets: true
      }
    ];

    it('renders inventory table with healthy, low, and out of stock badges without reference errors', () => {
      const onTogglePin = vi.fn();
      wrapWithLanguage(
        <InventoryStockTable
          searchTerm=""
          setSearchTerm={() => {}}
          selectedCategory="all"
          setSelectedCategory={() => {}}
          categories={[{ id: 'drinks', name: 'Nápoje' }, { id: 'food', name: 'Jídlo' }]}
          showLowStockOnly={false}
          setShowLowStockOnly={() => {}}
          presetFilter="all"
          setPresetFilter={() => {}}
          onOpenAddModal={() => {}}
          filteredPresets={mockPresets}
          editingStock={{}}
          handleStockChange={() => {}}
          handleOpenStockKeypad={() => {}}
          handleQuickAddStock={() => {}}
          setEditingPresetTarget={() => {}}
          handleSaveRow={() => {}}
          isSaving={false}
          categoryMap={{ drinks: 'Nápoje', food: 'Jídlo' }}
          onTogglePin={onTogglePin}
        />
      );

      // Verify item rows render
      expect(screen.getByText('Káva Espresso')).toBeInTheDocument();
      expect(screen.getByText('Croissant')).toBeInTheDocument();
      expect(screen.getByText('Čaj Bylinkový')).toBeInTheDocument();

      // Verify stock status badges
      expect(screen.getByText('Skladem')).toBeInTheDocument();
      expect(screen.getByText('Nízký stav')).toBeInTheDocument();
      expect(screen.getByText('Vyprodáno')).toBeInTheDocument();

      // Click pin toggle button on unpinned item
      const unpinnedBtn = screen.getByTitle(/Připnout na pokladnu jako rychlou dlaždici/i);
      fireEvent.click(unpinnedBtn);
      expect(onTogglePin).toHaveBeenCalledWith('p-2');
    });

    it('sorts rows when clicking sortable column headers', () => {
      wrapWithLanguage(
        <InventoryStockTable
          searchTerm=""
          setSearchTerm={() => {}}
          selectedCategory="all"
          setSelectedCategory={() => {}}
          categories={[{ id: 'drinks', name: 'Nápoje' }, { id: 'food', name: 'Jídlo' }]}
          showLowStockOnly={false}
          setShowLowStockOnly={() => {}}
          presetFilter="all"
          setPresetFilter={() => {}}
          onOpenAddModal={() => {}}
          filteredPresets={mockPresets}
          editingStock={{}}
          handleStockChange={() => {}}
          handleOpenStockKeypad={() => {}}
          handleQuickAddStock={() => {}}
          setEditingPresetTarget={() => {}}
          handleSaveRow={() => {}}
          isSaving={false}
          categoryMap={{ drinks: 'Nápoje', food: 'Jídlo' }}
          onTogglePin={() => {}}
        />
      );

      // Initially sorted by name asc: Croissant (C), Čaj Bylinkový (Č), Káva Espresso (K)
      const rowsInitial = screen.getAllByRole('row');
      expect(rowsInitial[1]).toHaveTextContent('Croissant');

      // Click Skladem header to sort by stock asc (lowest first: Čaj (0), Croissant (3), Káva (15))
      const stockHeader = screen.getByTitle(/Seřadit podle skladové zásoby/i);
      fireEvent.click(stockHeader);

      const rowsAfterStockAsc = screen.getAllByRole('row');
      expect(rowsAfterStockAsc[1]).toHaveTextContent('Čaj Bylinkový');

      // Click Skladem header again to toggle desc (highest first: Káva (15), Croissant (3), Čaj (0))
      fireEvent.click(stockHeader);

      const rowsAfterStockDesc = screen.getAllByRole('row');
      expect(rowsAfterStockDesc[1]).toHaveTextContent('Káva Espresso');
    });
  });
});

