import React, { useState } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react';
import ManualKeypad from '../components/ManualKeypad';
import { LanguageProvider } from '../i18n/LanguageContext';
import { usePosKeyboardShortcuts } from '../hooks/usePosKeyboardShortcuts.js';

function Harness({ onAddToCart }) {
  const [amountStr, setAmountStr] = useState('');
  const [itemMultiplier, setItemMultiplier] = useState(1);
  return (
    <ManualKeypad
      onAddToCart={onAddToCart}
      amountStr={amountStr}
      setAmountStr={setAmountStr}
      itemMultiplier={itemMultiplier}
      setItemMultiplier={setItemMultiplier}
    />
  );
}

const click = (name) => fireEvent.click(screen.getByRole('button', { name }));
const display = () => document.querySelector('.keypad-amount-display').textContent;

describe('on-screen keypad uses shared entry rules', () => {
  it('00 never adds a third decimal', () => {
    render(<LanguageProvider><Harness onAddToCart={vi.fn()} /></LanguageProvider>);
    ['1', ',', '5', '00'].forEach(click);
    expect(display()).toContain('1.50 Kč');
  });

  it('drops leading zeros', () => {
    render(<LanguageProvider><Harness onAddToCart={vi.fn()} /></LanguageProvider>);
    ['0', '0', '5'].forEach(click);
    expect(display()).toContain('5 Kč');
    expect(display()).not.toContain('005');
  });

  it('× keeps return mode instead of turning a return into a sale', () => {
    const onAddToCart = vi.fn();
    render(<LanguageProvider><Harness onAddToCart={onAddToCart} /></LanguageProvider>);
    fireEvent.click(screen.getByLabelText(/Snížit množství/));
    ['5', '×', '2', '0'].forEach(click);
    expect(display()).toContain('-5 ×');
    fireEvent.click(screen.getByRole('button', { name: /Vratku|return/i }));
    expect(onAddToCart).toHaveBeenCalledWith(expect.objectContaining({ price: -20, quantity: 5 }));
  });
});

describe('keyboard shortcuts use shared entry rules', () => {
  afterEach(() => vi.restoreAllMocks());

  function setup(initial = '', mult = 1) {
    const state = { amount: initial, mult };
    const setKeypadAmount = vi.fn((v) => { state.amount = typeof v === 'function' ? v(state.amount) : v; });
    const setItemMultiplier = vi.fn((v) => { state.mult = typeof v === 'function' ? v(state.mult) : v; });
    const props = () => ({
      isAppLocked: false, activeTab: 'register', keypadAmount: state.amount, setKeypadAmount,
      setItemMultiplier, itemMultiplier: state.mult, cartItems: [], paymentModalMethod: null,
      setPaymentModalMethod: vi.fn(), handleAddToCart: vi.fn(), storeConfig: {}
    });
    // Keys closer than 70 ms apart count as a barcode scan; space the test keypresses out.
    let clock = 1000;
    vi.spyOn(Date, 'now').mockImplementation(() => (clock += 500));
    const hook = renderHook((p) => usePosKeyboardShortcuts(p), { initialProps: props() });
    const press = (key) => {
      act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key })); });
      hook.rerender(props());
    };
    return { state, press };
  }

  it('caps at 8 characters and drops leading zeros', () => {
    const { state, press } = setup();
    ['0', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].forEach(press);
    expect(state.amount).toBe('12345678');
  });

  it('+ and ArrowDown stop at 99 and -99', () => {
    const a = setup('', 99);
    a.press('+');
    expect(a.state.mult).toBe(99);
    const b = setup('', -99);
    b.press('ArrowDown');
    expect(b.state.mult).toBe(-99);
  });

  it('* keeps return mode and rejects decimals', () => {
    const a = setup('5', -1);
    a.press('*');
    expect(a.state.mult).toBe(-5);
    expect(a.state.amount).toBe('');
    const b = setup('2.5', 1);
    b.press('*');
    expect(b.state.mult).toBe(1);
    expect(b.state.amount).toBe('2.5');
  });
});

describe('keypad P2 feedback', () => {
  it('Add button shows the line total with VAT, and VAT resets to default after adding', () => {
    const onAddToCart = vi.fn();
    render(<LanguageProvider><Harness onAddToCart={onAddToCart} /></LanguageProvider>);
    ['3', '×', '1', '2', '5'].forEach(click);
    click(/12\s*%/);
    const add = document.querySelector('.key-enter');
    expect(add.textContent).toContain('3 × 125.00 = 375.00 Kč · DPH 12%');
    fireEvent.click(add);
    expect(onAddToCart).toHaveBeenCalledWith(expect.objectContaining({ vat: 12, quantity: 3 }));
    expect(screen.getByRole('button', { name: /21\s*%/ })).toHaveClass('active');
  });

  it('shows a negative total for returns', () => {
    render(<LanguageProvider><Harness onAddToCart={vi.fn()} /></LanguageProvider>);
    ['±', '4', '0'].forEach(click);
    expect(document.querySelector('.key-enter').textContent).toContain('-40.00 Kč · DPH 21%');
  });

  it('a rejected × shakes the key and the display', () => {
    render(<LanguageProvider><Harness onAddToCart={vi.fn()} /></LanguageProvider>);
    ['2', ',', '5', '×'].forEach(click);
    expect(screen.getByRole('button', { name: '×' })).toHaveClass('key-reject');
    expect(document.querySelector('.keypad-amount-display')).toHaveClass('key-reject');
  });
});

describe('on-screen stepper cap', () => {
  it('stops at 99', () => {
    render(<LanguageProvider><Harness onAddToCart={vi.fn()} /></LanguageProvider>);
    const up = screen.getByLabelText(/Zvýšit množství/);
    for (let i = 0; i < 120; i += 1) fireEvent.click(up);
    expect(document.querySelector('.multiplier-badge').textContent).toBe('99×');
  });
});

describe('keypad accessibility and i18n', () => {
  it('every keypad button has an accessible name', () => {
    render(<LanguageProvider><Harness onAddToCart={vi.fn()} /></LanguageProvider>);
    const unnamed = [...document.querySelectorAll('.keypad-card-box button')]
      .filter((b) => !(b.getAttribute('aria-label') || b.textContent.trim()));
    expect(unnamed).toHaveLength(0);
  });

  it('shows English keypad strings when the language is EN', () => {
    localStorage.setItem('voltflow_pos_lang', 'en');
    render(<LanguageProvider><Harness onAddToCart={vi.fn()} /></LanguageProvider>);
    expect(screen.getByRole('button', { name: 'VAT 21%' })).toBeInTheDocument();
    expect(screen.getByTitle('Multiply')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/DPH|Násobit/);
    localStorage.removeItem('voltflow_pos_lang');
  });

  it('labels the × key and has no second backspace in the amount display', () => {
    localStorage.setItem('voltflow_pos_lang', 'en');
    render(<LanguageProvider><Harness onAddToCart={vi.fn()} /></LanguageProvider>);
    expect(screen.getByRole('button', { name: '×' }).textContent).toContain('qty');
    ['4', '2'].forEach(click);
    expect(document.querySelector('.keypad-amount-display button')).toBeNull();
    localStorage.removeItem('voltflow_pos_lang');
  });
});
