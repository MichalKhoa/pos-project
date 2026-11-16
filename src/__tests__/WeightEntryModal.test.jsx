import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WeightEntryModal from '../components/presets/WeightEntryModal';
import { LanguageProvider } from '../i18n/LanguageContext';

function renderModal(props) {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onAddToCart: vi.fn(),
    preset: {
      id: 'p-potato',
      name: 'Brambory konzumní',
      price: 25,
      category: 'Zelenina',
      unit: 'kg',
      isWeighted: true
    }
  };
  const mergedProps = { ...defaultProps, ...props };
  const utils = render(
    <LanguageProvider>
      <WeightEntryModal {...mergedProps} />
    </LanguageProvider>
  );
  return { ...utils, props: mergedProps };
}

describe('WeightEntryModal', () => {
  // The older tests below type kilograms; grams are the default (F-003), so they opt in to kg
  beforeEach(() => {
    localStorage.setItem('voltflow_pos_weight_entry_unit', 'kg');
  });

  it('renders preset information and unit price correctly', () => {
    renderModal({
      preset: {
        id: 'p1',
        name: 'Jablka Gala',
        price: 39,
        category: 'Ovoce',
        unit: 'kg'
      }
    });

    expect(screen.getByText('Jablka Gala')).toBeInTheDocument();
    expect(screen.getByText(/39\.00 Kč \/ kg/)).toBeInTheDocument();
    expect(screen.getByText(/Ovoce/)).toBeInTheDocument();
  });

  it('handles numpad touch input, decimal comma, and backspace', () => {
    renderModal();

    // Click 1, 2, 5
    fireEvent.click(screen.getByRole('button', { name: '1' }));
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    expect(screen.getByText('12')).toBeInTheDocument();

    // Comma
    fireEvent.click(screen.getByRole('button', { name: ',' }));
    fireEvent.click(screen.getByRole('button', { name: '5' }));
    expect(screen.getByText('12.5')).toBeInTheDocument();

    // Backspace
    const backspaceBtn = screen.getByTitle('Backspace');
    fireEvent.click(backspaceBtn);
    expect(screen.getByText('12.')).toBeInTheDocument();

    // Clear
    const clearBtn = screen.getByRole('button', { name: 'C' });
    fireEvent.click(clearBtn);
    expect(screen.getByText('0.000')).toBeInTheDocument();
  });

  it('calculates real-time line total accurately based on entered weight', () => {
    renderModal({
      preset: {
        id: 'p-apples',
        name: 'Jablka Golden',
        price: 40,
        unit: 'kg'
      }
    });

    // Enter 0, ., 6, 5
    fireEvent.click(screen.getByRole('button', { name: '0' }));
    fireEvent.click(screen.getByRole('button', { name: ',' }));
    fireEvent.click(screen.getByRole('button', { name: '6' }));
    fireEvent.click(screen.getByRole('button', { name: '5' }));

    // 0.65 kg * 40 Kč = 26.00 Kč
    expect(screen.getByText('26.00 Kč')).toBeInTheDocument();
  });

  it('applies tare subtraction shortcuts (-5g, -15g, and reset tare)', () => {
    const onAddToCart = vi.fn();
    renderModal({
      onAddToCart,
      preset: {
        id: 'p-tomatoes',
        name: 'Rajčata keříčková',
        price: 50,
        unit: 'kg'
      }
    });

    // Enter 0.650 kg
    fireEvent.click(screen.getByRole('button', { name: '0' }));
    fireEvent.click(screen.getByRole('button', { name: ',' }));
    fireEvent.click(screen.getByRole('button', { name: '6' }));
    fireEvent.click(screen.getByRole('button', { name: '5' }));
    fireEvent.click(screen.getByRole('button', { name: '0' }));

    // Initial line total: 0.650 * 50 = 32.50 Kč
    expect(screen.getByText('32.50 Kč')).toBeInTheDocument();

    // Click -5 g tare shortcut (mikrotenový sáček)
    const tare5Btn = screen.getByRole('button', { name: /-5 g/i });
    fireEvent.click(tare5Btn);

    // Net weight: 0.650 - 0.005 = 0.645 kg
    // Line total: 0.645 * 50 = 32.25 Kč
    expect(screen.getByText('32.25 Kč')).toBeInTheDocument();
    expect(screen.getByText(/0\.645 kg/)).toBeInTheDocument();

    // Click -15 g tare shortcut (vanička)
    const tare15Btn = screen.getByRole('button', { name: /-15 g/i });
    fireEvent.click(tare15Btn);

    // Net weight: 0.650 - 0.015 = 0.635 kg
    // Line total: 0.635 * 50 = 31.75 Kč
    expect(screen.getByText('31.75 Kč')).toBeInTheDocument();
    expect(screen.getByText(/0\.635 kg/)).toBeInTheDocument();

    // Click reset tare button (0 g)
    const resetTareBtn = screen.getByTitle(/Reset táry/i);
    fireEvent.click(resetTareBtn);

    // Reverts back to 0.650 kg and 32.50 Kč
    expect(screen.getByText('32.50 Kč')).toBeInTheDocument();
  });

  it('submits item with decimal net weight to cart and closes modal', () => {
    const onAddToCart = vi.fn();
    const onClose = vi.fn();
    renderModal({
      onAddToCart,
      onClose,
      preset: {
        id: 'p-carrot',
        name: 'Mrkev praná',
        price: 20,
        unit: 'kg'
      }
    });

    // Enter 1.250 kg
    fireEvent.click(screen.getByRole('button', { name: '1' }));
    fireEvent.click(screen.getByRole('button', { name: ',' }));
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    fireEvent.click(screen.getByRole('button', { name: '5' }));

    // Apply 5g tare
    fireEvent.click(screen.getByRole('button', { name: /-5 g/i }));

    // Net weight should be 1.25 - 0.005 = 1.245 kg
    const submitBtn = screen.getByRole('button', { name: /\+ Vložit do košíku/i });
    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(submitBtn);

    expect(onAddToCart).toHaveBeenCalledTimes(1);
    expect(onAddToCart).toHaveBeenCalledWith(expect.objectContaining({
      id: 'p-carrot',
      name: 'Mrkev praná',
      quantity: 1.245,
      unit: 'kg',
      price: 20,
      isWeighted: true
    }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('submits via Enter key when weight is valid', () => {
    const onAddToCart = vi.fn();
    const onClose = vi.fn();
    renderModal({ onAddToCart, onClose });

    // Enter 0.8 kg
    fireEvent.click(screen.getByRole('button', { name: '0' }));
    fireEvent.click(screen.getByRole('button', { name: ',' }));
    fireEvent.click(screen.getByRole('button', { name: '8' }));

    // Press Enter
    fireEvent.keyDown(window, { key: 'Enter' });

    expect(onAddToCart).toHaveBeenCalledTimes(1);
    expect(onAddToCart).toHaveBeenCalledWith(expect.objectContaining({
      quantity: 0.8
    }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('disables submit button and ignores Enter when net weight <= 0', () => {
    const onAddToCart = vi.fn();
    renderModal({ onAddToCart });

    const submitBtn = screen.getByRole('button', { name: /\+ Vložit do košíku/i });
    expect(submitBtn).toBeDisabled();

    // Pressing enter should do nothing
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onAddToCart).not.toHaveBeenCalled();
  });

  it('closes on Cancel button or Escape key', () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    const cancelBtn = screen.getByRole('button', { name: /Zrušit/i });
    fireEvent.click(cancelBtn);
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('supports open price weighted items: enters unit price then weight', () => {
    const onAddToCart = vi.fn();
    const onClose = vi.fn();
    renderModal({
      onAddToCart,
      onClose,
      preset: {
        id: 'preset-open-weighted',
        name: 'Volné ovoce / zelenina (váha)',
        price: 0,
        isOpenPrice: true,
        unit: 'kg',
        isWeighted: true
      }
    });

    // Should prompt for unit price first
    expect(screen.getByText(/Otevřená cena/i)).toBeInTheDocument();
    const switchBtn = screen.getByRole('button', { name: /Pokračovat na hmotnost/i });
    expect(switchBtn).toBeDisabled();

    // Enter unit price: 45 Kč / kg
    fireEvent.click(screen.getByRole('button', { name: '4' }));
    fireEvent.click(screen.getByRole('button', { name: '5' }));
    expect(switchBtn).not.toBeDisabled();

    // Advance to weight by clicking switch button
    fireEvent.click(switchBtn);

    // Now active field is weight. Button should become "+ Vložit do košíku" and disabled (weight is 0)
    const submitBtn = screen.getByRole('button', { name: /\+ Vložit do košíku/i });
    expect(submitBtn).toBeDisabled();

    // Enter weight: 1.500 kg
    fireEvent.click(screen.getByRole('button', { name: '1' }));
    fireEvent.click(screen.getByRole('button', { name: ',' }));
    fireEvent.click(screen.getByRole('button', { name: '5' }));

    // Real-time total: 1.5 * 45 = 67.50 Kč
    expect(screen.getByText('67.50 Kč')).toBeInTheDocument();
    expect(submitBtn).not.toBeDisabled();

    // Submit
    fireEvent.click(submitBtn);

    expect(onAddToCart).toHaveBeenCalledTimes(1);
    expect(onAddToCart).toHaveBeenCalledWith(expect.objectContaining({
      id: 'preset-open-weighted',
      price: 45,
      quantity: 1.5,
      unit: 'kg',
      isWeighted: true
    }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('prefills unit price when initialUnitPrice is supplied to open price weighted item', () => {
    const onAddToCart = vi.fn();
    const onClose = vi.fn();
    renderModal({
      onAddToCart,
      onClose,
      preset: {
        id: 'preset-open-weighted',
        name: 'Volné ovoce / zelenina (váha)',
        price: 0,
        isOpenPrice: true,
        unit: 'kg',
        isWeighted: true,
        initialUnitPrice: 60
      }
    });

    // Because initialUnitPrice was provided, should directly start in weight mode
    const submitBtn = screen.getByRole('button', { name: /\+ Vložit do košíku/i });
    expect(submitBtn).toBeDisabled();

    // Enter weight: 0.5 kg
    fireEvent.click(screen.getByRole('button', { name: '0' }));
    fireEvent.click(screen.getByRole('button', { name: ',' }));
    fireEvent.click(screen.getByRole('button', { name: '5' }));

    // 0.5 * 60 = 30.00 Kč
    expect(screen.getByText('30.00 Kč')).toBeInTheDocument();
    expect(submitBtn).not.toBeDisabled();

    // Press Enter to submit
    fireEvent.keyDown(window, { key: 'Enter' });

    expect(onAddToCart).toHaveBeenCalledTimes(1);
    expect(onAddToCart).toHaveBeenCalledWith(expect.objectContaining({
      price: 60,
      quantity: 0.5
    }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  describe('grams entry (F-003)', () => {
    const apples = { id: 'p-apples', name: 'Jablka Gala', price: 42, unit: 'kg', isWeighted: true };
    const type = (digits) => {
      for (const d of digits) fireEvent.click(screen.getByRole('button', { name: d }));
    };

    beforeEach(() => {
      localStorage.clear();
    });

    it('defaults to grams: 350 means 0.350 kg, not 350 kg', () => {
      const onAddToCart = vi.fn();
      renderModal({ preset: apples, onAddToCart });
      type('350');
      expect(screen.getByRole('button', { name: 'g' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByText(/0\.350 kg/)).toBeInTheDocument();
      expect(screen.getByText('14.70 Kč')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /\+ Vložit do košíku/i }));
      expect(onAddToCart).toHaveBeenCalledWith(expect.objectContaining({ quantity: 0.35, unit: 'kg', price: 42 }));
    });

    it('has no decimal comma in grams mode', () => {
      renderModal({ preset: apples });
      expect(screen.getByRole('button', { name: ',' })).toBeDisabled();
      type('5');
      fireEvent.keyDown(window, { key: ',' });
      expect(screen.queryByText('5.')).not.toBeInTheDocument();
    });

    it('takes at most six digits of grams', () => {
      renderModal({ preset: apples });
      type('12345678');
      expect(screen.getByText('123456')).toBeInTheDocument();
    });

    it('toggling to kg keeps the same weight', () => {
      renderModal({ preset: apples });
      type('350');
      fireEvent.click(screen.getByRole('button', { name: 'kg' }));
      expect(screen.getByText('0.35')).toBeInTheDocument();
      expect(screen.getByText('14.70 Kč')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'g' }));
      expect(screen.getByText('350')).toBeInTheDocument();
    });

    it('remembers the chosen unit on this device', () => {
      const first = renderModal({ preset: apples });
      fireEvent.click(screen.getByRole('button', { name: 'kg' }));
      first.unmount();
      renderModal({ preset: apples });
      expect(screen.getByRole('button', { name: 'kg' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: ',' })).toBeEnabled();
    });

    it('tare still takes grams off the net weight', () => {
      const onAddToCart = vi.fn();
      renderModal({ preset: apples, onAddToCart });
      type('350');
      fireEvent.click(screen.getByRole('button', { name: /-5 g/i }));
      fireEvent.click(screen.getByRole('button', { name: /\+ Vložit do košíku/i }));
      expect(onAddToCart).toHaveBeenCalledWith(expect.objectContaining({ quantity: 0.345 }));
    });

    it('asks a second time above 25 kg (350 kg typed by mistake)', () => {
      const onAddToCart = vi.fn();
      const onClose = vi.fn();
      renderModal({ preset: apples, onAddToCart, onClose });
      fireEvent.click(screen.getByRole('button', { name: 'kg' }));
      type('350');
      expect(screen.getByRole('status')).toHaveTextContent(/25 kg/);

      fireEvent.click(screen.getByRole('button', { name: /\+ Vložit do košíku/i }));
      expect(onAddToCart).not.toHaveBeenCalled();
      const confirm = screen.getByRole('button', { name: /Opravdu 350 kg/i });
      fireEvent.click(confirm);
      expect(onAddToCart).toHaveBeenCalledTimes(1);
      expect(onAddToCart).toHaveBeenCalledWith(expect.objectContaining({ quantity: 350 }));
    });

    it('editing the weight after the first tap asks again', () => {
      const onAddToCart = vi.fn();
      renderModal({ preset: apples, onAddToCart });
      fireEvent.click(screen.getByRole('button', { name: 'kg' }));
      type('350');
      fireEvent.click(screen.getByRole('button', { name: /\+ Vložit do košíku/i }));
      type('0');
      fireEvent.click(screen.getByRole('button', { name: /Opravdu 3500 kg|\+ Vložit do košíku/i }));
      expect(onAddToCart).not.toHaveBeenCalled();
    });

    it('Enter follows the same two-step rule', () => {
      const onAddToCart = vi.fn();
      renderModal({ preset: apples, onAddToCart });
      fireEvent.click(screen.getByRole('button', { name: 'kg' }));
      type('30');
      fireEvent.keyDown(window, { key: 'Enter' });
      expect(onAddToCart).not.toHaveBeenCalled();
      fireEvent.keyDown(window, { key: 'Enter' });
      expect(onAddToCart).toHaveBeenCalledTimes(1);
    });

    it('exactly 25 kg needs no confirmation', () => {
      const onAddToCart = vi.fn();
      renderModal({ preset: apples, onAddToCart });
      type('25000');
      fireEvent.click(screen.getByRole('button', { name: /\+ Vložit do košíku/i }));
      expect(onAddToCart).toHaveBeenCalledWith(expect.objectContaining({ quantity: 25 }));
    });

    it('items not sold per kg keep plain decimal entry without a unit toggle', () => {
      renderModal({ preset: { id: 'p-oil', name: 'Olej', price: 60, unit: 'l', isWeighted: true } });
      expect(screen.queryByRole('button', { name: 'g' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: ',' })).toBeEnabled();
    });
  });
});
