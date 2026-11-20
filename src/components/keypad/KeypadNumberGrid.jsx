import React from 'react';
import { Delete, PlusCircle } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext.jsx';
import { useHoldBackspace } from '../../hooks/useHoldBackspace.js';
import { formatKc } from '../../utils/money.js';

export default function KeypadNumberGrid({
  activeKey,
  onKeyPress,
  itemMultiplier,
  amountStr,
  onMultiply,
  selectedVat,
  rejectKey = null,
  hasValidAmount,
  onAddCustomItem
}) {
  const { t } = useTranslation();

  const isReturn = (itemMultiplier < 0) || Boolean(amountStr && amountStr.startsWith('-'));

  // What the Add button will put in the cart, so the cashier can check it before committing
  const unitAmount = Math.abs(parseFloat(amountStr)) || 0;
  const qty = Math.max(1, Math.abs(itemMultiplier || 1));
  const summary = hasValidAmount
    ? `${qty > 1 ? `${qty} × ${formatKc(unitAmount)} = ` : ''}${formatKc((isReturn ? -1 : 1) * unitAmount * qty)} Kč${selectedVat !== undefined ? ` · ${t('keypad.vat_label')} ${selectedVat}%` : ''}`
    : '';

  const backspaceHoldHandlers = useHoldBackspace({
    onBackspace: () => onKeyPress('BACK'),
    onClear: () => onKeyPress('CLEAR'),
  });

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
        {...backspaceHoldHandlers}
        title={t('keypad.backspace_title')}
        aria-label={t('keypad.backspace_title')}
      >
        <Delete size={22} />
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
        title={t('keypad.clear_title')}
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
        className={`key-btn ${isReturn ? 'active-return' : ''} ${activeKey === 'PLUSMINUS' || activeKey === '±' ? 'active-press' : ''}`}
        onClick={() => onKeyPress('±')}
        style={{
          color: isReturn ? 'var(--accent-rose)' : 'var(--text-primary)',
          fontWeight: '700',
          fontSize: '1.45rem',
          background: isReturn ? 'rgba(239, 68, 68, 0.15)' : undefined,
          borderColor: isReturn ? 'rgba(239, 68, 68, 0.6)' : undefined
        }}
        title={t('keypad.sign_title')}
      >
        ±
      </button>

      {/* × multiplier */}
      <button
        type="button"
        className={`key-btn key-action ${itemMultiplier > 1 ? 'active-multiplier' : ''} ${activeKey === 'MULTIPLY' ? 'active-press' : ''} ${rejectKey ? 'key-reject' : ''}`}
        onClick={onMultiply}
        style={{
          color: itemMultiplier > 1 ? '#fff' : 'var(--accent-amber)',
          fontWeight: '700',
          fontSize: '1.45rem',
          background: itemMultiplier > 1 ? '#d97706' : undefined
        }}
        title={t('keypad.multiply_title')}
      >
        ×
      </button>

      {/* Enter / Add to cart */}
      <button
        type="button"
        className={`key-btn key-enter ${hasValidAmount ? 'key-enter-active' : ''} ${activeKey === 'ENTER' ? 'active-press' : ''}`}
        style={{
          gridColumn: 'span 4',
          minHeight: '62px',
          height: '62px',
          aspectRatio: 'auto',
          background: isReturn && hasValidAmount
            ? '#dc2626'
            : undefined,
          borderColor: isReturn && hasValidAmount
            ? '#ef4444'
            : undefined,
          boxShadow: isReturn && hasValidAmount
            ? '0 4px 14px rgba(239, 68, 68, 0.35)'
            : undefined
        }}
        onClick={onAddCustomItem}
        disabled={!hasValidAmount}
      >
        <PlusCircle size={22} />
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.15 }}>
          <span>
          {!hasValidAmount
            ? t('keypad.enter_amount')
            : (isReturn
                ? (t('keypad.add_return_item') || '↩️ Vložit Vratku Zboží')
                : t('keypad.add_to_cart'))}
          </span>
          {summary && <span className="key-enter-summary">{summary}</span>}
        </span>
      </button>
    </div>
  );
}
