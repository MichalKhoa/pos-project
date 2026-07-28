import React from 'react';
import { RefreshCw, Wifi, Clock, AlertTriangle, X } from 'lucide-react';

export default function PendingSyncModal({ pendingCount, isLoading, onSync, onSnooze }) {
  return (
    <div className="modal-overlay" onClick={onSnooze}>
      <div className="modal-card pending-sync-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <div className="modal-header header-warning">
          <div className="modal-header-title">
            <AlertTriangle className="icon-warning" size={24} />
            <h2>Neodeslané účtenky k evidenci (EET)</h2>
          </div>
          <button className="close-modal-btn" onClick={onSnooze} disabled={isLoading} title="Zavřít">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ gap: '1rem' }}>
          <div className="sync-status-card">
            <div className="sync-status-icon">
              <Wifi size={32} className="text-accent" />
            </div>
            <div className="sync-status-info">
              <h3>Byla detekována konektivita / Neodeslané tržby</h3>
              <p>
                V lokální paměti registru zůstává <strong>{pendingCount} neodeslaných účtenek</strong> po předchozím výpadku internetu či napájení.
              </p>
            </div>
          </div>

          <div className="sync-notice-box">
            <p style={{ margin: 0 }}>
              Dle zákona je nutné tržby evidované v offline režimu bezodkladně po obnovení spojení odeslat na Finanční správu ČR.
            </p>
          </div>
        </div>

        <div className="modal-footer footer-split">
          <button
            className="btn btn-secondary"
            onClick={onSnooze}
            disabled={isLoading}
            style={{
              flex: 1,
              padding: '0.85rem 1rem',
              background: 'var(--bg-input)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              cursor: 'pointer'
            }}
          >
            <Clock size={18} />
            <span>Připomenout za 5 minut</span>
          </button>

          <button
            className="btn"
            onClick={onSync}
            disabled={isLoading}
            style={{
              flex: 1,
              padding: '0.85rem 1rem',
              background: 'var(--accent-emerald)',
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
            <RefreshCw size={18} className={isLoading ? 'spin-icon' : ''} />
            <span>{isLoading ? 'Odesílám...' : 'Synchronizovat tržby nyní'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
