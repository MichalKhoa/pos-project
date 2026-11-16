/**
 * Local sync state of a sale (audit F-001 part 2, F-014). Kept apart from `eet_status`,
 * which describes fiscal registration, not whether the server has the sale at all.
 *
 *   PENDING   made on this register, not yet accepted by the server; resent automatically
 *   STRANDED  found locally but missing on the server after a restart; resent only by hand
 *   REJECTED  the server refused it (4xx) or it needs review; never resent automatically
 *   SYNCED    stored on the server (also the meaning of "no syncState": backend sales, old data)
 */
export const SYNC = Object.freeze({
  SYNCED: 'SYNCED',
  PENDING: 'PENDING',
  STRANDED: 'STRANDED',
  REJECTED: 'REJECTED'
});

const isEetPending = s =>
  s.eet_status === 'OFFLINE_PENDING' || s.eetStatus === 'OFFLINE_PENDING' || s.is_sent_to_eet === false;

/** Sale the server does not have yet and the cashier must know about. */
export const needsSync = s =>
  s.syncState === SYNC.PENDING || s.syncState === SYNC.STRANDED || s.syncState === SYNC.REJECTED;

/** Sale that exists only on this register: never trim it from local storage. */
export const isLocalOnly = s => needsSync(s) || isEetPending(s);

/** 'ok' stored on server, 'rejected' server refused it, 'retry' server unreachable or failing. */
export function sendOutcome(res) {
  if (res && (res.status === 'SUCCESS' || res.status === 'ALREADY_EXISTS')) return 'ok';
  if (res && res.status === 'REJECTED') return 'rejected';
  return 'retry';
}

/** New version of `sale` after a send attempt with result `res` of createSaleBackend. */
export function applySendResult(sale, res) {
  const outcome = sendOutcome(res);
  if (outcome === 'ok') {
    const receiptNumber = res.receipt_number || sale.receiptNumber;
    const invoiceNumber = res.invoice_number || sale.invoiceNumber;
    return {
      ...sale,
      receiptNumber,
      receipt_number: receiptNumber,
      invoiceNumber,
      invoice_number: invoiceNumber || sale.invoice_number,
      // ALREADY_EXISTS answers carry no fiscal codes: keep what the sale already has
      fik: res.fik ?? sale.fik,
      pok: res.fik ?? sale.pok,
      bkp: res.bkp ?? sale.bkp,
      pkp: res.pkp ?? sale.pkp,
      eet_status: res.eet_status || sale.eet_status || 'EVD_OK',
      syncState: SYNC.SYNCED,
      syncError: null
    };
  }
  if (outcome === 'rejected') {
    return { ...sale, syncState: SYNC.REJECTED, syncError: res.code || `HTTP_${res.httpStatus}` };
  }
  return { ...sale, syncState: SYNC.PENDING };
}

const hasZeroLine = s =>
  Array.isArray(s.items) && s.items.some(i => Number(i.quantity) === 0);

/**
 * Marks local sales that the server does not have (F-014 recovery, run after the first
 * successful backend contact). Only sales without a syncState are considered, so sales made
 * since this fix are never touched. `backendSales` is the newest page the server returned
 * (`limit` rows); a local sale older than that page cannot be judged and is left alone.
 * Zero-quantity or zero-total sales (F-027) are marked REJECTED/NEEDS_REVIEW, never resent.
 */
export function markStranded(localSales, backendSales, limit) {
  const backendIds = new Set(backendSales.map(s => s.id));
  const pageIsFull = backendSales.length >= limit;
  const oldest = backendSales.reduce(
    (min, s) => Math.min(min, new Date(s.timestamp).getTime()),
    Infinity
  );
  return localSales.map(s => {
    if (s.syncState || isEetPending(s) || backendIds.has(s.id)) return s;
    if (pageIsFull && new Date(s.timestamp).getTime() < oldest) return s;
    if (hasZeroLine(s) || Number(s.totalAmount) === 0) {
      return { ...s, syncState: SYNC.REJECTED, syncError: 'NEEDS_REVIEW' };
    }
    return { ...s, syncState: SYNC.STRANDED };
  });
}
