import React from 'react';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { formatLocalDate, parseSaleTimestamp } from '../utils/dateUtils';
import { aggregateDailyStats, aggregateWeeklyStats, aggregateMonthlyStats } from '../utils/periodAggregator';
import { exportSalesToCSV } from '../utils/csvExporter';
import { markStranded } from '../utils/saleSync';
import { useSalesPeriodFilter } from '../hooks/useSalesPeriodFilter';
import SalesLedgerTable from '../components/history/SalesLedgerTable';
import { render, screen } from '@testing-library/react';

vi.mock('../i18n/LanguageContext.jsx', () => ({
  useTranslation: () => ({ t: (k) => k, language: 'cs' }),
}));

// The server stores utcnow() and sends it without a zone. On a Prague machine
// '2026-11-16T23:30:00' is 00:30 on 17.11. local time, so every day/period bucket must use 17.11.
const NAIVE_LATE = '2026-11-16T23:30:00';

let oldTz;
beforeAll(() => { oldTz = process.env.TZ; process.env.TZ = 'Europe/Prague'; });
afterAll(() => { if (oldTz === undefined) delete process.env.TZ; else process.env.TZ = oldTz; });

describe('formatLocalDate', () => {
  it('puts a zoneless server timestamp on the local day', () => {
    expect(formatLocalDate(NAIVE_LATE)).toBe('2026-11-17');
    expect(formatLocalDate('2026-11-16T22:30:00')).toBe('2026-11-16');
  });
  it('keeps zoned strings and date-only input working', () => {
    expect(formatLocalDate('2026-11-16T23:30:00Z')).toBe('2026-11-17');
    expect(formatLocalDate('2026-11-16T23:30:00+01:00')).toBe('2026-11-16');
    expect(formatLocalDate('2026-11-16')).toBe('2026-11-16');
  });
});

describe('periodAggregator', () => {
  const sale = { totalAmount: 100, timestamp: NAIVE_LATE };

  it('aggregateDailyStats counts the sale on 17.11.', () => {
    const { items } = aggregateDailyStats([sale], 5, new Date(2026, 10, 18));
    expect(items.find(i => i.dateKey === '2026-11-17').count).toBe(1);
    expect(items.find(i => i.dateKey === '2026-11-16').count).toBe(0);
  });

  it('aggregateWeeklyStats puts a Sunday-night sale in the next week', () => {
    const { items } = aggregateWeeklyStats(
      [{ totalAmount: 50, timestamp: '2026-11-22T23:30:00' }], 2, new Date(2026, 10, 25)
    );
    expect(items[0].count).toBe(1); // week of Mon 23.11.
    expect(items[1].count).toBe(0); // week of Mon 16.11.
  });

  it('aggregateMonthlyStats puts a 30.11. night sale in December', () => {
    const { items } = aggregateMonthlyStats(
      [{ totalAmount: 50, timestamp: '2026-11-30T23:30:00' }], 2, new Date(2026, 11, 10)
    );
    expect(items[0].month).toBe(11); // December
    expect(items[0].count).toBe(1);
    expect(items[1].count).toBe(0);
  });
});

describe('useSalesPeriodFilter', () => {
  it('filters a zoneless timestamp by local day', () => {
    const history = [
      { id: 'late', timestamp: NAIVE_LATE },            // 17.11. 00:30 local
      { id: 'early', timestamp: '2026-11-16T22:30:00' }, // 16.11. 23:30 local
    ];
    const { result } = renderHook(() => useSalesPeriodFilter({ salesHistory: history, initialDateFilter: '2026-11-17' }));
    expect(result.current.periodFilteredSales.map(s => s.id)).toEqual(['late']);
  });
});

describe('csvExporter', () => {
  it('writes the local time of a zoneless timestamp', async () => {
    let blob;
    const create = vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => { blob = b; return 'blob:x'; });
    URL.revokeObjectURL = vi.fn();
    exportSalesToCSV([{ receiptNumber: 'R1', timestamp: '2026-11-16T10:00:00', totalAmount: 10 }]);
    create.mockRestore();
    const text = await blob.text();
    expect(text).toContain('11:00:00');
    expect(text).not.toContain('10:00:00');
  });
});

describe('saleSync.markStranded', () => {
  it('compares a local sale with the server page in UTC', () => {
    const backend = [{ id: 'b1', timestamp: NAIVE_LATE }]; // full page, oldest 23:30Z
    const older = { id: 'l1', totalAmount: 5, items: [{ quantity: 1 }], timestamp: '2026-11-16T23:00:00.000Z' };
    // Older than the page: cannot be judged, left alone. Read as local time the server row
    // would be 22:30Z and this sale would be wrongly marked stranded.
    expect(markStranded([older], backend, 1)[0].syncState).toBeUndefined();
  });
});

describe('SalesLedgerTable', () => {
  it('shows the local time of a zoneless timestamp', () => {
    const sale = { id: 's1', receiptNumber: '2026-000001', timestamp: '2026-11-16T10:00:00', totalAmount: 10, paymentMethod: 'cash', items: [] };
    render(
      <SalesLedgerTable
        totalItems={1} docTypeFilter="all" setDocTypeFilter={() => {}} searchTerm="" setSearchTerm={() => {}}
        pageSize={10} setPageSize={() => {}} searchFilteredSales={[sale]} paginatedSales={[sale]}
        onInitiateRefund={() => {}} onSelectSale={() => {}} isAdminMode={false} onDeleteSale={() => {}}
        startIndex={0} endIndex={1} validCurrentPage={1} totalPages={1} setCurrentPage={() => {}}
      />
    );
    expect(screen.getByText(/11:00:00/)).toBeTruthy();
  });
});

describe('parseSaleTimestamp stays compatible', () => {
  it('still reads naive input as UTC', () => {
    expect(parseSaleTimestamp(NAIVE_LATE).toISOString()).toBe('2026-11-16T23:30:00.000Z');
  });
});
