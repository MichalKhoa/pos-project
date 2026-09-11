import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import BarcodeLabelModal from '../components/inventory/BarcodeLabelModal';
import { LanguageProvider } from '../i18n/LanguageContext';
import * as posApi from '../api/posApi';

vi.mock('../api/posApi', () => ({
  printBarcodeLabelBackend: vi.fn().mockResolvedValue({ status: 'SUCCESS' })
}));

const mockSinglePreset = {
  id: 'preset-banany',
  name: 'Banány Premium',
  price: 39.90,
  unit: 'kg',
  isWeighted: true,
  category: 'Ovoce',
  vat: 12,
  barcode: '85900011'
};

const mockBatchPresets = [
  {
    id: 'preset-item-1',
    name: 'Mléko Plnotučné 1L',
    price: 24.90,
    unit: 'ks',
    isWeighted: false,
    barcode: '85900021',
    vat: 12
  },
  {
    id: 'preset-item-2',
    name: 'Máslo Jihočeské 250g',
    price: 59.90,
    unit: 'ks',
    isWeighted: false,
    barcode: '85900022',
    vat: 12
  }
];

describe('BarcodeLabelModal Shelf Tag Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders shelf label preview with price, unit, validity date, and weighted 1 kg price', () => {
    render(
      <LanguageProvider>
        <BarcodeLabelModal
          isOpen={true}
          onClose={vi.fn()}
          preset={mockSinglePreset}
          storeConfig={{ storeName: 'Moje Prodejna' }}
        />
      </LanguageProvider>
    );

    // Verify store name, preset name, price
    expect(screen.getByText('Moje Prodejna')).toBeInTheDocument();
    const labelCard = screen.getByTestId('printable-barcode-label');
    expect(within(labelCard).getByText('Banány Premium')).toBeInTheDocument();
    expect(within(labelCard).getByText('39.90 Kč')).toBeInTheDocument();

    // Verify unit and weighted price
    expect(screen.getByTestId('label-unit')).toHaveTextContent('/ kg');
    expect(screen.getByTestId('label-weighted-price')).toHaveTextContent('Cena za 1 kg: 39.90 Kč');

    // Verify validity date
    expect(screen.getByTestId('label-validity-date')).toHaveTextContent(/Platnost od:/i);
    expect(screen.getByTestId('validity-date-input')).toBeInTheDocument();
  });

  it('updates validity date from input field and displays in preview', () => {
    render(
      <LanguageProvider>
        <BarcodeLabelModal
          isOpen={true}
          onClose={vi.fn()}
          preset={mockSinglePreset}
        />
      </LanguageProvider>
    );

    const dateInput = screen.getByTestId('validity-date-input');
    fireEvent.change(dateInput, { target: { value: '01.04.2026' } });

    expect(screen.getByTestId('label-validity-date')).toHaveTextContent('Platnost od: 01.04.2026');
  });

  it('supports batch mode with navigation and sends validityDate to print API', async () => {
    const handleClose = vi.fn();

    render(
      <LanguageProvider>
        <BarcodeLabelModal
          isOpen={true}
          onClose={handleClose}
          presets={mockBatchPresets}
          storeConfig={{ storeName: 'Supermarket' }}
        />
      </LanguageProvider>
    );

    // Verify batch title and items count
    expect(screen.getByRole('heading', { name: /Hromadný tisk regálových cenovek/i })).toBeInTheDocument();
    expect(screen.getByText(/2 položek v dávce/i)).toBeInTheDocument();

    // First item is active in printable card
    const labelCard = screen.getByTestId('printable-barcode-label');
    expect(within(labelCard).getByText('Mléko Plnotučné 1L')).toBeInTheDocument();

    // Switch to second item via next button
    const nextBtn = screen.getByTestId('batch-next-btn');
    fireEvent.click(nextBtn);
    expect(within(labelCard).getByText('Máslo Jihočeské 250g')).toBeInTheDocument();

    // Set custom validity date
    const dateInput = screen.getByTestId('validity-date-input');
    fireEvent.change(dateInput, { target: { value: '15.05.2026' } });

    // Click print button
    const printBtn = screen.getByTestId('thermal-print-submit-btn');
    fireEvent.click(printBtn);

    await waitFor(() => {
      expect(posApi.printBarcodeLabelBackend).toHaveBeenCalledTimes(2);
      expect(posApi.printBarcodeLabelBackend).toHaveBeenNthCalledWith(
        1,
        mockBatchPresets[0],
        1,
        expect.objectContaining({ storeName: 'Supermarket' }),
        '15.05.2026'
      );
      expect(posApi.printBarcodeLabelBackend).toHaveBeenNthCalledWith(
        2,
        mockBatchPresets[1],
        1,
        expect.objectContaining({ storeName: 'Supermarket' }),
        '15.05.2026'
      );
    });
  });
});
