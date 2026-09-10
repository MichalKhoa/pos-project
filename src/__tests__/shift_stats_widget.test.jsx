import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ShiftStatsWidget from '../components/keypad/ShiftStatsWidget.jsx';
import { LanguageProvider } from '../i18n/LanguageContext.jsx';
import { formatLocalDate } from '../utils/dateUtils';

function renderWithLanguage(ui) {
  return render(
    <LanguageProvider>
      {ui}
    </LanguageProvider>
  );
}

describe('ShiftStatsWidget', () => {
  const todayStr = formatLocalDate(new Date());

  const mockSales = [
    {
      id: 's1',
      date: todayStr,
      total_amount: 1500,
      payment_method: 'cash',
      cash_amount: 1500,
      card_amount: 0
    },
    {
      id: 's2',
      date: todayStr,
      total_amount: 2500,
      payment_method: 'card',
      cash_amount: 0,
      card_amount: 2500
    },
    {
      id: 's3',
      date: '2020-01-01', // old date
      total_amount: 9999,
      payment_method: 'cash'
    }
  ];

  it('renders slim variant collapsed by default and expands on click', () => {
    const handlePrint = vi.fn();
    const handleZReport = vi.fn();

    renderWithLanguage(
      <ShiftStatsWidget
        variant="slim"
        salesHistory={mockSales}
        onPrintDailySummary={handlePrint}
        onOpenZReport={handleZReport}
      />
    );

    // Header visible
    expect(screen.getByText(/Dnešní směna/i)).toBeInTheDocument();
    expect(screen.getByText(/2 účtenek/i)).toBeInTheDocument();

    // Collapsed by default: action buttons not yet rendered
    expect(screen.queryByRole('button', { name: /Z-Uzávěrka/i })).not.toBeInTheDocument();

    // Click anywhere on header to expand
    const headerToggle = screen.getByRole('button', { name: /Dnešní směna/i });
    fireEvent.click(headerToggle);

    // Now expanded: action buttons visible
    const zReportBtn = screen.getByRole('button', { name: /Z-Uzávěrka/i });
    expect(zReportBtn).toBeInTheDocument();
    fireEvent.click(zReportBtn);
    expect(handleZReport).toHaveBeenCalledTimes(1);

    const printBtn = screen.getByRole('button', { name: /Vytisknout denní tržbu/i });
    expect(printBtn).toBeInTheDocument();
    fireEvent.click(printBtn);
    expect(handlePrint).toHaveBeenCalledTimes(1);

    // Click again to collapse
    fireEvent.click(headerToggle);
    expect(screen.queryByRole('button', { name: /Z-Uzávěrka/i })).not.toBeInTheDocument();
  });

  it('renders card variant expanded and calculates cash/card split with roundCZK', () => {
    renderWithLanguage(
      <ShiftStatsWidget
        variant="card"
        salesHistory={mockSales}
        onOpenZReport={vi.fn()}
      />
    );

    expect(screen.getByText(/Dnešní směna/i)).toBeInTheDocument();
    expect(screen.getByText(/4[\s\u00a0]*000,00 Kč/i)).toBeInTheDocument();
    expect(screen.getByText(/1[\s\u00a0]*500 Kč/i)).toBeInTheDocument();
    expect(screen.getByText(/2[\s\u00a0]*500 Kč/i)).toBeInTheDocument();
  });
});
