import React from 'react';
import { Tag, X, ChevronUp, ChevronDown, Check } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext.jsx';

export default function OpenPriceModal({
  openPriceTarget,
  onClose,
  enteredOpenPrice,
  setEnteredOpenPrice,
  openPriceQty,
  setOpenPriceQty,
  onSubmit
}) {
  const { t } = useTranslation();

  if (!openPriceTarget) return null;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal-card"
        onClick={e => e.stopPropagation()}
        style={{
          width: '92vw',
          maxWidth: '420px',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-xl)',
          border: '1.5px solid var(--border-color)',
          boxShadow: 'var(--shadow-xl)',
          overflow: 'hidden'
        }}
      >
        <div className="modal-header" style={{ padding: '0.85rem 1.25rem' }}>
          <div className="modal-title" style={{ fontSize: '1.1rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Tag size={18} style={{ color: 'var(--accent-blue)' }} />
            <span>{openPriceTarget.name}</span>
          </div>
          <button type="button" className="close-modal-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div style={{
            background: 'var(--bg-input)',
            borderRadius: 'var(--radius-lg)',
            padding: '0.85rem 1rem',
            textAlign: 'center',
            border: '2px solid var(--accent-blue)',
            boxShadow: '0 0 12px rgba(59, 130, 246, 0.2)'
          }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>
              Zadejte cenu za jednotku (Kč)
            </div>
            <div style={{
              fontSize: '2rem',
              fontWeight: '900',
              fontFamily: 'var(--font-mono)',
              color: enteredOpenPrice ? 'var(--text-primary)' : 'var(--text-muted)'
            }}>
              {enteredOpenPrice ? `${enteredOpenPrice} Kč` : '0 Kč'}
            </div>
            {openPriceQty !== 1 && enteredOpenPrice && (
              <div style={{ fontSize: '0.85rem', color: openPriceQty < 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)', fontWeight: '800', marginTop: '0.2rem' }}>
                = Celkem {(openPriceQty * parseFloat(enteredOpenPrice || 0)).toLocaleString('cs-CZ')} Kč ({openPriceQty} ks)
              </div>
            )}
          </div>

          {/* Quick Qty +/- controls */}
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button
              type="button"
              onClick={() => setOpenPriceQty(prev => prev - 1)}
              style={{
                flex: 1, height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: '0.25rem', borderRadius: 'var(--radius-md)', background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                border: 'none', fontWeight: '900', fontSize: '0.85rem', color: '#fff',
                cursor: 'pointer', boxShadow: '0 2px 6px rgba(239,68,68,0.35)',
                transition: 'all 0.15s ease'
              }}
              title="Snížit množství (-1 / Vratka)"
            >
              <ChevronDown size={16} /><span>-1</span>
            </button>

            <button
              type="button"
              onClick={() => setOpenPriceQty(1)}
              style={{
                padding: '0 0.85rem', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 'var(--radius-md)',
                background: openPriceQty === 1 ? 'rgba(255,255,255,0.08)' : (openPriceQty < 0 ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'),
                border: `1px solid ${openPriceQty === 1 ? 'var(--border-color)' : (openPriceQty < 0 ? 'rgba(239,68,68,0.5)' : 'rgba(245,158,11,0.5)')}`,
                color: openPriceQty === 1 ? 'var(--text-muted)' : (openPriceQty < 0 ? 'var(--accent-rose)' : 'var(--accent-amber)'),
                fontWeight: '900', fontSize: '0.82rem', cursor: 'pointer'
              }}
            >
              {openPriceQty}×
            </button>

            <button
              type="button"
              onClick={() => setOpenPriceQty(prev => (prev < 0 ? 1 : prev + 1))}
              style={{
                flex: 1, height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: '0.25rem', borderRadius: 'var(--radius-md)', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none', fontWeight: '900', fontSize: '0.85rem', color: '#fff',
                cursor: 'pointer', boxShadow: '0 2px 6px rgba(16,185,129,0.35)',
                transition: 'all 0.15s ease'
              }}
              title="Zvýšit množství (+1)"
            >
              <ChevronUp size={16} /><span>+1</span>
            </button>
          </div>

          {/* Touch Numpad */}
          <div className="keypad-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
            {['7', '8', '9'].map(num => (
              <button key={num} type="button" className="key-btn" style={{ height: '52px', aspectRatio: 'auto' }} onClick={() => setEnteredOpenPrice(prev => {
                if (prev.includes('.')) {
                  const parts = prev.split('.');
                  if (parts[1] && parts[1].length >= 2) return prev;
                }
                return prev.length < 10 ? prev + num : prev;
              })}>{num}</button>
            ))}
            <button
              type="button"
              className="key-btn key-action"
              style={{ height: '52px', aspectRatio: 'auto' }}
              onClick={() => setEnteredOpenPrice(prev => prev.length > 1 ? prev.slice(0, -1) : '')}
            >
              ⌫
            </button>

            {['4', '5', '6'].map(num => (
              <button key={num} type="button" className="key-btn" style={{ height: '52px', aspectRatio: 'auto' }} onClick={() => setEnteredOpenPrice(prev => {
                if (prev.includes('.')) {
                  const parts = prev.split('.');
                  if (parts[1] && parts[1].length >= 2) return prev;
                }
                return prev.length < 10 ? prev + num : prev;
              })}>{num}</button>
            ))}
            <button
              type="button"
              className="key-btn key-action"
              style={{ height: '52px', fontSize: '0.9rem', fontWeight: '700', aspectRatio: 'auto' }}
              onClick={() => setEnteredOpenPrice('')}
            >
              C
            </button>

            {['1', '2', '3'].map(num => (
              <button key={num} type="button" className="key-btn" style={{ height: '52px', aspectRatio: 'auto' }} onClick={() => setEnteredOpenPrice(prev => {
                if (prev.includes('.')) {
                  const parts = prev.split('.');
                  if (parts[1] && parts[1].length >= 2) return prev;
                }
                return prev.length < 10 ? prev + num : prev;
              })}>{num}</button>
            ))}
            <button
              type="button"
              className="key-btn"
              style={{ height: '52px', fontSize: '1.4rem', fontWeight: '700', color: 'var(--accent-blue)', aspectRatio: 'auto' }}
              onClick={() => {
                if (enteredOpenPrice.includes('.')) return;
                setEnteredOpenPrice(prev => prev ? prev + '.' : '0.');
              }}
            >
              ,
            </button>

            <button type="button" className="key-btn" style={{ height: '52px', aspectRatio: 'auto' }} onClick={() => setEnteredOpenPrice(prev => {
              if (prev.includes('.')) {
                const parts = prev.split('.');
                if (parts[1] && parts[1].length >= 2) return prev;
              }
              return prev.length < 10 ? prev + '0' : prev;
            })}>0</button>

            <button
              type="button"
              className="key-btn"
              style={{
                height: '52px',
                fontSize: '0.85rem',
                fontWeight: '900',
                background: enteredOpenPrice.startsWith('-') ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 'rgba(239, 68, 68, 0.15)',
                color: enteredOpenPrice.startsWith('-') ? '#ffffff' : 'var(--accent-rose)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                gridColumn: 'span 3',
                aspectRatio: 'auto'
              }}
              onClick={() => setEnteredOpenPrice(prev => {
                if (!prev) return '-';
                if (prev.startsWith('-')) return prev.slice(1);
                return '-' + prev;
              })}
              title="Změnit znaménko / Vratka"
            >
              ± Vratka
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
            <button
              type="button"
              className="nav-tab"
              style={{ flex: 1, justifyContent: 'center', height: '48px' }}
              onClick={onClose}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="pay-btn pay-btn-cash"
              style={{
                flex: 1.5, height: '48px',
                background: (openPriceQty < 0 || (enteredOpenPrice && parseFloat(enteredOpenPrice) < 0)) ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : undefined
              }}
              disabled={!enteredOpenPrice || isNaN(parseFloat(enteredOpenPrice)) || parseFloat(enteredOpenPrice) === 0}
            >
              <Check size={18} />
              <span>{(openPriceQty < 0 || (enteredOpenPrice && parseFloat(enteredOpenPrice) < 0)) ? 'Vrátit zboží (Vratka)' : t('keypad.add_to_cart')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
