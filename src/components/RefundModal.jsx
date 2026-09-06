import React, { useState } from 'react';
import { RotateCcw, Banknote, CreditCard, Minus, Plus, Calendar, User, AlertTriangle, RotateCcw as ReturnIcon } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext.jsx';

const REASON_PRESETS = [
  'Vada / poškození zboží',
  'Nevhodný dárkový předmět',
  'Chyba při markování',
  'Odstoupení od smlouvy',
  'Jiné (vlastní popis)'
];

export default function RefundModal({ sale, onClose, onConfirmRefund }) {
  const { t } = useTranslation();
  const originalItems = sale?.items || [];

  const getMaxRefundableQty = (item) => {
    if (item.remaining_quantity !== undefined) return Math.max(0, item.remaining_quantity);
    if (item.remainingQuantity !== undefined) return Math.max(0, item.remainingQuantity);
    const refunded = item.refunded_quantity || item.refundedQuantity || 0;
    return Math.max(0, (item.quantity || 1) - refunded);
  };

  // Track return quantity per item id or index
  const [returnQuantities, setReturnQuantities] = useState(() => {
    const initial = {};
    originalItems.forEach((item, idx) => {
      const key = item.id || `idx-${idx}`;
      initial[key] = getMaxRefundableQty(item); // Default to maximum refundable remaining
    });
    return initial;
  });

  const [refundMode, setRefundMode] = useState('full');
  const [selectedReasonPreset, setSelectedReasonPreset] = useState(REASON_PRESETS[0]);
  const [customReasonText, setCustomReasonText] = useState('');
  const [refundPaymentMethod, setRefundPaymentMethod] = useState(sale?.paymentMethod || sale?.payment_method || 'cash');
  const [isDamagedWaste, setIsDamagedWaste] = useState(false);

  if (!sale) return null;

  const totalMaxRefundable = originalItems.reduce((sum, item) => sum + getMaxRefundableQty(item), 0);
  const isFullyRefundedAlready = originalItems.length > 0 && totalMaxRefundable === 0;

  const handleModeChange = (mode) => {
    setRefundMode(mode);
    if (mode === 'full') {
      const fullQty = {};
      originalItems.forEach((item, idx) => {
        const key = item.id || `idx-${idx}`;
        fullQty[key] = getMaxRefundableQty(item);
      });
      setReturnQuantities(fullQty);
    }
  };

  const handleQtyChange = (key, newQty, maxQty) => {
    const validQty = Math.max(0, Math.min(newQty, maxQty));
    setReturnQuantities(prev => ({
      ...prev,
      [key]: validQty
    }));
    setRefundMode('partial');
  };

  const returnedItems = originalItems.map((item, idx) => {
    const key = item.id || `idx-${idx}`;
    const qtyToReturn = returnQuantities[key] || 0;
    const disc = item.discountPercent || item.discount_percent || 0;
    const effPrice = item.price * (1 - disc / 100);
    const lineTotal = effPrice * qtyToReturn;
    return {
      ...item,
      quantityToReturn: qtyToReturn,
      lineTotal
    };
  }).filter(i => i.quantityToReturn > 0);

  const rawRefundSubtotal = returnedItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const cartDiscountPercent = sale.cartDiscountPercent || sale.cart_discount_percent || 0;
  const cartDiscountAmount = rawRefundSubtotal * (cartDiscountPercent / 100);
  const totalRefundAmount = Math.max(0, rawRefundSubtotal - cartDiscountAmount);

  const cartDiscountFactor = rawRefundSubtotal > 0 ? totalRefundAmount / rawRefundSubtotal : 1;
  const refundTaxSummary = returnedItems.reduce((acc, item) => {
    const rate = item.vat !== undefined ? parseInt(item.vat, 10) : 21;
    const itemFinalGross = item.lineTotal * cartDiscountFactor;
    const netPrice = rate > 0 ? itemFinalGross / (1 + rate / 100) : itemFinalGross;
    const taxAmount = itemFinalGross - netPrice;

    if (!acc[rate]) {
      acc[rate] = { rate, gross: 0, net: 0, tax: 0 };
    }
    acc[rate].gross += itemFinalGross;
    acc[rate].net += netPrice;
    acc[rate].tax += taxAmount;
    return acc;
  }, {});

  const finalReason = selectedReasonPreset === 'Jiné (vlastní popis)'
    ? (customReasonText.trim() || 'Storno prodeje')
    : selectedReasonPreset;

  const handleConfirm = () => {
    if (returnedItems.length === 0) {
      alert('Vyberte prosím alespoň jednu položku k vrácení.');
      return;
    }

    onConfirmRefund({
      originalSale: sale,
      returnedItems,
      totalRefundAmount,
      refundTaxSummary,
      refundReason: finalReason,
      paymentMethod: refundPaymentMethod,
      restock: !isDamagedWaste,
      isFullRefund: returnedItems.length === originalItems.length && returnedItems.every((item, idx) => item.quantityToReturn === getMaxRefundableQty(originalItems[idx]))
    });
  };

  const rawDate = sale.timestamp || sale.created_at || sale.date;
  const formattedDate = rawDate ? new Date(rawDate).toLocaleString('cs-CZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }) : '-';

  const cashierName = sale.cashierName || sale.cashier || sale.user || 'Admin';
  const origPayment = sale.paymentMethod || sale.payment_method || 'cash';
  const paymentLabel = origPayment === 'card' ? t('payment.card') : (origPayment === 'split' ? t('payment.split') : t('payment.cash'));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '680px',
          width: '95vw',
          maxHeight: '90dvh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Modal Header */}
        <div className="modal-header header-warning" style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', flexShrink: 0 }}>
          <div className="modal-header-title">
            <RotateCcw size={22} />
            <span>{t('refund.title')}</span>
          </div>
          <button className="close-modal-btn" onClick={onClose}>✕</button>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ gap: '1rem', overflowY: 'auto', flex: 1, padding: '1.25rem' }}>
          
          {/* Header Metadata Badge Card */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.6rem',
            background: 'var(--bg-input)',
            padding: '0.85rem 1.1rem',
            borderRadius: 'var(--radius-md)',
            borderLeft: '4px solid #ef4444'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t('refund.orig_doc')}:</div>
                <div style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                  {t('refund.orig_receipt')} #{sale.receiptNumber || sale.receipt_number}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t('refund.orig_total')}:</div>
                <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--accent-blue)' }}>
                  {(sale.totalAmount !== undefined ? sale.totalAmount : (sale.total_amount || 0)).toFixed(0)} Kč
                </div>
              </div>
            </div>

            {/* Structured badge chips for timestamp, cashier, and payment method */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem',
              fontSize: '0.78rem',
              color: 'var(--text-secondary)',
              borderTop: '1px solid var(--border-color)',
              paddingTop: '0.5rem'
            }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: 'var(--bg-card)', padding: '0.25rem 0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
                <span>{formattedDate}</span>
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: 'var(--bg-card)', padding: '0.25rem 0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                <User size={13} style={{ color: 'var(--text-muted)' }} />
                <span>{cashierName}</span>
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: 'var(--bg-card)', padding: '0.25rem 0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {origPayment === 'card' ? <CreditCard size={13} style={{ color: 'var(--text-muted)' }} /> : <Banknote size={13} style={{ color: 'var(--text-muted)' }} />}
                <span>{paymentLabel}</span>
              </span>
            </div>
          </div>

          {/* Already Fully Refunded Warning */}
          {isFullyRefundedAlready && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: 'var(--radius-md)',
              padding: '0.75rem 1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              color: '#ef4444',
              fontWeight: '700',
              fontSize: '0.9rem'
            }}>
              <AlertTriangle size={20} style={{ flexShrink: 0 }} />
              <span>{t('refund.already_fully_refunded')}</span>
            </div>
          )}

          {/* Mode Selector */}
          <div>
            <label className="form-label" style={{ fontWeight: '700', marginBottom: '0.4rem', display: 'block' }}>
              {t('refund.refund_type')}:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <button
                type="button"
                className={`btn ${refundMode === 'full' ? 'btn-primary' : 'btn-outline'}`}
                style={{
                  height: '44px',
                  fontWeight: '700',
                  background: refundMode === 'full' ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 'transparent',
                  borderColor: refundMode === 'full' ? '#ef4444' : 'var(--border-color)'
                }}
                onClick={() => handleModeChange('full')}
                disabled={isFullyRefundedAlready}
              >
                {t('refund.full_refund')}
              </button>
              <button
                type="button"
                className={`btn ${refundMode === 'partial' ? 'btn-primary' : 'btn-outline'}`}
                style={{
                  height: '44px',
                  fontWeight: '700',
                  background: refundMode === 'partial' ? 'var(--accent-blue)' : 'transparent',
                  borderColor: refundMode === 'partial' ? 'var(--accent-blue)' : 'var(--border-color)'
                }}
                onClick={() => handleModeChange('partial')}
                disabled={isFullyRefundedAlready}
              >
                {t('refund.partial_refund')}
              </button>
            </div>
          </div>

          {/* Items Table with 1-tap quick action buttons */}
          <div>
            <label className="form-label" style={{ fontWeight: '700', marginBottom: '0.4rem', display: 'block' }}>
              {t('refund.items_to_return')}:
            </label>
            <div style={{
              maxHeight: '230px',
              overflowY: 'auto',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-card)'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '0.6rem 0.8rem' }}>{t('presets.col_name')}</th>
                    <th style={{ padding: '0.6rem 0.8rem', textAlign: 'center' }}>Zakoupeno / Zbývá</th>
                    <th style={{ padding: '0.6rem 0.8rem', textAlign: 'center' }}>K vrácení</th>
                    <th style={{ padding: '0.6rem 0.8rem', textAlign: 'right' }}>Celkem</th>
                  </tr>
                </thead>
                <tbody>
                  {originalItems.map((item, idx) => {
                    const key = item.id || `idx-${idx}`;
                    const qty = returnQuantities[key] || 0;
                    const maxQty = getMaxRefundableQty(item);
                    const refundedQty = item.refunded_quantity || item.refundedQuantity || 0;
                    const disc = item.discountPercent || item.discount_percent || 0;
                    const unitPrice = item.price * (1 - disc / 100);
                    const isSelected = qty > 0;

                    return (
                      <tr key={idx} style={{
                        borderBottom: '1px solid var(--border-color)',
                        background: isSelected ? 'rgba(239, 68, 68, 0.06)' : 'transparent'
                      }}>
                        <td style={{ padding: '0.6rem 0.8rem' }}>
                          <div style={{ fontWeight: '600' }}>{item.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {unitPrice.toFixed(0)} Kč / ks {disc > 0 ? `(-${disc}%)` : ''} • DPH {item.vat}%
                            {refundedQty > 0 && (
                              <span style={{ marginLeft: '0.4rem', color: '#ef4444', fontWeight: '600' }}>
                                (vráceno {refundedQty} ks)
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '0.6rem 0.8rem', textAlign: 'center', fontWeight: '700' }}>
                          <div>{item.quantity} ks</div>
                          <div style={{
                            fontSize: '0.74rem',
                            color: maxQty > 0 ? 'var(--accent-blue)' : 'var(--text-muted)',
                            fontWeight: '600',
                            marginTop: '2px'
                          }}>
                            {t('refund.remaining_refundable', { qty: maxQty })}
                          </div>
                        </td>
                        <td style={{ padding: '0.6rem 0.8rem', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                            {/* 1-tap [- 1 ks] Quick Action */}
                            <button
                              type="button"
                              className="btn btn-outline"
                              style={{
                                minWidth: '40px',
                                height: '40px',
                                padding: '0 0.35rem',
                                fontSize: '0.72rem',
                                fontWeight: '700',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '2px',
                                whiteSpace: 'nowrap',
                                flexShrink: 0
                              }}
                              onClick={() => handleQtyChange(key, qty - 1, maxQty)}
                              disabled={qty <= 0}
                              title="-1 ks"
                            >
                              <Minus size={13} /> 1 ks
                            </button>

                            <span style={{ minWidth: '24px', textAlign: 'center', fontWeight: '800', fontSize: '0.95rem', color: isSelected ? '#ef4444' : 'var(--text-primary)' }}>
                              {qty}
                            </span>

                            {/* 1-tap [+ 1 ks] Quick Action */}
                            <button
                              type="button"
                              className="btn btn-outline"
                              style={{
                                minWidth: '40px',
                                height: '40px',
                                padding: '0 0.35rem',
                                fontSize: '0.72rem',
                                fontWeight: '700',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '2px',
                                whiteSpace: 'nowrap',
                                flexShrink: 0
                              }}
                              onClick={() => handleQtyChange(key, qty + 1, maxQty)}
                              disabled={qty >= maxQty}
                              title="+1 ks"
                            >
                              <Plus size={13} /> 1 ks
                            </button>

                            {/* 1-tap [Vrátit vše] Quick Action */}
                            <button
                              type="button"
                              className="btn btn-outline"
                              style={{
                                height: '40px',
                                padding: '0 0.5rem',
                                fontSize: '0.72rem',
                                fontWeight: '700',
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                                background: qty === maxQty && maxQty > 0 ? 'rgba(239, 68, 68, 0.12)' : 'transparent',
                                borderColor: qty === maxQty && maxQty > 0 ? '#ef4444' : 'var(--border-color)',
                                color: qty === maxQty && maxQty > 0 ? '#ef4444' : 'var(--text-primary)'
                              }}
                              onClick={() => handleQtyChange(key, maxQty, maxQty)}
                              disabled={maxQty <= 0 || qty === maxQty}
                              title={t('refund.return_all')}
                            >
                              {t('refund.return_all')}
                            </button>
                          </div>
                        </td>
                        <td style={{ padding: '0.6rem 0.8rem', textAlign: 'right', fontWeight: '700', color: isSelected ? '#ef4444' : 'var(--text-muted)' }}>
                          {(unitPrice * qty).toFixed(0)} Kč
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Reason & Return Method Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="form-label" style={{ fontWeight: '700', marginBottom: '0.4rem', display: 'block' }}>
                {t('refund.reason')}:
              </label>
              <select
                className="form-input"
                style={{ width: '100%', height: '42px', marginBottom: selectedReasonPreset === 'Jiné (vlastní popis)' ? '0.5rem' : '0' }}
                value={selectedReasonPreset}
                onChange={e => setSelectedReasonPreset(e.target.value)}
              >
                {REASON_PRESETS.map((p, i) => (
                  <option key={i} value={p}>{p}</option>
                ))}
              </select>
              {selectedReasonPreset === 'Jiné (vlastní popis)' && (
                <input
                  type="text"
                  className="form-input"
                  placeholder="Specific reason..."
                  value={customReasonText}
                  onChange={e => setCustomReasonText(e.target.value)}
                  style={{ width: '100%', height: '42px' }}
                />
              )}
            </div>

            <div>
              <label className="form-label" style={{ fontWeight: '700', marginBottom: '0.4rem', display: 'block' }}>
                {t('refund.return_method')}:
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className={`btn ${refundPaymentMethod === 'cash' ? 'btn-primary' : 'btn-outline'}`}
                  style={{ flex: 1, height: '42px', fontSize: '0.8rem', gap: '0.3rem' }}
                  onClick={() => setRefundPaymentMethod('cash')}
                >
                  <Banknote size={16} />
                  <span>{t('payment.cash')}</span>
                </button>
                <button
                  type="button"
                  className={`btn ${refundPaymentMethod === 'card' ? 'btn-primary' : 'btn-outline'}`}
                  style={{ flex: 1, height: '42px', fontSize: '0.8rem', gap: '0.3rem' }}
                  onClick={() => setRefundPaymentMethod('card')}
                >
                  <CreditCard size={16} />
                  <span>{t('payment.card')}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Damaged / Scrap restock checkbox */}
          <div style={{
            background: 'var(--bg-input)',
            padding: '0.6rem 0.9rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem'
          }}>
            <input
              type="checkbox"
              id="damagedWasteCheck"
              checked={isDamagedWaste}
              onChange={e => setIsDamagedWaste(e.target.checked)}
              style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#ef4444' }}
            />
            <label htmlFor="damagedWasteCheck" style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)', cursor: 'pointer' }}>
              Poškozeno / Likvidace (Nenaskladňovat položky zpět do skladu)
            </label>
          </div>

          {/* Refund Total Summary Callout */}
          <div style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '0.9rem 1.1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <div style={{ fontSize: '0.85rem', color: '#dc2626', fontWeight: '700' }}>
                {t('refund.total_refund')}:
              </div>
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: '900', color: '#dc2626' }}>
              -{totalRefundAmount.toFixed(0)} Kč
            </div>
          </div>

          {/* Footer Action Buttons */}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
              style={{ height: '44px', minWidth: '40px', padding: '0 1.25rem' }}
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{
                height: '44px',
                minWidth: '40px',
                padding: '0 1.5rem',
                fontWeight: '800',
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                borderColor: '#ef4444',
                gap: '0.5rem'
              }}
              onClick={handleConfirm}
              disabled={returnedItems.length === 0 || isFullyRefundedAlready}
            >
              <ReturnIcon size={18} />
              <span>{t('refund.confirm_btn')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

