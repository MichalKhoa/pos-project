import React from 'react';
import { Package, X, Check, Delete } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext';

export default function StockKeypadModal({
  stockKeypadTarget,
  stockKeypadValue,
  setStockKeypadValue,
  onClose,
  onConfirm
}) {
  const { t } = useTranslation();

  if (!stockKeypadTarget) return null;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal-card"
        onClick={e => e.stopPropagation()}
        style={{
          width: '92vw',
          maxWidth: '430px',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-xl)',
          border: '1.5px solid var(--border-color)',
          boxShadow: 'var(--shadow-xl)',
          overflow: 'hidden'
        }}
      >
        <div className="modal-header" style={{ padding: '0.85rem 1.25rem' }}>
          <div className="modal-title" style={{ fontSize: '1.05rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Package size={18} style={{ color: 'var(--accent-blue)' }} />
            <span>Zadat stav skladu: {stockKeypadTarget.name}</span>
          </div>
          <button type="button" className="close-modal-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div style={{
            background: 'var(--bg-input)',
            borderRadius: 'var(--radius-lg)',
            padding: '0.75rem 1rem',
            textAlign: 'center',
            border: '2px solid var(--accent-blue)',
            boxShadow: '0 0 12px rgba(59, 130, 246, 0.2)'
          }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>
              Počet kusů na skladě
            </div>
            <div style={{ fontSize: '2.2rem', fontWeight: '900', fontFamily: 'var(--font-mono)', color: 'var(--accent-emerald)' }}>
              {stockKeypadValue || '0'} ks
            </div>
          </div>

          {/* Touch Numpad */}
          <div className="keypad-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.45rem' }}>
            {['7', '8', '9'].map(num => (
              <button
                key={num}
                type="button"
                className="key-btn"
                onClick={() => setStockKeypadValue(prev => prev === '0' ? num : prev.length < 6 ? prev + num : prev)}
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              className="key-btn key-action"
              onClick={() => setStockKeypadValue(prev => prev.length > 1 ? prev.slice(0, -1) : '0')}
            >
              <Delete size={22} />
            </button>

            {['4', '5', '6'].map(num => (
              <button
                key={num}
                type="button"
                className="key-btn"
                onClick={() => setStockKeypadValue(prev => prev === '0' ? num : prev.length < 6 ? prev + num : prev)}
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              className="key-btn key-action"
              style={{ fontSize: '1.15rem', fontWeight: '900' }}
              onClick={() => setStockKeypadValue('0')}
            >
              C
            </button>

            {['1', '2', '3'].map(num => (
              <button
                key={num}
                type="button"
                className="key-btn"
                onClick={() => setStockKeypadValue(prev => prev === '0' ? num : prev.length < 6 ? prev + num : prev)}
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              className="key-btn"
              style={{ fontSize: '1.3rem', fontWeight: '900', color: 'var(--accent-blue)' }}
              onClick={() => setStockKeypadValue(prev => (parseInt(prev || '0', 10) + 10).toString())}
            >
              +10
            </button>

            <button
              type="button"
              className="key-btn"
              style={{ gridColumn: 'span 2', aspectRatio: 'auto', minHeight: '62px' }}
              onClick={() => setStockKeypadValue(prev => prev === '0' ? '0' : prev.length < 6 ? prev + '0' : prev)}
            >
              0
            </button>
            <button
              type="button"
              className="key-btn"
              style={{ gridColumn: 'span 2', aspectRatio: 'auto', minHeight: '62px' }}
              onClick={() => setStockKeypadValue(prev => prev === '0' ? '0' : prev.length < 6 ? prev + '00' : prev)}
            >
              00
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.65rem' }}>
            <button
              type="button"
              className="nav-tab"
              style={{ flex: 1, justifyContent: 'center', height: '50px', fontSize: '0.92rem' }}
              onClick={onClose}
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="pay-btn pay-btn-cash"
              style={{ flex: 1.5, height: '50px', fontSize: '0.96rem', gap: '0.5rem' }}
              onClick={onConfirm}
            >
              <Check size={19} />
              <span>Uložit stav</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
