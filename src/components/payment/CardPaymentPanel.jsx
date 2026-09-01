import React from 'react';
import { CreditCard, Wifi, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext.jsx';

export default function CardPaymentPanel({
  totalAmount,
  termConfig,
  termLoading,
  termResult,
  onTerminalPay,
  onComplete
}) {
  const { t } = useTranslation();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ textAlign: 'center', padding: '2.5rem 2rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
        <CreditCard size={64} style={{ color: 'var(--accent-blue)', marginBottom: '0.8rem' }} />
        <div style={{ fontWeight: '800', fontSize: '1.4rem', marginBottom: '0.4rem' }}>{t('payment.card_instruction')}</div>
        <div style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>{t('payment.total_due')}: <strong>{totalAmount.toFixed(2)} Kč</strong></div>

        {/* ČSOB Terminal Status Banner */}
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
              ? t('payment.card_auto_sub', { amount: totalAmount.toFixed(2) })
              : t('payment.card_manual_sub', { amount: totalAmount.toFixed(2) })
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
          <span>{(termConfig?.enabled && termConfig?.ip) ? t('payment.card_manual_override') : `${t('payment.card_confirm_manual')} (${totalAmount.toFixed(2)} Kč)`}</span>
        </button>
      </div>
    </div>
  );
}
