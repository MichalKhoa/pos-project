import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PaymentModal from '../components/PaymentModal';
import ReceiptModal from '../components/ReceiptModal';
import PresetModal from '../components/PresetModal';
import AdminPinModal from '../components/AdminPinModal';
import DiscountModal from '../components/DiscountModal';
import { LanguageProvider } from '../i18n/LanguageContext';
import { DEFAULT_STORE_CONFIG } from '../data/initialData';

// Mock posApi
vi.mock('../api/posApi', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    verifyPinBackend: vi.fn().mockResolvedValue({ valid: true }),
    printReceiptBackend: vi.fn().mockResolvedValue({ status: 'PRINTED' })
  };
});

function wrapWithLanguage(ui) {
  return render(
    <LanguageProvider>
      {ui}
    </LanguageProvider>
  );
}

describe('Modals & Dialog Component Tests', () => {
  describe('PaymentModal', () => {
    it('renders CashPaymentPanel by default with quick denomination buttons and change calculation', () => {
      const onCompleteSale = vi.fn();
      wrapWithLanguage(
        <PaymentModal
          isOpen={true}
          totalAmount={450}
          initialMethod="cash"
          storeConfig={DEFAULT_STORE_CONFIG}
          onClose={() => {}}
          onCompleteSale={onCompleteSale}
        />
      );

      // Verify payment modal title
      expect(screen.getByText(/Platba Prodeje/i)).toBeInTheDocument();

      // Verify payment methods tabs are present
      expect(screen.getAllByText(/Hotovost/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Karta/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/QR Platba/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Kombinovaná/i).length).toBeGreaterThanOrEqual(1);

      // Click exact amount button (Přesně)
      const exactBtn = screen.getByRole('button', { name: /^Přesně \(/i });
      fireEvent.click(exactBtn);

      // Click complete sale button
      const completeBtn = screen.getByRole('button', { name: /Dokončit prodej/i });
      expect(completeBtn).toBeEnabled();
      fireEvent.click(completeBtn);

      expect(onCompleteSale).toHaveBeenCalledWith(expect.objectContaining({
        method: 'cash',
        tendered: 450,
        change: 0
      }));
    });

    it('allows instant 1-click completion as exact amount without entering tendered cash', () => {
      const onCompleteSale = vi.fn();
      wrapWithLanguage(
        <PaymentModal
          isOpen={true}
          totalAmount={250}
          initialMethod="cash"
          storeConfig={DEFAULT_STORE_CONFIG}
          onClose={() => {}}
          onCompleteSale={onCompleteSale}
        />
      );

      // Complete button is immediately enabled for fast checkout
      const completeBtn = screen.getByRole('button', { name: /Dokončit prodej — Přesně/i });
      expect(completeBtn).toBeEnabled();
      fireEvent.click(completeBtn);

      expect(onCompleteSale).toHaveBeenCalledWith(expect.objectContaining({
        method: 'cash',
        tendered: 250,
        change: 0
      }));
    });

    it('switches between Card, QR, and Split payment tabs cleanly', () => {
      wrapWithLanguage(
        <PaymentModal
          isOpen={true}
          totalAmount={300}
          initialMethod="cash"
          storeConfig={DEFAULT_STORE_CONFIG}
          onClose={() => {}}
          onCompleteSale={() => {}}
        />
      );

      // Switch to Card tab
      const cardTabs = screen.getAllByText(/Karta/i);
      fireEvent.click(cardTabs[0]);
      expect(screen.getAllByText(/Karta/i).length).toBeGreaterThanOrEqual(1);

      // Switch to QR tab
      const qrTabs = screen.getAllByText(/QR Platba/i);
      fireEvent.click(qrTabs[0]);
      expect(screen.getAllByText(/QR/i).length).toBeGreaterThanOrEqual(1);

      // Switch to Split tab
      const splitTabs = screen.getAllByText(/Kombinovaná/i);
      fireEvent.click(splitTabs[0]);
      expect(screen.getAllByText(/Kombinovaná/i).length).toBeGreaterThanOrEqual(1);
    });

    it('renders offline QR code image with data URL and completes QR sale', () => {
      const onCompleteSale = vi.fn();
      wrapWithLanguage(
        <PaymentModal
          isOpen={true}
          totalAmount={520}
          initialMethod="qr"
          storeConfig={DEFAULT_STORE_CONFIG}
          onClose={() => {}}
          onCompleteSale={onCompleteSale}
        />
      );

      // Verify QR code image is rendered with a valid SVG data URL
      const qrImage = screen.getByAltText(/QR Platba SPD/i);
      expect(qrImage).toBeInTheDocument();
      expect(qrImage.getAttribute('src')).toMatch(/^data:image\/svg\+xml/);

      // Click confirm QR payment button
      const confirmBtn = screen.getByRole('button', { name: /Potvrdit Přijatou QR Platbu/i });
      expect(confirmBtn).toBeInTheDocument();
      fireEvent.click(confirmBtn);

      expect(onCompleteSale).toHaveBeenCalledWith(expect.objectContaining({
        method: 'qr',
        tendered: 520,
        change: 0
      }));
    });
  });

  describe('ReceiptModal', () => {
    const sampleSale = {
      receiptNumber: '2026-0001',
      totalAmount: 350,
      paymentMethod: 'cash',
      tenderedAmount: 500,
      changeDue: 150,
      timestamp: new Date().toISOString(),
      items: [
        { id: '1', name: 'Tričko VoltFlow', price: 350, quantity: 1, vat: 21 }
      ],
      taxSummary: {
        '21': { rate: 21, net: 289.26, tax: 60.74, gross: 350 }
      }
    };

    it('renders visual receipt paper with items, tax recapitulation, and buttons', () => {
      const onNewSale = vi.fn();
      wrapWithLanguage(
        <ReceiptModal
          saleData={sampleSale}
          storeConfig={DEFAULT_STORE_CONFIG}
          onClose={() => {}}
          onNewSale={onNewSale}
          disableAutoPrint={true}
        />
      );

      // Verify receipt title and number
      expect(screen.getByText(/DAŇOVÝ DOKLAD č\. 2026-0001/i)).toBeInTheDocument();
      expect(screen.getByText(/Tričko VoltFlow/i)).toBeInTheDocument();
      expect(screen.getAllByText(/350/i).length).toBeGreaterThanOrEqual(1);

      // Verify print and new sale buttons
      const newSaleBtn = screen.getByRole('button', { name: /Nový Prodej/i });
      expect(newSaleBtn).toBeInTheDocument();
      fireEvent.click(newSaleBtn);
      expect(onNewSale).toHaveBeenCalledTimes(1);
    });
  });

  describe('PresetModal', () => {
    it('renders form and saves a new item preset with color, vat, and price', () => {
      const onSave = vi.fn();
      wrapWithLanguage(
        <PresetModal
          isOpen={true}
          mode="add"
          categories={[{ id: 'cat-1', name: 'Nápoje' }]}
          onClose={() => {}}
          onSave={onSave}
        />
      );

      // Fill preset name
      const nameInput = screen.getByPlaceholderText('...');
      fireEvent.change(nameInput, { target: { value: 'Káva Espresso' } });

      // Switch to fixed price
      const fixedPriceBtn = screen.getByRole('button', { name: /Pevná cena/i });
      fireEvent.click(fixedPriceBtn);

      // Fill price
      const priceInput = screen.getByPlaceholderText('250');
      fireEvent.change(priceInput, { target: { value: '65' } });

      // Submit form
      const saveBtn = screen.getByRole('button', { name: /Přidat Novou Položku/i });
      fireEvent.click(saveBtn);

      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Káva Espresso',
        price: 65,
        vat: 21,
        isOpenPrice: false
      }));
    });

    it('saves new preset with default open price and store default VAT', () => {
      const onSave = vi.fn();
      wrapWithLanguage(
        <PresetModal
          isOpen={true}
          mode="add"
          categories={[{ id: 'cat-1', name: 'Oblečení' }]}
          storeConfig={{ defaultVat: 12 }}
          onClose={() => {}}
          onSave={onSave}
        />
      );

      const nameInput = screen.getByPlaceholderText('...');
      fireEvent.change(nameInput, { target: { value: 'Bunda dámská' } });

      const saveBtn = screen.getByRole('button', { name: /Přidat Novou Položku/i });
      fireEvent.click(saveBtn);

      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Bunda dámská',
        price: 0,
        isOpenPrice: true,
        vat: 12,
        trackStock: false
      }));
    });
  });

  describe('AdminPinModal', () => {
    it('validates entered PIN and accepts correct PIN code', async () => {
      const onSuccess = vi.fn();
      wrapWithLanguage(
        <AdminPinModal
          mode="VERIFY"
          storeConfig={{ ...DEFAULT_STORE_CONFIG, cashierPin: '1234' }}
          onClose={() => {}}
          onSuccess={onSuccess}
        />
      );

      // Enter digits 1, 2, 3, 4
      fireEvent.click(screen.getByRole('button', { name: '1' }));
      fireEvent.click(screen.getByRole('button', { name: '2' }));
      fireEvent.click(screen.getByRole('button', { name: '3' }));
      fireEvent.click(screen.getByRole('button', { name: '4' }));

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith('1234');
      });
    });
  });

  describe('DiscountModal', () => {
    it('applies quick discount percentage when numpad is used', () => {
      const onApply = vi.fn();
      wrapWithLanguage(
        <DiscountModal
          isOpen={true}
          totalAmount={200}
          onClose={() => {}}
          onApplyDiscount={onApply}
        />
      );

      // Click digit 1 then digit 5 (15%)
      const num1 = screen.getByRole('button', { name: '1' });
      const num5 = screen.getByRole('button', { name: '5' });
      fireEvent.click(num1);
      fireEvent.click(num5);

      // Click Aplikovat slevu
      const confirmBtn = screen.getByRole('button', { name: /Aplikovat slevu/i });
      fireEvent.click(confirmBtn);

      expect(onApply).toHaveBeenCalledWith(expect.objectContaining({
        type: 'percent',
        value: 15
      }));
    });
  });
});
