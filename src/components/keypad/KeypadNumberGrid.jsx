import React from 'react';
import { Delete, PlusCircle } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext.jsx';

export default function KeypadNumberGrid({
  activeKey,
  onKeyPress,
  itemMultiplier,
  setItemMultiplier,
  amountStr,
  setAmountStr,
  triggerKeyAnimation,
  hasValidAmount,
  onAddCustomItem
}) {
  const { t } = useTranslation();

  return (
    <div className="keypad-grid">
      {/* Row 1: 7 8 9 ⌫ */}
      {['7', '8', '9'].map(n => (
        <button
          key={n}
          type="button"
          className={`key-btn ${activeKey === n ? 'active-press' : ''}`}
          onClick={() => onKeyPress(n)}
        >
          {n}
        </button>
      ))}
      <button
        type="button"
        className={`key-btn key-action ${activeKey === 'BACK' ? 'active-press' : ''}`}
        onClick={() => onKeyPress('BACK')}
        title="Backspace"
      >
        <Delete size={20} />
      </button>

      {/* Row 2: 4 5 6 C */}
      {['4', '5', '6'].map(n => (
        <button
          key={n}
          type="button"
          className={`key-btn ${activeKey === n ? 'active-press' : ''}`}
          onClick={() => onKeyPress(n)}
        >
          {n}
        </button>
      ))}
      <button
        type="button"
        className={`key-btn key-action ${activeKey === 'CLEAR' ? 'active-press' : ''}`}
        onClick={() => onKeyPress('CLEAR')}
        title="Clear"
      >
        C
      </button>

      {/* Row 3: 1 2 3 , */}
      {['1', '2', '3'].map(n => (
        <button
          key={n}
          type="button"
          className={`key-btn ${activeKey === n ? 'active-press' : ''}`}
          onClick={() => onKeyPress(n)}
        >
          {n}
        </button>
      ))}
      <button
        type="button"
        className={`key-btn ${activeKey === '.' ? 'active-press' : ''}`}
        onClick={() => onKeyPress('.')}
      >
        ,
      </button>

      {/* Row 4: 0  00  ±  × */}
      <button
        type="button"
        className={`key-btn ${activeKey === '0' ? 'active-press' : ''}`}
        onClick={() => onKeyPress('0')}
      >
        0
      </button>
      <button
        type="button"
        className={`key-btn ${activeKey === '00' ? 'active-press' : ''}`}
        onClick={() => onKeyPress('00')}
      >
        00
      </button>

      {/* ± quick sign toggle */}
      <button
        type="button"
        className={`key-btn ${amountStr.startsWith('-') ? 'active-return' : ''} ${activeKey === 'PLUSMINUS' || activeKey === '±' ? 'active-press' : ''}`}
        onClick={() => onKeyPress('±')}
        style={{
          color: amountStr.startsWith('-') ? 'var(--accent-rose)' : 'var(--text-primary)',
          fontWeight: '900',
          fontSize: '1.25rem',
          background: amountStr.startsWith('-') ? 'rgba(239, 68, 68, 0.15)' : undefined,
          borderColor: amountStr.startsWith('-') ? 'rgba(239, 68, 68, 0.6)' : undefined
        }}
        title="Změnit znaménko (±)"
      >
        ±
      </button>

      {/* × multiplier */}
      <button
        type="button"
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
          fontWeight: '800',
          fontSize: '1.25rem',
          background: itemMultiplier > 1 ? 'linear-gradient(135deg,#f59e0b 0%,#d97706 100%)' : undefined
        }}
        title="Násobit"
      >
        ×
      </button>

      {/* Enter / Add to cart */}
      <button
        type="button"
        className={`key-btn key-enter ${hasValidAmount ? 'key-enter-active' : ''} ${activeKey === 'ENTER' ? 'active-press' : ''}`}
        style={{
          gridColumn: 'span 4',
          minHeight: '48px',
          background: amountStr.startsWith('-') && hasValidAmount
            ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
            : undefined,
          borderColor: amountStr.startsWith('-') && hasValidAmount
            ? '#ef4444'
            : undefined,
          boxShadow: amountStr.startsWith('-') && hasValidAmount
            ? '0 4px 14px rgba(239, 68, 68, 0.35)'
            : undefined
        }}
        onClick={onAddCustomItem}
        disabled={!hasValidAmount}
      >
        <PlusCircle size={20} />
        <span>
          {!hasValidAmount
            ? t('keypad.enter_amount')
            : (amountStr.startsWith('-')
                ? (t('keypad.add_return_item') || '↩️ Vložit Vratku Zboží')
                : t('keypad.add_to_cart'))}
        </span>
      </button>
    </div>
  );
}
