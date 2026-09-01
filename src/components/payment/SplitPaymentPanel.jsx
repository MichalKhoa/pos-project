import React from 'react';
import { Split, Delete, CreditCard, CheckCircle2, Wifi, RefreshCw } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext.jsx';

export default function SplitPaymentPanel({
  splitStep,
  setSplitStep,
  splitCashStr,
  setSplitCashStr,
  splitCashVal,
  splitCardVal,
  totalAmount,
  termConfig,
  termLoading,
  termResult,
  onSplitNumpadKey,
  onTerminalPay,
  onComplete
}) {
  const { t } = useTranslation();

  if (splitStep === 1) {
    return (
      <div className="cash-payment-container">
        {/* COLUMN 1: Cash Portion Inputs, Calculation & Shortcuts */}
        <div className="cash-col-left" style={{ gap: '1rem' }}>
          <div style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--accent-purple)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Split size={18} />
            <span>{t('payment.split_title')}</span>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
              {t('payment.split_cash_portion')}
            </label>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '2rem',
              fontWeight: '800',
              color: 'var(--accent-emerald)',
              background: 'var(--bg-input)',
              border: '1.5px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '0.65rem 1rem',
              textAlign: 'center'
            }}>
              {splitCashStr || '0'} Kč
            </div>
          </div>

          {/* Real-time Card Remaining Calculation Box */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', padding: '1rem 1.25rem', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--border-color)' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-secondary)' }}>
              {t('payment.split_card_remaining')}:
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.6rem', fontWeight: '800', color: 'var(--accent-blue)' }}>
              {splitCardVal.toFixed(2)} Kč
            </span>
          </div>

          {/* Quick Ratio & Cash Shortcut Buttons */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <button type="button" className="vat-btn" style={{ padding: '0.65rem', fontWeight: '800' }} onClick={() => setSplitCashStr((totalAmount / 2).toFixed(2))}>50% / 50%</button>
            <button type="button" className="vat-btn" style={{ padding: '0.65rem' }} onClick={() => setSplitCashStr('100')}>100 Kč</button>
            <button type="button" className="vat-btn" style={{ padding: '0.65rem' }} onClick={() => setSplitCashStr('200')}>200 Kč</button>
            <button type="button" className="vat-btn" style={{ padding: '0.65rem' }} onClick={() => setSplitCashStr('500')}>500 Kč</button>
            <button type="button" className="vat-btn" style={{ padding: '0.65rem', color: 'var(--accent-rose)' }} onClick={() => setSplitCashStr('0')}>C ({t('payment.reset')})</button>
          </div>
        </div>

        {/* COLUMN 2: Touch Numpad for Split Cash & Proceed/Complete Button */}
        <div className="cash-col-right">
          <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {t('payment.numpad_cash_portion')}:
          </div>

          {/* 4-Column Touch Numpad Grid */}
          <div className="side-numpad-grid">
            {['7', '8', '9'].map(n => (
              <button key={n} type="button" className="side-num-btn" onClick={() => onSplitNumpadKey(n)}>{n}</button>
            ))}
            <button type="button" className="side-num-btn key-action" onClick={() => onSplitNumpadKey('BACK')} title="Backspace">
              <Delete size={22} />
            </button>

            {['4', '5', '6'].map(n => (
              <button key={n} type="button" className="side-num-btn" onClick={() => onSplitNumpadKey(n)}>{n}</button>
            ))}
            <button type="button" className="side-num-btn key-action" onClick={() => onSplitNumpadKey('CLEAR')} title={t('payment.reset')}>
              C
            </button>

            {['1', '2', '3'].map(n => (
              <button key={n} type="button" className="side-num-btn" onClick={() => onSplitNumpadKey(n)}>{n}</button>
            ))}
            <button type="button" className="side-num-btn" onClick={() => onSplitNumpadKey('.')}>,</button>

            <button type="button" className="side-num-btn" style={{ gridColumn: 'span 2' }} onClick={() => onSplitNumpadKey('0')}>0</button>
            <button type="button" className="side-num-btn" style={{ gridColumn: 'span 2' }} onClick={() => onSplitNumpadKey('00')}>00</button>
          </div>

          {/* Proceed to Card Step or Finish Cash Sale */}
          {splitCardVal > 0 ? (
            <button
              className="pay-btn pay-btn-card"
              style={{ width: '100%', height: '64px', marginTop: 'auto', fontSize: '1.05rem', fontWeight: '800' }}
              onClick={() => setSplitStep(2)}
            >
              <CreditCard size={22} />
              <span>{t('payment.proceed_to_card', { amount: splitCardVal.toFixed(2) })}</span>
            </button>
          ) : (
            <button
              className="pay-btn pay-btn-cash"
              style={{ width: '100%', height: '64px', marginTop: 'auto', fontSize: '1.05rem', fontWeight: '800' }}
              onClick={onComplete}
            >
              <CheckCircle2 size={24} />
              <span>{t('payment.complete_split')} ({totalAmount.toFixed(2)} Kč)</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // Step 2: Card Terminal payment prompt for remaining splitCardVal amount
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          type="button"
          className="nav-tab"
          onClick={() => setSplitStep(1)}
          style={{ padding: '0.45rem 0.85rem', fontSize: '0.85rem', fontWeight: '700' }}
        >
          ← {t('payment.back_to_cash')}
        </button>
        <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', fontWeight: '700' }}>
          {t('payment.cash')}: {splitCashVal.toFixed(2)} Kč | {t('payment.card')}: {splitCardVal.toFixed(2)} Kč
        </div>
      </div>

      <div style={{ textAlign: 'center', padding: '2rem 1.5rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
        <CreditCard size={56} style={{ color: 'var(--accent-blue)', marginBottom: '0.8rem' }} />
        <div style={{ fontWeight: '800', fontSize: '1.3rem', marginBottom: '0.4rem' }}>{t('payment.card_instruction')}</div>
        <div style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>
          {t('payment.split_card_remaining')}: <strong>{splitCardVal.toFixed(2)} Kč</strong>
        </div>

        {/* ČSOB Terminal Status Banner for split card portion */}
        <div style={{
          marginTop: '1.25rem',
          padding: '0.85rem',
          borderRadius: 'var(--radius-md)',
          background: (termConfig?.enabled && termConfig?.ip) ? 'rgba(5, 150, 105, 0.12)' : 'rgba(59, 130, 246, 0.12)',
          border: `1px solid ${(termConfig?.enabled && termConfig?.ip) ? 'rgba(5, 150, 105, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
          textAlign: 'left',
          fontSize: '0.85rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '700', color: (termConfig?.enabled && termConfig?.ip) ? 'var(--accent-emerald)' : 'var(--accent-blue)', marginBottom: '0.2rem' }}>
            <Wifi size={16} />
            <span>
              {(termConfig?.enabled && termConfig?.ip)
                ? `${t('payment.card_auto_title')} (${termConfig.ip}:${termConfig.port})`
                : t('payment.card_manual_title')
              }
            </span>
          </div>
          <div style={{ color: 'var(--text-secondary)', lineHeight: '1.4' }}>
            {(termConfig?.enabled && termConfig?.ip)
              ? t('payment.card_auto_sub', { amount: splitCardVal.toFixed(2) })
              : t('payment.card_manual_sub', { amount: splitCardVal.toFixed(2) })
            }
          </div>
        </div>
      </div>

      {termResult && (
        <div style={{
          padding: '0.85rem',
          borderRadius: 'var(--radius-md)',
          background: termResult.success ? 'rgba(5, 150, 105, 0.15)' : 'rgba(225, 29, 72, 0.15)',
          border: `1px solid ${termResult.success ? 'rgba(5, 150, 105, 0.4)' : 'rgba(225, 29, 72, 0.4)'}`,
          fontSize: '0.85rem'
        }}>
          <div style={{ fontWeight: '800', color: termResult.success ? 'var(--accent-emerald)' : 'var(--accent-rose)', marginBottom: '0.2rem' }}>
            {termResult.success ? `✓ ${t('payment.terminal_approved')}` : `✕ ${termResult.message}`}
          </div>
          {termResult.auth_code && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
              Autorizační kód: {termResult.auth_code} | Karta: {termResult.card_mask}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        {termConfig?.enabled && termConfig?.ip && (
          <button
            className="pay-btn pay-btn-card"
            disabled={termLoading}
            style={{ flex: 1, height: '62px', fontSize: '1.05rem', fontWeight: '800' }}
            onClick={onTerminalPay}
          >
            <RefreshCw size={20} className={termLoading ? 'spin' : ''} />
            <span>{termLoading ? t('payment.sending_to_terminal') : t('payment.card_send_csob')}</span>
          </button>
        )}

        <button
          className="pay-btn pay-btn-card"
          style={{
            flex: 1,
            height: '62px',
            fontSize: '1.05rem',
            fontWeight: '800',
            background: (termConfig?.enabled && termConfig?.ip) ? 'var(--bg-card)' : 'var(--accent-blue)',
            border: (termConfig?.enabled && termConfig?.ip) ? '1px solid var(--border-color)' : 'none'
          }}
          onClick={onComplete}
        >
          <CheckCircle2 size={22} />
          <span>{(termConfig?.enabled && termConfig?.ip) ? t('payment.card_manual_override') : `${t('payment.card_confirm_manual')} (${splitCardVal.toFixed(2)} Kč)`}</span>
        </button>
      </div>
    </div>
  );
}
