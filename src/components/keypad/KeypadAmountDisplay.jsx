import React from 'react';
import { useTranslation } from '../../i18n/LanguageContext.jsx';

// Amount card for the keypad modals: mode label, quantity pill and the typed price.
// The line total lives on the Add button (KeypadNumberGrid).
export default function KeypadAmountDisplay({
  isReturn,
  hasValidAmount,
  multiplier = 1,
  amountStr = '',
  rejected = false,
  testId
}) {
  const { t } = useTranslation();

  return (
    <div
      data-testid={testId}
      className={`keypad-amount-display ${hasValidAmount ? 'has-value' : ''} ${rejected ? 'key-reject' : ''}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '0.45rem 0.75rem',
        borderRadius: '6px',
        border: isReturn
          ? '2px solid var(--accent-rose)'
          : (hasValidAmount ? '1.5px solid var(--accent-blue)' : '1px solid var(--border-color)'),
        background: isReturn
          ? 'rgba(239, 68, 68, 0.06)'
          : (hasValidAmount ? 'color-mix(in srgb, var(--accent-blue) 4%, var(--bg-input))' : 'var(--bg-input)'),
        boxShadow: isReturn
          ? '0 0 12px rgba(239, 68, 68, 0.18)'
          : (hasValidAmount ? '0 0 12px rgba(59, 130, 246, 0.15)' : 'none'),
        transition: 'all 0.2s ease'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          fontSize: '0.8rem',
          fontWeight: '700',
          letterSpacing: '0.06em',
          color: isReturn ? 'var(--accent-rose)' : 'var(--text-muted)'
        }}>
          {isReturn ? t('keypad.return_price_prompt') : t('keypad.price_prompt')}
          {isReturn && <span className="keypad-return-pill">{t('keypad.return_pill')}</span>}
        </span>

        {multiplier !== 1 && (
          <span style={{
            fontSize: '0.8rem',
            fontWeight: '700',
            color: isReturn ? 'var(--accent-rose)' : 'var(--accent-amber)',
            background: isReturn ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.12)',
            padding: '1px 5px',
            borderRadius: '4px'
          }}>
            {multiplier}×
          </span>
        )}
      </div>

      <div style={{
        fontSize: '1.45rem',
        fontWeight: '700',
        fontFamily: 'var(--font-mono)',
        color: isReturn
          ? 'var(--accent-rose)'
          : (amountStr ? 'var(--text-primary)' : 'var(--text-muted)'),
        wordBreak: 'break-all',
        marginTop: '1px'
      }}>
        {amountStr ? `${amountStr} Kč` : (isReturn ? '-0 Kč' : '0 Kč')}
      </div>
    </div>
  );
}
