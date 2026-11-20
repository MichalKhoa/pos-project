import React, { useState } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react';
import QuickPresetGrid from '../components/QuickPresetGrid';
import OpenPriceModal from '../components/presets/OpenPriceModal';
import CustomItemModal from '../components/CustomItemModal';
import WeightEntryModal from '../components/presets/WeightEntryModal';
import { LanguageProvider } from '../i18n/LanguageContext';
import { usePosKeyboardShortcuts } from '../hooks/usePosKeyboardShortcuts.js';
import { acquireKeyboard, releaseKeyboard, isKeyboardOwned } from '../utils/keyboardOwner.js';

vi.mock('../api/posApi', () => ({ openSystemKeyboard: vi.fn().mockResolvedValue({ status: 'SUCCESS' }) }));

const presets = [{ id: 'g1', name: 'Oblečení', price: 0, vat: 21, category: 'all', isGeneralPreset: true }];

function GridHarness({ onAddToCart, startMultiplier = 1, startKeypad = '' }) {
  const [mult, setMult] = useState(startMultiplier);
  const [keypad, setKeypad] = useState(startKeypad);
  return (
    <QuickPresetGrid
      presets={presets}
      onAddToCart={onAddToCart}
      itemMultiplier={mult}
      setItemMultiplier={setMult}
      keypadAmount={keypad}
      onClearKeypadAmount={() => setKeypad('')}
      onOpenCustomModal={() => {}}
    />
  );
}

const renderGrid = (props) => render(<LanguageProvider><GridHarness {...props} /></LanguageProvider>);
const openModal = () => fireEvent.click(screen.getByText('Oblečení'));
const modalKey = (name) => fireEvent.click(screen.getByRole('button', { name }));
const submit = () => fireEvent.click(document.querySelector('.modal-card button[type="submit"]'));

describe('open-price modal opens in the pad mode (no silent sign flip)', () => {
  it('pad in return mode: modal shows return and adds a negative price', () => {
    const onAddToCart = vi.fn();
    renderGrid({ onAddToCart, startMultiplier: -1 });
    openModal();
    const badge = document.querySelector('.multiplier-badge');
    expect(badge).toHaveClass('has-return');
    expect(badge.textContent).toContain('-1×');
    ['5', '0'].forEach(modalKey);
    submit();
    expect(onAddToCart).toHaveBeenCalledWith(expect.objectContaining({ price: -50, quantity: 1 }));
  });

  it('pad return multiplier -3 keeps quantity 3', () => {
    const onAddToCart = vi.fn();
    renderGrid({ onAddToCart, startMultiplier: -3 });
    openModal();
    ['4', '0'].forEach(modalKey);
    submit();
    expect(onAddToCart).toHaveBeenCalledWith(expect.objectContaining({ price: -40, quantity: 3 }));
  });

  it('a lone "-" on the pad opens the modal in return mode', () => {
    const onAddToCart = vi.fn();
    renderGrid({ onAddToCart, startKeypad: '-' });
    openModal();
    ['9'].forEach(modalKey);
    submit();
    expect(onAddToCart).toHaveBeenCalledWith(expect.objectContaining({ price: -9, quantity: 1 }));
  });

  it('± in the modal turns a pad return into a sale', () => {
    const onAddToCart = vi.fn();
    renderGrid({ onAddToCart, startMultiplier: -1 });
    openModal();
    modalKey('±');
    ['5', '0'].forEach(modalKey);
    submit();
    expect(onAddToCart).toHaveBeenCalledWith(expect.objectContaining({ price: 50, quantity: 1 }));
  });

  it('pad in sale mode stays a sale', () => {
    const onAddToCart = vi.fn();
    renderGrid({ onAddToCart });
    openModal();
    ['7'].forEach(modalKey);
    submit();
    expect(onAddToCart).toHaveBeenCalledWith(expect.objectContaining({ price: 7, quantity: 1 }));
  });
});

