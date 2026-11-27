import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import CustomItemModal from '../components/CustomItemModal';
import OpenPriceModal from '../components/presets/OpenPriceModal';
import KeypadAmountDisplay from '../components/keypad/KeypadAmountDisplay';
import { LanguageProvider } from '../i18n/LanguageContext';

vi.mock('../api/posApi', () => ({ openSystemKeyboard: vi.fn().mockResolvedValue({ status: 'SUCCESS' }) }));

const customModal = (qty = 1) => <CustomItemModal isOpen id="c" onClose={vi.fn()} onAddToCart={vi.fn()} initialMultiplier={qty} />;
const openPriceModal = (qty = 1, price = '') => (
  <OpenPriceModal
    openPriceTarget={{ id: 'x', name: 'X' }}
    onClose={vi.fn()}
    enteredOpenPrice={price}
    setEnteredOpenPrice={vi.fn()}
    openPriceQty={qty}
    setOpenPriceQty={vi.fn()}
    onSubmit={vi.fn()}
  />
);
const mount = (ui) => render(<LanguageProvider>{ui}</LanguageProvider>);
const modalText = () => document.querySelector('.modal-card').textContent;

describe.each([
  ['CustomItemModal', customModal],
  ['OpenPriceModal', openPriceModal]
])('%s strings, emoji and accessible names', (_name, make) => {
  afterEach(() => localStorage.removeItem('voltflow_pos_lang'));

  it('shows English strings and no emoji when the language is EN', () => {
    localStorage.setItem('voltflow_pos_lang', 'en');
    mount(make(-1, '5'));
    const text = modalText();
    expect(text).toContain('Return price');
    expect(text).toContain('RETURN');
    expect(text).not.toMatch(/Zadejte|Cena pro|Vratk|DPH|Celkem/);
    expect(text).not.toMatch(/↩️|⚡/);
  });

  it('has no emoji in the Czech sale and return states', () => {
    mount(make(3, '5'));
    expect(modalText()).not.toMatch(/↩️|⚡/);
    expect(modalText()).toContain('Zadejte cenu za jednotku');
  });

  it('gives every button an accessible name', () => {
    mount(make());
    const unnamed = [...document.querySelectorAll('.modal-card button')]
      .filter((b) => !(b.getAttribute('aria-label') || b.textContent.trim()));
    expect(unnamed).toHaveLength(0);
  });

  it('has a single backspace button and no locale-formatted total line', () => {
    mount(make(3, '5'));
    expect(document.querySelectorAll('.modal-card button[aria-label="Smazat poslední znak (Backspace)"]')).toHaveLength(1);
    expect(modalText()).not.toMatch(/Celkem:/);
  });
});

describe('KeypadAmountDisplay', () => {
  it('shows the sale prompt, the quantity pill only when not 1, and the price', () => {
    const { rerender } = mount(<KeypadAmountDisplay isReturn={false} hasValidAmount={false} multiplier={1} amountStr="" />);
    expect(screen.getByText('Zadejte cenu za jednotku (Kč)')).toBeInTheDocument();
    expect(document.body.textContent).toContain('0 Kč');
    expect(screen.queryByText('1×')).toBeNull();
    rerender(<LanguageProvider><KeypadAmountDisplay isReturn={false} hasValidAmount multiplier={3} amountStr="12" /></LanguageProvider>);
    expect(screen.getByText('3×')).toBeInTheDocument();
    expect(document.body.textContent).toContain('12 Kč');
  });

  it('shows the return prompt with the pill and -0 for an empty return', () => {
    mount(<KeypadAmountDisplay isReturn hasValidAmount={false} multiplier={-2} amountStr="" testId="d" />);
    expect(screen.getByTestId('d').textContent).toContain('Cena pro vrácení');
    expect(document.querySelector('.keypad-return-pill').textContent).toBe('VRATKA');
    expect(screen.getByText('-2×')).toBeInTheDocument();
    expect(screen.getByTestId('d').textContent).toContain('-0 Kč');
  });

  it('adds the shake class when rejected', () => {
    mount(<KeypadAmountDisplay isReturn={false} hasValidAmount={false} rejected />);
    expect(document.querySelector('.keypad-amount-display')).toHaveClass('key-reject');
  });
});
