import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { createSaleBackend } from '../api/posApi';
import { SYNC, sendOutcome, applySendResult, markStranded, isLocalOnly, needsSync } from '../utils/saleSync';
import { useUnsentSales } from '../hooks/useUnsentSales';
import { setStorageItem } from '../utils/storage';

const mockFetch = (status, body) =>
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  }));

afterEach(() => vi.unstubAllGlobals());

describe('createSaleBackend result classes', () => {
  it('returns the JSON on 2xx', async () => {
    mockFetch(201, { status: 'SUCCESS', receipt_number: '2026-000009' });
    expect((await createSaleBackend({ id: 'a' })).status).toBe('SUCCESS');
  });

  it('returns REJECTED with the server code on 422', async () => {
    mockFetch(422, { detail: { code: 'TOTAL_MISMATCH', client_total: 12, server_total: 11.5 } });
    const res = await createSaleBackend({ id: 'a' });
    expect(res).toMatchObject({ status: 'REJECTED', httpStatus: 422, code: 'TOTAL_MISMATCH' });
  });

  it('returns REJECTED with HTTP_<n> when the body has no code', async () => {
    mockFetch(400, {});
    expect((await createSaleBackend({ id: 'a' })).code).toBe('HTTP_400');
  });

  it('returns null on 5xx, 429 and network errors (retryable)', async () => {
    mockFetch(500, {});
    expect(await createSaleBackend({ id: 'a' })).toBeNull();
    mockFetch(429, {});
    expect(await createSaleBackend({ id: 'a' })).toBeNull();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    expect(await createSaleBackend({ id: 'a' })).toBeNull();
  });

  it('does not send local sync fields to the server', async () => {
    mockFetch(201, { status: 'SUCCESS' });
    await createSaleBackend({ id: 'a', syncState: 'PENDING', syncError: 'X', totalAmount: 5 });
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body).toEqual({ id: 'a', totalAmount: 5 });
  });
});

describe('saleSync helpers', () => {
  it('classifies outcomes', () => {
    expect(sendOutcome({ status: 'SUCCESS' })).toBe('ok');
    expect(sendOutcome({ status: 'ALREADY_EXISTS' })).toBe('ok');
    expect(sendOutcome({ status: 'REJECTED' })).toBe('rejected');
    expect(sendOutcome(null)).toBe('retry');
  });

  it('applySendResult: ok keeps the server receipt number and marks SYNCED', () => {
    const sale = { id: 's', receiptNumber: '2026-000001', syncState: SYNC.PENDING };
    const out = applySendResult(sale, { status: 'SUCCESS', receipt_number: '2026-000007', eet_status: 'DISABLED' });
    expect(out).toMatchObject({ syncState: 'SYNCED', receiptNumber: '2026-000007', eet_status: 'DISABLED', syncError: null });
  });

  it('applySendResult: rejected keeps the code, retry stays PENDING', () => {
    const sale = { id: 's', syncState: SYNC.PENDING };
    expect(applySendResult(sale, { status: 'REJECTED', code: 'TOTAL_MISMATCH' }))
      .toMatchObject({ syncState: 'REJECTED', syncError: 'TOTAL_MISMATCH' });
    expect(applySendResult(sale, null).syncState).toBe('PENDING');
  });

  it('isLocalOnly covers unsent and EET-pending sales, not synced ones', () => {
    expect(isLocalOnly({ syncState: 'PENDING' })).toBe(true);
    expect(isLocalOnly({ eet_status: 'OFFLINE_PENDING' })).toBe(true);
    expect(isLocalOnly({ syncState: 'SYNCED' })).toBe(false);
    expect(isLocalOnly({})).toBe(false);
    expect(needsSync({ syncState: 'SYNCED' })).toBe(false);
  });
});

