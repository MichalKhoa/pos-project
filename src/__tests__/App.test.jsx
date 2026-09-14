import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../App';
import ErrorBoundary from '../components/ErrorBoundary';
import { LanguageProvider } from '../i18n/LanguageContext';
import { StoreConfigProvider } from '../context/StoreConfigContext';

// Partial mock preserving all exports
vi.mock('../api/posApi', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchBackendRoot: vi.fn().mockResolvedValue({ online: true }),
    fetchEetStatus: vi.fn().mockResolvedValue(null),
    processEetQueue: vi.fn().mockResolvedValue({}),
    fetchSalesHistoryBackend: vi.fn().mockResolvedValue([]),
    normalizeSale: vi.fn(s => s),
    updateSaleRefundStatusBackend: vi.fn().mockResolvedValue({ status: 'SUCCESS' }),
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
    createSaleBackend: vi.fn().mockResolvedValue({ status: 'SUCCESS', receipt_number: '2026-000001' }),
    openCashDrawerBackend: vi.fn().mockResolvedValue({ status: 'SUCCESS' }),
    printReceiptBackend: vi.fn().mockResolvedValue({ status: 'PRINTED', physical: true }),
    fetchPrinterDevices: vi.fn().mockResolvedValue([]),
    fetchTerminalConfig: vi.fn().mockResolvedValue({ enabled: false }),
    fetchLitestreamStatus: vi.fn().mockResolvedValue(null),
    fetchLitestreamStatusBackend: vi.fn().mockResolvedValue(null)
  };
});