describe('open-price modal limits and Esc', () => {
  function Modal({ onClose = vi.fn() }) {
    const [price, setPrice] = useState('');
    const [qty, setQty] = useState(1);
    return (
      <LanguageProvider>
        <OpenPriceModal
          openPriceTarget={{ id: 'x', name: 'X' }}
          onClose={onClose}
          enteredOpenPrice={price}
          setEnteredOpenPrice={setPrice}
          openPriceQty={qty}
          setOpenPriceQty={setQty}
          onSubmit={(e) => e.preventDefault()}
        />
      </LanguageProvider>
    );
  }

  it('quantity stops at 99 and -99', () => {
    render(<Modal />);
    const up = screen.getByTitle('Zvýšit množství (+1)');
    for (let i = 0; i < 120; i += 1) fireEvent.click(up);
    expect(document.querySelector('.multiplier-badge').textContent).toBe('99×');
    const down = screen.getByTitle('Snížit množství (−1 / Vratka)');
    for (let i = 0; i < 250; i += 1) fireEvent.click(down);
    expect(document.querySelector('.multiplier-badge').textContent).toContain('-99×');
  });

  it('price stops at 8 characters', () => {
    render(<Modal />);
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].forEach(modalKey);
    expect(document.querySelector('.keypad-amount-display').textContent).toContain('12345678 Kč');
    modalKey('C');
    ['1', '2', '3', '4', '5', '6', '7'].forEach(modalKey);
    modalKey('00');
    expect(document.querySelector('.keypad-amount-display').textContent).toContain('1234567 Kč');
  });

  it('a decimal point is refused when no decimal digit could follow it', () => {
    render(<Modal />);
    ['1', '2', '3', '4', '5', '6', ','].forEach(modalKey);
    expect(document.querySelector('.keypad-amount-display').textContent).toContain('123456 Kč');
    modalKey('C');
    ['1', '2', '3', '4', '5', ',', '5', '0'].forEach(modalKey);
    expect(document.querySelector('.keypad-amount-display').textContent).toContain('12345.50 Kč');
  });

  it('Escape closes the modal', () => {
    const onClose = vi.fn();
    render(<Modal onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('keyboardOwner', () => {
  it('counts nested owners and never goes negative', () => {
    expect(isKeyboardOwned()).toBe(false);
    acquireKeyboard();
    acquireKeyboard();
    releaseKeyboard();
    expect(isKeyboardOwned()).toBe(true);
    releaseKeyboard();
    releaseKeyboard();
    expect(isKeyboardOwned()).toBe(false);
  });
});

describe('modals own the keyboard so the register shortcuts do not fire behind them', () => {
  afterEach(() => vi.restoreAllMocks());

  function mountHook() {
    const setKeypadAmount = vi.fn();
    const handleAddToCart = vi.fn();
    let clock = 1000; // keys under 70 ms apart look like a scanner burst
    vi.spyOn(Date, 'now').mockImplementation(() => (clock += 500));
    renderHook(() => usePosKeyboardShortcuts({
      isAppLocked: false, activeTab: 'register', keypadAmount: '77', setKeypadAmount,
      setItemMultiplier: vi.fn(), itemMultiplier: 1, cartItems: [], paymentModalMethod: null,
      setPaymentModalMethod: vi.fn(), handleAddToCart, storeConfig: {}
    }));
    const press = (key) => act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key })); });
    return { setKeypadAmount, handleAddToCart, press };
  }

  it('digit and Enter reach the pad only when no modal owns the keyboard', () => {
    const { setKeypadAmount, handleAddToCart, press } = mountHook();
    acquireKeyboard();
    press('7');
    press('Enter');
    expect(setKeypadAmount).not.toHaveBeenCalled();
    expect(handleAddToCart).not.toHaveBeenCalled();
    releaseKeyboard();
    press('7');
    press('Enter');
    expect(setKeypadAmount).toHaveBeenCalled();
    expect(handleAddToCart).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['OpenPriceModal', () => (
      <OpenPriceModal openPriceTarget={{ id: 'x', name: 'X' }} onClose={vi.fn()} enteredOpenPrice=""
        setEnteredOpenPrice={vi.fn()} openPriceQty={1} setOpenPriceQty={vi.fn()} onSubmit={vi.fn()} />
    )],
    ['CustomItemModal', () => <CustomItemModal isOpen id="c" onClose={vi.fn()} onAddToCart={vi.fn()} />],
    ['WeightEntryModal', () => (
      <WeightEntryModal isOpen preset={{ id: 'w', name: 'W', price: 10, isWeighted: true }} onClose={vi.fn()} onAddToCart={vi.fn()} />
    )]
  ])('%s blocks the pad while open and releases on unmount', (_name, makeModal) => {
    const { setKeypadAmount, press } = mountHook();
    const { unmount } = render(<LanguageProvider>{makeModal()}</LanguageProvider>);
    press('7');
    expect(setKeypadAmount).not.toHaveBeenCalled();
    unmount();
    expect(isKeyboardOwned()).toBe(false);
    press('7');
    expect(setKeypadAmount).toHaveBeenCalled();
  });
});
