import React from 'react';
import { CreditCard, Wifi, RefreshCw, Zap, Printer } from 'lucide-react';
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
      <div style={{
        textAlign: 'center',
        padding: '2rem 1.5rem',
        background: 'var(--bg-main)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.65rem'
      }}>
        <div style={{
          width: '72px',
          height: '72px',
          borderRadius: '50%',
          background: 'rgba(59, 130, 246, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--accent-blue)',
          boxShadow: 'var(--shadow-blue-glow)'
        }}>
          <CreditCard size={36} />
        </div>
        <div style={{ fontWeight: '900', fontSize: '1.3rem', color: 'var(--text-primary)' }}>
          {t('payment.card_instruction')}
        </div>

        {/* Hero Large Amount Display for Fast Terminal Entry */}
        <div style={{
          margin: '0.4rem 0',
          padding: '0.85rem 2.5rem',
          background: 'var(--bg-card)',
          border: '1.5px solid var(--accent-blue)',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          boxShadow: '0 4px 20px rgba(59, 130, 246, 0.15)'
        }}>
          <span style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.2rem' }}>
            {t('payment.total_due')}
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '2.6rem',
            fontWeight: '900',
            color: 'var(--accent-blue)',
            lineHeight: 1.1,
            letterSpacing: '-0.02em'
          }}>
            {totalAmount.toFixed(2)} Kč
          </span>
        </div>

        {/* ČSOB Terminal Status Banner */}
        <div style={{
          width: '100%',
          maxWidth: '560px',
          marginTop: '0.5rem',
          padding: '0.75rem 1rem',
          borderRadius: 'var(--radius-md)',
          background: (termConfig?.enabled && termConfig?.ip) ? 'rgba(5, 150, 105, 0.08)' : 'rgba(59, 130, 246, 0.08)',
          border: `1px solid ${(termConfig?.enabled && termConfig?.ip) ? 'rgba(5, 150, 105, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
          textAlign: 'left',
          fontSize: '0.85rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: '800', color: (termConfig?.enabled && termConfig?.ip) ? 'var(--accent-emerald)' : 'var(--accent-blue)', marginBottom: '0.2rem' }}>
            <Wifi size={15} />
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
          padding: '0.75rem 1rem',
          borderRadius: 'var(--radius-md)',
          background: termResult.success ? 'rgba(5, 150, 105, 0.12)' : 'rgba(225, 29, 72, 0.12)',
          border: `1px solid ${termResult.success ? 'rgba(5, 150, 105, 0.35)' : 'rgba(225, 29, 72, 0.35)'}`,
          fontSize: '0.85rem'
        }}>
          <div style={{ fontWeight: '800', color: termResult.success ? 'var(--accent-emerald)' : 'var(--accent-rose)', marginBottom: '0.2rem' }}>
            {termResult.success ? `✓ ${t('payment.terminal_approved')}` : `✕ ${termResult.message}`}
          </div>
          {termResult.auth_code && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {t('payment.auth_code')}: {termResult.auth_code} | {t('payment.card_mask')}: {termResult.card_mask}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto', flexWrap: 'nowrap' }}>
        {termConfig?.enabled && termConfig?.ip && (
          <button
            type="button"
            className="pay-btn pay-btn-card"
            disabled={termLoading}
            style={{ flex: 1.2, height: '56px', fontSize: '0.95rem', fontWeight: '800' }}
            onClick={onTerminalPay}
          >
            <RefreshCw size={18} className={termLoading ? 'spin' : ''} />
            <span>{termLoading ? t('payment.sending_to_terminal') : t('payment.card_send_csob')}</span>
          </button>
        )}

        <button
          type="button"
          className="pay-btn"
          style={{
            flex: 1,
            height: '56px',
            fontSize: '0.95rem',
            fontWeight: '800',
            background: 'var(--bg-main)',
            color: 'var(--text-primary)',
            border: '1.5px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.45rem',
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
          onClick={() => onComplete({ printReceipt: false })}
          title={t('payment.finish_no_print') || 'Dokončit bez tisku'}
        >
          <Zap size={18} style={{ color: 'var(--accent-amber)' }} />
          <span>{t('payment.finish_no_print') || 'Dokončit bez tisku'}</span>
        </button>

        <button
          type="button"
          className="pay-btn pay-btn-card"
          style={{
            flex: 1.2,
            height: '56px',
            fontSize: '0.95rem',
            fontWeight: '800',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.45rem',
            whiteSpace: 'nowrap'
          }}
          onClick={() => onComplete({ printReceipt: true })}
          title={t('payment.finish_with_print') || 'Dokončit a vytisknout'}
        >
          <Printer size={19} />
          <span>{t('payment.finish_with_print') || 'Dokončit a vytisknout'}</span>
        </button>
      </div>
    </div>
  );
}
