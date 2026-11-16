import React, { useEffect } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext.jsx';

// Callers pass type in any case ('SUCCESS', 'success', 'info', 'default', ...); anything unknown reads as info.
const KINDS = ['success', 'warning', 'error'];

export default function CheckoutFlashBanner({ flashBanner, onDismiss }) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!flashBanner) return;
    const duration = String(flashBanner.type).toLowerCase() === 'success' ? 2200 : 3200;
    const timer = setTimeout(() => {
      if (onDismiss) {
        onDismiss();
      }
    }, duration);
    return () => clearTimeout(timer);
  }, [flashBanner, onDismiss]);

  if (!flashBanner) return null;

  const lowered = String(flashBanner.type).toLowerCase();
  const kind = KINDS.includes(lowered) ? lowered : 'info';
  const defaultText = kind === 'success' ? t('payment.paid') : kind === 'error' ? t('payment.transaction_error') : '';

  return (
    <div className="flash-banner-wrapper">
      <div className={`flash-banner-card flash-${kind}`}>
        <div className="flash-icon">
          {kind === 'success' ? <CheckCircle2 size={24} /> : kind === 'info' ? <Info size={24} /> : <AlertTriangle size={24} />}
        </div>

        <div className="flash-message-content">
          <span className="flash-main-text">{flashBanner.message || defaultText}</span>
          {flashBanner.amount !== undefined && flashBanner.amount !== null && (
            <span className="flash-amount-badge">
              {flashBanner.amount.toFixed(2)} Kč
            </span>
          )}
        </div>

        <button
          type="button"
          className="flash-close-btn"
          onClick={onDismiss}
          title={t('common.close')}
          aria-label={t('common.close')}
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
