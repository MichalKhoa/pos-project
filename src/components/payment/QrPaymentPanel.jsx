import React, { useMemo } from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { generateQrDataUrl } from '../../utils/qrCode.js';
import { useTranslation } from '../../i18n/LanguageContext.jsx';

export default function QrPaymentPanel({
  totalAmount,
  storeConfig,
  onComplete
}) {
  const { t } = useTranslation();
  const rawIban = (storeConfig?.bankAccountIban || storeConfig?.bank_account_iban || "").replace(/\s/g, '').toUpperCase();
  const hasValidIban = rawIban && rawIban !== "CZ6508000000001234567890";
  const merchantIban = hasValidIban ? rawIban : "";
  const varSymbol = useMemo(() => Date.now().toString().slice(-8), []);
  const storeName = (storeConfig?.storeName || 'VoltFlow POS').slice(0, 30);
  const spdString = hasValidIban
    ? `SPD*1.0*ACC:${merchantIban}*AM:${Math.max(0, totalAmount).toFixed(2)}*CC:CZK*X-VS:${varSymbol}*MSG:Platba ${storeName}`
    : '';
  const formattedIban = hasValidIban ? (merchantIban.match(/.{1,4}/g)?.join(' ') || merchantIban) : 'Nenastaveno';
  const qrImageUrl = useMemo(() => (hasValidIban && spdString ? generateQrDataUrl(spdString, 280) : null), [hasValidIban, spdString]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
      <div style={{
        padding: '1.25rem 1.5rem',
        background: 'var(--bg-main)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-color)',
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gap: '1.5rem',
        alignItems: 'center'
      }}>
        {/* Large Crisp QR Code Box */}
        <div style={{
          background: '#ffffff',
          padding: '14px',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.12)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          width: '240px',
          height: '240px',
          boxSizing: 'border-box'
        }}>
          {hasValidIban && qrImageUrl ? (
            <img
              src={qrImageUrl}
              alt="QR Platba SPD"
              style={{ width: '212px', height: '212px', display: 'block' }}
            />
          ) : (
            <div style={{ padding: '1rem', textAlign: 'center' }}>
              <AlertTriangle size={36} style={{ color: 'var(--accent-amber)', margin: '0 auto 0.5rem', display: 'block' }} />
              <div style={{ fontWeight: '800', fontSize: '0.85rem', color: 'var(--accent-rose)' }}>
                Účet (IBAN) nenastaven
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.35rem', lineHeight: '1.3' }}>
                Pro vygenerování platebního QR kódu zadejte IBAN v Nastavení prodejny.
              </div>
            </div>
          )}
        </div>

        {/* Structured Payment & Transfer Details Area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {/* Hero Amount Badge */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1.5px solid var(--accent-purple)',
            borderRadius: 'var(--radius-md)',
            padding: '0.65rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 16px rgba(124, 58, 237, 0.15)'
          }}>
            <span style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('payment.total_due')}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '2.2rem', fontWeight: '900', color: 'var(--accent-purple)', lineHeight: 1.1 }}>
              {totalAmount.toLocaleString('cs-CZ')} Kč
            </span>
          </div>

          {/* VS & IBAN Detail Tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '0.5rem' }}>
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '0.6rem 0.85rem'
            }}>
              <div style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {t('payment.var_symbol')}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.25rem', fontWeight: '900', color: 'var(--text-primary)', marginTop: '0.15rem' }}>
                {varSymbol}
              </div>
            </div>

            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '0.6rem 0.85rem'
            }}>
              <div style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {t('payment.bank_account_iban')}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.95rem', fontWeight: '800', color: 'var(--text-primary)', marginTop: '0.2rem', wordBreak: 'break-all' }}>
                {formattedIban}
              </div>
            </div>
          </div>

          {/* Payment Message & Scan Hint */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '0.5rem 0.85rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              {t('payment.payment_message')}:
            </span>
            <span style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-secondary)' }}>
              Platba VoltFlow POS
            </span>
          </div>

          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.3', marginTop: '0.2rem' }}>
            📱 {t('payment.qr_scan_instruction')}
          </div>
        </div>
      </div>

      {/* Confirmation Action Button */}
      <button
        type="button"
        className="pay-btn pay-btn-card"
        style={{ width: '100%', height: '56px', background: 'var(--accent-purple)', fontSize: '1.05rem', fontWeight: '800', marginTop: 'auto' }}
        onClick={onComplete}
      >
        <CheckCircle2 size={22} />
        <span>{t('payment.qr_confirm_btn', { amount: totalAmount.toFixed(2) }) || `${t('payment.qr_confirm')} (${totalAmount.toFixed(2)} Kč)`}</span>
      </button>
    </div>
  );
}
