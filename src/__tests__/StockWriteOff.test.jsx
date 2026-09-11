import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import StockWriteOffModal from '../components/inventory/StockWriteOffModal';
import { LanguageProvider } from '../i18n/LanguageContext';
import * as posApi from '../api/posApi';

vi.mock('../api/posApi', () => ({
  submitStockWriteOff: vi.fn(),
  printWriteOffProtocol: vi.fn()
}));

const mockCategories = [
  { id: 'cat-veg', name: 'Ovoce a zelenina', naturalLossNorm: 4.0 },
  { id: 'cat-dry', name: 'Trvanlivé potraviny', naturalLossNorm: 0.0 }
];

const mockPresets = [
  {
    id: 'p-banana',
    name: 'Banány volné',
    category: 'cat-veg',
    price: 40.0,
    costPrice: 25.0,
    stockQuantity: 50.0,
    unit: 'kg'
  },
  {
    id: 'p-chips',
    name: 'Brambůrky solené 100g',
    category: 'cat-dry',
    price: 35.0,
    costPrice: 20.0,
    stockQuantity: 30.0,
    unit: 'ks'
  }
];

describe('StockWriteOffModal Component Tests (§ 25 ZoÚ)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal with default expiration reason and tax deductibility evaluation', () => {
    render(
      <LanguageProvider>
        <StockWriteOffModal
          isOpen={true}
          onClose={vi.fn()}
          presets={mockPresets}
          categories={mockCategories}
        />
      </LanguageProvider>
    );

    expect(screen.getByText(/Skladový Odpis a Likvidační Protokol/i)).toBeInTheDocument();
    expect(screen.getByText(/Exspirace \(Projité zboží\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Potvrdit a provést odpis/i)).toBeInTheDocument();
  });

  it('auto-evaluates produce natural loss within norm as tax-deductible', async () => {
    render(
      <LanguageProvider>
        <StockWriteOffModal
          isOpen={true}
          onClose={vi.fn()}
          presets={mockPresets}
          categories={mockCategories}
          initialPresetId="p-banana"
        />
      </LanguageProvider>
    );

    // Should indicate "V normě" badge for produce with category norm 4% on EXSPIRACE
    expect(screen.getByText(/V normě/i)).toBeInTheDocument();
    expect(screen.getByText(/Režim: Daňově uznatelný/i)).toBeInTheDocument();
  });

  it('switches to non-deductible mode when theft reason (KRADEZ) is selected', async () => {
    render(
      <LanguageProvider>
        <StockWriteOffModal
          isOpen={true}
          onClose={vi.fn()}
          presets={mockPresets}
          categories={mockCategories}
          initialPresetId="p-banana"
        />
      </LanguageProvider>
    );

    // Change reason to KRADEZ
    const reasonSelect = screen.getByTestId('write-off-reason-select');
    fireEvent.change(reasonSelect, { target: { value: 'KRADEZ' } });

    await waitFor(() => {
      expect(screen.getByText(/Režim: Nedaňové manko/i)).toBeInTheDocument();
    });
  });

  it('submits write-off payload and displays success screen with protocol number', async () => {
    posApi.submitStockWriteOff.mockResolvedValueOnce({
      id: 'wroff_123',
      protocol_number: 'ODP-2026-0001',
      reason: 'EXSPIRACE',
      responsible_person: 'Petr Novák',
      total_cost_value: 50.0,
      total_retail_value: 80.0,
      is_tax_deductible: true,
      vat_adjustment_required: false,
      timestamp: '2026-09-11T20:50:00'
    });

    const onComplete = vi.fn();
    render(
      <LanguageProvider>
        <StockWriteOffModal
          isOpen={true}
          onClose={vi.fn()}
          presets={mockPresets}
          categories={mockCategories}
          initialPresetId="p-banana"
          onWriteOffCompleted={onComplete}
        />
      </LanguageProvider>
    );

    const submitBtn = screen.getByText(/Potvrdit a provést odpis/i);
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(posApi.submitStockWriteOff).toHaveBeenCalledWith({
        reason: 'EXSPIRACE',
        responsible_person: null,
        note: null,
        items: [
          {
            preset_id: 'p-banana',
            quantity: 1,
            is_norm_loss: undefined
          }
        ]
      });
      expect(screen.getByText(/Odpis byl úspěšně zaevidován/i)).toBeInTheDocument();
      expect(screen.getByText(/ODP-2026-0001/i)).toBeInTheDocument();
      expect(onComplete).toHaveBeenCalled();
    });
  });
});
