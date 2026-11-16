import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import PaymentModal from '../components/PaymentModal';
import AppModals from '../components/app/AppModals';
import { usePosKeyboardShortcuts } from '../hooks/usePosKeyboardShortcuts';
import { LanguageProvider } from '../i18n/LanguageContext';
import { DEFAULT_STORE_CONFIG } from '../data/initialData';
import * as posApi from '../api/posApi';

vi.mock('../api/posApi', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchTerminalConfig: vi.fn().mockResolvedValue(null),
    payWithTerminal: vi.fn(),
    broadcastCustomerDisplay: vi.fn()
  };
});

const key = (k) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
  });

// A scanner types the digits within a few milliseconds, then Enter.
const scan = (code) => {
  for (const ch of code) key(ch);
  key('Enter');
};

function renderModal(props = {}) {
  const onCompleteSale = vi.fn();
  const onClose = vi.fn();
  const utils = render(
    <LanguageProvider>
      <PaymentModal
        totalAmount={350}
        initialMethod="cash"
        storeConfig={DEFAULT_STORE_CONFIG}
        onClose={onClose}
        onCompleteSale={onCompleteSale}
        {...props}
      />
    </LanguageProvider>
  );
  return { ...utils, onCompleteSale, onClose };
}

describe('PaymentModal safety (F-002, F-005, F-008, F-022)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    posApi.fetchTerminalConfig.mockResolvedValue(null);
    vi.useFakeTimers({ shouldAdvanceTime: false });
    vi.setSystemTime(new Date('2026-11-16T10:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('scanner burst while paying (F-002)', () => {
    it('does not change the tendered amount or complete the sale', () => {
      const { onCompleteSale } = renderModal();
      scan('8593001234567');
      expect(onCompleteSale).not.toHaveBeenCalled();
      expect(screen.queryByText(/8593001234567/)).not.toBeInTheDocument();
      expect(screen.queryByText(/^8\s?Kč$/)).not.toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent(/Sken během platby/i);
    });

    it('keeps a typed amount untouched by a scan', () => {
      const { onCompleteSale } = renderModal();
      key('5');
      vi.advanceTimersByTime(300);
      key('0');
      vi.advanceTimersByTime(300);
      scan('8593001234567');
      expect(onCompleteSale).not.toHaveBeenCalled();
      expect(screen.getByText('50 Kč')).toBeInTheDocument();
    });

    it('does not touch the split cash amount either', () => {
      renderModal({ initialMethod: 'split' });
      scan('8593001234567');
      expect(screen.getByText('0 Kč')).toBeInTheDocument();
    });

    it('still accepts a person typing digits slowly', () => {
      renderModal();
      for (const d of ['4', '0', '0']) {
        key(d);
        vi.advanceTimersByTime(300);
      }
      expect(screen.getByText('400 Kč')).toBeInTheDocument();
    });
  });

  describe('Enter key', () => {
    it('completes cash only with an explicit amount', () => {
      const { onCompleteSale } = renderModal();
      key('Enter');
      expect(onCompleteSale).not.toHaveBeenCalled();

      key('4');
      vi.advanceTimersByTime(300);
      key('0');
      vi.advanceTimersByTime(300);
      key('0');
      vi.advanceTimersByTime(300);
      key('Enter');
      expect(onCompleteSale).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'cash', tendered: 400, change: 50 })
      );
    });

    it.each(['card', 'qr', 'split'])('does nothing in %s mode', (method) => {
      const { onCompleteSale } = renderModal({ initialMethod: method });
      key('Enter');
      expect(onCompleteSale).not.toHaveBeenCalled();
    });

    it('is ignored when it comes from a form field', () => {
      const { onCompleteSale } = renderModal();
      fireEvent.click(screen.getByRole('button', { name: /Firemní faktura/i }));
      const input = screen.getByPlaceholderText('12345678');
      fireEvent.click(screen.getByRole('button', { name: /^Přesně \(/i }));
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onCompleteSale).not.toHaveBeenCalled();
    });
  });

  describe('amount cap', () => {
    it('stops at six digits from the numpad', () => {
      renderModal();
      const nine = screen.getAllByRole('button', { name: '9' })[0];
      for (let i = 0; i < 9; i++) fireEvent.click(nine);
      expect(screen.getByText('999999 Kč')).toBeInTheDocument();
    });

    it('caps banknote accumulation', () => {
      renderModal();
      const note = screen.getByRole('button', { name: /5 000 Kč/ });
      for (let i = 0; i < 300; i++) fireEvent.click(note);
      expect(screen.getByText('999999 Kč')).toBeInTheDocument();
    });
  });

  describe('Escape', () => {
    it('closes the modal when idle', () => {
      const { onClose } = renderModal();
      key('Escape');
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('exact amount (F-008)', () => {
    it('shows the exact amount greyed out when nothing is typed', () => {
      renderModal({ totalAmount: 350 });
      expect(screen.getByTestId('tendered-exact')).toHaveTextContent('350');
    });
  });

  describe('manual card confirmation (F-022)', () => {
    it('needs a second step before a manual card sale is recorded', () => {
      const { onCompleteSale } = renderModal({ initialMethod: 'card' });
      fireEvent.click(screen.getByRole('button', { name: /Dokončit bez tisku/i }));
      expect(onCompleteSale).not.toHaveBeenCalled();

      const dialog = screen.getByRole('alertdialog');
      expect(dialog).toHaveTextContent('350.00');
      fireEvent.click(within(dialog).getByRole('button', { name: /Ano, zaplaceno/i }));
      expect(onCompleteSale).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'card', paymentMethod: 'card', tendered: 350, printReceipt: false })
      );
    });

    it('"Ne" returns to the card screen without a sale', () => {
      const { onCompleteSale } = renderModal({ initialMethod: 'card' });
      fireEvent.click(screen.getByRole('button', { name: /Dokončit a vytisknout/i }));
      fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: /^Ne$/i }));
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(onCompleteSale).not.toHaveBeenCalled();
    });

    it('asks for the card part of a split sale', () => {
      const { onCompleteSale } = renderModal({ initialMethod: 'split', totalAmount: 150 });
      fireEvent.click(screen.getByRole('button', { name: '1' }));
      fireEvent.click(screen.getByRole('button', { name: '0' }));
      fireEvent.click(screen.getByRole('button', { name: '0' }));
      fireEvent.click(screen.getByRole('button', { name: /Pokračovat na platbu kartou/i }));
      fireEvent.click(screen.getByRole('button', { name: /Dokončit bez tisku/i }));
      const dialog = screen.getByRole('alertdialog');
      expect(dialog).toHaveTextContent('50.00');
      expect(onCompleteSale).not.toHaveBeenCalled();
      fireEvent.click(within(dialog).getByRole('button', { name: /Ano, zaplaceno/i }));
      expect(onCompleteSale).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'split', splitDetails: { cash: 100, card: 50 } })
      );
    });

    it('does not ask again after the terminal approved the charge', async () => {
      posApi.fetchTerminalConfig.mockResolvedValue({ enabled: true, ip: '10.0.0.5', port: 4000 });
      posApi.payWithTerminal.mockResolvedValue({ success: true, auth_code: 'A1', card_mask: '**** 1111' });
      const { onCompleteSale } = renderModal({ initialMethod: 'card' });
      await act(async () => { await Promise.resolve(); });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Odeslat na Terminál/i }));
      });
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(onCompleteSale).toHaveBeenCalledTimes(1);
    });
  });

  describe('terminal charge in progress (F-005)', () => {
    let finish;
    beforeEach(() => {
      posApi.fetchTerminalConfig.mockResolvedValue({ enabled: true, ip: '10.0.0.5', port: 4000 });
      posApi.payWithTerminal.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    });

    async function startCharge() {
      const utils = renderModal({ initialMethod: 'card' });
      await act(async () => { await Promise.resolve(); });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Odeslat na Terminál/i }));
      });
      return utils;
    }

    it('cannot be closed by overlay, X or Escape', async () => {
      const { onClose, container } = await startCharge();
      fireEvent.click(container.querySelector('.modal-overlay'));
      fireEvent.click(screen.getByRole('button', { name: '✕' }));
      key('Escape');
      expect(onClose).not.toHaveBeenCalled();
    });

    it('cannot switch payment method while charging', async () => {
      await startCharge();
      expect(screen.getByRole('button', { name: /Hotovost/i })).toBeDisabled();
    });

    it('completes once, straight from the result, with the full payload', async () => {
      const { onCompleteSale } = await startCharge();
      await act(async () => {
        finish({ success: true, auth_code: 'A1', card_mask: '**** 1111' });
      });
      expect(onCompleteSale).toHaveBeenCalledTimes(1);
      expect(onCompleteSale).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'card',
          paymentMethod: 'card',
          tendered: 350,
          tenderedAmount: 350,
          cardAuthCode: 'A1',
          cardMask: '**** 1111',
          printReceipt: true
        })
      );
    });

    it('stays locked after approval until the sale has been handed over', async () => {
      const { onClose, container } = await startCharge();
      await act(async () => {
        finish({ success: true, auth_code: 'A1', card_mask: '**** 1111' });
      });
      fireEvent.click(container.querySelector('.modal-overlay'));
      expect(onClose).not.toHaveBeenCalled();
    });

    it('unlocks again when handing the sale over throws', async () => {
      const { onClose, onCompleteSale, container } = await startCharge();
      onCompleteSale.mockImplementation(() => { throw new Error('boom'); });
      await act(async () => {
        finish({ success: true, auth_code: 'A1', card_mask: '**** 1111' });
      });
      fireEvent.click(container.querySelector('.modal-overlay'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('unlocks again when the terminal declines', async () => {
      const { onClose, onCompleteSale, container } = await startCharge();
      await act(async () => {
        finish({ success: false, message: 'Declined' });
      });
      expect(onCompleteSale).not.toHaveBeenCalled();
      fireEvent.click(container.querySelector('.modal-overlay'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});

describe('usePosKeyboardShortcuts while a payment modal is open (F-002)', () => {
  const preset = { id: 'p1', name: 'Kofola', price: 28, vat: 21, barcode: '8594001234567' };

  function Harness({ paymentModalMethod, onAdd }) {
    const [keypadAmount, setKeypadAmount] = useState('');
    const [itemMultiplier, setItemMultiplier] = useState(1);
    usePosKeyboardShortcuts({
      isAppLocked: false,
      activeTab: 'register',
      keypadAmount,
      setKeypadAmount,
      setItemMultiplier,
      itemMultiplier,
      cartItems: [{ id: 'x' }],
      paymentModalMethod,
      setPaymentModalMethod: vi.fn(),
      handleAddToCart: onAdd,
      storeConfig: { defaultVat: 21 },
      presets: [preset]
    });
    return <div data-testid="amount">{keypadAmount}</div>;
  }

  it('adds nothing and leaves the keypad alone', () => {
    const onAdd = vi.fn();
    render(<Harness paymentModalMethod="cash" onAdd={onAdd} />);
    scan('8594001234567');
    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByTestId('amount')).toHaveTextContent('');
  });

  it('still adds the scanned item when no payment modal is open', () => {
    const onAdd = vi.fn();
    render(<Harness paymentModalMethod={null} onAdd={onAdd} />);
    scan('8594001234567');
    expect(onAdd).toHaveBeenCalledTimes(1);
  });
});

describe('undo toast (F-004)', () => {
  const base = {
    cartItems: [],
    cartDiscountPercent: 0,
    isDiscountModalOpen: false,
    setIsDiscountModalOpen: () => {},
    setPaymentModalMethod: () => {},
    storeConfig: DEFAULT_STORE_CONFIG,
    undoToast: { type: 'ADD', itemName: 'Rohlík' },
    onUndoLastAction: () => {},
    onDismissUndoToast: () => {}
  };

  it('is shown on the register', () => {
    render(<LanguageProvider><AppModals {...base} paymentModalMethod={null} /></LanguageProvider>);
    expect(screen.getByText('Rohlík')).toBeInTheDocument();
  });

  it('is hidden while a payment modal is open', () => {
    render(<LanguageProvider><AppModals {...base} paymentModalMethod="card" /></LanguageProvider>);
    expect(screen.queryByText('Rohlík')).not.toBeInTheDocument();
  });
});
