import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import SupplierPriceHistoryModal from '../components/inventory/SupplierPriceHistoryModal';
import { LanguageProvider } from '../i18n/LanguageContext';
import * as posApi from '../api/posApi';

vi.mock('../api/posApi', () => ({
  fetchSupplierPriceHistory: vi.fn()
}));

const mockPreset = {
  id: 'preset-coffee',
  name: 'Espresso Zrnková Káva 1kg',
  stockQuantity: 12.5,
  costPrice: 220.0,
  unit: 'kg'
};

const mockHistoryData = [
  {
    id: 'intake-1',
    timestamp: '2026-03-10T14:30:00Z',
    supplier_name: 'Káva Import s.r.o.',
    supplier_ico: '12345678',
    document_ref: 'FA-2026-0099',
    quantity_delta: 25,
    unit_cost: 220.0,
    trend: 'rose'
  },
  {
    id: 'intake-2',
    timestamp: '2026-02-15T10:00:00Z',
    supplier_name: 'Káva Import s.r.o.',
    supplier_ico: '12345678',
    document_ref: 'FA-2026-0045',
    quantity_delta: 20,
    unit_cost: 210.0,
    trend: 'fell'
  },
  {
    id: 'intake-3',
    timestamp: '2026-01-10T09:15:00Z',
    supplier_name: 'Bean Wholesaler',
    supplier_ico: null,
    document_ref: null,
    quantity_delta: 30,
    unit_cost: 210.0,
    trend: 'stable'
  }
];

describe('SupplierPriceHistoryModal Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal header with product info, stock, and current VAP cost', async () => {
    posApi.fetchSupplierPriceHistory.mockResolvedValueOnce(mockHistoryData);

    render(
      <LanguageProvider>
        <SupplierPriceHistoryModal
          isOpen={true}
          onClose={vi.fn()}
          preset={mockPreset}
        />
      </LanguageProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Historie nákupních cen dodavatelů/i })).toBeInTheDocument();
      expect(screen.getByText(/Espresso Zrnková Káva 1kg/i)).toBeInTheDocument();
      expect(screen.getByText(/12\.5/i)).toBeInTheDocument();
      expect(screen.getByText(/220\.00/i)).toBeInTheDocument();
    });
  });

  it('fetches and renders intake timeline with supplier info, doc ref, and trend badges', async () => {
    posApi.fetchSupplierPriceHistory.mockResolvedValueOnce(mockHistoryData);

    render(
      <LanguageProvider>
        <SupplierPriceHistoryModal
          isOpen={true}
          onClose={vi.fn()}
          preset={mockPreset}
        />
      </LanguageProvider>
    );

    await waitFor(() => {
      expect(posApi.fetchSupplierPriceHistory).toHaveBeenCalledWith('preset-coffee');
      const rows = screen.getAllByTestId('price-history-row');
      expect(rows.length).toBe(3);
    });

    // Verify supplier info & document ref
    expect(screen.getAllByText(/Káva Import s\.r\.o\./i).length).toBe(2);
    expect(screen.getByText('FA-2026-0099')).toBeInTheDocument();
    expect(screen.getByText('+25 kg')).toBeInTheDocument();

    // Verify trend badges: rose, fell, stable
    expect(screen.getByTestId('trend-badge-rose')).toBeInTheDocument();
    expect(screen.getByTestId('trend-badge-fell')).toBeInTheDocument();
    expect(screen.getByTestId('trend-badge-stable')).toBeInTheDocument();
  });

  it('displays empty state when history is empty', async () => {
    posApi.fetchSupplierPriceHistory.mockResolvedValueOnce([]);

    render(
      <LanguageProvider>
        <SupplierPriceHistoryModal
          isOpen={true}
          onClose={vi.fn()}
          preset={mockPreset}
        />
      </LanguageProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Zatím žádná historie naskladnění pro tento produkt/i)).toBeInTheDocument();
    });
  });
});
