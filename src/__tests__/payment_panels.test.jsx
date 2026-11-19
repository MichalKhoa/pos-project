import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SplitPaymentPanel from '../components/payment/SplitPaymentPanel';
import QrPaymentPanel from '../components/payment/QrPaymentPanel';
import CardPaymentPanel from '../components/payment/CardPaymentPanel';
import { LanguageProvider } from '../i18n/LanguageContext';

function renderWithLang(ui) {
  return render(<LanguageProvider>{ui}</LanguageProvider>);
}

describe('Payment sub-panels', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('SplitPaymentPanel step 1 shortcuts, numpad callbacks, proceed-to-card, and full-cash finish bar', () => {
    const setSplitStep = vi.fn();
    const setSplitCashStr = vi.fn();
    const onSplitNumpadKey = vi.fn();
    const onComplete = vi.fn();

    const baseProps = {
      splitStep: 1,
      setSplitStep,
      splitCashStr: '200',
      setSplitCashStr,
      splitCashVal: 200,
      splitCardVal: 300,
      totalAmount: 500,
      termConfig: { enabled: false },
      termLoading: false,
      termResult: null,
      onSplitNumpadKey,
      onTerminalPay: vi.fn(),
      onComplete
    };

    const { rerender } = renderWithLang(<SplitPaymentPanel {...baseProps} />);

    fireEvent.click(screen.getByRole('button', { name: '50% / 50%' }));
    expect(setSplitCashStr).toHaveBeenCalledWith('250');

    fireEvent.click(screen.getByRole('button', { name: '100 Kč' }));
    expect(setSplitCashStr).toHaveBeenCalledWith('100');

    fireEvent.click(screen.getByRole('button', { name: /^C \(/ }));
    expect(setSplitCashStr).toHaveBeenCalledWith('0');

    fireEvent.click(screen.getByRole('button', { name: '7' }));
    fireEvent.click(screen.getByRole('button', { name: /^C$/ }));
    fireEvent.click(screen.getByTitle('Backspace'));
    expect(onSplitNumpadKey).toHaveBeenNthCalledWith(1, '7');
    expect(onSplitNumpadKey).toHaveBeenNthCalledWith(2, 'CLEAR');
    expect(onSplitNumpadKey).toHaveBeenNthCalledWith(3, 'BACK');

    fireEvent.click(screen.getByRole('button', { name: /Pokračovat na platbu kartou \(300\.00 Kč\)/i }));
    expect(setSplitStep).toHaveBeenCalledWith(2);

    rerender(
      <LanguageProvider>
        <SplitPaymentPanel {...baseProps} splitCashStr="500" splitCashVal={500} splitCardVal={0} />
      </LanguageProvider>
    );

    expect(screen.queryByRole('button', { name: /Pokračovat na platbu kartou/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Dokončit bez tisku/i }));
    expect(onComplete).toHaveBeenCalledWith({ printReceipt: false });
    fireEvent.click(screen.getByRole('button', { name: /Dokončit a vytisknout/i }));
    expect(onComplete).toHaveBeenCalledWith({ printReceipt: true });
  });

  it('SplitPaymentPanel step 2 back button, terminal banner, result states, and terminal pay action', () => {
    const setSplitStep = vi.fn();
    const onTerminalPay = vi.fn();

    const baseProps = {
      splitStep: 2,
      setSplitStep,
      splitCashStr: '200',
      setSplitCashStr: vi.fn(),
      splitCashVal: 200,
      splitCardVal: 300,
      totalAmount: 500,
      termConfig: { enabled: true, ip: '192.168.1.50', port: 8888 },
      termLoading: false,
      termResult: { success: true, auth_code: '998877', card_mask: '4111****1111' },
      onSplitNumpadKey: vi.fn(),
      onTerminalPay,
      onComplete: vi.fn()
    };

    const { rerender } = renderWithLang(<SplitPaymentPanel {...baseProps} />);

    expect(screen.getByText(/192\.168\.1\.50:8888/)).toBeInTheDocument();
    expect(screen.getByText(/Transakce na terminálu schválena!/)).toBeInTheDocument();
    expect(screen.getByText(/998877/)).toBeInTheDocument();
    expect(screen.getByText(/4111\*\*\*\*1111/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Odeslat na Terminál ČSOB/i }));
    expect(onTerminalPay).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Zpět na zadání hotovosti/i }));
    expect(setSplitStep).toHaveBeenCalledWith(1);

    rerender(
      <LanguageProvider>
        <SplitPaymentPanel
          {...baseProps}
          termResult={{ success: false, message: 'Declined 51' }}
        />
      </LanguageProvider>
    );
    expect(screen.getByText(/Declined 51/)).toBeInTheDocument();
  });

  it('QrPaymentPanel shows missing/placeholder IBAN warning and renders QR SPD image for valid IBAN', () => {
    const onComplete = vi.fn();

    const { rerender } = renderWithLang(
      <QrPaymentPanel totalAmount={199.5} storeConfig={{}} onComplete={onComplete} />
    );
    expect(screen.getByText('Účet (IBAN) nenastaven')).toBeInTheDocument();
    expect(screen.queryByAltText('QR Platba SPD')).not.toBeInTheDocument();

    rerender(
      <LanguageProvider>
        <QrPaymentPanel
          totalAmount={199.5}
          storeConfig={{ bankAccountIban: 'CZ65 0800 0000 0012 3456 7890' }}
          onComplete={onComplete}
        />
      </LanguageProvider>
    );
    expect(screen.getByText('Účet (IBAN) nenastaven')).toBeInTheDocument();
    expect(screen.queryByAltText('QR Platba SPD')).not.toBeInTheDocument();

    rerender(
      <LanguageProvider>
        <QrPaymentPanel
          totalAmount={199.5}
          storeConfig={{ bankAccountIban: 'CZ5855000000126509800100', storeName: 'Test Shop' }}
          onComplete={onComplete}
        />
      </LanguageProvider>
    );
    const img = screen.getByAltText('QR Platba SPD');
    expect(img).toBeInTheDocument();
    expect(img.getAttribute('src')).toMatch(/^data:image\/svg\+xml/);
    expect(screen.getByText('CZ58 5500 0000 1265 0980 0100')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Dokončit bez tisku/i }));
    expect(onComplete).toHaveBeenCalledWith({ printReceipt: false });
    fireEvent.click(screen.getByRole('button', { name: /Dokončit a vytisknout/i }));
    expect(onComplete).toHaveBeenCalledWith({ printReceipt: true });
  });

  it('CardPaymentPanel manual mode vs ČSOB IP terminal loading, approved, and declined states', () => {
    const onTerminalPay = vi.fn();
    const onComplete = vi.fn();

    const { rerender } = renderWithLang(
      <CardPaymentPanel
        totalAmount={350}
        termConfig={{ enabled: false }}
        termLoading={false}
        termResult={null}
        onTerminalPay={onTerminalPay}
        onComplete={onComplete}
      />
    );

    expect(screen.getByText('350.00 Kč')).toBeInTheDocument();
    expect(screen.getByText(/Ruční Režim Terminálu/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Odeslat na Terminál ČSOB/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Dokončit bez tisku/i }));
    expect(onComplete).toHaveBeenCalledWith({ printReceipt: false });
    fireEvent.click(screen.getByRole('button', { name: /Dokončit a vytisknout/i }));
    expect(onComplete).toHaveBeenCalledWith({ printReceipt: true });

    rerender(
      <LanguageProvider>
        <CardPaymentPanel
          totalAmount={350}
          termConfig={{ enabled: true, ip: '10.0.0.20', port: 8888 }}
          termLoading={false}
          termResult={{ success: true, auth_code: '776655', card_mask: '5500****9999' }}
          onTerminalPay={onTerminalPay}
          onComplete={onComplete}
        />
      </LanguageProvider>
    );

    expect(screen.getByText(/10\.0\.0\.20:8888/)).toBeInTheDocument();
    expect(screen.getByText(/776655/)).toBeInTheDocument();
    expect(screen.getByText(/5500\*\*\*\*9999/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Odeslat na Terminál ČSOB/i }));
    expect(onTerminalPay).toHaveBeenCalledTimes(1);

    rerender(
      <LanguageProvider>
        <CardPaymentPanel
          totalAmount={350}
          termConfig={{ enabled: true, ip: '10.0.0.20', port: 8888 }}
          termLoading={true}
          termResult={{ success: false, message: 'Terminal timeout' }}
          onTerminalPay={onTerminalPay}
          onComplete={onComplete}
        />
      </LanguageProvider>
    );

    expect(screen.getByRole('button', { name: /Odesílám na ČSOB terminál/i })).toBeDisabled();
    expect(screen.getByText(/Terminal timeout/)).toBeInTheDocument();
  });
});
