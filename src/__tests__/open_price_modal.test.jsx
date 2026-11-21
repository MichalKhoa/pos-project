import React, { useState } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react';
import QuickPresetGrid from '../components/QuickPresetGrid';
import OpenPriceModal from '../components/presets/OpenPriceModal';
import CustomItemModal from '../components/CustomItemModal';
import WeightEntryModal from '../components/presets/WeightEntryModal';
import PriceCheckModal from '../components/PriceCheckModal';
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
const submit = () => fireEvent.click(document.querySelector('.modal-card .key-enter'));

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

describe('open-price modal uses the shared keypad rules', () => {
  afterEach(() => vi.restoreAllMocks());

  function Modal({ onClose = vi.fn(), onSubmit = vi.fn(), startQty = 1 }) {
    const [price, setPrice] = useState('');
    const [qty, setQty] = useState(startQty);
    return (
      <LanguageProvider>
        <OpenPriceModal
          openPriceTarget={{ id: 'x', name: 'X' }}
          onClose={onClose}
          enteredOpenPrice={price}
          setEnteredOpenPrice={setPrice}
          openPriceQty={qty}
          setOpenPriceQty={setQty}
          onSubmit={onSubmit}
        />
      </LanguageProvider>
    );
  }

  const shown = () => document.querySelector('.keypad-amount-display').textContent;
  const addBtn = () => document.querySelector('.modal-card .key-enter');
  const badge = () => document.querySelector('.multiplier-badge').textContent;

  it('quantity stops at 99 and -99', () => {
    render(<Modal />);
    const up = screen.getByTitle('Zvýšit množství (+1)');
    for (let i = 0; i < 120; i += 1) fireEvent.click(up);
    expect(badge()).toBe('99×');
    const down = screen.getByTitle('Snížit množství (−1 / Vratka)');
    for (let i = 0; i < 250; i += 1) fireEvent.click(down);
    expect(badge()).toContain('-99×');
  });

  it('price stops at 8 characters, 00 adds only what fits', () => {
    render(<Modal />);
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].forEach(modalKey);
    expect(shown()).toContain('12345678 Kč');
    modalKey('C');
    ['1', '2', '3', '4', '5', '6', '7'].forEach(modalKey);
    modalKey('00');
    expect(shown()).toContain('12345670 Kč');
  });

  it('a decimal point is refused when no decimal digit could follow it', () => {
    render(<Modal />);
    ['1', '2', '3', '4', '5', '6', ','].forEach(modalKey);
    expect(shown()).toContain('123456 Kč');
    modalKey('C');
    ['1', '2', '3', '4', '5', ',', '5', '0'].forEach(modalKey);
    expect(shown()).toContain('12345.50 Kč');
  });

  it('no leading zeros, and 00 keeps two decimals', () => {
    render(<Modal />);
    ['0', '0', '5'].forEach(modalKey);
    expect(shown()).toContain('5 Kč');
    expect(shown()).not.toContain('005');
    modalKey('C');
    ['1', ',', '5', '00'].forEach(modalKey);
    expect(shown()).toContain('1.50 Kč');
  });

  it('× makes the typed number the quantity instead of adding one', () => {
    render(<Modal />);
    ['3', '×'].forEach(modalKey);
    expect(badge()).toBe('3×');
    expect(shown()).toContain('0 Kč');
    ['1', '2', '5'].forEach(modalKey);
    expect(addBtn().textContent).toContain('3 × 125.00 = 375.00 Kč');
  });

  it('× keeps return mode and a rejected × shakes', () => {
    render(<Modal startQty={-1} />);
    ['4', '×'].forEach(modalKey);
    expect(badge()).toContain('-4×');
    modalKey('C');
    ['2', ',', '5', '×'].forEach(modalKey);
    expect(screen.getByRole('button', { name: '×' })).toHaveClass('key-reject');
    expect(document.querySelector('.keypad-amount-display')).toHaveClass('key-reject');
  });

  it('Add button shows a negative total for returns and the line total uses formatKc', () => {
    render(<Modal startQty={-3} />);
    ['4', '0'].forEach(modalKey);
    expect(addBtn().textContent).toContain('3 × 40.00 = -120.00 Kč');
    expect(document.body.textContent).not.toMatch(/Celkem|\d\s\d{3}\s\d{3}/);
  });

  it('has a single backspace button', () => {
    render(<Modal />);
    ['4', '2'].forEach(modalKey);
    expect(document.querySelectorAll('.modal-card button[aria-label="Smazat poslední znak (Backspace)"]')).toHaveLength(1);
    expect(document.querySelector('.keypad-amount-display button')).toBeNull();
  });

  it('Add calls onSubmit only with a valid amount', () => {
    const onSubmit = vi.fn();
    render(<Modal onSubmit={onSubmit} />);
    expect(addBtn()).toBeDisabled();
    modalKey('9');
    fireEvent.click(addBtn());
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  describe('physical keyboard', () => {
    // Keys under 70 ms apart count as a scanner; space real keypresses out.
    function slowClock(step = 500) {
      let clock = 1000;
      vi.spyOn(Date, 'now').mockImplementation(() => (clock += step));
    }
    const press = (key) => fireEvent.keyDown(window, { key });

    it('types digits, decimal, backspace, sign, stepper and ×', () => {
      slowClock();
      render(<Modal />);
      ['1', '2', ',', '5'].forEach(press);
      expect(shown()).toContain('12.5 Kč');
      press('Backspace');
      expect(shown()).toContain('12. Kč');
      press('c');
      expect(shown()).toContain('0 Kč');
      press('ArrowUp');
      expect(badge()).toBe('2×');
      press('-');
      expect(badge()).toContain('-2×');
      press('Delete');
      ['4', '*'].forEach(press);
      expect(badge()).toBe('4×');
    });

    it('Enter submits only when the amount is valid', () => {
      slowClock();
      const onSubmit = vi.fn();
      render(<Modal onSubmit={onSubmit} />);
      press('Enter');
      expect(onSubmit).not.toHaveBeenCalled();
      press('5');
      press('Enter');
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it('a fast burst (barcode scanner) is ignored and never submits', () => {
      slowClock(10);
      const onSubmit = vi.fn();
      render(<Modal onSubmit={onSubmit} />);
      ['5', '9', '0', '1', '2', '3', 'Enter'].forEach(press);
      expect(onSubmit).not.toHaveBeenCalled();
      expect(shown()).not.toContain('590123');
    });

    it('Escape closes the modal', () => {
      slowClock();
      const onClose = vi.fn();
      render(<Modal onClose={onClose} />);
      press('Escape');
      expect(onClose).toHaveBeenCalledTimes(1);
    });
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

describe('any modal on screen keeps the pad shortcuts quiet, scans still work', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.querySelectorAll('.modal-overlay').forEach((el) => el.remove());
  });

  function mount(step) {
    let clock = 1000;
    vi.spyOn(Date, 'now').mockImplementation(() => (clock += step));
    const props = {
      isAppLocked: false, activeTab: 'register', keypadAmount: '5', setKeypadAmount: vi.fn(),
      setItemMultiplier: vi.fn(), itemMultiplier: 1, cartItems: [{ id: 'a' }], paymentModalMethod: null,
      setPaymentModalMethod: vi.fn(), handleAddToCart: vi.fn(), storeConfig: {},
      presets: [{ id: 'p1', name: 'Cola', price: 10, barcode: '8594000111222' }]
    };
    renderHook(() => usePosKeyboardShortcuts(props));
    const press = (key) => act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key })); });
    return { props, press };
  }

  const addOverlay = () => {
    const el = document.createElement('div');
    el.className = 'modal-overlay';
    document.body.appendChild(el);
    return el;
  };

  it('digits, decimal and Enter do nothing while a .modal-overlay is mounted', () => {
    const { props, press } = mount(500);
    const overlay = addOverlay();
    ['7', '.', 'x', 'Backspace', 'Enter'].forEach(press);
    expect(props.setKeypadAmount).not.toHaveBeenCalled();
    expect(props.handleAddToCart).not.toHaveBeenCalled();
    expect(props.setPaymentModalMethod).not.toHaveBeenCalled();
    overlay.remove();
    press('7');
    expect(props.setKeypadAmount).toHaveBeenCalled();
    press('Enter');
    expect(props.handleAddToCart).toHaveBeenCalledTimes(1);
  });

  it('a barcode scan still adds the item with a modal mounted, without typing a digit', () => {
    const { props, press } = mount(10);
    addOverlay();
    ['8', '5', '9', '4', '0', '0', '0', '1', '1', '1', '2', '2', '2', 'Enter'].forEach(press);
    expect(props.handleAddToCart).toHaveBeenCalledTimes(1);
    expect(props.handleAddToCart).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }));
    // only the clear that follows a scan, never a typed digit
    props.setKeypadAmount.mock.calls.forEach(([arg]) => expect(arg).toBe(''));
  });
});

