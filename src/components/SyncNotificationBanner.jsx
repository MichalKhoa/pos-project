import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export default function SyncNotificationBanner({ type = 'success', message, onClose }) {
  if (!message) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle2 size={20} className="banner-icon icon-success" />;
      case 'error':
        return <AlertCircle size={20} className="banner-icon icon-error" />;
      default:
        return <Info size={20} className="banner-icon icon-info" />;
    }
  };

  return (
    <div className={`sync-notification-banner banner-${type}`}>
      <div className="banner-content">
        {getIcon()}
        <span className="banner-message">{message}</span>
      </div>
      <button className="banner-close-btn" onClick={onClose} title="Zavřít oznámení">
        <X size={18} />
      </button>
    </div>
  );
}
