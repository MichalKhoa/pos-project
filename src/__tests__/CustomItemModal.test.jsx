import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CustomItemModal from '../components/CustomItemModal';
import { LanguageProvider } from '../i18n/LanguageContext';
import * as posApi from '../api/posApi';

vi.mock('../api/posApi', () => ({
  openSystemKeyboard: vi.fn().mockResolvedValue({ status: 'SUCCESS' })
}));

function renderModal(props = {}) {
  const defaultProps = {
    isOpen: true,
    id: 'test-custom-item',
    onClose: vi.fn(),
    onAddToCart: vi.fn(),
    defaultVat: 21,
    initialMultiplier: 1,
    ...props
  };

  const utils = render(
    <LanguageProvider>
      <CustomItemModal {...defaultProps} />
    </LanguageProvider>
  );

  return {
    ...utils,
    props: defaultProps
  };
}

describe('CustomItemModal Component Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('renders correctly when open with default values', () => {
    renderModal();

    expect(screen.getByText(/Vlastní \/ Nezařazená položka/i)).toBeInTheDocument();
    expect(screen.getByTestId('amount-display')).toHaveTextContent('0 Kč');
    expect(screen.getByRole('button', { name: 'DPH 21%' })).toHaveClass('active');
    expect(screen.getByRole('textbox', { name: /Název/i })).toHaveValue('');
  });

  it('does not render when isOpen is false', () => {
    const { container } = renderModal({ isOpen: false });
    expect(container.firstChild).toBeNull();
  });

  it('types price using the touch numpad (1, 5, 0 -> 150 Kč)', () => {
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: '1' }));
    fireEvent.click(screen.getByRole('button', { name: '5' }));
    fireEvent.click(screen.getByRole('button', { name: '0' }));

    expect(screen.getByTestId('amount-display')).toHaveTextContent('150 Kč');
  });

  it('handles decimal input and backspace/clear in numpad', () => {
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: '4' }));
    fireEvent.click(screen.getByRole('button', { name: ',' }));
    fireEvent.click(screen.getByRole('button', { name: '5' }));

    expect(screen.getByTestId('amount-display')).toHaveTextContent('4.5 Kč');

    // Inline Backspace
    fireEvent.click(screen.getByLabelText('Inline Backspace'));
    expect(screen.getByTestId('amount-display')).toHaveTextContent('4. Kč');

    // Clear key 'C'
    fireEvent.click(screen.getByRole('button', { name: 'C' }));
    expect(screen.getByTestId('amount-display')).toHaveTextContent('0 Kč');
  });

  it('switches VAT rate between 21%, 12%, and 0%', () => {
    renderModal();

    const vat21 = screen.getByRole('button', { name: 'DPH 21%' });
    const vat12 = screen.getByRole('button', { name: 'DPH 12%' });
    const vat0 = screen.getByRole('button', { name: 'DPH 0%' });

    expect(vat21).toHaveClass('active');

    fireEvent.click(vat12);
    expect(vat12).toHaveClass('active');
    expect(vat21).not.toHaveClass('active');

    fireEvent.click(vat0);
    expect(vat0).toHaveClass('active');
    expect(vat12).not.toHaveClass('active');
  });

  it('adjusts multiplier using +/- stepper bar', () => {
    renderModal();

    // Stepper +1
    fireEvent.click(screen.getByTitle('Zvýšit množství (+1)'));
    expect(screen.getByText('2×')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Zvýšit množství (+1)'));
    expect(screen.getByText('3×')).toBeInTheDocument();

    // Stepper -1
    fireEvent.click(screen.getByTitle('Snížit množství (−1 / Vratka)'));
    expect(screen.getByText('2×')).toBeInTheDocument();
  });

  it('toggles return mode via ± button', () => {
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: '1' }));
    fireEvent.click(screen.getByRole('button', { name: '0' }));
    fireEvent.click(screen.getByRole('button', { name: '0' }));

    // Toggle return
    fireEvent.click(screen.getByRole('button', { name: '±' }));
    expect(screen.getByTestId('amount-display')).toHaveTextContent('-100 Kč');
    expect(screen.getAllByText(/VRATKA/i).length).toBeGreaterThanOrEqual(1);
  });

  it('sets item name via retail suggestion chips', () => {
    renderModal();

    const nameInput = screen.getByRole('textbox', { name: /Název/i });

    fireEvent.click(screen.getByRole('button', { name: 'Pečivo' }));
    expect(nameInput).toHaveValue('Pečivo');

    fireEvent.click(screen.getByRole('button', { name: 'Nealko' }));
    expect(nameInput).toHaveValue('Nealko');
  });

  it('submits valid custom item to cart and calls onAddToCart and onClose', () => {
    const { props } = renderModal();

    // Enter price 250
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    fireEvent.click(screen.getByRole('button', { name: '5' }));
    fireEvent.click(screen.getByRole('button', { name: '0' }));

    // Select VAT 12%
    fireEvent.click(screen.getByRole('button', { name: 'DPH 12%' }));

    // Select Qty +1 (2x)
    fireEvent.click(screen.getByTitle('Zvýšit množství (+1)'));

    // Set name
    fireEvent.click(screen.getByRole('button', { name: 'Pečivo' }));

    // Submit via Enter button in KeypadNumberGrid
    const submitBtn = screen.getByRole('button', { name: /Přidat do Košíku/i });
    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(submitBtn);

    expect(props.onAddToCart).toHaveBeenCalledTimes(1);
    expect(props.onAddToCart).toHaveBeenCalledWith(expect.objectContaining({
      id: props.id,
      name: 'Pečivo',
      price: 250,
      vat: 12,
      quantity: 2,
      isCustom: true
    }));

    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('closes modal on Escape key press or close button click', () => {
    const { props } = renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Zrušit' }));
    expect(props.onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText('Zavřít'));
    expect(props.onClose).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalledTimes(3);
  });

  it('triggers system keyboard on keyboard button click', () => {
    const showMock = vi.fn();
    globalThis.navigator.virtualKeyboard = { show: showMock };

    renderModal();

    const keyboardBtn = screen.getByRole('button', { name: 'Otevřít klávesnici' });
    fireEvent.click(keyboardBtn);

    expect(posApi.openSystemKeyboard).toHaveBeenCalledTimes(1);
    expect(showMock).toHaveBeenCalledTimes(1);

    delete globalThis.navigator.virtualKeyboard;
  });

  it('auto-opens touch keyboard on input focus when autoOpenTouchKeyboard is enabled in props or config', () => {
    renderModal({ autoOpenTouchKeyboard: true });

    const nameInput = screen.getByRole('textbox', { name: /Název/i });
    fireEvent.focus(nameInput);

    expect(posApi.openSystemKeyboard).toHaveBeenCalledTimes(1);
  });

  it('does not auto-open touch keyboard on input focus when autoOpenTouchKeyboard is false', () => {
    renderModal({ autoOpenTouchKeyboard: false, storeConfig: { autoOpenTouchKeyboard: false } });

    const nameInput = screen.getByRole('textbox', { name: /Název/i });
    fireEvent.focus(nameInput);

    expect(posApi.openSystemKeyboard).not.toHaveBeenCalled();
  });

  it('clears name when clear button is clicked', () => {
    renderModal();

    const nameInput = screen.getByRole('textbox', { name: /Název/i });
    fireEvent.change(nameInput, { target: { value: 'Custom Coffee' } });
    expect(nameInput).toHaveValue('Custom Coffee');

    const clearBtn = screen.getByRole('button', { name: 'Clear name' });
    fireEvent.click(clearBtn);

    expect(nameInput).toHaveValue('');
  });
});

