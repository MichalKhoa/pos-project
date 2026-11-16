import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ShiftStatsWidget from '../components/keypad/ShiftStatsWidget.jsx';
import { LanguageProvider } from '../i18n/LanguageContext.jsx';

function renderWithLanguage(ui) {
  return render(
    <LanguageProvider>
      {ui}
    </LanguageProvider>
  );
}

describe('ShiftStatsWidget (server numbers, audit F-015)', () => {
  const shift = {
    receipts_count: 2,
    total_revenue: 4000,
    total_cash_sales: 1500,
    card_sales: 2500
  };

  it('renders slim variant collapsed by default and expands on click', () => {
    const handlePrint = vi.fn();
    const handleZReport = vi.fn();

    renderWithLanguage(
      <ShiftStatsWidget
        variant="slim"
        shift={shift}
        onPrintDailySummary={handlePrint}
        onOpenZReport={handleZReport}
      />
    );

    expect(screen.getByText(/Dnešní směna/i)).toBeInTheDocument();
    expect(screen.getByText(/2 účtenky/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Z-Uzávěrka/i })).not.toBeInTheDocument();

    const headerToggle = screen.getByRole('button', { name: /Dnešní směna/i });
    fireEvent.click(headerToggle);

    const zReportBtn = screen.getByRole('button', { name: /Z-Uzávěrka/i });
    fireEvent.click(zReportBtn);
    expect(handleZReport).toHaveBeenCalledTimes(1);

    const printBtn = screen.getByRole('button', { name: /Vytisknout denní tržbu/i });
    fireEvent.click(printBtn);
    expect(handlePrint).toHaveBeenCalledTimes(1);

    fireEvent.click(headerToggle);
    expect(screen.queryByRole('button', { name: /Z-Uzávěrka/i })).not.toBeInTheDocument();
  });

  it('card variant shows the server revenue, cash and card figures', () => {
    renderWithLanguage(<ShiftStatsWidget variant="card" shift={shift} onOpenZReport={vi.fn()} />);

    expect(screen.getByText(/4[\s\u00a0]*000,00 Kč/i)).toBeInTheDocument();
    expect(screen.getByText(/1[\s\u00a0]*500 Kč/i)).toBeInTheDocument();
    expect(screen.getByText(/2[\s\u00a0]*500 Kč/i)).toBeInTheDocument();
  });

  it('shows a dash, not a locally computed figure, when the server data is missing', () => {
    renderWithLanguage(<ShiftStatsWidget variant="card" shift={null} onOpenZReport={vi.fn()} />);
    expect(screen.queryByText(/Kč/)).not.toBeInTheDocument();
    expect(screen.getAllByText('\u2014').length).toBeGreaterThan(0);
  });

  it('ignores sales that exist only in the browser (they are not in the totals)', () => {
    renderWithLanguage(
      <ShiftStatsWidget
        variant="card"
        shift={shift}
        salesHistory={[{ id: 'x', total_amount: 9999, timestamp: new Date().toISOString() }]}
        onOpenZReport={vi.fn()}
      />
    );
    expect(screen.queryByText(/9[\s\u00a0]*999/)).not.toBeInTheDocument();
  });

  it('shows unsent sales on their own line and keeps them out of the totals', () => {
    renderWithLanguage(
      <ShiftStatsWidget variant="card" shift={shift} unsent={{ count: 2, amount: 123.5 }} onOpenZReport={vi.fn()} />
    );
    expect(screen.getByRole('status')).toHaveTextContent(/Neuloženo: 2 prodejů \(123,50 Kč\)/);
    expect(screen.getByText(/4[\s\u00a0]*000,00 Kč/i)).toBeInTheDocument();
  });

  it('hides the unsent line when nothing is unsent', () => {
    renderWithLanguage(<ShiftStatsWidget variant="card" shift={shift} unsent={{ count: 0, amount: 0 }} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it.each([[0, 'účtenek'], [1, 'účtenka'], [2, 'účtenky'], [4, 'účtenky'], [5, 'účtenek'], [21, 'účtenek']])(
    'uses the Czech plural for %i receipts',
    (count, word) => {
      renderWithLanguage(<ShiftStatsWidget variant="slim" shift={{ ...shift, receipts_count: count }} />);
      expect(screen.getByText(`${count} ${word}`)).toBeInTheDocument();
    }
  );
});
