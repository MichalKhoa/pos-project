import React from 'react';
import { KeyRound } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext.jsx';

// Shows a recovery code once. The server keeps only a hash, so closing this loses the code.
export default function RecoveryCodeModal({ code, onClose }) {
  const { t } = useTranslation();
  return (
    <div className="modal-overlay" style={{ background: 'rgba(9, 13, 25, 0.94)', zIndex: 99999 }} role="dialog" aria-modal="true">
      <div className="modal-card" style={{ maxWidth: '440px', width: '92%', padding: '1.75rem 1.5rem', textAlign: 'center' }}>
        <KeyRound size={28} style={{ color: 'var(--accent-amber)', margin: '0 auto 0.5rem auto' }} />
        <div style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-primary)' }}>
          {t('settings.recovery_code_title')}
        </div>
        <div
          data-testid="recovery-code"
          style={{
            fontFamily: 'monospace',
            fontSize: '1.6rem',
            fontWeight: '900',
            letterSpacing: '0.12em',
            margin: '1.25rem 0',
            padding: '0.9rem',
            borderRadius: '8px',
            border: '1px dashed var(--accent-amber)',
            background: 'var(--bg-input)',
            userSelect: 'all'
          }}
        >
          {code}
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.45, margin: '0 0 1.25rem 0' }}>
          {t('settings.recovery_code_warning')}
        </p>
        <button
          type="button"
          className="btn-primary"
          onClick={onClose}
          style={{ width: '100%', padding: '0.75rem', fontSize: '0.95rem', fontWeight: '800' }}
        >
          {t('settings.recovery_code_done')}
        </button>
      </div>
    </div>
  );
}
