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
    openCashDrawerBackend: vi.fn().mockResolvedValue({ status: 'SUCCESS' }),
    printReceiptBackend: vi.fn().mockResolvedValue({ status: 'PRINTED' }),
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
    expect(screen.getAllByRole('button', { name: /Sklad/i }).length).toBeGreaterThanOrEqual(1);
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

    // Click Sklad tab
    const inventoryTabs = screen.getAllByRole('button', { name: /Sklad/i });
    fireEvent.click(inventoryTabs[0]);

    // Verify inventory view elements render
    expect(await screen.findByPlaceholderText(/Hledat název \/ EAN/i)).toBeInTheDocument();

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

    // Verify keypad label input is present
    expect(await screen.findByPlaceholderText(/Název \/ popis/i)).toBeInTheDocument();
  });

  it('renders customer display view when hash is #/customer-display', async () => {
    window.location.hash = '#/customer-display';
    renderAppWithProviders();

    await waitFor(() => {
      expect(screen.getAllByText(/Vítejte/i).length).toBeGreaterThanOrEqual(1);
    });
  });
});
