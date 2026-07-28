import React, { useState } from 'react';
import { Power, AlertTriangle, CheckCircle, X, LogOut } from 'lucide-react';
import { shutdownBackend } from '../api/posApi';

export default function ShutdownModal({ pendingCount, onClose }) {
  const [isShuttingDown, setIsShuttingDown] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const handleConfirmShutdown = () => {
    setIsShuttingDown(true);
    // Non-blocking fire-and-forget request to backend
    shutdownBackend().catch(err => console.warn('Shutdown dispatched:', err));

    setTimeout(() => {
      setIsDone(true);
      try {
        window.close();
      } catch {
        // Window close blocked by browser security policy
      }
    }, 400);
  };

  if (isDone) {
    return (
      <div className="modal-overlay">
        <div className="modal-card" style={{ maxWidth: '480px', textAlign: 'center', padding: '2.5rem' }}>
          <CheckCircle size={64} style={{ color: 'var(--accent-emerald)', margin: '0 auto 1rem auto' }} />
          <h2 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '0.5rem', color: '#fff' }}>
            Směna byla úspěšně ukončena!
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.5', margin: 0 }}>
            Všechny prodeje byly uloženy. Pokladní systém je bezpečně vypnut. Můžete vypnout monitor.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <div className="modal-header" style={{ borderBottom: '2px solid var(--accent-rose)' }}>
          <div className="modal-header-title">
            <Power size={24} style={{ color: 'var(--accent-rose)' }} />
            <h2>Ukončení Směny & Vypnutí</h2>
          </div>
          <button className="close-modal-btn" onClick={onClose} disabled={isShuttingDown} title="Zavřít">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ gap: '1rem' }}>
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '1.1rem 1.25rem',
            color: 'var(--text-primary)'
          }}>
            <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: '1.5' }}>
              Opravdu chcete <strong>ukončit dnešní směnu</strong> a vypnout pokladní systém?
            </p>
          </div>

          {pendingCount > 0 && (
            <div style={{
              background: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: 'var(--radius-md)',
              padding: '0.85rem 1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              color: 'var(--accent-amber)',
              fontSize: '0.85rem'
            }}>
              <AlertTriangle size={20} style={{ flexShrink: 0 }} />
              <span>
                Upozornění: V paměti zůstává <strong>{pendingCount} neodeslaných tržeb (EET)</strong>. Doporučujeme je před vypnutím odeslat.
              </span>
            </div>
          )}
        </div>

        <div className="modal-footer footer-split">
          <button
            className="btn btn-secondary"
            onClick={onClose}
            disabled={isShuttingDown}
            style={{
              flex: 1,
              padding: '0.85rem 1rem',
              background: 'var(--bg-input)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            <span>Pokračovat v prodeji</span>
          </button>

          <button
            className="btn"
            onClick={handleConfirmShutdown}
            disabled={isShuttingDown}
            style={{
              flex: 1,
              padding: '0.85rem 1rem',
              background: 'var(--accent-rose)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              cursor: 'pointer'
            }}
          >
            <LogOut size={18} />
            <span>{isShuttingDown ? 'Vypínám...' : 'Ano, Vypnout Pokladnu'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
