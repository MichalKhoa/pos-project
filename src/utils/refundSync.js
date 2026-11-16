import { updateSaleRefundStatusBackend } from '../api/posApi';

/**
 * A refund has two server calls: the storno sale itself, then the refund status of the original
 * sale. The status call must follow a stored storno (audit F-026), so it travels with the storno
 * as `pendingRefundUpdate` until both are done. `previous` lets us undo the optimistic change
 * on the original sale when the server refuses the storno.
 */
export function buildRefundUpdate(originalSale, refundStatus, refundedAmount) {
  return {
    saleId: originalSale.id,
    refundStatus,
    refundedAmount,
    previous: {
      refundStatus: originalSale.refundStatus || originalSale.refund_status || 'NONE',
      refundedAmount: Number(originalSale.refundedAmount ?? originalSale.refunded_amount ?? 0) || 0
    }
  };
}

/** Puts the original sale back to the refund state it had before the refused storno. */
export function revertRefund(sales, update) {
  return sales.map(s =>
    s.id === update.saleId
      ? {
          ...s,
          refundStatus: update.previous.refundStatus,
          refund_status: update.previous.refundStatus,
          refundedAmount: update.previous.refundedAmount,
          refunded_amount: update.previous.refundedAmount
        }
      : s
  );
}

/** Sends the refund status of the original sale. True when there is nothing to send or it worked. */
export async function settleRefundUpdate(sale) {
  const u = sale.pendingRefundUpdate;
  if (!u) return true;
  const res = await updateSaleRefundStatusBackend(u.saleId, u.refundStatus, u.refundedAmount);
  return Boolean(res);
}