describe('markStranded (restart recovery)', () => {
  const sale = (id, ts, extra = {}) => ({ id, timestamp: ts, totalAmount: 50, items: [{ quantity: 1 }], ...extra });
  const backend = [sale('b1', '2026-11-16T10:00:00Z'), sale('b2', '2026-11-16T09:00:00Z')];

  it('marks a legacy local sale that the server lacks as STRANDED', () => {
    const out = markStranded([sale('lost', '2026-11-16T09:30:00Z')], backend, 100);
    expect(out[0].syncState).toBe('STRANDED');
  });

  it('leaves sales the server has, sales with a syncState, and EET-pending sales alone', () => {
    const local = [
      sale('b1', '2026-11-16T10:00:00Z'),
      sale('mine', '2026-11-16T10:30:00Z', { syncState: 'PENDING' }),
      sale('eet', '2026-11-16T10:40:00Z', { eet_status: 'OFFLINE_PENDING' })
    ];
    expect(markStranded(local, backend, 100)).toEqual(local);
  });

  it('never auto-queues zero-quantity or zero-total sales', () => {
    const zeroQty = sale('z1', '2026-11-16T09:30:00Z', { items: [{ quantity: 0 }] });
    const zeroTotal = sale('z2', '2026-11-16T09:31:00Z', { totalAmount: 0 });
    const out = markStranded([zeroQty, zeroTotal], backend, 100);
    expect(out.map(s => [s.syncState, s.syncError])).toEqual([
      ['REJECTED', 'NEEDS_REVIEW'],
      ['REJECTED', 'NEEDS_REVIEW']
    ]);
  });

  it('cannot judge sales older than a full backend page', () => {
    const old = sale('old', '2026-01-01T00:00:00Z');
    expect(markStranded([old], backend, 2)[0].syncState).toBeUndefined();
    expect(markStranded([old], backend, 100)[0].syncState).toBe('STRANDED');
  });

  it('works when the server returned no sales at all', () => {
    expect(markStranded([sale('x', '2026-11-16T09:30:00Z')], [], 100)[0].syncState).toBe('STRANDED');
  });
});

describe('useUnsentSales', () => {
  const pending = (id, ts) => ({ id, timestamp: ts, receiptNumber: `R-${id}`, syncState: SYNC.PENDING });

  const setup = initial => renderHook(() => {
    const [salesHistory, setSalesHistory] = useState(initial);
    return { salesHistory, ...useUnsentSales({ salesHistory, setSalesHistory }) };
  });

  it('flush on pos:backend-online sends each pending sale exactly once, oldest first', async () => {
    const calls = [];
    vi.stubGlobal('fetch', vi.fn(async (url, opts) => {
      calls.push(JSON.parse(opts.body).id);
      return { ok: true, status: 201, json: async () => ({ status: 'SUCCESS', receipt_number: 'S' }) };
    }));
    const { result } = setup([pending('b', '2026-11-16T10:00:00Z'), pending('a', '2026-11-16T09:00:00Z')]);
    expect(result.current.unsentCount).toBe(2);
    await act(async () => { window.dispatchEvent(new CustomEvent('pos:backend-online')); });
    await waitFor(() => expect(result.current.unsentCount).toBe(0));
    expect(calls).toEqual(['a', 'b']);
    expect(result.current.salesHistory.every(s => s.syncState === 'SYNCED')).toBe(true);
  });

  it('stops at the first unreachable result and keeps the rest PENDING', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const { result } = setup([pending('a', '2026-11-16T09:00:00Z'), pending('b', '2026-11-16T10:00:00Z')]);
    let out;
    await act(async () => { out = await result.current.flush(); });
    expect(out).toEqual({ sent: 0, rejected: 0, unreachable: true, refundUpdateFailed: 0 });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.current.unsentCount).toBe(2);
  });

  it('a 4xx marks the sale REJECTED and is not retried automatically', async () => {
    mockFetch(422, { detail: { code: 'TOTAL_MISMATCH' } });
    const { result } = setup([pending('a', '2026-11-16T09:00:00Z')]);
    await act(async () => { await result.current.flush(); });
    expect(result.current.salesHistory[0]).toMatchObject({ syncState: 'REJECTED', syncError: 'TOTAL_MISMATCH' });
    await act(async () => { await result.current.flush(); });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('a manual flush with ids sends a STRANDED sale, automatic flush does not', async () => {
    mockFetch(201, { status: 'SUCCESS', receipt_number: 'S' });
    const { result } = setup([{ id: 'x', timestamp: '2026-11-16T09:00:00Z', syncState: SYNC.STRANDED }]);
    await act(async () => { await result.current.flush(); });
    expect(fetch).not.toHaveBeenCalled();
    await act(async () => { await result.current.flush({ ids: ['x'] }); });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.current.salesHistory[0].syncState).toBe('SYNCED');
  });
});

describe('setStorageItem quota guard', () => {
  it('returns false when localStorage throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    expect(setStorageItem('sales', [1])).toBe(false);
    spy.mockRestore();
    expect(setStorageItem('sales', [1])).toBe(true);
  });
});
