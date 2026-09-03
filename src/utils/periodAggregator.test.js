import { describe, it, expect } from 'vitest';
import { aggregateDailyStats, aggregateWeeklyStats, aggregateMonthlyStats } from './periodAggregator';

describe('periodAggregator', () => {
  const refDate = new Date('2026-09-03T12:00:00Z');

  const mockSales = [
    { id: '1', timestamp: '2026-09-03T10:00:00Z', total_amount: 500 },
    { id: '2', timestamp: '2026-09-02T15:00:00Z', total_amount: 300 },
    { id: '3', timestamp: '2026-08-25T11:00:00Z', total_amount: 1200 },
    { id: '4', timestamp: '2026-07-15T09:00:00Z', total_amount: 4500 }
  ];

  it('aggregates daily stats for last 30 days', () => {
    const res = aggregateDailyStats(mockSales, 30, refDate, 'cs');
    expect(res.items).toHaveLength(30);
    expect(res.items[0].label).toBe('Dnes');
    expect(res.items[0].revenue).toBe(500);
    expect(res.items[0].count).toBe(1);
    expect(res.items[1].label).toBe('Včera');
    expect(res.items[1].revenue).toBe(300);
    expect(res.totalRevenue).toBe(2000); // 500 + 300 + 1200 (within 30 days)
    expect(res.totalCount).toBe(3);
    expect(res.avgRevenue).toBeCloseTo(2000 / 30, 2);
    expect(res.maxRevenue).toBe(1200);
  });

  it('aggregates weekly stats for last 12 weeks', () => {
    const res = aggregateWeeklyStats(mockSales, 12, refDate, 'cs');
    expect(res.items).toHaveLength(12);
    expect(res.items[0].isCurrent).toBe(true);
    // 2026-09-03 is in current week -> 500 + 300 = 800
    expect(res.items[0].revenue).toBe(800);
    expect(res.items[0].count).toBe(2);
    expect(res.totalRevenue).toBe(6500); // 800 + 1200 + 4500 (all within 12 weeks = 84 days)
  });

  it('aggregates monthly stats for last 12 months', () => {
    const res = aggregateMonthlyStats(mockSales, 12, refDate, 'cs');
    expect(res.items).toHaveLength(12);
    expect(res.items[0].isCurrent).toBe(true);
    // Sept 2026 -> 500 + 300 = 800
    expect(res.items[0].revenue).toBe(800);
    // Aug 2026 -> 1200
    expect(res.items[1].revenue).toBe(1200);
    // July 2026 -> 4500
    expect(res.items[2].revenue).toBe(4500);
    expect(res.totalRevenue).toBe(6500);
    expect(res.totalCount).toBe(4);
    expect(res.maxRevenue).toBe(4500);
  });

  it('handles empty sales history gracefully', () => {
    const res = aggregateDailyStats([], 30, refDate);
    expect(res.totalRevenue).toBe(0);
    expect(res.totalCount).toBe(0);
    expect(res.items).toHaveLength(30);
    expect(res.maxRevenue).toBe(0);
  });
});
