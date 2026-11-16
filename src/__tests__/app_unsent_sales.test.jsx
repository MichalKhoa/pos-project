import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
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
    getCurrentShift: vi.fn().mockResolvedValue({ receipts_count: 0, total_revenue: 0, total_cash_sales: 0, card_sales: 0 }),
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


async function payOneCustomItemInCash() {
  fireEvent.click(await screen.findByRole('button', { name: /Vlastní položka/i }));
  fireEvent.click(await screen.findByRole('button', { name: '1' }));
  fireEvent.click(screen.getByRole('button', { name: '5' }));
  fireEvent.click(screen.getByRole('button', { name: '0' }));
  fireEvent.click(screen.getByRole('button', { name: /Přidat do Košíku|Vložit do košíku/i }));
  fireEvent.click(screen.getByRole('button', { name: /^Hotovost$/i }));
  fireEvent.click(await screen.findByRole('button', { name: /Dokončit a vytisknout/i }));
}

describe('sale that the server did not store (F-001 part 2, F-014)', () => {
  beforeEach(async () => {
    window.location.hash = '';
    localStorage.clear();
    const posApi = await import('../api/posApi');
    posApi.createSaleBackend.mockClear();
    posApi.printReceiptBackend.mockClear();
  });

  it('server refuses the sale: dialog with the code, no receipt printed, sale kept as REJECTED', async () => {
    const posApi = await import('../api/posApi');
    posApi.createSaleBackend.mockResolvedValueOnce({ status: 'REJECTED', httpStatus: 422, code: 'TOTAL_MISMATCH' });
    renderAppWithProviders();
    await payOneCustomItemInCash();

    expect(await screen.findByRole('dialog', { name: /Neuložené prodeje/i })).toBeInTheDocument();
    expect(screen.getByText(/TOTAL_MISMATCH/)).toBeInTheDocument();
    expect(screen.getByText(/Zavolejte správce/i)).toBeInTheDocument();
    expect(posApi.printReceiptBackend).not.toHaveBeenCalled();
    const stored = JSON.parse(localStorage.getItem('voltflow_pos_sales'));
    expect(stored[0]).toMatchObject({ syncState: 'REJECTED', syncError: 'TOTAL_MISMATCH' });
  });

  it('server down: badge shows 1, then backend returns and the sale is sent exactly once more', async () => {
    const posApi = await import('../api/posApi');
    posApi.createSaleBackend.mockResolvedValueOnce(null);
    renderAppWithProviders();
    await payOneCustomItemInCash();

    const badge = await screen.findByRole('button', { name: /Neuložené prodeje: 1/i });
    expect(badge).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('voltflow_pos_sales'))[0].syncState).toBe('PENDING');
    expect(posApi.createSaleBackend).toHaveBeenCalledTimes(1);

    posApi.createSaleBackend.mockResolvedValue({ status: 'SUCCESS', receipt_number: '2026-000042' });
    await act(async () => { window.dispatchEvent(new CustomEvent('pos:backend-online')); });

    await waitFor(() => expect(screen.queryByRole('button', { name: /Neuložené prodeje/i })).not.toBeInTheDocument());
    expect(posApi.createSaleBackend).toHaveBeenCalledTimes(2);
    expect(JSON.parse(localStorage.getItem('voltflow_pos_sales'))[0]).toMatchObject({ syncState: 'SYNCED', receiptNumber: '2026-000042' });
    expect(posApi.createSaleBackend.mock.calls[0][0].id).toBe(posApi.createSaleBackend.mock.calls[1][0].id);
  });

  it('after a restart a local sale missing on the server is listed for manual sending, not auto-sent', async () => {
    const posApi = await import('../api/posApi');
    localStorage.setItem('voltflow_pos_sales', JSON.stringify([{
      id: 'sale-lost', receiptNumber: '2026-000007', timestamp: new Date().toISOString(),
      totalAmount: 50, items: [{ id: 'a', name: 'X', price: 50, quantity: 1, vat: 21 }], paymentMethod: 'cash'
    }]));
    renderAppWithProviders();

    expect(await screen.findByRole('button', { name: /Neuložené prodeje: 1/i })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('voltflow_pos_sales'))[0].syncState).toBe('STRANDED');
    expect(posApi.createSaleBackend).not.toHaveBeenCalled();
  });

  it('the shift widget shows the server numbers and refreshes them after the sale is stored', async () => {
    const posApi = await import('../api/posApi');
    posApi.getCurrentShift.mockResolvedValue({ receipts_count: 0, total_revenue: 0, total_cash_sales: 0, card_sales: 0 });
    renderAppWithProviders();
    expect(await screen.findByText('0 účtenek')).toBeInTheDocument();

    posApi.getCurrentShift.mockResolvedValue({ receipts_count: 1, total_revenue: 150, total_cash_sales: 150, card_sales: 0 });
    await payOneCustomItemInCash();
    expect(await screen.findByText('1 účtenka')).toBeInTheDocument();
  });

  describe('refund guards (F-026)', () => {
    const sale = (extra = {}) => ({
      id: 'sale-1', receiptNumber: '2026-000010', timestamp: new Date().toISOString(), totalAmount: 150,
      paymentMethod: 'cash', items: [{ id: 'p1', name: 'Víno bílé', price: 150, quantity: 1, vat: 21 }], ...extra
    });

    it('quick storno is disabled for a sale the server does not have', async () => {
      localStorage.setItem('voltflow_pos_sales', JSON.stringify([sale({ syncState: 'PENDING' })]));
      renderAppWithProviders();
      fireEvent.click(await screen.findByRole('button', { name: /Poslední:\s*150\s*Kč/i }));
      expect(screen.getByRole('button', { name: /Rychlé storno/i })).toBeDisabled();
    });

    it('a cash sale of 3.50 paid as 4 is refunded as 4 and the 0.50 is noted as rounding', async () => {
      const posApi = await import('../api/posApi');
      const stored = sale({
        id: 'sale-3-50', receiptNumber: '2026-000011', totalAmount: 4, cashRounding: 0.5,
        items: [{ id: 'p2', name: 'Rohlík', price: 3.5, quantity: 1, vat: 12 }]
      });
      posApi.fetchSalesHistoryBackend.mockResolvedValue([stored]);
      posApi.createSaleBackend.mockClear();
      posApi.createSaleBackend.mockResolvedValue({ status: 'SUCCESS', receipt_number: 'STORNO-2026-000012' });
      localStorage.setItem('voltflow_pos_sales', JSON.stringify([stored]));
      renderAppWithProviders();

      fireEvent.click(await screen.findByRole('button', { name: /Poslední:\s*4\s*Kč/i }));
      fireEvent.click(screen.getByRole('button', { name: /Rychlé storno/i }));
      await screen.findByText(/Vratka \/ Storno Účtenky/i);
      fireEvent.click(screen.getByRole('button', { name: /Provést vratku|Potvrdit|Vystavit/i }));

      await waitFor(() => expect(posApi.createSaleBackend).toHaveBeenCalled());
      const storno = posApi.createSaleBackend.mock.calls[0][0];
      expect(storno).toMatchObject({ isRefund: true, paymentMethod: 'cash', totalAmount: -4, cashRounding: -0.5, tenderedAmount: -4 });
      expect(storno.items[0].quantity).toBe(-1);
      posApi.fetchSalesHistoryBackend.mockResolvedValue([]);
    });

    it('refused storno: error shown, original sale not marked refunded, no status update sent', async () => {
      const posApi = await import('../api/posApi');
      const stored = sale();
      posApi.fetchSalesHistoryBackend.mockResolvedValue([stored]);
      posApi.updateSaleRefundStatusBackend.mockClear();
      posApi.createSaleBackend.mockResolvedValue({ status: 'REJECTED', httpStatus: 422, code: 'TOTAL_MISMATCH' });
      localStorage.setItem('voltflow_pos_sales', JSON.stringify([stored]));
      renderAppWithProviders();

      fireEvent.click(await screen.findByRole('button', { name: /Poslední:\s*150\s*Kč/i }));
      fireEvent.click(screen.getByRole('button', { name: /Rychlé storno/i }));
      await screen.findByText(/Vratka \/ Storno Účtenky/i);
      fireEvent.click(screen.getByRole('button', { name: /Provést vratku|Potvrdit|Vystavit/i }));

      expect(await screen.findByText(/Server vratku odmítl/i)).toBeInTheDocument();
      expect(posApi.updateSaleRefundStatusBackend).not.toHaveBeenCalled();
      const local = JSON.parse(localStorage.getItem('voltflow_pos_sales'));
      expect(local.find(s => s.id === 'sale-1').refundStatus || 'NONE').toBe('NONE');
      expect(local.find(s => s.isRefund)).toMatchObject({ syncState: 'REJECTED' });
      posApi.fetchSalesHistoryBackend.mockResolvedValue([]);
      posApi.createSaleBackend.mockResolvedValue({ status: 'SUCCESS', receipt_number: '2026-000001' });
    });
  });
});
