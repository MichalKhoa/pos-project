import { parseSaleTimestamp } from '../utils/dateUtils';
import React from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext.jsx';
import { SYNC } from '../utils/saleSync';

const STATE_KEY = {
  [SYNC.PENDING]: 'state_pending',
  [SYNC.STRANDED]: 'state_stranded',
  [SYNC.REJECTED]: 'state_rejected'
};

/** Lists sales the server does not have yet (audit F-001 part 2, F-014) with a manual resend. */
export default function UnsentSalesModal({ sales, isFlushing, onSend, onSendAll, onClose }) {
  const { t } = useTranslation();
  const hasRejected = sales.some(s => s.syncState === SYNC.REJECTED);
  const sendable = sales.filter(s => s.syncState !== SYNC.REJECTED);

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={t('unsent_sales.title')}>
      <div className="modal-card" style={{ maxWidth: '720px' }}>
        <div className="modal-header header-warning">
          <div className="modal-header-title">
            <AlertTriangle className="icon-warning" size={24} />
            <h2>{t('unsent_sales.title')}</h2>
          </div>
          <button type="button" className="close-modal-btn" onClick={onClose} title={t('unsent_sales.close')}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ gap: '0.75rem' }}>
          {sales.length === 0 ? (
            <p>{t('unsent_sales.empty')}</p>
          ) : (
            <>
              <p style={{ margin: 0 }}>{t('unsent_sales.intro')}</p>
              {hasRejected && (
                <p role="alert" style={{ margin: 0, fontWeight: 700, color: 'var(--accent-red)' }}>
                  {t('unsent_sales.rejected_notice')}
                </p>
              )}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
                    <th>{t('unsent_sales.receipt')}</th>
                    <th>{t('unsent_sales.time')}</th>
                    <th style={{ textAlign: 'right' }}>{t('unsent_sales.amount')}</th>
                    <th>{t('unsent_sales.state')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {sales.map(s => (
                    <tr key={s.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                      <td>{s.receiptNumber}</td>
                      <td>{parseSaleTimestamp(s.timestamp).toLocaleString('cs-CZ')}</td>
                      <td style={{ textAlign: 'right' }}>{Number(s.totalAmount).toFixed(2)} Kč</td>
                      <td>
                        {t(`unsent_sales.${STATE_KEY[s.syncState]}`)}
                        {s.syncError ? ` (${s.syncError})` : ''}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          disabled={isFlushing}
                          onClick={() => onSend([s.id])}
                          style={{ minHeight: '44px', padding: '0 0.9rem' }}
                        >
                          {s.syncState === SYNC.REJECTED ? t('unsent_sales.retry') : t('unsent_sales.send')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>

        <div className="modal-footer footer-split">
          <button type="button" className="btn btn-secondary" onClick={onClose} style={{ minHeight: '48px' }}>
            {t('unsent_sales.close')}
          </button>
          {sendable.length > 0 && (
            <button
              type="button"
              className="btn"
              disabled={isFlushing}
              onClick={() => onSendAll(sendable.map(s => s.id))}
              style={{ minHeight: '48px', background: 'var(--accent-emerald)', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}
            >
              <RefreshCw size={18} />
              <span>{t('unsent_sales.send_all')}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
