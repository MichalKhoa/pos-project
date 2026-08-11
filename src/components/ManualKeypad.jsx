import React, { useState, useEffect } from 'react';
import { Calculator, Delete, PlusCircle, ChevronUp, ChevronDown, Percent, Unlock, PauseCircle, PlayCircle, X, Trash2, Clock, ShoppingBag } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext.jsx';

export default function ManualKeypad({
  onAddToCart,
  amountStr = '',
  setAmountStr,
  itemMultiplier = 1,
  setItemMultiplier,
  defaultVat = 21,
  onOpenCashDrawer,
  onApplyDiscount,
  parkedCarts = [],
  onParkCart,
  onRestoreParkedCart,
  onDeleteParkedCart,
  hasCartItems = false
}) {
  const { t } = useTranslation();
  const [label, setLabel] = useState('');
  const [selectedVat, setSelectedVat] = useState(() => defaultVat !== undefined ? parseInt(defaultVat, 10) : 21);
  const [activeKey, setActiveKey] = useState(null);
  const [showHoldModal, setShowHoldModal] = useState(false);

  useEffect(() => {
    if (defaultVat !== undefined && defaultVat !== null) {
      setSelectedVat(parseInt(defaultVat, 10));
    }
  }, [defaultVat]);

  const triggerKeyAnimation = (key) => {
    setActiveKey(key);
    setTimeout(() => setActiveKey(null), 150);
  };

  const handleKeyPress = (val) => {
    if (!setAmountStr) return;
    triggerKeyAnimation(val);

    if (val === 'PLUSMINUS' || val === '±') {
      setAmountStr(prev => {
        if (!prev) return '-';
        if (prev.startsWith('-')) return prev.slice(1);
        return '-' + prev;
      });
      return;
    }
    if (val === 'CLEAR') {
      setAmountStr('');
      if (setItemMultiplier) setItemMultiplier(1);
      return;
    }
    if (val === 'BACK') {
      setAmountStr(prev => prev.slice(0, -1));
      return;
    }
    if (val === '.' || val === ',') {
      if (amountStr.includes('.')) return;
      setAmountStr(prev => (prev ? prev + '.' : '0.'));
      return;
    }
    if (val === '.00') {
      if (amountStr.includes('.')) return;
      setAmountStr(prev => (prev ? prev + '.00' : '0.00'));
      return;
    }

    // Enforce max 2 decimal places
    if (amountStr.includes('.')) {
      const parts = amountStr.split('.');
      if (parts[1] && parts[1].length >= 2) return;
    }

    if (amountStr.length >= 10) return;
    setAmountStr(prev => prev + val);
  };

  const handleAddCustomItem = () => {
    const numericAmount = parseFloat(amountStr);
    if (isNaN(numericAmount) || numericAmount === 0) return;

    const isReturn = numericAmount < 0;
    onAddToCart({
      id: `custom-${Date.now()}`,
      name: label.trim() || (isReturn ? '↩️ Vratka / Vrácené zboží' : 'Volný prodej'),
      price: numericAmount,
      vat: selectedVat,
      quantity: itemMultiplier || 1,
      isCustom: true
    });

    if (setAmountStr) setAmountStr('');
    setLabel('');
    if (setItemMultiplier && itemMultiplier !== 1) setItemMultiplier(1);
    triggerKeyAnimation('ENTER');
  };

  // Hardware numpad & keyboard hotkey listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeEl = document.activeElement;
      const isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');

      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddCustomItem();
        return;
      }

      if (isInput && activeEl.className.includes('keypad-label-input')) return;

      if (/^[0-9]$/.test(e.key)) {
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        handleKeyPress('BACK');
      } else if (e.key === 'Escape' || e.key.toLowerCase() === 'c') {
        handleKeyPress('CLEAR');
      } else if (e.key === '.' || e.key === ',') {
        handleKeyPress('.');
      } else if (e.key === '+' || e.key === 'Add') {
        e.preventDefault();
        if (setItemMultiplier) setItemMultiplier(prev => (prev || 1) + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amountStr, label, selectedVat]);

  const hasValidAmount = parseFloat(amountStr) > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', overflowY: 'auto' }}>
      {/* ── CARD 1: STANDALONE NUMERIC KEYPAD CARD ───────────────── */}
      <div
        className="keypad-section touch-large-keypad pos-standalone-card"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          padding: '1rem',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem'
        }}
      >
        {/* ── Item name (ultra-slim 1-line bar) ─────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.4rem',
        height: '28px', padding: '0 0.5rem', flexShrink: 0,
        background: 'var(--bg-input)', borderRadius: '8px',
        border: '1px solid var(--border-color)'
      }}>
        <Calculator size={13} style={{ color: 'var(--accent-emerald)', flexShrink: 0 }} />
        <input
          type="text"
          className="keypad-label-input"
          placeholder={t('keypad.item_placeholder') || 'Název položky (volitelné)...'}
          value={label}
          onChange={e => setLabel(e.target.value)}
          style={{
            fontSize: '0.8rem', border: 'none', outline: 'none',
            background: 'transparent', width: '100%', height: '100%',
            color: 'var(--text-primary)'
          }}
        />
      </div>

      {/* ── Amount display card ───────────────────────────────── */}
      <div
        className={`keypad-amount-display ${hasValidAmount ? 'has-value' : ''}`}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'stretch',
          padding: '0.4rem 0.75rem', flexShrink: 0, borderRadius: '10px',
          border: itemMultiplier > 1 ? '2px solid var(--accent-amber)' : '1px solid var(--border-color)',
          background: itemMultiplier > 1 ? 'rgba(245,158,11,0.04)' : 'var(--bg-input)',
          boxShadow: itemMultiplier > 1 ? '0 0 14px rgba(245,158,11,0.2)' : 'none',
          transition: 'all 0.2s ease'
        }}
      >
        <span style={{
          fontSize: '0.63rem', fontWeight: '800', textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: itemMultiplier > 1 ? 'var(--accent-amber)' : 'var(--text-muted)'
        }}>
          {t('keypad.amount_label')}
        </span>

        {/* Big price / equation */}
        <div style={{
          fontSize: itemMultiplier !== 1 ? '1.2rem' : '1.4rem',
          fontWeight: '900',
          fontFamily: 'var(--font-mono)',
          color: itemMultiplier < 0 ? 'var(--accent-rose)' : (itemMultiplier > 1 ? 'var(--accent-amber)' : (amountStr ? 'var(--text-primary)' : 'var(--text-muted)')),
          wordBreak: 'break-all'
        }}>
          {itemMultiplier !== 1
            ? `${itemMultiplier} × ${amountStr ? `${amountStr} Kč` : '___ Kč'} ${itemMultiplier < 0 ? '(VRATKA)' : ''}`
            : (amountStr ? `${amountStr} Kč` : '0 Kč')}
        </div>

        {/* Subtotal line */}
        {itemMultiplier !== 1 && hasValidAmount && (
          <div style={{
            fontSize: '0.82rem', fontWeight: '800', fontFamily: 'var(--font-mono)',
            color: itemMultiplier < 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)', textAlign: 'right',
            borderTop: '1px dashed rgba(245,158,11,0.35)',
            paddingTop: '2px', marginTop: '2px'
          }}>
            = Celkem {(itemMultiplier * parseFloat(amountStr)).toLocaleString('cs-CZ')} Kč
          </div>
        )}
      </div>

      {/* ── Qty arrow row — directly below the amount card ───── */}
      <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => {
            triggerKeyAnimation('DEC_QTY');
            if (setItemMultiplier) {
              setItemMultiplier(prev => {
                if (prev === 1) return -1; // Switch directly to -1 return multiplier
                if (prev === -1) return -2;
                return prev - 1;
              });
            }
          }}
          style={{
            flex: 1, height: '34px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: '0.3rem', borderRadius: '8px',
            background: itemMultiplier < 0 ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : (itemMultiplier > 1 ? 'var(--accent-amber)' : 'var(--bg-input)'),
            border: itemMultiplier < 0 ? 'none' : '1.5px solid var(--border-color)',
            fontWeight: '900', fontSize: '0.82rem',
            color: (itemMultiplier < 0 || itemMultiplier > 1) ? '#fff' : 'var(--text-primary)',
            cursor: 'pointer',
            transition: 'all 0.15s ease', boxShadow: itemMultiplier < 0 ? '0 2px 8px rgba(239,68,68,0.35)' : 'none'
          }}
          title="Snížit množství / Přepnout na Vratku (-1x)"
        >
          <ChevronDown size={16} />
          <span>{itemMultiplier === 1 ? '↩️ -1ks Vratka' : '-1ks'}</span>
        </button>

        <button
          type="button"
          onClick={() => { triggerKeyAnimation('INC_QTY'); if (setItemMultiplier) setItemMultiplier(prev => (prev || 1) + 1); }}
          style={{
            flex: 1, height: '34px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: '0.3rem', borderRadius: '8px',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            border: 'none', fontWeight: '900', fontSize: '0.82rem', color: '#fff',
            cursor: 'pointer', boxShadow: '0 2px 8px rgba(16,185,129,0.35)',
            transition: 'all 0.15s ease'
          }}
          title="Zvýšit množství"
        >
          <ChevronUp size={16} />
          <span>+1</span>
        </button>
      </div>

      {/* ── VAT selector & Return Sign Toggle ─────────────────── */}
      <div className="vat-selector" style={{ flexShrink: 0, display: 'flex', gap: '0.35rem' }}>
        {[21, 12, 0].map(rate => (
          <button
            key={rate}
            type="button"
            className={`vat-btn vat-${rate} ${selectedVat === rate ? 'active' : ''}`}
            onClick={() => setSelectedVat(rate)}
            style={{ flex: 1, padding: '0.25rem 0', fontSize: '0.8rem' }}
          >
            DPH {rate}%
          </button>
        ))}
        <button
          type="button"
          className={`vat-btn ${amountStr.startsWith('-') ? 'active' : ''}`}
          onClick={() => handleKeyPress('±')}
          style={{
            flex: 1.1,
            padding: '0.25rem 0',
            fontSize: '0.8rem',
            fontWeight: '900',
            background: amountStr.startsWith('-') ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 'rgba(239, 68, 68, 0.12)',
            color: amountStr.startsWith('-') ? '#ffffff' : 'var(--accent-rose)',
            border: '1px solid rgba(239, 68, 68, 0.4)'
          }}
          title="Změnit znaménko / Označit jako vratku zboží"
        >
          ± Vratka
        </button>
      </div>

      {/* ── Number grid (4 × 4 + enter bar) ─────────────────── */}
      <div className="keypad-grid">
        {/* Row 1: 7 8 9 ⌫ */}
        {['7','8','9'].map(n => (
          <button key={n} type="button"
            className={`key-btn ${activeKey === n ? 'active-press' : ''}`}
            onClick={() => handleKeyPress(n)}>{n}</button>
        ))}
        <button type="button"
          className={`key-btn key-action ${activeKey === 'BACK' ? 'active-press' : ''}`}
          onClick={() => handleKeyPress('BACK')} title="Backspace">
          <Delete size={20} />
        </button>

        {/* Row 2: 4 5 6 C */}
        {['4','5','6'].map(n => (
          <button key={n} type="button"
            className={`key-btn ${activeKey === n ? 'active-press' : ''}`}
            onClick={() => handleKeyPress(n)}>{n}</button>
        ))}
        <button type="button"
          className={`key-btn key-action ${activeKey === 'CLEAR' ? 'active-press' : ''}`}
          onClick={() => handleKeyPress('CLEAR')} title="Clear">C</button>

        {/* Row 3: 1 2 3 , */}
        {['1','2','3'].map(n => (
          <button key={n} type="button"
            className={`key-btn ${activeKey === n ? 'active-press' : ''}`}
            onClick={() => handleKeyPress(n)}>{n}</button>
        ))}
        <button type="button"
          className={`key-btn ${activeKey === '.' ? 'active-press' : ''}`}
          onClick={() => handleKeyPress('.')}>,</button>

        {/* Row 4: 0  00  +1ks  × */}
        <button type="button"
          className={`key-btn ${activeKey === '0' ? 'active-press' : ''}`}
          onClick={() => handleKeyPress('0')}>0</button>
        <button type="button"
          className={`key-btn ${activeKey === '00' ? 'active-press' : ''}`}
          onClick={() => handleKeyPress('00')}>00</button>

        {/* +1 ks — green quick-add */}
        <button type="button"
          className={`key-btn ${activeKey === 'INC_QTY' ? 'active-press' : ''}`}
          onClick={() => { triggerKeyAnimation('INC_QTY'); if (setItemMultiplier) setItemMultiplier(prev => (prev || 1) + 1); }}
          style={{ background: 'linear-gradient(135deg,#10b981 0%,#059669 100%)', color: '#fff', fontWeight: '900', fontSize: '0.9rem', border: 'none' }}
          title="+1 ks">+1 ks</button>

        {/* × multiplier */}
        <button type="button"
          className={`key-btn key-action ${itemMultiplier > 1 ? 'active-multiplier' : ''} ${activeKey === 'MULTIPLY' ? 'active-press' : ''}`}
          onClick={() => {
            triggerKeyAnimation('MULTIPLY');
            if (itemMultiplier > 1) {
              if (setItemMultiplier) setItemMultiplier(1);
              if (setAmountStr) setAmountStr('');
              return;
            }
            if (amountStr && !amountStr.includes('.')) {
              const q = parseInt(amountStr, 10);
              if (!isNaN(q) && q >= 1 && q <= 99) {
                if (setItemMultiplier) setItemMultiplier(q);
                if (setAmountStr) setAmountStr('');
              }
            }
          }}
          style={{
            color: itemMultiplier > 1 ? '#fff' : 'var(--accent-amber)',
            fontWeight: '800', fontSize: '1.25rem',
            background: itemMultiplier > 1 ? 'linear-gradient(135deg,#f59e0b 0%,#d97706 100%)' : undefined
          }}
          title="Násobit">×</button>

        {/* Enter / Add to cart */}
        <button type="button"
          className={`key-btn key-enter ${hasValidAmount ? 'key-enter-active' : ''} ${activeKey === 'ENTER' ? 'active-press' : ''}`}
          style={{ gridColumn: 'span 4', minHeight: '46px' }}
          onClick={handleAddCustomItem}
          disabled={!hasValidAmount}>
          <PlusCircle size={20} />
          <span>{hasValidAmount ? t('keypad.add_to_cart') : t('keypad.enter_amount')}</span>
        </button>
      </div>
      </div>

      {/* ── CARD 2: STANDALONE HOLD / PARK CART STORAGE CARD ───── */}
      <div
        className="hold-cart-card-standalone pos-standalone-card"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          padding: '1rem',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem',
          flexShrink: 0
        }}
      >
        <div style={{
          fontSize: '0.72rem',
          fontWeight: '800',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem'
        }}>
          <ShoppingBag size={14} style={{ color: 'var(--accent-amber)' }} />
          <span>Odložené Nákupy (Zákazníci)</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          {/* ODLOŽIT NÁKUP (Park active cart) */}
          <button
            type="button"
            className="key-btn"
            disabled={!hasCartItems}
            onClick={() => onParkCart && onParkCart()}
            style={{
              height: '50px',
              fontSize: '0.88rem',
              fontWeight: '900',
              background: hasCartItems
                ? 'linear-gradient(135deg, rgba(245,158,11,0.25) 0%, rgba(217,119,6,0.35) 100%)'
                : 'var(--bg-card)',
              color: hasCartItems ? 'var(--accent-amber)' : 'var(--text-muted)',
              border: hasCartItems ? '2px solid rgba(245,158,11,0.6)' : '1px solid var(--border-color)',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              opacity: hasCartItems ? 1 : 0.45,
              cursor: hasCartItems ? 'pointer' : 'default',
              boxShadow: hasCartItems ? '0 3px 10px rgba(245,158,11,0.2)' : 'none'
            }}
            title="Odložit aktuální nákup pro vyřízení jiného zákazníka"
          >
            <PauseCircle size={19} />
            <span>Odložit nákup</span>
          </button>

          {/* OBNOVIT NÁKUP (Restore held cart) */}
          <button
            type="button"
            className="key-btn"
            disabled={parkedCarts.length === 0}
            onClick={() => setShowHoldModal(true)}
            style={{
              height: '50px',
              fontSize: '0.88rem',
              fontWeight: '900',
              background: parkedCarts.length > 0
                ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                : 'var(--bg-card)',
              color: parkedCarts.length > 0 ? '#fff' : 'var(--text-muted)',
              border: parkedCarts.length > 0 ? 'none' : '1px solid var(--border-color)',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              opacity: parkedCarts.length > 0 ? 1 : 0.45,
              cursor: parkedCarts.length > 0 ? 'pointer' : 'default',
              boxShadow: parkedCarts.length > 0 ? '0 4px 14px rgba(59,130,246,0.4)' : 'none'
            }}
            title="Obnovit odložený nákup"
          >
            <PlayCircle size={19} />
            <span>Obnovit ({parkedCarts.length})</span>
          </button>
        </div>

        {onOpenCashDrawer && (
          <button
            type="button"
            className="key-btn"
            onClick={onOpenCashDrawer}
            style={{
              height: '36px',
              fontSize: '0.78rem',
              fontWeight: '800',
              background: 'rgba(245,158,11,0.08)',
              color: 'var(--accent-amber)',
              border: '1px solid rgba(245,158,11,0.3)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              width: '100%'
            }}
            title="Otevřít Pokladní Zásuvku"
          >
            <Unlock size={14} />
            <span>Otevřít pokladní zásuvku</span>
          </button>
        )}
      </div>

      {/* ── Modal Dialog for Parked / Held Carts ────────────────── */}
      {showHoldModal && (
        <div className="modal-overlay" style={{ zIndex: 9999 }} onClick={() => setShowHoldModal(false)}>
          <div
            className="modal-card"
            style={{ width: '92%', maxWidth: '520px', padding: '1.25rem', borderRadius: '16px' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', pb: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                <Clock size={20} style={{ color: 'var(--accent-amber)' }} />
                <span>Odložené nákupy ({parkedCarts.length})</span>
              </h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowHoldModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.3rem' }}
              >
                <X size={22} />
              </button>
            </div>

            {parkedCarts.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Žádné odložené nákupy.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '360px', overflowY: 'auto' }}>
                {parkedCarts.map((holdItem, index) => (
                  <div
                    key={holdItem.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.85rem 1rem',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '12px',
                      gap: '0.75rem'
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: '800', fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                        Nákup #{index + 1} — <span style={{ color: 'var(--accent-blue)' }}>{holdItem.timeStr}</span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                        {holdItem.itemCount} položek • {holdItem.items.map(i => i.name).slice(0, 3).join(', ')}{holdItem.items.length > 3 ? '...' : ''}
                      </div>
                      <div style={{ fontSize: '1rem', fontWeight: '900', color: 'var(--accent-emerald)', marginTop: '0.2rem', fontFamily: 'var(--font-mono)' }}>
                        {holdItem.totalAmount.toLocaleString('cs-CZ')} Kč
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                      <button
                        type="button"
                        className="pay-btn pay-btn-cash"
                        onClick={() => {
                          if (onRestoreParkedCart) onRestoreParkedCart(holdItem.id);
                          setShowHoldModal(false);
                        }}
                        style={{ height: '42px', padding: '0 1rem', fontSize: '0.85rem', fontWeight: '800', gap: '0.3rem' }}
                      >
                        <PlayCircle size={16} />
                        <span>Obnovit</span>
                      </button>

                      <button
                        type="button"
                        className="key-btn"
                        onClick={() => onDeleteParkedCart && onDeleteParkedCart(holdItem.id)}
                        style={{
                          height: '42px',
                          width: '42px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'rgba(239,68,68,0.1)',
                          color: 'var(--accent-rose)',
                          border: '1px solid rgba(239,68,68,0.3)',
                          borderRadius: '8px'
                        }}
                        title="Smazat tento odložený nákup"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
