import { calculateCartTotals, roundCashTotal } from './tax';
import { normalizeSale } from '../api/posApi';

/**
 * Builds the sale object that the register stores locally and POSTs to /api/v1/sales/.
 * Pure (no state, no clock, no storage) so the payload can be tested against the backend
 * with shared fixtures in backend/tests/fixtures/sales.
 *
 * @param {object} p
 * @param {string} p.id                sale id
 * @param {string} p.receiptNumber     client-proposed receipt number
 * @param {string} p.timestamp         ISO timestamp
 * @param {Array}  p.cartItems         cart lines (price, quantity, vat, discountPercent, ...)
 * @param {number} p.cartDiscountPercent
 * @param {string} p.method            'cash' | 'card' | 'qr' | 'split'
 * @param {number} p.tenderedAmount
 * @param {number} p.changeDue
 * @param {object|null} p.splitDetails
 * @param {object} p.invoice           B2B fields: isInvoice, is_invoice, customerIco, customer_ico, ...
 * @returns {{ sale: object, finalGrandTotal: number }}
 */
export function buildSalePayload({
  id,
  receiptNumber,
  timestamp,
  cartItems,
  cartDiscountPercent = 0,
  method,
  tenderedAmount = 0,
  changeDue = 0,
  splitDetails = null,
  invoice = {}
}) {
  const { finalGrandTotal, taxSummary } = calculateCartTotals(cartItems, cartDiscountPercent);
  const isCash = method === 'cash';

  const {
    isInvoice,
    is_invoice,
    customerIco,
    customer_ico,
    customerDic,
    customer_dic,
    customerName,
    customer_name,
    customerAddress,
    customer_address
  } = invoice;

  const sale = normalizeSale({
    id,
    receiptNumber,
    timestamp,
    items: cartItems.map((item, index) => ({
      id: item.id || `${id}-item-${index}`,
      name: item.name,
      price: parseFloat(item.price),
      quantity: item.quantity,
      vat: item.vat !== undefined ? parseInt(item.vat, 10) : 21,
      discount_percent: item.discountPercent || 0
    })),
    totalAmount: isCash ? roundCashTotal(finalGrandTotal) : finalGrandTotal,
    cashRounding: isCash ? Math.round((roundCashTotal(finalGrandTotal) - finalGrandTotal + Number.EPSILON) * 100) / 100 : 0,
    cartDiscountPercent,
    paymentMethod: method,
    splitDetails: splitDetails || null,
    tenderedAmount: isCash ? tenderedAmount : finalGrandTotal,
    changeDue: isCash ? changeDue : 0,
    taxSummary,
    isInvoice: isInvoice || is_invoice || false,
    is_invoice: is_invoice || isInvoice || false,
    customerIco: customerIco || customer_ico || null,
    customer_ico: customer_ico || customerIco || null,
    customerDic: customerDic || customer_dic || null,
    customer_dic: customer_dic || customerDic || null,
    customerName: customerName || customer_name || null,
    customer_name: customer_name || customerName || null,
    customerAddress: customerAddress || customer_address || null,
    customer_address: customer_address || customerAddress || null
  });

  return { sale, finalGrandTotal };
}
