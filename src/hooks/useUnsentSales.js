import { useCallback, useEffect, useRef, useState } from 'react';
import { createSaleBackend } from '../api/posApi';
import { SYNC, needsSync, sendOutcome, applySendResult } from '../utils/saleSync';
import { revertRefund, settleRefundUpdate } from '../utils/refundSync';

const RETRY_INTERVAL_MS = 30000;

/**
 * Keeps sales that the server has not accepted yet (audit F-014) and resends them.
 * Automatic resend only touches PENDING sales: on `pos:backend-online`, every 30 s, and on
 * demand. Resending is safe because the server answers ALREADY_EXISTS for a known sale id.
 */
export function useUnsentSales({ salesHistory, setSalesHistory, onSent }) {
  const [isFlushing, setIsFlushing] = useState(false);
  const salesRef = useRef(salesHistory);
  const busyRef = useRef(false);
  const onSentRef = useRef(onSent);

  useEffect(() => {
    salesRef.current = salesHistory;
    onSentRef.current = onSent;
  }, [salesHistory, onSent]);

  /**
   * Sends sales one by one, oldest first. Without `ids` it sends all PENDING sales (and stornos
   * whose original-sale update is still owed); with `ids` it sends exactly those (manual
   * "Odeslat"). Stops at the first unreachable-server result.
   * Resolves to { sent, rejected, unreachable, refundUpdateFailed }.
   */
  const flush = useCallback(async ({ ids } = {}) => {
    const result = { sent: 0, rejected: 0, unreachable: false, refundUpdateFailed: 0 };
    if (busyRef.current) return result;
    busyRef.current = true;
    setIsFlushing(true);
    try {
      const targets = salesRef.current
        .filter(s => (ids
          ? ids.includes(s.id)
          : s.syncState === SYNC.PENDING || (s.syncState === SYNC.SYNCED && s.pendingRefundUpdate)))
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      for (const sale of targets) {
        const res = await createSaleBackend(sale);
        const outcome = sendOutcome(res);
        if (outcome === 'retry') {
          result.unreachable = true;
          break;
        }
        setSalesHistory(prev => {
          let next = prev.map(s => (s.id === sale.id ? applySendResult(s, res) : s));
          if (outcome === 'rejected' && sale.pendingRefundUpdate) {
            // refused storno: the original sale goes back to how it was
            next = revertRefund(next, sale.pendingRefundUpdate)
              .map(s => (s.id === sale.id ? { ...s, pendingRefundUpdate: null } : s));
          }
          return next;
        });
        if (outcome === 'rejected') {
          result.rejected += 1;
          continue;
        }
        if (sale.syncState !== SYNC.SYNCED) result.sent += 1;
        if (sale.pendingRefundUpdate) {
          if (await settleRefundUpdate(sale)) {
            setSalesHistory(prev => prev.map(s => (s.id === sale.id ? { ...s, pendingRefundUpdate: null } : s)));
          } else {
            result.refundUpdateFailed += 1;
          }
        }
      }
    } finally {
      busyRef.current = false;
      setIsFlushing(false);
    }
    if (result.sent > 0) onSentRef.current?.();
    return result;
  }, [setSalesHistory]);

  useEffect(() => {
    const onBackendOnline = () => { flush(); };
    window.addEventListener('pos:backend-online', onBackendOnline);
    const timer = setInterval(() => {
      if (salesRef.current.some(s => s.syncState === SYNC.PENDING || (s.syncState === SYNC.SYNCED && s.pendingRefundUpdate))) flush();
    }, RETRY_INTERVAL_MS);
    return () => {
      window.removeEventListener('pos:backend-online', onBackendOnline);
      clearInterval(timer);
    };
  }, [flush]);

  const unsentSales = salesHistory.filter(needsSync);
  return { unsentSales, unsentCount: unsentSales.length, isFlushing, flush };
}
