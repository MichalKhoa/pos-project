import React, { useState, useEffect } from 'react';
import { Percent, Banknote, CheckCircle2, RotateCcw, Delete, Tag } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext.jsx';

const PCT_PRESETS = [5, 10, 15, 20, 25, 30, 50, 75];
const AMT_PRESETS = [20, 50, 100, 200, 500, 1000];

export default function DiscountModal({
  isOpen,
  onClose,
  totalAmount,
  selectedItem = null,
  onApplyDiscount
}) {
  const { t } = useTranslation();
  const [discountType, setDiscountType] = useState('percent');
  const [valStr, setValStr] = useState('0');
  const [targetScope, setTargetScope] = useState(selectedItem ? 'item' : 'cart');

  useEffect(() => {
    setValStr('0');
    setTargetScope(selectedItem ? 'item' : 'cart');
  }, [selectedItem, isOpen]);

  if (!isOpen) return null;

  const numVal = parseFloat(valStr.replace(',', '.')) || 0;

  const referenceAmount = targetScope === 'item' && selectedItem
    ? (selectedItem.price * selectedItem.quantity)
    : totalAmount;

  let savingsAmount = 0;
  if (discountType === 'percent') {
    savingsAmount = referenceAmount * (Math.min(100, numVal) / 100);
  } else {
    savingsAmount = Math.min(referenceAmount, numVal);
  }

  const finalAmount = Math.max(0, referenceAmount - savingsAmount);

  const handleNumpadKey = (digit) => {
    if (digit === 'CLEAR') {
      setValStr('0');
      return;
    }
    if (digit === 'BACK') {
      setValStr(prev => (prev.length > 1 ? prev.slice(0, -1) : '0'));
      return;
    }
    if (digit === '.' || digit === ',') {
      if (valStr.includes('.') || valStr.includes(',')) return;
      setValStr(prev => prev + ',');
      return;
    }

    setValStr(prev => (prev === '0' ? digit : prev + digit));
  };

  const handleApply = () => {
    if (numVal <= 0) {
      onClose();
      return;
    }

    onApplyDiscount({
      type: discountType,
      value: numVal,
      savings: savingsAmount,
      scope: targetScope,
      itemId: selectedItem ? selectedItem.id : null
    });

    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '640px', width: '95%' }}
      >
        <div className="modal-header">
          <div className="modal-title">
            <Percent size={22} style={{ color: 'var(--accent-purple)' }} />
            <span>{t('discount.title')}</span>
          </div>
          <button className="close-modal-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ gap: '0.9rem' }}>
          {selectedItem && (
            <div style={{ display: 'flex', gap: '0.4rem', background: 'var(--bg-input)', padding: '0.3rem', borderRadius: 'var(--radius-md)' }}>
              <button
                type="button"
                className={`nav-tab ${targetScope === 'item' ? 'active' : ''}`}
                style={{ flex: 1, justifyContent: 'center', fontSize: '0.82rem', padding: '0.45rem' }}
                onClick={() => setTargetScope('item')}
              >
                <Tag size={15} />
                <span>{t('discount.for_item')}: {selectedItem.name}</span>
              </button>

              <button
                type="button"
                className={`nav-tab ${targetScope === 'cart' ? 'active' : ''}`}
                style={{ flex: 1, justifyContent: 'center', fontSize: '0.82rem', padding: '0.45rem' }}
                onClick={() => setTargetScope('cart')}
              >
                <Percent size={15} />
                <span>{t('discount.for_cart')} ({totalAmount.toFixed(0)} Kč)</span>
              </button>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.4rem', background: 'var(--bg-input)', padding: '0.3rem', borderRadius: 'var(--radius-md)' }}>
            <button
              type="button"
              className={`nav-tab ${discountType === 'percent' ? 'active' : ''}`}
              style={{ flex: 1, justifyContent: 'center', fontSize: '0.85rem', padding: '0.5rem', fontWeight: '800' }}
              onClick={() => { setDiscountType('percent'); setValStr('0'); }}
            >
              <Percent size={16} />
              <span>{t('discount.percent_type')}</span>
            </button>

            <button
              type="button"
              className={`nav-tab ${discountType === 'amount' ? 'active' : ''}`}
              style={{ flex: 1, justifyContent: 'center', fontSize: '0.85rem', padding: '0.5rem', fontWeight: '800' }}
              onClick={() => { setDiscountType('amount'); setValStr('0'); }}
            >
              <Banknote size={16} />
              <span>{t('discount.amount_type')}</span>
            </button>
          </div>

          <div style={{
            background: 'var(--bg-input)',
            border: '1.5px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '0.75rem 1rem',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.3rem'
          }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {discountType === 'percent' ? t('discount.entered_percent') : t('discount.entered_amount')}
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '2.3rem',
              fontWeight: '800',
              color: 'var(--accent-purple)'
            }}>
              {valStr} {discountType === 'percent' ? '%' : 'Kč'}
            </div>

            <div style={{
              display: 'flex',
              justify: 'space-around',
              alignItems: 'center',
              paddingTop: '0.5rem',
              marginTop: '0.3rem',
              borderTop: '1px dashed var(--border-color)',
              fontSize: '0.88rem'
            }}>
              <span style={{ color: 'var(--accent-rose)', fontWeight: '800' }}>
                {t('discount.savings')}: -{savingsAmount.toFixed(2)} Kč
              </span>
              <span style={{ color: 'var(--accent-emerald)', fontWeight: '800' }}>
                {t('discount.new_price')}: {finalAmount.toFixed(2)} Kč
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {discountType === 'percent' ? (
              PCT_PRESETS.map(pct => (
                <button
                  key={pct}
                  type="button"
                  className="vat-btn"
                  style={{ flex: 1, minWidth: '60px', padding: '0.55rem 0.2rem', fontWeight: '800', fontSize: '0.9rem' }}
                  onClick={() => setValStr(pct.toString())}
                >
                  -{pct}%
                </button>
              ))
            ) : (
              AMT_PRESETS.map(amt => (
                <button
                  key={amt}
                  type="button"
                  className="vat-btn"
                  style={{ flex: 1, minWidth: '65px', padding: '0.55rem 0.2rem', fontWeight: '800', fontSize: '0.85rem' }}
                  onClick={() => setValStr(amt.toString())}
                >
                  -{amt} Kč
                </button>
              ))
            )}
            <button
              type="button"
              className="vat-btn"
              style={{ color: 'var(--accent-rose)', padding: '0.55rem 0.4rem', fontWeight: '800' }}
              onClick={() => setValStr('0')}
            >
              <RotateCcw size={14} /> {t('payment.reset')}
            </button>
          </div>

          <div className="cash-numpad-container">
            <div className="cash-numpad-grid">
              {['7', '8', '9'].map(n => (
                <button key={n} type="button" className="cash-num-btn" onClick={() => handleNumpadKey(n)}>{n}</button>
              ))}
              <button type="button" className="cash-num-btn key-action" onClick={() => handleNumpadKey('BACK')}>
                <Delete size={20} />
              </button>

              {['4', '5', '6'].map(n => (
                <button key={n} type="button" className="cash-num-btn" onClick={() => handleNumpadKey(n)}>{n}</button>
              ))}
              <button type="button" className="cash-num-btn key-action" onClick={() => handleNumpadKey('CLEAR')}>C</button>

              {['1', '2', '3'].map(n => (
                <button key={n} type="button" className="cash-num-btn" onClick={() => handleNumpadKey(n)}>{n}</button>
              ))}
              <button type="button" className="cash-num-btn" onClick={() => handleNumpadKey(',')}>,</button>

              <button type="button" className="cash-num-btn" style={{ gridColumn: 'span 2' }} onClick={() => handleNumpadKey('0')}>0</button>
              <button type="button" className="cash-num-btn" style={{ gridColumn: 'span 2' }} onClick={() => handleNumpadKey('00')}>00</button>
            </div>
          </div>

          <button
            type="button"
            className="pay-btn pay-btn-cash"
            style={{ width: '100%', height: '56px', background: 'linear-gradient(135deg, var(--accent-purple), #6d28d9)', fontSize: '1.1rem', fontWeight: '800' }}
            onClick={handleApply}
          >
            <CheckCircle2 size={22} />
            <span>{t('discount.apply_discount')} (-{savingsAmount.toFixed(0)} Kč)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
