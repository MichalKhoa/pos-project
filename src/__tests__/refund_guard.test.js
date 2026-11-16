import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useState } from 'react';
import { canRefund, SYNC } from '../utils/saleSync';
import { buildRefundUpdate, revertRefund } from '../utils/refundSync';
import { useUnsentSales } from '../hooks/useUnsentSales';

afterEach(() => vi.unstubAllGlobals());

describe('refund guards (F-026)', () => {
  it('a sale the server does not have cannot be refunded', () => {
    expect(canRefund({ syncState: SYNC.PENDING })).toBe(false);
    expect(canRefund({ syncState: SYNC.STRANDED })).toBe(false);
    expect(canRefund({ syncState: SYNC.REJECTED })).toBe(false);
    expect(canRefund({ syncState: SYNC.SYNCED })).toBe(true);
    expect(canRefund({})).toBe(true);
  });

  it('buildRefundUpdate remembers the previous refund state and revertRefund restores it', () => {
    const original = { id: 'o', refundStatus: 'PARTIAL', refundedAmount: 20 };
    const update = buildRefundUpdate(original, 'FULL', 50);
    expect(update).toEqual({
      saleId: 'o', refundStatus: 'FULL', refundedAmount: 50,
      previous: { refundStatus: 'PARTIAL', refundedAmount: 20 }
    });
    const changed = [{ id: 'o', refundStatus: 'FULL', refund_status: 'FULL', refundedAmount: 50 }, { id: 'x' }];
    const back = revertRefund(changed, update);
    expect(back[0]).toMatchObject({ refundStatus: 'PARTIAL', refund_status: 'PARTIAL', refundedAmount: 20, refunded_amount: 20 });
    expect(back[1]).toEqual({ id: 'x' });
  });

  it('buildRefundUpdate defaults an untouched original to NONE and 0', () => {
    expect(buildRefundUpdate({ id: 'o' }, 'FULL', 12).previous).toEqual({ refundStatus: 'NONE', refundedAmount: 0 });
  });
});

describe('storno queue: original sale is updated only after the storno is stored', () => {
  const update = { saleId: 'orig', refundStatus: 'FULL', refundedAmount: 12, previous: { refundStatus: 'NONE', refundedAmount: 0 } };
  const storno = { id: 'storno', timestamp: '2026-11-16T10:00:00Z', syncState: SYNC.PENDING, pendingRefundUpdate: update };
  const original = { id: 'orig', timestamp: '2026-11-16T09:00:00Z', refundStatus: 'FULL', refundedAmount: 12 };

  const setup = initial => renderHook(() => {
    const [salesHistory, setSalesHistory] = useState(initial);
    return { salesHistory, ...useUnsentSales({ salesHistory, setSalesHistory }) };
  });

  const routeFetch = handlers => vi.stubGlobal('fetch', vi.fn(async (url, opts) => {
    const key = `${opts?.method || 'GET'} ${url.replace(/^.*\/api\/v1/, '')}`;
    const h = handlers[key];
    if (!h) throw new Error(`unexpected ${key}`);
    const { status, body } = h(opts);
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  }));

  it('storno stored: sends the refund status once and clears the owed update', async () => {
    const statusCalls = [];
    routeFetch({
      'POST /sales/': () => ({ status: 201, body: { status: 'SUCCESS', receipt_number: 'STORNO-1' } }),
      'PUT /sales/orig/refund-status': o => { statusCalls.push(JSON.parse(o.body)); return { status: 200, body: { status: 'SUCCESS' } }; }
    });
    const { result } = setup([storno, original]);
    await act(async () => { await result.current.flush(); });
    expect(statusCalls).toEqual([{ refund_status: 'FULL', refunded_amount: 12 }]);
    const s = result.current.salesHistory.find(x => x.id === 'storno');
    expect(s).toMatchObject({ syncState: 'SYNCED', pendingRefundUpdate: null });
  });

  it('storno refused: the original sale goes back to its earlier refund state and no status is sent', async () => {
    routeFetch({ 'POST /sales/': () => ({ status: 422, body: { detail: { code: 'TOTAL_MISMATCH' } } }) });
    const { result } = setup([storno, original]);
    await act(async () => { await result.current.flush(); });
    const byId = id => result.current.salesHistory.find(x => x.id === id);
    expect(byId('storno')).toMatchObject({ syncState: 'REJECTED', pendingRefundUpdate: null });
    expect(byId('orig')).toMatchObject({ refundStatus: 'NONE', refundedAmount: 0 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('status update fails: the update stays owed and is retried on the next flush', async () => {
    let putOk = false;
    routeFetch({
      'POST /sales/': () => ({ status: 201, body: { status: putOk ? 'ALREADY_EXISTS' : 'SUCCESS' } }),
      'PUT /sales/orig/refund-status': () => (putOk ? { status: 200, body: { status: 'SUCCESS' } } : { status: 404, body: {} })
    });
    const { result } = setup([storno, original]);
    let out;
    await act(async () => { out = await result.current.flush(); });
    expect(out.refundUpdateFailed).toBe(1);
    expect(result.current.salesHistory.find(x => x.id === 'storno')).toMatchObject({ syncState: 'SYNCED', pendingRefundUpdate: update });

    putOk = true;
    await act(async () => { out = await result.current.flush(); });
    expect(out.refundUpdateFailed).toBe(0);
    expect(result.current.salesHistory.find(x => x.id === 'storno').pendingRefundUpdate).toBeNull();
  });

  it('server unreachable: nothing is sent and the update stays with the storno', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const { result } = setup([storno, original]);
    await act(async () => { await result.current.flush(); });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.current.salesHistory.find(x => x.id === 'storno').pendingRefundUpdate).toEqual(update);
  });
});
