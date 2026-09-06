import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import App from '../App';
import ErrorBoundary from '../components/ErrorBoundary';
import { LanguageProvider } from '../i18n/LanguageContext';
import { StoreConfigProvider } from '../context/StoreConfigContext';
import * as posApi from '../api/posApi';

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
    createSaleBackend: vi.fn().mockResolvedValue({ status: 'SUCCESS', receipt_number: 'STORNO-2026-000001' }),
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

function renderApp() {
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
}

describe('Receipt Barcode Scanner & Easy Return Workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    window.location.hash = '';
  });

  it('intercepts scanned receipt barcode and opens RefundModal with header metadata and transaction items', async () => {
    const mockSale = {
      id: 'sale-test-123',
      receiptNumber: '2026-000042',
      receipt_number: '2026-000042',
      timestamp: '2026-09-06T14:30:00.000Z',
      cashierName: 'Monika K.',
      totalAmount: 350.0,
      total_amount: 350.0,
      paymentMethod: 'cash',
      cartDiscountPercent: 0,
      items: [
        {
          id: 'item-1',
          name: 'Káva Cappuccino',
          price: 75.0,
          quantity: 2,
          vat: 21,
          discount_percent: 0,
          refunded_quantity: 0,
          remaining_quantity: 2
        },
        {
          id: 'item-2',
          name: 'Čokoládový Dort',
          price: 200.0,
          quantity: 1,
          vat: 21,
          discount_percent: 0,
          refunded_quantity: 0,
          remaining_quantity: 1
        }
      ]
    };

    posApi.fetchSaleByReceiptNumber.mockResolvedValue(mockSale);

    renderApp();

    // Verify app rendered on register
    expect(screen.getByText(/Nákupní košík/i)).toBeInTheDocument();

    // Simulate scanning receipt barcode 2026-000042
    simulateScannerInput('2026-000042');

    // Wait for RefundModal to open
    await waitFor(() => {
      expect(posApi.fetchSaleByReceiptNumber).toHaveBeenCalledWith('2026-000042');
    });

    // Verify RefundModal is visible with items & header badges
    expect(await screen.findByText(/Vratka \/ Storno Účtenky/i)).toBeInTheDocument();
    expect(screen.getByText(/Účtenka č\. #2026-000042/i)).toBeInTheDocument();
    expect(screen.getByText(/Monika K\./i)).toBeInTheDocument();
    expect(screen.getAllByText(/Hotovost/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Káva Cappuccino/i)).toBeInTheDocument();
    expect(screen.getByText(/Čokoládový Dort/i)).toBeInTheDocument();
  });

  it('supports 1-tap quick action buttons and processes partial refund end-to-end', async () => {
    const mockSale = {
      id: 'sale-test-456',
      receiptNumber: '2026-000088',
      receipt_number: '2026-000088',
      timestamp: '2026-09-06T15:00:00.000Z',
      cashierName: 'Honza T.',
      totalAmount: 300.0,
      total_amount: 300.0,
      paymentMethod: 'cash',
      items: [
        {
          id: 'item-tea',
          name: 'Zelený Čaj Sencha',
          price: 100.0,
          quantity: 3,
          vat: 21,
          refunded_quantity: 0,
          remaining_quantity: 3
        }
      ]
    };

    posApi.fetchSaleByReceiptNumber.mockResolvedValue(mockSale);

    renderApp();
    simulateScannerInput('2026-000088');

    expect(await screen.findByText(/Vratka \/ Storno Účtenky/i)).toBeInTheDocument();

    // Initially defaults to full refund (qty = 3, total = -300 Kč)
    expect(screen.getByText(/-300 Kč/i)).toBeInTheDocument();

    // Find quick action buttons: [- 1 ks], [+ 1 ks], [Vrátit vše]
    const minusBtn = screen.getByTitle('-1 ks');
    const plusBtn = screen.getByTitle('+1 ks');
    const returnAllBtn = screen.getByTitle('Vrátit vše');

    // Click minus once -> qty becomes 2, refund total becomes -200 Kč
    fireEvent.click(minusBtn);
    expect(screen.getByText(/-200 Kč/i)).toBeInTheDocument();

    // Click minus again -> qty becomes 1, refund total becomes -100 Kč
    fireEvent.click(minusBtn);
    expect(screen.getByText(/-100 Kč/i)).toBeInTheDocument();

    // Click plus once -> qty becomes 2, refund total becomes -200 Kč
    fireEvent.click(plusBtn);
    expect(screen.getByText(/-200 Kč/i)).toBeInTheDocument();

    // Click Return All -> qty becomes 3, refund total becomes -300 Kč
    fireEvent.click(returnAllBtn);
    expect(screen.getByText(/-300 Kč/i)).toBeInTheDocument();

    // Set to 1 unit for partial refund
    fireEvent.click(minusBtn);
    fireEvent.click(minusBtn);
    expect(screen.getByText(/-100 Kč/i)).toBeInTheDocument();

    // Submit refund
    const confirmBtn = screen.getByText(/Potvrdit vratku a vystavit storno doklad/i);
    fireEvent.click(confirmBtn);

    // Verify backend calls
    await waitFor(() => {
      expect(posApi.createSaleBackend).toHaveBeenCalled();
      expect(posApi.updateSaleRefundStatusBackend).toHaveBeenCalledWith(
        'sale-test-456',
        'PARTIAL',
        100.0
      );
    });
  });

  it('enforces maximum refundable quantity limit and displays remaining refundable indicator', async () => {
    const mockSale = {
      id: 'sale-test-789',
      receiptNumber: '2026-000100',
      receipt_number: '2026-000100',
      timestamp: '2026-09-06T16:00:00.000Z',
      totalAmount: 200.0,
      paymentMethod: 'card',
      items: [
        {
          id: 'item-pie',
          name: 'Jablečný Koláč',
          price: 100.0,
          quantity: 2,
          vat: 21,
          refunded_quantity: 1,
          remaining_quantity: 1
        }
      ]
    };

    posApi.fetchSaleByReceiptNumber.mockResolvedValue(mockSale);

    renderApp();
    simulateScannerInput('2026-000100');

    expect(await screen.findByText(/Vratka \/ Storno Účtenky/i)).toBeInTheDocument();

    // Visual indicators
    expect(screen.getByText(/\(vráceno 1 ks\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Zbývá k vrácení: 1 ks/i)).toBeInTheDocument();

    // Plus button should be disabled because max refundable is 1
    const plusBtn = screen.getByTitle('+1 ks');
    expect(plusBtn).toBeDisabled();
  });

  it('displays already fully refunded warning banner and disables confirmation', async () => {
    const mockSale = {
      id: 'sale-fully-refunded',
      receiptNumber: '2026-000999',
      receipt_number: '2026-000999',
      timestamp: '2026-09-06T17:00:00.000Z',
      totalAmount: 150.0,
      paymentMethod: 'cash',
      items: [
        {
          id: 'item-espresso',
          name: 'Espresso',
          price: 50.0,
          quantity: 3,
          vat: 21,
          refunded_quantity: 3,
          remaining_quantity: 0
        }
      ]
    };

    posApi.fetchSaleByReceiptNumber.mockResolvedValue(mockSale);

    renderApp();
    simulateScannerInput('2026-000999');

    expect(await screen.findByText(/Vratka \/ Storno Účtenky/i)).toBeInTheDocument();
    expect(screen.getByText(/Všechny položky na této účtence již byly kompletně vráceny/i)).toBeInTheDocument();

    const confirmBtn = screen.getByText(/Potvrdit vratku a vystavit storno doklad/i).closest('button');
    expect(confirmBtn).toBeDisabled();
  });

  it('handles not found receipt gracefully without crash', async () => {
    posApi.fetchSaleByReceiptNumber.mockResolvedValue(null);

    renderApp();

    simulateScannerInput('2026-999999');

    await waitFor(() => {
      expect(posApi.fetchSaleByReceiptNumber).toHaveBeenCalledWith('2026-999999');
    });

    // Refund modal should NOT be in DOM
    expect(screen.queryByText(/Vratka \/ Storno Účtenky/i)).not.toBeInTheDocument();
  });
});

