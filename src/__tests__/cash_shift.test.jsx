import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CashDrawerMovementModal from '../components/cash/CashDrawerMovementModal';
import ZReportModal from '../components/cash/ZReportModal';
import { LanguageProvider } from '../i18n/LanguageContext';
import * as posApi from '../api/posApi';

vi.mock('../api/posApi', () => ({
  getCurrentShift: vi.fn(),
  recordCashMovement: vi.fn(),
  closeShift: vi.fn(),
  printCashMovementSlip: vi.fn(),
  printZReport: vi.fn()
}));

describe('Cash Drawer & Shift Management Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('CashDrawerMovementModal', () => {
    it('renders correctly and allows entering amount and selecting reason preset', async () => {
      const handleClose = vi.fn();
      const handleRecorded = vi.fn();

      posApi.recordCashMovement.mockResolvedValueOnce({
        status: 'CREATED',
        movement: { id: 'mov-1', movement_type: 'FLOAT_IN', amount: 500, reason: 'Ranní vklad' },
        shift: { expected_cash: 500, shift_number: 1 }
      });
      posApi.printCashMovementSlip.mockResolvedValueOnce({ success: true });

      render(
        <LanguageProvider>
          <CashDrawerMovementModal
            isOpen={true}
            onClose={handleClose}
            onMovementRecorded={handleRecorded}
            currentShift={{ shift_number: 1, expected_cash: 0 }}
          />
        </LanguageProvider>
      );

      // Verify modal title
      expect(screen.getByRole('heading', { name: /Vklad \/ Výběr/i })).toBeInTheDocument();

      // Click preset chip "Ranní vklad"
      const morningChip = screen.getByRole('button', { name: /Ranní vklad/i });
      fireEvent.click(morningChip);

      // Input should have "Ranní vklad"
      const reasonInput = screen.getByPlaceholderText(/Zadejte důvod/i);
      expect(reasonInput).toHaveValue('Ranní vklad');

      // Click keypad: 5, 0, 0
      fireEvent.click(screen.getByRole('button', { name: '5' }));
      fireEvent.click(screen.getByRole('button', { name: '0' }));
      fireEvent.click(screen.getByRole('button', { name: '0' }));

      // Submit movement
      const submitBtn = screen.getByRole('button', { name: /Zaznamenat pohyb/i });
      expect(submitBtn).not.toBeDisabled();
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(posApi.recordCashMovement).toHaveBeenCalledWith({
          movement_type: 'FLOAT_IN',
          amount: 500,
          reason: 'Ranní vklad',
          print_slip: true
        });
        expect(handleRecorded).toHaveBeenCalled();
        expect(handleClose).toHaveBeenCalled();
      });
    });

    it('allows switching to PAYOUT and submitting a payout', async () => {
      const handleClose = vi.fn();
      posApi.recordCashMovement.mockResolvedValueOnce({
        status: 'CREATED',
        movement: { id: 'mov-2', movement_type: 'PAYOUT', amount: 200, reason: 'Pekárna / Pečivo' },
        shift: { expected_cash: 300, shift_number: 1 }
      });
      posApi.printCashMovementSlip.mockResolvedValueOnce({ success: true });

      render(
        <LanguageProvider>
          <CashDrawerMovementModal
            isOpen={true}
            onClose={handleClose}
            onMovementRecorded={vi.fn()}
          />
        </LanguageProvider>
      );

      // Click Výběr tab
      const payoutTab = screen.getByRole('button', { name: /Výběr \/ Dodavatel/i });
      fireEvent.click(payoutTab);

      // Click preset chip "Pekárna / Pečivo"
      const bakeryChip = screen.getByRole('button', { name: /Pekárna \/ Pečivo/i });
      fireEvent.click(bakeryChip);

      // Click quick amount chip +200
      const quick200 = screen.getByRole('button', { name: '+200' });
      fireEvent.click(quick200);

      const submitBtn = screen.getByRole('button', { name: /Zaznamenat pohyb/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(posApi.recordCashMovement).toHaveBeenCalledWith({
          movement_type: 'PAYOUT',
          amount: 200,
          reason: 'Pekárna / Pečivo',
          print_slip: true
        });
      });
    });
  });

  describe('ZReportModal', () => {
    const mockShift = {
      id: 'shift-10',
      shift_number: 2,
      z_seq: 15,
      opening_cash: 1000,
      total_cash_sales: 4000,
      total_cash_refunds: 200,
      float_in: 500,
      payouts: 300,
      safe_drops: 0,
      net_movements: 200,
      expected_cash: 5000,
      actual_cash: null,
      discrepancy: null,
      is_closed: false
    };

    const typeCount = (digits) => {
      for (const d of digits) fireEvent.click(screen.getByRole('button', { name: d }));
    };

    it('calculates discrepancy in real-time: matching (0 Kč), manko (-), and přebytek (+)', async () => {
      posApi.getCurrentShift.mockResolvedValue(mockShift);

      render(
        <LanguageProvider>
          <ZReportModal isOpen={true} onClose={vi.fn()} />
        </LanguageProvider>
      );

      // Wait for shift data to load
      await waitFor(() => {
        expect(screen.getAllByText(/5[\s\u00a0]*000/i).length).toBeGreaterThan(0);
      });

      // Nothing is pre-filled (F-021): no verdict until the cashier counted
      expect(screen.queryByText(/V pořádku \(0 Kč\)/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Manko/i)).not.toBeInTheDocument();
      expect(screen.getByText(/Spočítejte hotovost/i)).toBeInTheDocument();

      // Counting exactly the expected amount -> 0 Kč (V pořádku)
      typeCount('5000');
      expect(screen.getByText(/V pořádku \(0 Kč\)/i)).toBeInTheDocument();

      // Clear actual cash
      fireEvent.click(screen.getByRole('button', { name: 'C' }));
      expect(screen.getByText(/Spočítejte hotovost/i)).toBeInTheDocument();

      // Enter 4800 (shortage: manko -200)
      fireEvent.click(screen.getByRole('button', { name: '4' }));
      fireEvent.click(screen.getByRole('button', { name: '8' }));
      fireEvent.click(screen.getByRole('button', { name: '0' }));
      fireEvent.click(screen.getByRole('button', { name: '0' }));

      expect(screen.getByText(/Manko \(-200/i)).toBeInTheDocument();

      // Clear and enter 5250 (surplus: přebytek +250)
      fireEvent.click(screen.getByRole('button', { name: 'C' }));
      fireEvent.click(screen.getByRole('button', { name: '5' }));
      fireEvent.click(screen.getByRole('button', { name: '2' }));
      fireEvent.click(screen.getByRole('button', { name: '5' }));
      fireEvent.click(screen.getByRole('button', { name: '0' }));

      expect(screen.getByText(/Přebytek \(\+250/i)).toBeInTheDocument();
    });

    it('submits shift closure and triggers thermal printing', async () => {
      posApi.getCurrentShift.mockResolvedValue(mockShift);
      posApi.closeShift.mockResolvedValue({
        status: 'CLOSED',
        shift_number: 2,
        z_seq: 15,
        total_revenue: 5000,
        shift: {
          id: 'shift-10',
          shift_number: 2,
          expected_cash: 5000,
          actual_cash: 5000,
          discrepancy: 0
        }
      });
      posApi.printZReport.mockResolvedValue({ success: true });

      const handleClosed = vi.fn();

      render(
        <LanguageProvider>
          <ZReportModal isOpen={true} onClose={vi.fn()} onShiftClosed={handleClosed} />
        </LanguageProvider>
      );

      await waitFor(() => {
        expect(screen.getAllByText(/5[\s\u00a0]*000/i).length).toBeGreaterThan(0);
      });

      const confirmBtn = screen.getByRole('button', { name: /Provést Z-Uzávěrku a vytisknout/i });
      typeCount('5000');
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(posApi.closeShift).toHaveBeenCalledWith({
          actual_cash: 5000,
          notes: ''
        });
        expect(posApi.printZReport).toHaveBeenCalled();
        expect(handleClosed).toHaveBeenCalled();
        expect(screen.getByText(/Z-Uzávěrka byla úspěšně provedena/i)).toBeInTheDocument();
      });
    });

    it('warns about unsent sales and needs an extra confirmation before closing (F-015)', async () => {
      posApi.getCurrentShift.mockResolvedValue(mockShift);
      posApi.closeShift.mockResolvedValue({ status: 'CLOSED', shift_number: 2, z_seq: 15, total_revenue: 5000, shift: { id: 'shift-10', expected_cash: 5000, actual_cash: 5000, discrepancy: 0 } });
      posApi.printZReport.mockResolvedValue({ success: true });

      render(
        <LanguageProvider>
          <ZReportModal isOpen={true} onClose={vi.fn()} unsent={{ count: 2, amount: 123.5 }} />
        </LanguageProvider>
      );

      await waitFor(() => {
        expect(screen.getAllByText(/5[\s\u00a0]*000/i).length).toBeGreaterThan(0);
      });

      expect(screen.getByRole('alert')).toHaveTextContent(/2 neuložených prodejů \(123,50 Kč\)/);
      const confirmBtn = screen.getByRole('button', { name: /Provést Z-Uzávěrku a vytisknout/i });
      typeCount('5000');
      expect(confirmBtn).toBeDisabled();
      fireEvent.click(confirmBtn);
      expect(posApi.closeShift).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('checkbox', { name: /uzavřít směnu bez nich/i }));
      expect(confirmBtn).toBeEnabled();
      fireEvent.click(confirmBtn);
      await waitFor(() => expect(posApi.closeShift).toHaveBeenCalledTimes(1));
    });

    it('shows no warning and closes normally when nothing is unsent', async () => {
      posApi.getCurrentShift.mockResolvedValue(mockShift);
      render(
        <LanguageProvider>
          <ZReportModal isOpen={true} onClose={vi.fn()} unsent={{ count: 0, amount: 0 }} />
        </LanguageProvider>
      );
      await waitFor(() => {
        expect(screen.getAllByText(/5[\s\u00a0]*000/i).length).toBeGreaterThan(0);
      });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      typeCount('5000');
      expect(screen.getByRole('button', { name: /Provést Z-Uzávěrku a vytisknout/i })).toBeEnabled();
    });

    it('starts empty and cannot be closed before the cash is counted (F-021)', async () => {
      posApi.getCurrentShift.mockResolvedValue(mockShift);
      render(
        <LanguageProvider>
          <ZReportModal isOpen={true} onClose={vi.fn()} />
        </LanguageProvider>
      );
      await waitFor(() => {
        expect(screen.getAllByText(/5[\s\u00a0]*000/i).length).toBeGreaterThan(0);
      });
      const confirmBtn = screen.getByRole('button', { name: /Provést Z-Uzávěrku a vytisknout/i });
      expect(confirmBtn).toBeDisabled();
      fireEvent.click(confirmBtn);
      expect(posApi.closeShift).not.toHaveBeenCalled();

      typeCount('5000');
      expect(confirmBtn).toBeEnabled();
    });

    it('an empty drawer (expected 0) starts at 0 and closes in one tap', async () => {
      posApi.getCurrentShift.mockResolvedValue({ ...mockShift, opening_cash: 0, total_cash_sales: 0, total_cash_refunds: 0, float_in: 0, payouts: 0, net_movements: 0, expected_cash: 0 });
      render(
        <LanguageProvider>
          <ZReportModal isOpen={true} onClose={vi.fn()} />
        </LanguageProvider>
      );
      const confirmBtn = await screen.findByRole('button', { name: /Provést Z-Uzávěrku a vytisknout/i });
      await waitFor(() => expect(confirmBtn).toBeEnabled());
      expect(screen.getByText(/V pořádku \(0 Kč\)/i)).toBeInTheDocument();
    });
  });
});
