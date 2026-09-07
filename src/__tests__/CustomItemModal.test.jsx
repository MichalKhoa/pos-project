import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CustomItemModal from '../components/CustomItemModal';
import { LanguageProvider } from '../i18n/LanguageContext';

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
  it('renders correctly when open with default values', () => {
    renderModal();

    expect(screen.getByText(/Vlastní \/ Nezařazená položka/i)).toBeInTheDocument();
    expect(screen.getByTestId('amount-display')).toHaveTextContent('0 Kč');
    expect(screen.getByRole('button', { name: '100' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '200' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '500' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '21%' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText(/Název/i)).toHaveValue('');
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
    fireEvent.click(screen.getByRole('button', { name: '.' }));
    fireEvent.click(screen.getByRole('button', { name: '5' }));

    expect(screen.getByTestId('amount-display')).toHaveTextContent('4.5 Kč');

    // Backspace
    fireEvent.click(screen.getByRole('button', { name: 'Backspace' }));
    expect(screen.getByTestId('amount-display')).toHaveTextContent('4. Kč');

    // Clear
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByTestId('amount-display')).toHaveTextContent('0 Kč');
  });

  it('sets price quickly via banknote chips (100, 200, 500)', () => {
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: '200' }));
    expect(screen.getByTestId('amount-display')).toHaveTextContent('200 Kč');

    fireEvent.click(screen.getByRole('button', { name: '500' }));
    expect(screen.getByTestId('amount-display')).toHaveTextContent('500 Kč');
  });

  it('switches VAT rate between 21%, 12%, and 0%', () => {
    renderModal();

    const vat21 = screen.getByRole('radio', { name: '21%' });
    const vat12 = screen.getByRole('radio', { name: '12%' });
    const vat0 = screen.getByRole('radio', { name: '0%' });

    expect(vat21).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(vat12);
    expect(vat12).toHaveAttribute('aria-checked', 'true');
    expect(vat21).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(vat0);
    expect(vat0).toHaveAttribute('aria-checked', 'true');
    expect(vat12).toHaveAttribute('aria-checked', 'false');
  });

  it('adjusts multiplier using quick chips and +/- stepper', () => {
    renderModal();

    // Quick multiplier chips
    fireEvent.click(screen.getByRole('button', { name: '3x' }));
    expect(screen.getByText('3 ks')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '10x' }));
    expect(screen.getByText('10 ks')).toBeInTheDocument();

    // Stepper +1 / -1
    fireEvent.click(screen.getByRole('button', { name: 'Zvýšit množství' }));
    expect(screen.getByText('11 ks')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Snížit množství' }));
    expect(screen.getByText('10 ks')).toBeInTheDocument();
  });

  it('toggles return mode via ± button', () => {
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: '1' }));
    fireEvent.click(screen.getByRole('button', { name: '0' }));
    fireEvent.click(screen.getByRole('button', { name: '0' }));

    // Toggle return
    fireEvent.click(screen.getByRole('button', { name: '±' }));
    expect(screen.getByTestId('amount-display')).toHaveTextContent('-100 Kč');
    expect(screen.getAllByText(/Vratka/i).length).toBeGreaterThanOrEqual(1);
  });

  it('sets item name via retail suggestion chips', () => {
    renderModal();

    const nameInput = screen.getByLabelText(/Název/i);

    fireEvent.click(screen.getByRole('button', { name: 'Pečivo' }));
    expect(nameInput).toHaveValue('Pečivo');

    fireEvent.click(screen.getByRole('button', { name: 'Nealko' }));
    expect(nameInput).toHaveValue('Nealko');
  });

  it('opens on-screen touch keyboard and types Czech characters', () => {
    renderModal();

    // Toggle touch keyboard open
    const keyboardToggle = screen.getByRole('button', { name: /Klávesnice/i });
    fireEvent.click(keyboardToggle);

    // Type with Shift + P, e, č, i, v, o
    fireEvent.click(screen.getByRole('button', { name: 'Shift' }));
    fireEvent.click(screen.getByRole('button', { name: 'p' }));
    fireEvent.click(screen.getByRole('button', { name: 'e' }));
    fireEvent.click(screen.getByRole('button', { name: 'č' }));
    fireEvent.click(screen.getByRole('button', { name: 'i' }));
    fireEvent.click(screen.getByRole('button', { name: 'v' }));
    fireEvent.click(screen.getByRole('button', { name: 'o' }));

    const nameInput = screen.getByLabelText(/Název/i);
    expect(nameInput).toHaveValue('Pečivo');

    // Space & Backspace in touch keyboard
    fireEvent.click(screen.getByRole('button', { name: 'Mezera' }));
    expect(nameInput).toHaveValue('Pečivo ');

    fireEvent.click(screen.getByRole('button', { name: '⌫' }));
    expect(nameInput).toHaveValue('Pečivo');

    // Clear text
    fireEvent.click(screen.getByRole('button', { name: 'Clear text' }));
    expect(nameInput).toHaveValue('');
  });

  it('submits valid custom item to cart and calls onAddToCart and onClose', () => {
    const { props } = renderModal();

    // Enter price 250
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    fireEvent.click(screen.getByRole('button', { name: '5' }));
    fireEvent.click(screen.getByRole('button', { name: '0' }));

    // Select VAT 12%
    fireEvent.click(screen.getByRole('radio', { name: '12%' }));

    // Select Qty 2x
    fireEvent.click(screen.getByRole('button', { name: '2x' }));

    // Set name
    fireEvent.click(screen.getByRole('button', { name: 'Pečivo' }));

    // Submit
    const submitBtn = screen.getByRole('button', { name: /Vložit do košíku/i });
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

    fireEvent.click(screen.getByRole('button', { name: 'Zavřít' }));
    expect(props.onClose).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalledTimes(3);
  });
});
