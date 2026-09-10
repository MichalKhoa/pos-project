import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import StockIntakeModal from '../components/inventory/StockIntakeModal';
import { LanguageProvider } from '../i18n/LanguageContext';
import * as posApi from '../api/posApi';

vi.mock('../api/posApi', () => ({
  lookupAres: vi.fn(),
  submitStockIntake: vi.fn(),
  getStockMovements: vi.fn()
}));

const mockPresets = [
  {
    id: 'prod-coffee-1',
    name: 'Espresso Blend 1kg',
    price: 350.0,
    costPrice: 150.0,
    stockQuantity: 10,
    trackStock: true,
    barcode: '85940001',
    isGeneralPreset: false
  },
  {
    id: 'prod-tea-1',
    name: 'Earl Grey 250g',
    price: 120.0,
    costPrice: 55.0,
    stockQuantity: 5,
    trackStock: true,
    barcode: '85940002',
    isGeneralPreset: false
  }
];

describe('Stock Intake & ARES Modal Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('performs ARES lookup and autofills supplier information', async () => {
    const handleClose = vi.fn();
    const handleIntakeCompleted = vi.fn();

    posApi.lookupAres.mockResolvedValueOnce({
      ico: '27082440',
      name: 'ALZA a.s.',
      dic: 'CZ27082440',
      street: 'Jankovcova 1522/53',
      city: 'Praha 7',
      zip: '17000',
      formattedAddress: 'Jankovcova 1522/53, 17000 Praha 7'
    });

    render(
      <LanguageProvider>
        <StockIntakeModal
          isOpen={true}
          onClose={handleClose}
          presets={mockPresets}
          onIntakeCompleted={handleIntakeCompleted}
        />
      </LanguageProvider>
    );

    // Verify modal title
    expect(screen.getByRole('heading', { name: /Příjemka zboží/i })).toBeInTheDocument();

    // Enter valid 8-digit IČO
    const icoInput = screen.getByPlaceholderText(/Zadejte 8místné IČO/i);
    fireEvent.change(icoInput, { target: { value: '27082440' } });
    expect(icoInput.value).toBe('27082440');

    // Wait for ARES button to be enabled and click it
    const aresBtn = await screen.findByRole('button', { name: /ARES/i });
    await waitFor(() => expect(aresBtn).not.toBeDisabled());
    fireEvent.click(aresBtn);

    // Verify API called and supplier name autofilled
    await waitFor(() => {
      expect(posApi.lookupAres).toHaveBeenCalledWith('27082440');
      expect(screen.getByDisplayValue('ALZA a.s.')).toBeInTheDocument();
      expect(screen.getByText(/ověřen v registru ARES/i)).toBeInTheDocument();
    });
  });

  it('allows adding line items, updates totals, and submits intake to backend', async () => {
    const handleClose = vi.fn();
    const handleIntakeCompleted = vi.fn();

    posApi.submitStockIntake.mockResolvedValueOnce({
      status: 'SUCCESS',
      intake_count: 2,
      document_ref: 'FAK-2026-001'
    });

    render(
      <LanguageProvider>
        <StockIntakeModal
          isOpen={true}
          onClose={handleClose}
          presets={mockPresets}
          onIntakeCompleted={handleIntakeCompleted}
        />
      </LanguageProvider>
    );

    // Enter Document Ref
    const docInput = screen.getByPlaceholderText(/VF-2026-001/i);
    fireEvent.change(docInput, { target: { value: 'FAK-2026-001' } });

    // Select first product in initial row
    const firstSelect = screen.getByRole('combobox');
    fireEvent.change(firstSelect, { target: { value: 'prod-coffee-1' } });

    // Verify default cost price 150 is filled
    expect(screen.getByDisplayValue('150')).toBeInTheDocument();

    // Change quantity to 5
    const qtyInputs = screen.getAllByRole('spinbutton');
    // First spinbutton is quantity (value 1), second is cost_price (value 150)
    fireEvent.change(qtyInputs[0], { target: { value: '5' } });

    // Add second item row
    const addRowBtn = screen.getByRole('button', { name: /\+ Přidat položku do příjemky/i });
    fireEvent.click(addRowBtn);

    // Select second product in the second row
    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBe(2);
    fireEvent.change(selects[1], { target: { value: 'prod-tea-1' } });

    // Change second quantity to 10
    const updatedSpinbuttons = screen.getAllByRole('spinbutton');
    // Row 1 qty: index 0, cost: index 1. Row 2 qty: index 2, cost: index 3.
    fireEvent.change(updatedSpinbuttons[2], { target: { value: '10' } });

    // Verify summary calculation:
    // Coffee: 5 * 150 = 750 Kč
    // Tea: 10 * 55 = 550 Kč
    // Total = 1300 Kč
    await waitFor(() => {
      expect(screen.getByText(/1\s?300\s?Kč/i)).toBeInTheDocument();
    });

    // Click submit button
    const submitBtn = screen.getByRole('button', { name: /Uložit a naskladnit/i });
    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(posApi.submitStockIntake).toHaveBeenCalledWith({
        supplier_ico: null,
        supplier_name: null,
        document_ref: 'FAK-2026-001',
        note: null,
        items: [
          { preset_id: 'prod-coffee-1', quantity: 5, cost_price: 150 },
          { preset_id: 'prod-tea-1', quantity: 10, cost_price: 55 }
        ]
      });
      expect(handleIntakeCompleted).toHaveBeenCalledWith(2);
      expect(handleClose).toHaveBeenCalled();
    });
  });
});