function renderAppWithProviders() {
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

describe('App Shell & Navigation Regression Tests', () => {
  beforeEach(() => {
    window.location.hash = '';
    localStorage.clear();
  });

  it('renders the main POS register shell without crashing', async () => {
    renderAppWithProviders();

    // Verify brand logo is present
    expect(screen.getByAltText(/VoltFlow/i)).toBeInTheDocument();

    // Verify main register tabs are present in navbar
    expect(screen.getAllByRole('button', { name: /Pokladna/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('button', { name: /Katalog/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('button', { name: /Historie/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('button', { name: /Analytika/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('button', { name: /Nastavení/i }).length).toBeGreaterThanOrEqual(1);
  });

  it('navigates cleanly between views when clicking top navbar tabs', async () => {
    renderAppWithProviders();

    // Click Katalog tab
    const catalogTabs = screen.getAllByRole('button', { name: /Katalog/i });
    fireEvent.click(catalogTabs[0]);

    // Verify catalog view elements render
    expect(await screen.findByPlaceholderText(/Hledat položku nebo název/i)).toBeInTheDocument();

    // Click Historie tab
    const historyTabs = screen.getAllByRole('button', { name: /Historie/i });
    fireEvent.click(historyTabs[0]);

    // Verify history view elements render
    expect(await screen.findByPlaceholderText(/Hledat č\. účtenky/i)).toBeInTheDocument();

    // Click Analytika tab
    const analyticsTabs = screen.getAllByRole('button', { name: /Analytika/i });
    fireEvent.click(analyticsTabs[0]);

    // Verify analytics view elements render
    expect(await screen.findByText(/Rozpis DPH/i)).toBeInTheDocument();

    // Click Nastavení tab
    const settingsTabs = screen.getAllByRole('button', { name: /Nastavení/i });
    fireEvent.click(settingsTabs[0]);

    // Verify settings view elements render
    expect(await screen.findByText(/Údaje prodejny/i)).toBeInTheDocument();
    expect(screen.getByText(/Rozvržení & Zobrazení/i)).toBeInTheDocument();

    // Click back to Pokladna (Register) tab
    const registerTabs = screen.getAllByRole('button', { name: /Pokladna/i });
    fireEvent.click(registerTabs[0]);

    // Verify preset search / catalog is present
    expect(await screen.findByPlaceholderText(/Hledat položku nebo název/i)).toBeInTheDocument();
  });

  it('renders customer display view when hash is #/customer-display', async () => {
    window.location.hash = '#/customer-display';
    renderAppWithProviders();

    await waitFor(() => {
      expect(screen.getAllByText(/Vítejte/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('cycles font size on navbar button click and sets data-font-size attribute', async () => {
    renderAppWithProviders();

    // Default font-size should be md
    expect(document.documentElement.getAttribute('data-font-size')).toBe('md');

    // Find navbar font size cycle button
    const fontBtn = screen.getByTitle(/Velikost písma: M\b/i);
    expect(fontBtn).toBeInTheDocument();
    expect(fontBtn).toHaveTextContent('M');

    // Cycle to L
    fireEvent.click(fontBtn);
    expect(document.documentElement.getAttribute('data-font-size')).toBe('lg');
    expect(localStorage.getItem('voltflow_font_size')).toBe('lg');
    expect(fontBtn).toHaveTextContent('L');

    // Cycle to XL
    fireEvent.click(fontBtn);
    expect(document.documentElement.getAttribute('data-font-size')).toBe('xl');
    expect(fontBtn).toHaveTextContent('XL');

    // Cycle to S
    fireEvent.click(fontBtn);
    expect(document.documentElement.getAttribute('data-font-size')).toBe('sm');
    expect(fontBtn).toHaveTextContent('S');

    // Cycle back to M
    fireEvent.click(fontBtn);
    expect(document.documentElement.getAttribute('data-font-size')).toBe('md');
    expect(fontBtn).toHaveTextContent('M');
  });

  it('prints receipt directly via hardware in background without lingering in ReceiptModal on payment completion', async () => {
    const posApi = await import('../api/posApi');
    renderAppWithProviders();

    // Open Custom Item Modal
    const customItemBtn = await screen.findByRole('button', { name: /Vlastní položka/i });
    fireEvent.click(customItemBtn);

    // Type 1, 5, 0 on touch numpad
    fireEvent.click(await screen.findByRole('button', { name: '1' }));
    fireEvent.click(screen.getByRole('button', { name: '5' }));
    fireEvent.click(screen.getByRole('button', { name: '0' }));

    // Click Add to Cart
    const addBtn = screen.getByRole('button', { name: /Přidat do Košíku|Vložit do košíku/i });
    fireEvent.click(addBtn);

    // Click Pay Cash
    const payCashBtn = screen.getByRole('button', { name: /^Hotovost$/i });
    fireEvent.click(payCashBtn);

    // Inside payment modal, click "Dokončit a vytisknout"
    const completeWithPrintBtn = await screen.findByRole('button', { name: /Dokončit a vytisknout/i });
    fireEvent.click(completeWithPrintBtn);

    // Verify printReceiptBackend was called directly in background
    await waitFor(() => {
      expect(posApi.printReceiptBackend).toHaveBeenCalled();
    });

    // Verify payment modal is closed and ReceiptModal is not blocking the register
    await waitFor(() => {
      expect(screen.queryByText(/Platba Prodeje/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/STORNO DOKLAD \/ DOBROPIS/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Prodej Dokončen/i)).not.toBeInTheDocument();
    });
  });

  it('renders 2-column wide layout without stationary keypad by default and supports 3-column mode', async () => {
    // 1. Default 2-column mode
    const { container, unmount } = renderAppWithProviders();
    expect(container.querySelector('.pos-layout.layout-two-column')).toBeInTheDocument();
    expect(container.querySelector('.pos-col-presets')).toBeInTheDocument();
    expect(container.querySelector('.pos-col-cart')).toBeInTheDocument();
    expect(container.querySelector('.pos-col-left')).not.toBeInTheDocument();
    unmount();

    // 2. Set 3-column mode in localStorage
    localStorage.setItem('voltflow_pos_config', JSON.stringify({ registerLayout: 'three_column' }));
    const { container: container3 } = renderAppWithProviders();
    expect(container3.querySelector('.pos-layout.layout-three-column')).toBeInTheDocument();
    expect(container3.querySelector('.pos-col-left')).toBeInTheDocument();
    expect(container3.querySelector('.pos-col-center')).toBeInTheDocument();
    expect(container3.querySelector('.pos-col-right')).toBeInTheDocument();
  });
});

