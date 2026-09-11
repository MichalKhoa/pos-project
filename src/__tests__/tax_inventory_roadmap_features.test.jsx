import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PhysicalInventoryModal from '../components/inventory/PhysicalInventoryModal';
import DepositPackagingModal from '../components/inventory/DepositPackagingModal';
import TaxReportsModal from '../components/inventory/TaxReportsModal';
import PaymentModal from '../components/PaymentModal';
import ReceiptModal from '../components/ReceiptModal';
import { LanguageProvider } from '../i18n/LanguageContext';
import * as posApi from '../api/posApi';

vi.mock('../api/posApi', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    lookupAres: vi.fn(),
    printReceiptBackend: vi.fn().mockResolvedValue({ status: 'PRINTED', physical: true })
  };
});

describe('Roadmap 1.1 to 1.4 Frontend Feature Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe('Task 1.1: Physical Inventory Modal (§ 29, 30 ZoÚ)', () => {
    const mockPresets = [
      { id: 'item-1', name: 'Pilsner Urquell 0.5l', barcode: '8594001', stockQuantity: 20, costPrice: 25, price: 35, unit: 'ks' },
      { id: 'item-2', name: 'Rohlík tukový', barcode: '8594002', stockQuantity: 50, costPrice: 2, price: 3, unit: 'ks' }
    ];

    it('renders audit count sheet and handles item counting', async () => {
      render(
        <LanguageProvider>
          <PhysicalInventoryModal
            isOpen={true}
            onClose={vi.fn()}
            presets={mockPresets}
          />
        </LanguageProvider>
      );

      expect(screen.getByText(/Fyzická inventura skladu k 31\. 12\./i)).toBeInTheDocument();
      const scanInput = screen.getByPlaceholderText(/Pípněte čárový kód/i);
      expect(scanInput).toBeInTheDocument();

      // Scan Pilsner Urquell by barcode
      fireEvent.change(scanInput, { target: { value: '8594001' } });
      fireEvent.keyDown(scanInput, { key: 'Enter', code: 'Enter' });

      expect(screen.getByText(/Pilsner Urquell 0\.5l/i)).toBeInTheDocument();
    });

    it('submits audit reconciliation to backend and prints ESC/POS protocol', async () => {
      const mockProtocol = {
        id: 1,
        protocol_number: 'INV-2026-0001',
        audit_number: 'INV-2026-0001',
        total_items_counted: 1,
        total_surplus_value: 50.0,
        total_shortage_value: 0.0,
        net_discrepancy_value: 50.0,
        audit_date: '2026-12-31T20:00:00',
        responsible_person: 'Vedoucí skladu',
        items: []
      };

      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('/api/v1/inventory/audit')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockProtocol)
          });
        }
        if (url.includes('/api/v1/printer/print-inventory')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ status: 'PRINTED' })
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      const onAuditCompleted = vi.fn();

      render(
        <LanguageProvider>
          <PhysicalInventoryModal
            isOpen={true}
            onClose={vi.fn()}
            presets={mockPresets}
            onAuditCompleted={onAuditCompleted}
          />
        </LanguageProvider>
      );

      // Scan Pilsner Urquell
      const scanInput = screen.getByPlaceholderText(/Pípněte čárový kód/i);
      fireEvent.change(scanInput, { target: { value: '8594001' } });
      fireEvent.keyDown(scanInput, { key: 'Enter', code: 'Enter' });

      // Change counted quantity from 21 to 22 (+2 surplus)
      const inputs = screen.getAllByRole('spinbutton');
      fireEvent.change(inputs[0], { target: { value: '22' } });

      // Click Uzavřít a narovnat sklad
      const reconcileBtn = screen.getByRole('button', { name: /Uzavřít a narovnat sklad/i });
      fireEvent.click(reconcileBtn);

      // Confirm dialog button
      const confirmBtn = await screen.findByRole('button', { name: /Ano, zúčtovat sklad/i });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(onAuditCompleted).toHaveBeenCalledWith(mockProtocol);
        expect(screen.getByText(/Inventura úspěšně zaúčtována!/i)).toBeInTheDocument();
        expect(screen.getByText(/INV-2026-0001/i)).toBeInTheDocument();
      });

      // Test printing protocol
      const printBtn = screen.getByRole('button', { name: /Vytisknout.*protokol/i });
      fireEvent.click(printBtn);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/v1/printer/print-inventory',
          expect.objectContaining({ method: 'POST' })
        );
      });
    });
  });

  describe('Task 1.4: Returnable Deposit Packaging Modal', () => {
    it('fetches deposit balances and displays bottles and crates', async () => {
      const mockSummary = {
        total_locked_deposit_value: 360.0,
        total_deposit_locked_value: 360.0,
        balances: [
          { container_type: 'BOTTLE_3CZK', container_name: 'Pivní lahev 0,5l', deposit_value: 3.0, current_quantity: 20, total_deposit_value: 60.0 },
          { container_type: 'CRATE_100CZK', container_name: 'Přepravka / Basa', deposit_value: 100.0, current_quantity: 3, total_deposit_value: 300.0 }
        ],
        recent_movements: []
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSummary)
      });

      render(
        <LanguageProvider>
          <DepositPackagingModal isOpen={true} onClose={vi.fn()} />
        </LanguageProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/360\.00 Kč/i)).toBeInTheDocument();
        expect(screen.getByText(/Pivní lahev 0,5l/i)).toBeInTheDocument();
        expect(screen.getByText(/Přepravka \/ Basa/i)).toBeInTheDocument();
      });
    });

    it('records a supplier intake movement', async () => {
      const mockSummary = {
        total_locked_deposit_value: 0.0,
        total_deposit_locked_value: 0.0,
        balances: [
          { container_type: 'BOTTLE_3CZK', name: 'Pivní lahev 0,5l', deposit_amount: 3.0, current_quantity: 0, total_deposit_value: 0.0 }
        ],
        recent_movements: []
      };

      global.fetch = vi.fn().mockImplementation((url, opts) => {
        if (opts?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ id: 1, quantity: 40 })
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockSummary)
        });
      });

      render(
        <LanguageProvider>
          <DepositPackagingModal isOpen={true} onClose={vi.fn()} />
        </LanguageProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/Pivní lahev 0,5l/i)).toBeInTheDocument();
      });

      // Click + Příjem z pivovaru button
      const intakeActionBtn = screen.getByRole('button', { name: /\+ Příjem z pivovaru/i });
      fireEvent.click(intakeActionBtn);

      // Form appears
      expect(screen.getByText(/Příjem obalů z dodacího listu pivovaru/i)).toBeInTheDocument();

      // Enter quantity
      const qtyInput = screen.getByPlaceholderText(/Např\. 20/i);
      fireEvent.change(qtyInput, { target: { value: '40' } });

      // Submit form
      const saveBtn = screen.getByRole('button', { name: /Uložit pohyb/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/v1/inventory/deposits/movement',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('"quantity":40')
          })
        );
      });
    });
  });

  describe('Task 1.2: Tax Reports Modal (DPFO & DPH)', () => {
    it('fetches and displays DPFO tax statement and inventory valuation', async () => {
      const mockTaxStatement = {
        year: 2026,
        revenue: { total_sales: 120000.0, total_refunds: 2000.0, net_revenue: 118000.0 },
        expenses: { goods_intake_expenses: 60000.0, cash_payouts_expenses: 5000.0, total_deductible_expenses: 65000.0 },
        inventory_valuation: {
          opening_inventory_date: '2026-01-01',
          opening_inventory_valuation: 40000.0,
          closing_inventory_date: '2026-12-31',
          closing_inventory_valuation: 45000.0,
          inventory_difference: 5000.0
        },
        operating_profit_tax_base: 53000.0,
        tax_statement_date: '2026-12-31T23:59:59'
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockTaxStatement)
      });

      render(
        <LanguageProvider>
          <TaxReportsModal isOpen={true} onClose={vi.fn()} />
        </LanguageProvider>
      );

      await screen.findByText(/Zdanitelné příjmy/i);
      expect(screen.getByText(/Tabulka D: Stav zásob/i)).toBeInTheDocument();
      expect(screen.getByText(/Daňově uznatelné výdaje/i)).toBeInTheDocument();
      expect(screen.getByText(/Dílčí základ daně/i)).toBeInTheDocument();
    });

    it('switches to VAT tab and displays VAT rate matrix', async () => {
      const mockVatOverview = {
        year: 2026,
        period: 'FULL_YEAR',
        rates: {
          '21%': { base: 100000.0, vat: 21000.0 },
          '12%': { base: 20000.0, vat: 2400.0 },
          '0%': { base: 5000.0, vat: 0.0 }
        },
        total_base: 125000.0,
        total_vat: 23400.0,
        total_gross: 148400.0
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockVatOverview)
      });

      render(
        <LanguageProvider>
          <TaxReportsModal isOpen={true} onClose={vi.fn()} />
        </LanguageProvider>
      );

      // Click VAT tab
      const vatTabBtn = screen.getByRole('button', { name: /Přehled DPH/i });
      fireEvent.click(vatTabBtn);

      await waitFor(() => {
        expect(screen.getByText(/Rozpis DPH podle sazeb/i)).toBeInTheDocument();
        expect(screen.getByText(/Sazba 21%/i)).toBeInTheDocument();
        expect(screen.getByText(/Sazba 12%/i)).toBeInTheDocument();
      });
    });
  });

  describe('Task 1.3: B2B Invoicing in PaymentModal & ReceiptModal', () => {
    it('toggles B2B invoice drawer and prefills customer data from ARES', async () => {
      posApi.lookupAres.mockResolvedValue({
        ico: '12345678',
        dic: 'CZ12345678',
        obchodni_jmeno: 'ACME Corp s.r.o.',
        full_address: 'Průmyslová 5, 100 00 Praha 10',
        platce_dph: true
      });

      const onCompleteSale = vi.fn();

      render(
        <LanguageProvider>
          <PaymentModal
            method="cash"
            totalAmount={15000}
            storeConfig={{}}
            onClose={vi.fn()}
            onCompleteSale={onCompleteSale}
          />
        </LanguageProvider>
      );

      // B2B toggle button
      const b2bToggle = screen.getByRole('button', { name: /Firemní faktura/i });
      fireEvent.click(b2bToggle);

      // IČO input appears
      const icoInput = screen.getByPlaceholderText('12345678');
      fireEvent.change(icoInput, { target: { value: '12345678' } });

      // Click ARES button
      const aresBtn = screen.getByRole('button', { name: /ARES/i });
      fireEvent.click(aresBtn);

      await waitFor(() => {
        expect(posApi.lookupAres).toHaveBeenCalledWith('12345678');
        expect(screen.getByDisplayValue('ACME Corp s.r.o.')).toBeInTheDocument();
        expect(screen.getByDisplayValue('CZ12345678')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Průmyslová 5, 100 00 Praha 10')).toBeInTheDocument();
      });

      // Complete payment
      const completeBtn = screen.getByRole('button', { name: /Dokončit bez tisku/i });
      fireEvent.click(completeBtn);

      expect(onCompleteSale).toHaveBeenCalledWith(
        expect.objectContaining({
          isInvoice: true,
          is_invoice: true,
          customerIco: '12345678',
          customerDic: 'CZ12345678',
          customerName: 'ACME Corp s.r.o.',
          customerAddress: 'Průmyslová 5, 100 00 Praha 10'
        })
      );
    });

    it('ReceiptModal shows A4 invoice button when sale is invoice', () => {
      const mockInvoiceSale = {
        id: 'sale-inv-1',
        receiptNumber: '2026-000001',
        invoiceNumber: 'FA-2026-0001',
        invoice_number: 'FA-2026-0001',
        isInvoice: true,
        is_invoice: true,
        customerName: 'ACME Corp s.r.o.',
        customerIco: '12345678',
        totalAmount: 15000,
        timestamp: new Date().toISOString(),
        items: [{ id: '1', name: 'Zboží', price: 15000, quantity: 1, vat: 21 }]
      };

      const originalOpen = window.open;
      window.open = vi.fn();

      render(
        <LanguageProvider>
          <ReceiptModal
            saleData={mockInvoiceSale}
            storeConfig={{}}
            onClose={vi.fn()}
            onNewSale={vi.fn()}
            disableAutoPrint={true}
          />
        </LanguageProvider>
      );

      expect(screen.getAllByText(/FA-2026-0001/i).length).toBeGreaterThan(0);

      const a4Btn = screen.getByRole('button', { name: /Tisknout A4 Fakturu/i });
      expect(a4Btn).toBeInTheDocument();

      fireEvent.click(a4Btn);
      expect(window.open).toHaveBeenCalledWith(
        '/api/v1/sales/sale-inv-1/invoice-html',
        '_blank'
      );

      window.open = originalOpen;
    });
  });
});
