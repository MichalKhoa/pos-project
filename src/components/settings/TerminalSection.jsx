import React from 'react';
import { CreditCard, Save, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext.jsx';

export default function TerminalSection({
  termEnabled,
  setTermEnabled,
  termIp,
  setTermIp,
  termPort,
  setTermPort,
  termId,
  setTermId,
  onSaveTerminal,
  termSaveSuccess,
  pingLoading,
  pingResult,
  onPing,
  reconcileLoading,
  reconcileResult,
  onReconcile
}) {
  const { t } = useTranslation();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="table-card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CreditCard size={20} style={{ color: 'var(--accent-blue)' }} />
            <span>{t('settings.csob_title')}</span>
          </h3>
          <span className="status-badge" style={{
            background: termIp ? 'rgba(5, 150, 105, 0.15)' : 'rgba(245, 158, 11, 0.15)',
            color: termIp ? 'var(--accent-emerald)' : 'var(--accent-amber)',
            borderColor: termIp ? 'rgba(5, 150, 105, 0.3)' : 'rgba(245, 158, 11, 0.3)',
            padding: '0.3rem 0.65rem',
            fontSize: '0.75rem'
          }}>
            {termIp ? `IP: ${termIp}:${termPort}` : 'Ruční zadání (Bez IP)'}
          </span>
        </div>

        <form onSubmit={onSaveTerminal} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
              {t('settings.csob_mode')}
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <button
                type="button"
                className="vat-btn"
                style={{
                  padding: '0.75rem',
                  textAlign: 'left',
                  background: !termEnabled ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-input)',
                  borderColor: !termEnabled ? 'var(--accent-blue)' : 'var(--border-color)',
                  color: 'var(--text-primary)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.2rem'
                }}
                onClick={() => setTermEnabled(false)}
              >
                <span style={{ fontWeight: '800', fontSize: '0.85rem', color: !termEnabled ? 'var(--accent-blue)' : 'var(--text-primary)' }}>
                  {t('settings.csob_manual_mode')}
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {t('settings.csob_manual_desc')}
                </span>
              </button>

              <button
                type="button"
                className="vat-btn"
                style={{
                  padding: '0.75rem',
                  textAlign: 'left',
                  background: termEnabled ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-input)',
                  borderColor: termEnabled ? 'var(--accent-emerald)' : 'var(--border-color)',
                  color: 'var(--text-primary)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.2rem'
                }}
                onClick={() => setTermEnabled(true)}
              >
                <span style={{ fontWeight: '800', fontSize: '0.85rem', color: termEnabled ? 'var(--accent-emerald)' : 'var(--text-primary)' }}>
                  {t('settings.csob_auto_mode')}
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {t('settings.csob_auto_desc')}
                </span>
              </button>
            </div>
          </div>

          {termEnabled && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                  {t('settings.csob_ip')}
                </label>
                <input
                  type="text"
                  placeholder="např. 192.168.1.150"
                  value={termIp}
                  onChange={e => setTermIp(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontWeight: '700', fontFamily: 'var(--font-mono)' }}
                  required={termEnabled}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                    {t('settings.csob_port')}
                  </label>
                  <input
                    type="text"
                    value={termPort}
                    onChange={e => setTermPort(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem 0.75rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontWeight: '700', fontFamily: 'var(--font-mono)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                    {t('settings.csob_tid')}
                  </label>
                  <input
                    type="text"
                    placeholder="TID terminálu"
                    value={termId}
                    onChange={e => setTermId(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem 0.75rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontWeight: '700' }}
                  />
                </div>
              </div>

              {/* Ping & Reconcile actions */}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="nav-tab"
                  onClick={onPing}
                  disabled={pingLoading || !termIp}
                  style={{ flex: 1, padding: '0.5rem', justifyContent: 'center', fontSize: '0.8rem', fontWeight: '700' }}
                >
                  <RefreshCw size={14} className={pingLoading ? 'spin-icon' : ''} />
                  <span>{pingLoading ? 'Testuji...' : t('settings.ping_test')}</span>
                </button>

                <button
                  type="button"
                  className="nav-tab"
                  onClick={onReconcile}
                  disabled={reconcileLoading || !termIp}
                  style={{ flex: 1, padding: '0.5rem', justifyContent: 'center', fontSize: '0.8rem', fontWeight: '700' }}
                >
                  <RefreshCw size={14} className={reconcileLoading ? 'spin-icon' : ''} />
                  <span>{reconcileLoading ? 'Uzavírám...' : t('settings.reconcile')}</span>
                </button>
              </div>

              {pingResult && (
                <div style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  background: pingResult.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: pingResult.success ? 'var(--accent-emerald)' : 'var(--accent-rose)'
                }}>
                  {pingResult.success ? <CheckCircle size={14} /> : <XCircle size={14} />}
                  <span>{pingResult.message || (pingResult.success ? 'Spojení navázáno' : 'Terminál neodpovídá')}</span>
                </div>
              )}

              {reconcileResult && (
                <div style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  background: reconcileResult.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: reconcileResult.success ? 'var(--accent-emerald)' : 'var(--accent-rose)'
                }}>
                  {reconcileResult.success ? <CheckCircle size={14} /> : <XCircle size={14} />}
                  <span>{reconcileResult.message || (reconcileResult.success ? 'Uzávěrka úspěšná' : 'Chyba uzávěrky')}</span>
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            className="pay-btn pay-btn-cash"
            style={{ height: '46px', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            <Save size={18} />
            <span>{termSaveSuccess ? 'Uloženo!' : t('settings.save_terminal')}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
