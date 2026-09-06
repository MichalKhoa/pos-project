import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import App from '../App';
import ErrorBoundary from '../components/ErrorBoundary';
import { LanguageProvider } from '../i18n/LanguageContext';
import { StoreConfigProvider } from '../context/StoreConfigContext';
import * as posApi from '../api/posApi';
import { setStorageItem } from '../utils/storage';

// Mock posApi
vi.mock('../api/posApi', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchBackendRoot: vi.fn().mockResolvedValue({ online: true }),
    fetchEetStatus: vi.fn().mockResolvedValue(null),
    processEetQueue: vi.fn().mockResolvedValue({}),
    fetchSalesHistoryBackend: vi.fn().mockResolvedValue([]),
    fetchSaleByReceiptNumber: vi.fn(),
    normalizeSale: vi.fn(s => s),
    updateSaleRefundStatusBackend: vi.fn().mockResolvedValue({ status: 'SUCCESS' }),
    createSaleBackend: vi.fn().mockResolvedValue({ status: 'SUCCESS', receipt_number: '2026-000001' }),
    fetchCategoriesBackend: vi.fn().mockResolvedValue([]),
    saveCategoryBackend: vi.fn().mockResolvedValue({ status: 'SUCCESS' }),
    deleteCategoryBackend: vi.fn().mockResolvedValue({ status: 'SUCCESS' }),
    fetchPresetsBackend: vi.fn().mockResolvedValue([]),
    savePresetBackend: vi.fn().mockResolvedValue({ status: 'SUCCESS' }),
    deletePresetBackend: vi.fn().mockResolvedValue({ status: 'SUCCESS' }),
    reorderPresetsBackend: vi.fn().mockResolvedValue({ status: 'SUCCESS' }),
    fetchStoreConfigBackend: vi.fn().mockResolvedValue({}),
    saveStoreConfigBackend: vi.fn().mockResolvedValue({ status: 'SUCCESS' }),
    broadcastCustomerDisplay: vi.fn(),
    deleteSaleBackend: vi.fn().mockResolvedValue({ status: 'SUCCESS' }),
    purgeAllSalesBackend: vi.fn().mockResolvedValue({ status: 'SUCCESS' }),
    openCashDrawerBackend: vi.fn().mockResolvedValue({ success: true, physical: true }),
    printReceiptBackend: vi.fn().mockResolvedValue({ status: 'PRINTED', physical: true }),
    fetchPrinterDevices: vi.fn().mockResolvedValue([]),
    fetchTerminalConfig: vi.fn().mockResolvedValue({ enabled: false }),
    fetchLitestreamStatus: vi.fn().mockResolvedValue(null),
    fetchLitestreamStatusBackend: vi.fn().mockResolvedValue(null)
  };
});

function renderApp() {
  window.innerWidth = 1280;
  return render(
    <ErrorBoundary>
      <LanguageProvider>
        <StoreConfigProvider>
          <App />
        </StoreConfigProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}

// Helper to simulate hardware barcode scanner burst keystrokes
function simulateScannerInput(code) {
  act(() => {
    for (let i = 0; i < code.length; i++) {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: code[i],
          bubbles: true,
          cancelable: true
        })
      );
    }
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true
      })
    );
  });
}

