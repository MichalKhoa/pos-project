import React, { useEffect } from 'react';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';

export default function CheckoutFlashBanner({ flashBanner, onDismiss }) {
  useEffect(() => {
    if (!flashBanner) return;
    const duration = flashBanner.type === 'SUCCESS' ? 2200 : 3200;
    const timer = setTimeout(() => {
      if (onDismiss) {
        onDismiss();
      }
    }, duration);
    return () => clearTimeout(timer);
  }, [flashBanner, onDismiss]);

  if (!flashBanner) return null;

  const isSuccess = flashBanner.type === 'SUCCESS';

  return (
    <div className="flash-banner-wrapper">
      <div className={`flash-banner-card ${isSuccess ? 'flash-success' : 'flash-error'}`}>
        <div className="flash-icon">
          {isSuccess ? (
            <CheckCircle2 size={24} />
          ) : (
            <AlertTriangle size={24} />
          )}
        </div>

        <div className="flash-message-content">
          <span className="flash-main-text">
            {flashBanner.message || (isSuccess ? 'Zaplaceno!' : 'Chyba transakce')}
          </span>
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
          title="Zavřít"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
