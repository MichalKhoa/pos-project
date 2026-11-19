import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { useAutoLock } from '../hooks/useAutoLock';
import { formatLocalDate, parseLocalDateStart, parseLocalDateEnd, getPeriodDateRange } from '../utils/dateUtils';
import { BURST_ENTER_GAP_MS, BURST_KEY_GAP_MS, createBurstTracker } from '../utils/scanBurst';
import * as posApi from '../api/posApi';

vi.mock('../api/posApi', () => ({
  fetchEetStatus: vi.fn(),
  processEetQueue: vi.fn(),
  createSaleBackend: vi.fn(),
  fetchSalesHistoryBackend: vi.fn()
}));

describe('useOfflineSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    posApi.fetchEetStatus.mockResolvedValue({ eet_enabled: false, pending_offline_sales: 0 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens sync modal when EET enabled and pending > 0; closes when disabled or 0', async () => {
    posApi.fetchEetStatus.mockResolvedValueOnce({ eet_enabled: true, pending_offline_sales: 3 });
    const { result } = renderHook(() => useOfflineSync());

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.pendingSyncCount).toBe(3);
    expect(result.current.showSyncModal).toBe(true);

    posApi.fetchEetStatus.mockResolvedValueOnce({ eet_enabled: false, pending_offline_sales: 3 });
    await act(async () => {
      await result.current.checkPendingOfflineSales();
    });
    expect(result.current.pendingSyncCount).toBe(0);
    expect(result.current.showSyncModal).toBe(false);
  });

  it('handleSnoozeSync suppresses modal reopen during 5-minute snooze window', async () => {
    posApi.fetchEetStatus.mockResolvedValue({ eet_enabled: true, pending_offline_sales: 2 });
    const { result } = renderHook(() => useOfflineSync());

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.showSyncModal).toBe(true);

    act(() => {
      result.current.handleSnoozeSync();
    });
    expect(result.current.showSyncModal).toBe(false);

    await act(async () => {
      await result.current.checkPendingOfflineSales();
    });
    expect(result.current.pendingSyncCount).toBe(2);
    expect(result.current.showSyncModal).toBe(false);
  });

  it('handleSyncQueueNow handles EET_DISABLED, success with local replay + history merge, failure, and thrown error', async () => {
    const setSalesHistory = vi.fn();
    const initialHistory = [{ id: 's1', eet_status: 'OFFLINE_PENDING' }];

    const { result, rerender } = renderHook(
      ({ salesHistory }) => useOfflineSync({ salesHistory, setSalesHistory }),
      { initialProps: { salesHistory: initialHistory } }
    );
    await act(async () => {
      await Promise.resolve();
    });

    posApi.processEetQueue.mockResolvedValueOnce({ status: 'EET_DISABLED', processed_count: 0 });
    posApi.fetchSalesHistoryBackend.mockResolvedValueOnce([]);
    posApi.fetchEetStatus.mockResolvedValueOnce({ eet_enabled: false, pending_offline_sales: 0 });
    rerender({ salesHistory: [] });
    await act(async () => {
      await result.current.handleSyncQueueNow();
    });
    expect(result.current.syncNotification?.type).toBe('info');

    rerender({ salesHistory: initialHistory });
    posApi.processEetQueue.mockResolvedValueOnce({ status: 'SUCCESS', processed_count: 1 });
    posApi.createSaleBackend.mockResolvedValueOnce({ status: 'ALREADY_EXISTS' });
    posApi.fetchSalesHistoryBackend.mockResolvedValueOnce([{ id: 's1', eet_status: 'EVD_OK' }]);
    posApi.fetchEetStatus.mockResolvedValueOnce({ eet_enabled: true, pending_offline_sales: 0 });
    await act(async () => {
      await result.current.handleSyncQueueNow();
    });
    expect(result.current.syncNotification?.type).toBe('success');
    expect(result.current.syncNotification?.message).toContain('2');
    expect(result.current.pendingSyncCount).toBe(0);
    expect(result.current.isSyncingQueue).toBe(false);
    const historyUpdater = setSalesHistory.mock.calls.at(-1)[0];
    expect(historyUpdater(initialHistory)).toEqual([{ id: 's1', eet_status: 'EVD_OK' }]);

    rerender({ salesHistory: [] });
    posApi.processEetQueue.mockResolvedValueOnce({ status: 'SUCCESS', processed_count: 0 });
    posApi.fetchSalesHistoryBackend.mockResolvedValueOnce([]);
    posApi.fetchEetStatus.mockResolvedValueOnce({ eet_enabled: true, pending_offline_sales: 1 });
    await act(async () => {
      await result.current.handleSyncQueueNow();
    });
    expect(result.current.syncNotification?.type).toBe('error');

    posApi.processEetQueue.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    posApi.fetchEetStatus.mockResolvedValueOnce({ eet_enabled: true, pending_offline_sales: 1 });
    await act(async () => {
      await result.current.handleSyncQueueNow();
    });
    expect(result.current.syncNotification?.type).toBe('error');
    expect(result.current.syncNotification?.message).toContain('ECONNREFUSED');
    expect(result.current.isSyncingQueue).toBe(false);
  });
});