describe('Last Receipt Quick Actions & Price Check Mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    window.location.hash = '';
    window.innerWidth = 1280;
  });

  describe('1. Poslední účtenka: Rychlý dotisk a Storno (Last Receipt Quick Actions)', () => {
    it('displays last receipt quick chip when previous sale exists in history', async () => {
      const mockSale = {
        id: 'sale-recent-1',
        receiptNumber: '2026-000088',
        timestamp: '2026-09-06T14:30:00.000Z',
        totalAmount: 185,
        paymentMethod: 'cash',
        items: [{ id: 'p1', name: 'Plzeň 12° 0.5L', price: 45, quantity: 2, vat: 21 }]
      };
      setStorageItem('sales', [mockSale]);
      posApi.fetchSalesHistoryBackend.mockResolvedValue([mockSale]);

      renderApp();

      const chip = await screen.findByRole('button', { name: /Poslední:\s*185\s*Kč/i });
      expect(chip).toBeInTheDocument();
    });

    it('opens popover on chip click with Re-print and Quick Storno options', async () => {
      const mockSale = {
        id: 'sale-recent-2',
        receiptNumber: '2026-000089',
        timestamp: '2026-09-06T15:45:00.000Z',
        totalAmount: 220,
        paymentMethod: 'cash',
        items: [{ id: 'p1', name: 'Kofola 2L', price: 44, quantity: 5, vat: 21 }]
      };
      setStorageItem('sales', [mockSale]);
      posApi.fetchSalesHistoryBackend.mockResolvedValue([mockSale]);

      renderApp();

      const chipBtn = await screen.findByRole('button', { name: /Poslední:\s*220\s*Kč/i });
      fireEvent.click(chipBtn);

      // Popover should be open
      expect(screen.getByText(/#2026-000089/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Vytisknout znovu/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Rychlé storno/i })).toBeInTheDocument();
    });

    it('triggers printReceiptBackend when clicking Re-print in popover', async () => {
      const mockSale = {
        id: 'sale-recent-3',
        receiptNumber: '2026-000090',
        timestamp: '2026-09-06T16:00:00.000Z',
        totalAmount: 100,
        paymentMethod: 'cash',
        items: [{ id: 'p1', name: 'Káva Espresso', price: 50, quantity: 2, vat: 21 }]
      };
      setStorageItem('sales', [mockSale]);
      posApi.fetchSalesHistoryBackend.mockResolvedValue([mockSale]);

      renderApp();

      const chipBtn = await screen.findByRole('button', { name: /Poslední:\s*100\s*Kč/i });
      fireEvent.click(chipBtn);

      const reprintBtn = screen.getByRole('button', { name: /Vytisknout znovu/i });
      fireEvent.click(reprintBtn);

      await waitFor(() => {
        expect(posApi.printReceiptBackend).toHaveBeenCalledWith(
          expect.objectContaining({ receiptNumber: '2026-000090', totalAmount: 100 }),
          expect.anything()
        );
      });
    });

    it('opens RefundModal preloaded with last sale when clicking Quick Storno', async () => {
      const mockSale = {
        id: 'sale-recent-4',
        receiptNumber: '2026-000091',
        timestamp: '2026-09-06T16:30:00.000Z',
        totalAmount: 150,
        paymentMethod: 'cash',
        items: [{ id: 'p1', name: 'Víno bílé 0.7L', price: 150, quantity: 1, vat: 21 }]
      };
      setStorageItem('sales', [mockSale]);
      posApi.fetchSalesHistoryBackend.mockResolvedValue([mockSale]);

      renderApp();

      const chipBtn = await screen.findByRole('button', { name: /Poslední:\s*150\s*Kč/i });
      fireEvent.click(chipBtn);

      const stornoBtn = screen.getByRole('button', { name: /Rychlé storno/i });
      fireEvent.click(stornoBtn);

      // RefundModal should open
      await waitFor(() => {
        expect(screen.getByText(/Vratka \/ Storno Účtenky/i)).toBeInTheDocument();
        expect(screen.getByText(/Víno bílé 0.7L/i)).toBeInTheDocument();
      });
    });
  });

  describe('2. Kontrola ceny / Cenovka (Price Check Mode)', () => {
    it('renders 1-tap Price Check toggle button on register screen', async () => {
      renderApp();
      expect(screen.getByRole('button', { name: /Kontrola ceny/i })).toBeInTheDocument();
    });

    it('toggles price check mode on button click and via F2 hotkey', async () => {
      renderApp();
      const toggleBtn = screen.getByRole('button', { name: /Kontrola ceny/i });

      // Click button to activate
      fireEvent.click(toggleBtn);
      expect(screen.getByRole('button', { name: /Cenovka:\s*AKTIVNÍ/i })).toBeInTheDocument();

      // Press F2 to deactivate
      fireEvent.keyDown(window, { key: 'F2' });
      expect(screen.getByRole('button', { name: /Kontrola ceny/i })).toBeInTheDocument();

      // Press F2 to reactivate
      fireEvent.keyDown(window, { key: 'F2' });
      expect(screen.getByRole('button', { name: /Cenovka:\s*AKTIVNÍ/i })).toBeInTheDocument();
    });

    it('tapping preset in price check mode displays price check modal without mutating cart', async () => {
      const mockPresets = [
        { id: 'preset-kofola', name: 'Kofola 0.5L', price: 35, vat: 21, barcode: '8594005551111', showInPresets: true, trackStock: true, stockQuantity: 24 }
      ];
      setStorageItem('presets', mockPresets);
      posApi.fetchPresetsBackend.mockResolvedValue(mockPresets);

      renderApp();

      // Turn on Price Check Mode
      const toggleBtn = screen.getByRole('button', { name: /Kontrola ceny/i });
      fireEvent.click(toggleBtn);
      await screen.findByRole('button', { name: /Cenovka:\s*AKTIVNÍ/i });

      // Click on preset tile
      const presetTile = await screen.findByText('Kofola 0.5L');
      fireEvent.click(presetTile);

      // Price Check Modal should appear
      const modal = await screen.findByRole('dialog');
      expect(within(modal).getByText(/Kontrola ceny zboží/i)).toBeInTheDocument();
      expect(within(modal).getByText(/35\.00/)).toBeInTheDocument();
      expect(within(modal).getByText(/24 ks/i)).toBeInTheDocument();
      expect(within(modal).getByText('Sazba DPH')).toBeInTheDocument();

      // Cart should still be empty!
      expect(screen.getByText(/Košík je prázdný/i)).toBeInTheDocument();
    });

    it('scanning barcode in price check mode shows price modal without mutating cart', async () => {
      const mockPresets = [
        { id: 'preset-birell', name: 'Birell Pomelo 0.5L', price: 38, vat: 21, barcode: '8594001234567', showInPresets: true }
      ];
      setStorageItem('presets', mockPresets);
      posApi.fetchPresetsBackend.mockResolvedValue(mockPresets);

      renderApp();

      // Wait for presets to load
      await screen.findByText('Birell Pomelo 0.5L');

      // Turn on Price Check Mode via F2 and verify active state
      fireEvent.keyDown(window, { key: 'F2' });
      await screen.findByRole('button', { name: /Cenovka:\s*AKTIVNÍ/i });

      // Simulate barcode scan
      simulateScannerInput('8594001234567');

      const modal = await screen.findByRole('dialog');
      expect(within(modal).getByText(/Kontrola ceny zboží/i)).toBeInTheDocument();
      expect(within(modal).getByText('Birell Pomelo 0.5L')).toBeInTheDocument();
      expect(within(modal).getByText(/38\.00/)).toBeInTheDocument();

      // Cart is empty
      expect(screen.getByText(/Košík je prázdný/i)).toBeInTheDocument();
    });

    it('adding item to cart from Price Check modal updates cart', async () => {
      const mockPresets = [
        { id: 'preset-croissant', name: '7Days Croissant', price: 22, vat: 12, barcode: '5201360521006', showInPresets: true }
      ];
      setStorageItem('presets', mockPresets);
      posApi.fetchPresetsBackend.mockResolvedValue(mockPresets);

      renderApp();

      // Wait for preset to be rendered
      const presetTile = await screen.findByText('7Days Croissant');

      // Turn on Price Check Mode
      fireEvent.keyDown(window, { key: 'F2' });
      await screen.findByRole('button', { name: /Cenovka:\s*AKTIVNÍ/i });

      // Tap preset
      fireEvent.click(presetTile);

      // In modal, click [+ Přidat do košíku]
      const addBtn = await screen.findByRole('button', { name: /Přidat do košíku/i });
      fireEvent.click(addBtn);

      // Item should now be in cart
      await waitFor(() => {
        expect(screen.queryByText(/Kontrola ceny zboží/i)).not.toBeInTheDocument();
        expect(screen.getAllByText('7Days Croissant').length).toBeGreaterThan(0);
      });
    });

    it('scanning unknown barcode in price check mode displays unknown barcode notification modal', async () => {
      renderApp();

      // Turn on Price Check Mode
      fireEvent.keyDown(window, { key: 'F2' });
      await screen.findByRole('button', { name: /Cenovka:\s*AKTIVNÍ/i });

      // Scan uncatalogued barcode
      simulateScannerInput('9998887776665');

      const modal = await screen.findByRole('dialog');
      expect(within(modal).getByText(/Neznámý čárový kód/i)).toBeInTheDocument();
      expect(within(modal).getByText('9998887776665')).toBeInTheDocument();
      expect(within(modal).getByRole('button', { name: /Vytvořit produkt/i })).toBeInTheDocument();
    });
  });
});
