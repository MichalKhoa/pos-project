import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LanguageProvider } from '../i18n/LanguageContext.jsx';
import { StoreConfigProvider } from '../context/StoreConfigContext.jsx';
import { ConfirmProvider } from '../context/ConfirmContext.jsx';
import Navbar from '../components/Navbar.jsx';
import PresetModal from '../components/PresetModal.jsx';
import PriceCheckModal from '../components/PriceCheckModal.jsx';
import RefundModal from '../components/RefundModal.jsx';
import LayoutSection from '../components/settings/LayoutSection.jsx';
import StoreProfileSection from '../components/settings/StoreProfileSection.jsx';

function renderWithProviders(ui) {
  localStorage.setItem('lang', 'cs');
  return render(
    <LanguageProvider>
      <StoreConfigProvider>
        <ConfirmProvider>
          {ui}
        </ConfirmProvider>
      </StoreConfigProvider>
    </LanguageProvider>
  );
}

describe('Inventory Feature Toggle', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('Navbar hides Inventory tab when inventoryEnabled is false and shows it when true', () => {
    const baseProps = {
      activeTab: 'register',
      setActiveTab: vi.fn(),
      isAdminMode: false,
      onToggleAdminMode: vi.fn(),
      pendingCount: 0,
      onOpenSyncModal: vi.fn(),
      unsentCount: 0,
      onOpenUnsentSales: vi.fn(),
      onOpenShutdownModal: vi.fn(),
      onOpenCalendarModal: vi.fn(),
      onLockApp: vi.fn(),
      onOpenCashDrawer: vi.fn(),
      onPrintDailySummary: vi.fn()
    };

    const { rerender } = renderWithProviders(
      <Navbar {...baseProps} storeConfig={{ inventoryEnabled: false }} />
    );
    expect(screen.queryByText('Sklad')).toBeNull();

    rerender(
      <LanguageProvider>
        <StoreConfigProvider>
          <ConfirmProvider>
            <Navbar {...baseProps} storeConfig={{ inventoryEnabled: true }} />
          </ConfirmProvider>
        </StoreConfigProvider>
      </LanguageProvider>
    );
    expect(screen.getByText('Sklad')).toBeInTheDocument();
  });

  it('PresetModal hides stock tracking and cost/margin fields when inventoryEnabled is false', () => {
    const { rerender } = renderWithProviders(
      <PresetModal
        isOpen={true}
        mode="add"
        categories={[{ id: 'all', name: 'Vše' }]}
        onClose={vi.fn()}
        onSave={vi.fn()}
        storeConfig={{ inventoryEnabled: false }}
      />
    );

    expect(screen.queryByText(/Sledovat skladovou zásobu/i)).toBeNull();
    expect(screen.queryByText(/Nákupní cena bez DPH/i)).toBeNull();
    expect(screen.queryByText(/Koeficient marže/i)).toBeNull();

    rerender(
      <LanguageProvider>
        <StoreConfigProvider>
          <ConfirmProvider>
            <PresetModal
              isOpen={true}
              mode="add"
              categories={[{ id: 'all', name: 'Vše' }]}
              onClose={vi.fn()}
              onSave={vi.fn()}
              storeConfig={{ inventoryEnabled: true }}
            />
          </ConfirmProvider>
        </StoreConfigProvider>
      </LanguageProvider>
    );

    expect(screen.getByText(/Sledovat skladovou zásobu/i)).toBeInTheDocument();
    expect(screen.getByText(/Nákupní cena bez DPH/i)).toBeInTheDocument();
    expect(screen.getByText(/Koeficient marže/i)).toBeInTheDocument();
  });

  it('PriceCheckModal hides stock level when inventoryEnabled is false', () => {
    const item = {
      id: 'p1',
      name: 'Káva',
      price: 55,
      vat: 21,
      trackStock: true,
      stockQuantity: 12
    };

    const { rerender } = renderWithProviders(
      <PriceCheckModal
        item={item}
        storeConfig={{ inventoryEnabled: false }}
        onClose={vi.fn()}
      />
    );
    expect(screen.queryByText(/12 ks/i)).toBeNull();

    rerender(
      <LanguageProvider>
        <StoreConfigProvider>
          <ConfirmProvider>
            <PriceCheckModal
              item={item}
              storeConfig={{ inventoryEnabled: true }}
              onClose={vi.fn()}
            />
          </ConfirmProvider>
        </StoreConfigProvider>
      </LanguageProvider>
    );
    expect(screen.getByText(/12 ks/i)).toBeInTheDocument();
  });

  it('RefundModal hides damaged/restock checkbox and sends restock: false when inventoryEnabled is false', () => {
    const onConfirmRefund = vi.fn();
    const sale = {
      id: 's1',
      receiptNumber: '2026-000001',
      totalAmount: 100,
      paymentMethod: 'cash',
      items: [{ id: 'p1', name: 'Káva', price: 100, quantity: 1, vat: 21 }]
    };

    renderWithProviders(
      <RefundModal
        sale={sale}
        storeConfig={{ inventoryEnabled: false }}
        onClose={vi.fn()}
        onConfirmRefund={onConfirmRefund}
      />
    );

    expect(screen.queryByLabelText(/Nenaskladňovat položky zpět do skladu/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Vystavit storno/i }));
    expect(onConfirmRefund).toHaveBeenCalledTimes(1);
    expect(onConfirmRefund.mock.calls[0][0].restock).toBe(false);
  });

  it('LayoutSection toggles inventoryEnabled and StoreProfileSection hides defaultMarginCoefficient when disabled', () => {
    const saveConfigBatch = vi.fn();
    renderWithProviders(
      <LayoutSection
        config={{ inventoryEnabled: false }}
        setConfig={vi.fn()}
        saveConfigBatch={saveConfigBatch}
      />
    );

    const toggleLabel = screen.getByText(/Skladové hospodářství/i);
    const row = toggleLabel.closest('.settings-toggle-row');
    const checkbox = row.querySelector('input[type="checkbox"]');
    expect(checkbox.checked).toBe(false);
    fireEvent.click(checkbox);
    expect(saveConfigBatch).toHaveBeenCalledWith({ inventoryEnabled: true });

    renderWithProviders(
      <StoreProfileSection
        config={{ inventoryEnabled: false }}
        setConfig={vi.fn()}
        saveConfigField={vi.fn()}
      />
    );
    expect(screen.queryByText(/Výchozí přirážkový koeficient marže/i)).toBeNull();
  });
});
