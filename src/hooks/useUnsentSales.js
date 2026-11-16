import { useCallback, useEffect, useRef, useState } from 'react';
import { createSaleBackend } from '../api/posApi';
import { SYNC, needsSync, sendOutcome, applySendResult } from '../utils/saleSync';

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
   * Sends sales one by one, oldest first. Without `ids` it sends all PENDING sales; with `ids`
   * it sends exactly those (manual "Odeslat"). Stops at the first unreachable-server result.
   * Resolves to { sent, rejected, unreachable }.
   */
  const flush = useCallback(async ({ ids } = {}) => {
    const result = { sent: 0, rejected: 0, unreachable: false };
    if (busyRef.current) return result;
    busyRef.current = true;
    setIsFlushing(true);
    try {
      const targets = salesRef.current
        .filter(s => (ids ? ids.includes(s.id) : s.syncState === SYNC.PENDING))
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      for (const sale of targets) {
        const res = await createSaleBackend(sale);
        const outcome = sendOutcome(res);
        if (outcome === 'retry') {
          result.unreachable = true;
          break;
        }
        setSalesHistory(prev => prev.map(s => (s.id === sale.id ? applySendResult(s, res) : s)));
        if (outcome === 'ok') result.sent += 1;
        else result.rejected += 1;
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
      if (salesRef.current.some(s => s.syncState === SYNC.PENDING)) flush();
    }, RETRY_INTERVAL_MS);
    return () => {
      window.removeEventListener('pos:backend-online', onBackendOnline);
      clearInterval(timer);
    };
  }, [flush]);

  const unsentSales = salesHistory.filter(needsSync);
  return { unsentSales, unsentCount: unsentSales.length, isFlushing, flush };
}