describe('price check modal Enter adds the item once', () => {
  afterEach(() => vi.restoreAllMocks());

  it('does not also add a custom line from the pad shortcuts', () => {
    let clock = 1000;
    vi.spyOn(Date, 'now').mockImplementation(() => (clock += 500));
    const handleAddToCart = vi.fn();
    const onAddToCart = vi.fn();
    const setPaymentModalMethod = vi.fn();
    renderHook(() => usePosKeyboardShortcuts({
      isAppLocked: false, activeTab: 'register', keypadAmount: '7', setKeypadAmount: vi.fn(),
      setItemMultiplier: vi.fn(), itemMultiplier: 1, cartItems: [{ id: 'a' }], paymentModalMethod: null,
      setPaymentModalMethod, handleAddToCart, storeConfig: {}
    }));
    render(
      <LanguageProvider>
        <PriceCheckModal item={{ id: 'p1', name: 'Banány', price: 39.9, vat: 12 }} storeConfig={{}} onAddToCart={onAddToCart} onClose={vi.fn()} />
      </LanguageProvider>
    );
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); });
    expect(onAddToCart).toHaveBeenCalledTimes(1);
    expect(handleAddToCart).not.toHaveBeenCalled();
    expect(setPaymentModalMethod).not.toHaveBeenCalled();
  });
});
