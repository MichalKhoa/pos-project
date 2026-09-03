import React from 'react';
import { CreditCard, Save, RefreshCw, CheckCircle, XCircle, Wifi, Smartphone } from 'lucide-react';
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
    <div className="settings-grid-layout">
      {/* 💳 LEFT COLUMN: Terminal Mode */}
      <div className="settings-grid-col">
        {/* 💳 Card 1: Režim platby kartou */}
        <div className="settings-section-card">
        <div className="settings-section-header">
          <div>
            <h3 className="settings-section-title">
              <CreditCard size={19} style={{ color: 'var(--accent-blue)' }} />
              <span>{t('settings.csob_title') || 'Platební terminál pro karty'}</span>
            </h3>
            <p className="settings-section-desc">
              Zvolte, zda obsluha zadává částku na terminálu ručně, nebo pokladna odesílá částku automaticky přes síť.
            </p>
          </div>

          <span className="status-badge" style={{
            background: termEnabled ? 'rgba(5, 150, 105, 0.15)' : 'rgba(59, 130, 246, 0.12)',
            color: termEnabled ? 'var(--accent-emerald)' : 'var(--accent-blue)',
            border: 'none',
            padding: '0.35rem 0.75rem',
            fontSize: '0.8rem',
            fontWeight: '800'
          }}>
            {termEnabled ? 'Automatický režim' : 'Ruční režim'}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
          {/* Manual mode card */}
          <div
            onClick={() => setTermEnabled(false)}
            style={{
              cursor: 'pointer',
              padding: '1.15rem',
              borderRadius: 'var(--radius-lg)',
              border: `2px solid ${!termEnabled ? 'var(--accent-blue)' : 'var(--border-color)'}`,
              background: !termEnabled ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-card)',
              boxShadow: !termEnabled ? '0 2px 8px rgba(59, 130, 246, 0.15)' : 'none',
              transition: 'all 0.15s ease',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem',
              userSelect: 'none'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Smartphone size={22} style={{ color: !termEnabled ? 'var(--accent-blue)' : 'var(--text-muted)' }} />
              <span style={{ fontWeight: '800', fontSize: '1rem', color: !termEnabled ? 'var(--accent-blue)' : 'var(--text-primary)' }}>
                {t('settings.csob_manual_mode') || 'Ruční zadání (Doporučeno)'}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              Obsluha naťuká částku přímo do terminálu. Vhodné pro jakýkoliv platební terminál bez nutnosti propojení po síti.
            </p>
          </div>

          {/* Automatic CSOB mode card */}
          <div
            onClick={() => setTermEnabled(true)}
            style={{
              cursor: 'pointer',
              padding: '1.15rem',
              borderRadius: 'var(--radius-lg)',
              border: `2px solid ${termEnabled ? 'var(--accent-emerald)' : 'var(--border-color)'}`,
              background: termEnabled ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-card)',
              boxShadow: termEnabled ? '0 2px 8px rgba(16, 185, 129, 0.15)' : 'none',
              transition: 'all 0.15s ease',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem',
              userSelect: 'none'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Wifi size={22} style={{ color: termEnabled ? 'var(--accent-emerald)' : 'var(--text-muted)' }} />
              <span style={{ fontWeight: '800', fontSize: '1rem', color: termEnabled ? 'var(--accent-emerald)' : 'var(--text-primary)' }}>
                {t('settings.csob_auto_mode') || 'Automatický ČSOB terminál'}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              Částka se automaticky přenese do terminálu Ingenico Move 3500 přes lokální Wi-Fi nebo ethernetovou síť.
            </p>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <button
        type="button"
        className="pay-btn pay-btn-cash"
        onClick={onSaveTerminal}
        style={{ height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%', marginTop: '0.5rem' }}
      >
        <Save size={18} />
        <span>{termSaveSuccess ? 'Uloženo!' : 'Uložit nastavení terminálu'}</span>
      </button>
    </div>

    {/* ⚙️ RIGHT COLUMN: CSOB Network Configuration or Manual Info */}
    <div className="settings-grid-col">
        {termEnabled ? (
          <div className="settings-section-card">
            <div className="settings-section-header">
              <div>
                <h3 className="settings-section-title">
                  <Wifi size={19} style={{ color: 'var(--accent-emerald)' }} />
                  <span>Síťové nastavení terminálu ČSOB</span>
                </h3>
                <p className="settings-section-desc">
                  Zadejte lokální IP adresu a port terminálu přidělené vaším routerem.
                </p>
              </div>
            </div>

            <div className="settings-field">
              <label className="settings-label">
                {t('settings.csob_ip') || 'IP adresa terminálu v síti'}
              </label>
              <input
                type="text"
                className="settings-input"
                placeholder="např. 192.168.1.150"
                value={termIp}
                onChange={e => setTermIp(e.target.value)}
              />
            </div>

            <div className="settings-form-grid">
              <div className="settings-field">
                <label className="settings-label">
                  {t('settings.csob_port') || 'Komunikační port'}
                </label>
                <input
                  type="text"
                  className="settings-input"
                  placeholder="8888"
                  value={termPort}
                  onChange={e => setTermPort(e.target.value)}
                />
              </div>

              <div className="settings-field">
                <label className="settings-label">
                  {t('settings.csob_tid') || 'ID Terminálu (TID)'}
                </label>
                <input
                  type="text"
                  className="settings-input"
                  placeholder="např. 12345678"
                  value={termId}
                  onChange={e => setTermId(e.target.value)}
                />
              </div>
            </div>

            {/* Test Connection and Reconcile actions */}
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="key-btn"
                onClick={onPing}
                disabled={pingLoading}
                style={{ flex: 1, minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
              >
                <RefreshCw size={15} className={pingLoading ? 'spin-icon' : ''} />
                <span>{pingLoading ? 'Testuji...' : 'Otestovat spojení (Ping)'}</span>
              </button>

              <button
                type="button"
                className="key-btn"
                onClick={onReconcile}
                disabled={reconcileLoading}
                style={{ flex: 1, minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
              >
                <RefreshCw size={15} className={reconcileLoading ? 'spin-icon' : ''} />
                <span>{reconcileLoading ? 'Uzavírám...' : 'Denní uzávěrka terminálu'}</span>
              </button>
            </div>

            {/* Ping Result Banner */}
            {pingResult && (
              <div style={{
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.85rem',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginTop: '1rem',
                background: pingResult.success ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                color: pingResult.success ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                border: `1px solid ${pingResult.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
              }}>
                {pingResult.success ? <CheckCircle size={16} /> : <XCircle size={16} />}
                <span>{pingResult.message || (pingResult.success ? 'Terminál je dostupný na síti' : 'Terminál neodpovídá na zadané adrese')}</span>
              </div>
            )}

            {/* Reconcile Result Banner */}
            {reconcileResult && (
              <div style={{
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.85rem',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginTop: '0.5rem',
                background: reconcileResult.success ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                color: reconcileResult.success ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                border: `1px solid ${reconcileResult.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
              }}>
                {reconcileResult.success ? <CheckCircle size={16} /> : <XCircle size={16} />}
                <span>{reconcileResult.message || (reconcileResult.success ? 'Denní finanční uzávěrka terminálu byla úspěšně provedena' : 'Chyba při provádění uzávěrky')}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="settings-section-card">
            <div className="settings-section-header">
              <div>
                <h3 className="settings-section-title">
                  <Smartphone size={19} style={{ color: 'var(--accent-blue)' }} />
                  <span>Jak funguje ruční režim</span>
                </h3>
                <p className="settings-section-desc">
                  Jednoduché a bezchybné řešení bez nutnosti síťového nastavování.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', flexShrink: 0 }}>1</div>
                <div>Zákazník zvolí platbu kartou. Pokladna na obrazovce zobrazí přesnou částku k úhradě.</div>
              </div>

              <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', flexShrink: 0 }}>2</div>
                <div>Obsluha zadá tuto částku do libovolného přenosného terminálu (ČSOB, SumUp, myPOS) a přiloží kartu.</div>
              </div>

              <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', flexShrink: 0 }}>3</div>
                <div>Po úspěšném pípnutí terminálu klikne obsluha na pokladně na <strong>Dokončit platbu</strong>.</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
