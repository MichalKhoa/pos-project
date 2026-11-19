import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RefundModal from '../components/RefundModal';
import { LanguageProvider } from '../i18n/LanguageContext';
import { ConfirmProvider } from '../context/ConfirmContext';

function renderRefundModal(props) {
  return render(
    <LanguageProvider>
      <ConfirmProvider>
        <RefundModal
          onClose={vi.fn()}
          onConfirmRefund={vi.fn()}
          {...props}
        />
      </ConfirmProvider>
    </LanguageProvider>
  );
}

describe('RefundModal', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when sale prop is null', () => {
    const { container } = renderRefundModal({ sale: null });
    expect(container.firstChild).toBeNull();
  });

  it('enforces remaining refundable quantity cap and shows already-fully-refunded state', () => {
    const partialSale = {
      id: 'sale-part',
      receiptNumber: '2026-000010',
      totalAmount: 300,
      paymentMethod: 'cash',
      items: [{ id: 'p1', name: 'Káva', price: 100, quantity: 3, refunded_quantity: 2, vat: 21 }]
    };

    const { unmount } = renderRefundModal({ sale: partialSale });
    expect(screen.getByText(/Zbývá k vrácení: 1 ks/)).toBeInTheDocument();
    expect(screen.getByText(/\(vráceno 2 ks\)/)).toBeInTheDocument();
    expect(screen.getByTitle('+1 ks')).toBeDisabled();
    expect(screen.getByTitle('-1 ks')).not.toBeDisabled();
    unmount();

    const exhaustedSale = {
      id: 'sale-done',
      receiptNumber: '2026-000011',
      totalAmount: 200,
      paymentMethod: 'card',
      items: [{ id: 'p2', name: 'Čaj', price: 100, quantity: 2, remaining_quantity: 0, vat: 12 }]
    };
    renderRefundModal({ sale: exhaustedSale });
    expect(screen.getByText(/Všechny položky na této účtence již byly kompletně vráceny/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Kompletní storno/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Částečná vratka/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Potvrdit vratku/i })).toBeDisabled();
  });

  it('partial stepper adjusts quantity, switches mode, computes discounted total + VAT summary, and restores via full mode', () => {
    const onConfirmRefund = vi.fn();
    const sale = {
      id: 'sale-vat',
      receiptNumber: '2026-000012',
      totalAmount: 207,
      cartDiscountPercent: 10,
      paymentMethod: 'cash',
      items: [
        { id: 'i1', name: 'Položka 21%', price: 100, quantity: 2, vat: 21, discountPercent: 10 },
        { id: 'i2', name: 'Položka 12%', price: 50, quantity: 1, vat: 12, discountPercent: 0 }
      ]
    };

    renderRefundModal({ sale, onConfirmRefund });

    fireEvent.click(screen.getAllByTitle('-1 ks')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Potvrdit vratku/i }));

    expect(onConfirmRefund).toHaveBeenCalledTimes(1);
    const partialPayload = onConfirmRefund.mock.calls[0][0];
    expect(partialPayload.isFullRefund).toBe(false);
    expect(partialPayload.returnedItems).toHaveLength(2);
    expect(partialPayload.returnedItems[0]).toMatchObject({ id: 'i1', quantityToReturn: 1, lineTotal: 90 });
    expect(partialPayload.returnedItems[1]).toMatchObject({ id: 'i2', quantityToReturn: 1, lineTotal: 50 });
    expect(partialPayload.totalRefundAmount).toBeCloseTo(126, 5);

    const vat21 = partialPayload.refundTaxSummary[21];
    const vat12 = partialPayload.refundTaxSummary[12];
    expect(vat21.gross).toBeCloseTo(81, 5);
    expect(vat21.net + vat21.tax).toBeCloseTo(vat21.gross, 5);
    expect(vat12.gross).toBeCloseTo(45, 5);
    expect(vat12.net + vat12.tax).toBeCloseTo(vat12.gross, 5);

    fireEvent.click(screen.getByRole('button', { name: /Kompletní storno/i }));
    fireEvent.click(screen.getByRole('button', { name: /Potvrdit vratku/i }));

    const fullPayload = onConfirmRefund.mock.calls[1][0];
    expect(fullPayload.isFullRefund).toBe(true);
    expect(fullPayload.returnedItems[0].quantityToReturn).toBe(2);
  });

  it('disables confirm when all quantities decremented to zero', () => {
    const sale = {
      id: 'sale-zero',
      receiptNumber: '2026-000013',
      totalAmount: 50,
      paymentMethod: 'cash',
      items: [{ id: 'i1', name: 'Rohlík', price: 50, quantity: 1, vat: 12 }]
    };

    renderRefundModal({ sale });
    fireEvent.click(screen.getByTitle('-1 ks'));
    expect(screen.getByRole('button', { name: /Potvrdit vratku/i })).toBeDisabled();
  });

  it('handles custom reason preset fallback/input, payment method switch, and damaged-waste restock toggle', () => {
    const onConfirmRefund = vi.fn();
    const sale = {
      id: 'sale-opts',
      receiptNumber: '2026-000014',
      totalAmount: 100,
      paymentMethod: 'cash',
      items: [{ id: 'i1', name: 'Hrnek', price: 100, quantity: 1, vat: 21 }]
    };

    renderRefundModal({ sale, onConfirmRefund });

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Jiné (vlastní popis)' } });
    const customInput = screen.getByPlaceholderText('Specific reason...');
    expect(customInput).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Potvrdit vratku/i }));
    expect(onConfirmRefund.mock.calls[0][0].refundReason).toBe('Storno prodeje');

    fireEvent.change(customInput, { target: { value: '  Rozbitý obal  ' } });
    fireEvent.click(screen.getByRole('button', { name: /Karta/i }));
    fireEvent.click(screen.getByLabelText(/Poškozeno \/ Likvidace/i));
    fireEvent.click(screen.getByRole('button', { name: /Potvrdit vratku/i }));

    expect(onConfirmRefund.mock.calls[1][0]).toMatchObject({
      refundReason: 'Rozbitý obal',
      paymentMethod: 'card',
      restock: false
    });
  });
});