describe('useAutoLock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-19T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('locks after autoLockMinutes of inactivity and unlockApp resets lock & timer', () => {
    const { result } = renderHook(() => useAutoLock(1));
    expect(result.current.isAppLocked).toBe(false);

    act(() => {
      vi.advanceTimersByTime(50_000);
    });
    expect(result.current.isAppLocked).toBe(false);

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(result.current.isAppLocked).toBe(true);

    act(() => {
      result.current.unlockApp();
    });
    expect(result.current.isAppLocked).toBe(false);

    act(() => {
      vi.advanceTimersByTime(50_000);
    });
    expect(result.current.isAppLocked).toBe(false);
  });

  it('user activity events postpone auto-lock', () => {
    const { result } = renderHook(() => useAutoLock(1));

    act(() => {
      vi.advanceTimersByTime(50_000);
      window.dispatchEvent(new MouseEvent('mousedown'));
      vi.advanceTimersByTime(50_000);
    });
    expect(result.current.isAppLocked).toBe(false);

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(result.current.isAppLocked).toBe(true);
  });

  it('autoLockMinutes === 0 disables auto-lock', () => {
    const { result } = renderHook(() => useAutoLock(0));

    act(() => {
      vi.advanceTimersByTime(3_600_000);
    });
    expect(result.current.isAppLocked).toBe(false);
  });
});

describe('dateUtils', () => {
  it('formatLocalDate formats local Date without UTC rollback and handles invalid input', () => {
    expect(formatLocalDate(new Date(2026, 10, 19, 23, 59, 59))).toBe('2026-11-19');
    expect(formatLocalDate(new Date(2026, 0, 5, 0, 1, 0))).toBe('2026-01-05');
    expect(formatLocalDate('not-a-date')).toBe('');
  });

  it('parseLocalDateStart and parseLocalDateEnd parse local day bounds and handle empty input', () => {
    const start = parseLocalDateStart('2026-11-19');
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(10);
    expect(start.getDate()).toBe(19);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getSeconds()).toBe(0);
    expect(start.getMilliseconds()).toBe(0);

    const end = parseLocalDateEnd('2026-11-19');
    expect(end.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(10);
    expect(end.getDate()).toBe(19);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
    expect(end.getSeconds()).toBe(59);
    expect(end.getMilliseconds()).toBe(999);

    expect(parseLocalDateStart('').getTime()).toBe(0);
  });

  it('getPeriodDateRange covers today, week (including Sunday edge case), month (leap & non-leap Feb), year, custom, and all', () => {
    const todayRange = getPeriodDateRange('today', new Date(2026, 10, 19, 14, 30));
    expect(formatLocalDate(todayRange.start)).toBe('2026-11-19');
    expect(formatLocalDate(todayRange.end)).toBe('2026-11-19');
    expect(todayRange.end.getHours()).toBe(23);

    const wedWeek = getPeriodDateRange('week', new Date(2026, 10, 18, 12, 0));
    expect(formatLocalDate(wedWeek.start)).toBe('2026-11-16');
    expect(formatLocalDate(wedWeek.end)).toBe('2026-11-22');

    const sunWeek = getPeriodDateRange('week', new Date(2026, 10, 22, 12, 0));
    expect(formatLocalDate(sunWeek.start)).toBe('2026-11-16');
    expect(formatLocalDate(sunWeek.end)).toBe('2026-11-22');

    const leapFeb = getPeriodDateRange('month', new Date(2024, 1, 10));
    expect(formatLocalDate(leapFeb.start)).toBe('2024-02-01');
    expect(formatLocalDate(leapFeb.end)).toBe('2024-02-29');

    const stdFeb = getPeriodDateRange('month', new Date(2026, 1, 10));
    expect(formatLocalDate(stdFeb.start)).toBe('2026-02-01');
    expect(formatLocalDate(stdFeb.end)).toBe('2026-02-28');

    const yearRange = getPeriodDateRange('year', new Date(2026, 5, 15));
    expect(formatLocalDate(yearRange.start)).toBe('2026-01-01');
    expect(formatLocalDate(yearRange.end)).toBe('2026-12-31');

    const customRange = getPeriodDateRange('custom', new Date(), '2026-03-01', '2026-03-15');
    expect(formatLocalDate(customRange.start)).toBe('2026-03-01');
    expect(formatLocalDate(customRange.end)).toBe('2026-03-15');

    const allRange = getPeriodDateRange('all');
    expect(allRange.start.getTime()).toBe(0);
    expect(allRange.end.getFullYear()).toBe(2099);
  });
});

describe('scanBurst (createBurstTracker)', () => {
  it('detects fast scanner burst followed by Enter within threshold and resets counter', () => {
    let clock = 1000;
    const tracker = createBurstTracker(() => clock);

    const charResults = [10, 10, 10, 10].map((step) => {
      clock += step;
      return tracker.onChar();
    });
    expect(charResults).toEqual([false, true, true, true]);

    clock += 20;
    expect(tracker.onEnter()).toBe(true);
    expect(tracker.onEnter()).toBe(false);
  });

  it('rejects slow human typing, short bursts (< 3 chars), and delayed Enter', () => {
    let clock = 1000;
    const tracker = createBurstTracker(() => clock);

    const slowChars = [0, BURST_KEY_GAP_MS + 30, BURST_KEY_GAP_MS + 30, BURST_KEY_GAP_MS + 30].map((step) => {
      clock += step;
      return tracker.onChar();
    });
    expect(slowChars).toEqual([false, false, false, false]);
    clock += 10;
    expect(tracker.onEnter()).toBe(false);

    clock += 1000;
    tracker.onChar();
    clock += 10;
    tracker.onChar();
    clock += 10;
    expect(tracker.onEnter()).toBe(false);

    clock += 1000;
    for (let i = 0; i < 4; i += 1) {
      clock += 10;
      tracker.onChar();
    }
    clock += BURST_ENTER_GAP_MS + 50;
    expect(tracker.onEnter()).toBe(false);
  });
});
