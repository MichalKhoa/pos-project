import React from 'react';
import { RefreshCw, Zap, Printer } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext.jsx';

export default function PaymentFinishBar({
  onComplete,
  primaryClassName = 'pay-btn-card',
  disabled = false,
  onBeforeComplete,
  terminalAction
}) {
  const { t } = useTranslation();

  const handleComplete = (printReceipt) => {
    if (onBeforeComplete) onBeforeComplete();
    onComplete({ printReceipt });
  };

  return (
    <div className="payment-finish-bar">
      {terminalAction?.enabled && (
        <button
          type="button"
          className="pay-btn pay-btn-card payment-finish-terminal"
          disabled={terminalAction.loading}
          onClick={terminalAction.onPay}
        >
          <RefreshCw size={22} className={terminalAction.loading ? 'spin' : ''} style={{ flexShrink: 0 }} />
          <span>{terminalAction.loading ? t('payment.sending_to_terminal') : t('payment.card_send_csob')}</span>
        </button>
      )}

      <button
        type="button"
        className="pay-btn payment-finish-secondary"
        disabled={disabled}
        onClick={() => handleComplete(false)}
        title={t('payment.finish_no_print') || 'Dokončit bez tisku'}
      >
        <Zap size={23} style={{ color: 'var(--accent-amber)', flexShrink: 0 }} />
        <span>{t('payment.finish_no_print') || 'Dokončit bez tisku'}</span>
      </button>

      <button
        type="button"
        className={`pay-btn ${primaryClassName} payment-finish-primary`}
        disabled={disabled}
        onClick={() => handleComplete(true)}
        title={t('payment.finish_with_print') || 'Dokončit a vytisknout'}
      >
        <Printer size={26} style={{ flexShrink: 0 }} />
        <span>{t('payment.finish_with_print') || 'Dokončit a vytisknout'}</span>
      </button>
    </div>
  );
}
