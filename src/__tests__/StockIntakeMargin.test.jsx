import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import StockIntakeModal from '../components/inventory/StockIntakeModal';
import { LanguageProvider } from '../i18n/LanguageContext';
import * as posApi from '../api/posApi';

vi.mock('../api/posApi', () => ({
  lookupAres: vi.fn(),
  submitStockIntake: vi.fn(),
  getStockMovements: vi.fn(),
  fetchSupplierPriceHistory: vi.fn().mockResolvedValue({
    preset_id: 'preset-1',
    history: []
  })
}));

const mockPresets = [
  {
    id: 'preset-1',
    name: 'Káva Arabica 1kg',
    price: 300.0,
    costPrice: 200.0,
    marginCoefficient: 1.5,
    vat: 21,
    stockQuantity: 15,
    trackStock: true,
    barcode: '85940001',
    unit: 'kg'
  }
];

describe('StockIntakeModal Margin & Price Recommendation Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays low margin warning badge when selling price is below recommended price', async () => {
    render(
      <LanguageProvider>
        <StockIntakeModal
          isOpen={true}
          onClose={vi.fn()}
          presets={mockPresets}
          storeConfig={{ defaultMarginCoefficient: 1.30 }}
        />
      </LanguageProvider>
    );

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'preset-1' } });

    await waitFor(() => {
      expect(screen.getByTestId('margin-warning-badge')).toBeInTheDocument();
      expect(screen.getByText(/Nízká marže/i)).toBeInTheDocument();
      expect(screen.getByText(/doporučeno 363 Kč/i)).toBeInTheDocument();
    });
  });

  it('autofills recommended selling price on 1-click and submits in payload', async () => {
    posApi.submitStockIntake.mockResolvedValueOnce({
      status: 'SUCCESS',
      intake_count: 1
    });

    const handleIntakeCompleted = vi.fn();
    const handleClose = vi.fn();

    render(
      <LanguageProvider>
        <StockIntakeModal
          isOpen={true}
          onClose={handleClose}
          presets={mockPresets}
          onIntakeCompleted={handleIntakeCompleted}
          storeConfig={{ defaultMarginCoefficient: 1.30 }}
        />
      </LanguageProvider>
    );

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'preset-1' } });

    const recPriceBtn = await screen.findByRole('button', { name: /Nastavit doporučenou cenu/i });
    fireEvent.click(recPriceBtn);

    const newPriceInputs = screen.getAllByPlaceholderText(/300 Kč/i);
    expect(newPriceInputs[0].value).toBe('363');

    const submitBtn = screen.getByRole('button', { name: /Uložit a naskladnit/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(posApi.submitStockIntake).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [
            expect.objectContaining({
              preset_id: 'preset-1',
              quantity: 1,
              cost_price: 200,
              new_selling_price: 363
            })
          ]
        })
      );
    });
  });

  it('opens SupplierPriceHistoryModal on clicking history button in row', async () => {
    render(
      <LanguageProvider>
        <StockIntakeModal
          isOpen={true}
          onClose={vi.fn()}
          presets={mockPresets}
        />
      </LanguageProvider>
    );

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'preset-1' } });

    const historyBtn = await screen.findByTitle(/Historie nákupních cen od dodavatelů/i);
    fireEvent.click(historyBtn);

    await waitFor(() => {
      expect(posApi.fetchSupplierPriceHistory).toHaveBeenCalledWith('preset-1');
      expect(screen.getByRole('heading', { name: /Historie nákupních cen dodavatelů/i })).toBeInTheDocument();
    });
  });
});
