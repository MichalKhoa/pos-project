import React, { useState } from 'react';
import { RotateCcw, Banknote, CreditCard, Minus, Plus } from 'lucide-react';
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

  // Track return quantity per item id or index
  const [returnQuantities, setReturnQuantities] = useState(() => {
    const initial = {};
    originalItems.forEach((item, idx) => {
      const key = item.id || `idx-${idx}`;
      initial[key] = item.quantity; // Default to full return
    });
    return initial;
  });

  const [refundMode, setRefundMode] = useState('full');
  const [selectedReasonPreset, setSelectedReasonPreset] = useState(REASON_PRESETS[0]);
  const [customReasonText, setCustomReasonText] = useState('');
  const [refundPaymentMethod, setRefundPaymentMethod] = useState(sale?.paymentMethod || 'cash');

  if (!sale) return null;

  const handleModeChange = (mode) => {
    setRefundMode(mode);
    if (mode === 'full') {
      const fullQty = {};
      originalItems.forEach((item, idx) => {
        const key = item.id || `idx-${idx}`;
        fullQty[key] = item.quantity;
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
    const disc = item.discountPercent || 0;
    const effPrice = item.price * (1 - disc / 100);
    const lineTotal = effPrice * qtyToReturn;
    return {
      ...item,
      quantityToReturn: qtyToReturn,
      lineTotal
    };
  }).filter(i => i.quantityToReturn > 0);

  const rawRefundSubtotal = returnedItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const cartDiscountPercent = sale.cartDiscountPercent || 0;
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
      isFullRefund: returnedItems.length === originalItems.length && returnedItems.every((item, idx) => item.quantityToReturn === originalItems[idx].quantity)
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '620px' }}>
        <div className="modal-header header-warning" style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}>
          <div className="modal-header-title">
            <RotateCcw size={22} />
            <span>{t('refund.title')}</span>
          </div>
          <button className="close-modal-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ gap: '1.2rem' }}>
          <div style={{
            display: 'flex',
            justify: 'space-between',
            alignItems: 'center',
            background: 'var(--bg-input)',
            padding: '0.85rem 1.1rem',
            borderRadius: 'var(--radius-md)',
            borderLeft: '4px solid #ef4444'
          }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t('refund.orig_doc')}:</div>
              <div style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                {t('refund.orig_receipt')} #{sale.receiptNumber}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t('refund.orig_total')}:</div>
              <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--accent-blue)' }}>
                {(sale.totalAmount || 0).toFixed(0)} Kč
              </div>
            </div>
          </div>

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
              >
                {t('refund.partial_refund')}
              </button>
            </div>
          </div>

          <div>
            <label className="form-label" style={{ fontWeight: '700', marginBottom: '0.4rem', display: 'block' }}>
              {t('refund.items_to_return')}:
            </label>
            <div style={{
              maxHeight: '220px',
              overflowY: 'auto',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-card)'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '0.6rem 0.8rem' }}>{t('presets.col_name')}</th>
                    <th style={{ padding: '0.6rem 0.8rem', textAlign: 'center' }}>Purchased</th>
                    <th style={{ padding: '0.6rem 0.8rem', textAlign: 'center' }}>Return Qty</th>
                    <th style={{ padding: '0.6rem 0.8rem', textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {originalItems.map((item, idx) => {
                    const key = item.id || `idx-${idx}`;
                    const qty = returnQuantities[key] || 0;
                    const disc = item.discountPercent || 0;
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
                          </div>
                        </td>
                        <td style={{ padding: '0.6rem 0.8rem', textAlign: 'center', fontWeight: '700' }}>
                          {item.quantity} ks
                        </td>
                        <td style={{ padding: '0.6rem 0.8rem', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                            <button
                              type="button"
                              className="qty-btn"
                              style={{ width: '28px', height: '28px', padding: 0 }}
                              onClick={() => handleQtyChange(key, qty - 1, item.quantity)}
                              disabled={qty <= 0}
                            >
                              <Minus size={14} />
                            </button>
                            <span style={{ minWidth: '24px', fontWeight: '800', fontSize: '0.95rem' }}>
                              {qty}
                            </span>
                            <button
                              type="button"
                              className="qty-btn"
                              style={{ width: '28px', height: '28px', padding: 0 }}
                              onClick={() => handleQtyChange(key, qty + 1, item.quantity)}
                              disabled={qty >= item.quantity}
                            >
                              <Plus size={14} />
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="form-label" style={{ fontWeight: '700', marginBottom: '0.4rem', display: 'block' }}>
                {t('refund.reason')}:
              </label>
              <select
                className="form-input"
                style={{ width: '100%', marginBottom: selectedReasonPreset === 'Jiné (vlastní popis)' ? '0.5rem' : '0' }}
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
                  style={{ width: '100%' }}
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

          <div style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem',
            display: 'flex',
            justify: 'space-between',
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

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button type="button" className="btn btn-outline" onClick={onClose} style={{ height: '46px', padding: '0 1.25rem' }}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{
                height: '46px',
                padding: '0 1.5rem',
                fontWeight: '800',
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                borderColor: '#ef4444',
                gap: '0.5rem'
              }}
              onClick={handleConfirm}
            >
              <RotateCcw size={18} />
              <span>{t('refund.confirm_btn')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
