import React from 'react';
import { Shield, Lock, Unlock, Save } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext.jsx';

export default function SecuritySection({
  config,
  setConfig,
  isAdminMode,
  onToggleAdminMode,
  onOpenPinChange,
  onSubmit,
  saveSuccess
}) {
  const { t } = useTranslation();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Admin Mode Toggle Card */}
      <div className="table-card" style={{ padding: '1.25rem 1.5rem', background: isAdminMode ? 'rgba(245, 158, 11, 0.08)' : 'var(--bg-card)', borderColor: isAdminMode ? 'var(--accent-amber)' : 'var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ fontSize: '1.1rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem', color: isAdminMode ? 'var(--accent-amber)' : 'var(--text-primary)' }}>
            {isAdminMode ? <Unlock size={20} style={{ color: 'var(--accent-amber)' }} /> : <Lock size={20} style={{ color: 'var(--text-muted)' }} />}
            <span>Režim Správce Pokladny (Admin Mode)</span>
            <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '999px', background: isAdminMode ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.06)', color: isAdminMode ? 'var(--accent-amber)' : 'var(--text-muted)', fontWeight: '700' }}>
              {isAdminMode ? 'AKTIVNÍ' : 'VYPNUTO'}
            </span>
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {isAdminMode ? 'Režim správce je zapnutý. Máte přístup k mazání prodejů a pokročilým možnostem.' : 'Zapnutím správcovského režimu získáte přístup ke mazání testovacích prodejů a pokročilým funkcím.'}
          </div>
        </div>

        <button
          type="button"
          className="pay-btn"
          style={{
            height: '42px',
            padding: '0 1.25rem',
            fontSize: '0.9rem',
            background: isAdminMode ? 'var(--accent-amber)' : 'var(--bg-main)',
            color: isAdminMode ? '#ffffff' : 'var(--text-primary)',
            border: isAdminMode ? 'none' : '1px solid var(--border-color)'
          }}
          onClick={onToggleAdminMode}
        >
          {isAdminMode ? <Unlock size={18} /> : <Lock size={18} />}
          <span>{isAdminMode ? 'Deaktivovat Admin' : 'Aktivovat Režim Správce'}</span>
        </button>
      </div>

      {/* Admin PIN Security & Management Card */}
      <div className="table-card" style={{ padding: '1.25rem 1.5rem' }}>
        <div style={{ fontSize: '1.1rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.8rem' }}>
          <Shield size={20} style={{ color: 'var(--accent-amber)' }} />
          <span>Bezpečnost & Správa Admin PIN</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
              Kód Admin PIN: <span style={{ fontFamily: 'monospace', letterSpacing: '2px', color: 'var(--accent-amber)' }}>••••</span>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Admin PIN chrání nastavení, certifikáty a možnost mazat prodeje před neoprávněným zásahem.
            </div>
          </div>

          <button
            type="button"
            className="clear-cart-btn"
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.88rem',
              fontWeight: '800',
              borderColor: 'var(--accent-amber)',
              color: 'var(--accent-amber)',
              background: 'rgba(245, 158, 11, 0.1)'
            }}
            onClick={onOpenPinChange}
          >
            <Lock size={15} />
            <span>Změnit Admin PIN</span>
          </button>
        </div>
      </div>

      {/* Cashier PIN & Auto Lock Settings */}
      <div className="table-card" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Shield size={18} style={{ color: 'var(--accent-blue)' }} />
          <span>Zabezpečení a Uzamčení Pokladny</span>
        </h3>

        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '180px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                PIN kód pokladny (4–8 číslic)
              </label>
              <input
                type="password"
                maxLength={8}
                value={config.cashierPin || '1234'}
                onChange={e => setConfig({ ...config, cashierPin: e.target.value.replace(/\D/g, '').slice(0, 8) })}
                style={{ width: '100%', padding: '0.65rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '1.1rem', fontWeight: '800', textAlign: 'center', letterSpacing: '0.2em' }}
              />
            </div>

            <div style={{ flex: 1, minWidth: '180px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                Automatické zamknutí
              </label>
              <select
                value={config.autoLockMinutes !== undefined ? config.autoLockMinutes : 15}
                onChange={e => setConfig({ ...config, autoLockMinutes: parseInt(e.target.value, 10) })}
                style={{ width: '100%', padding: '0.65rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: '700' }}
              >
                <option value={15}>Po 15 minutách neaktivity (Doporučeno)</option>
                <option value={5}>Po 5 minutách neaktivity</option>
                <option value={30}>Po 30 minutách neaktivity</option>
                <option value={0}>Vypnuto (Pouze ruční zamknutí)</option>
              </select>
            </div>
          </div>

          <button type="submit" className="pay-btn pay-btn-card" style={{ height: '46px', marginTop: '0.5rem' }}>
            <Save size={18} />
            <span>{saveSuccess ? 'Uloženo!' : t('settings.save_store')}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
