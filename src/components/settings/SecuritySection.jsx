import React from 'react';
import { Shield, Lock, Unlock, KeyRound } from 'lucide-react';

export default function SecuritySection({
  config,
  setConfig,
  saveConfigBatch,
  isAdminMode,
  onToggleAdminMode,
  onOpenPinChange
}) {

  const handleUpdate = (updates) => {
    if (saveConfigBatch) {
      saveConfigBatch(updates);
    } else {
      const updated = { ...config, ...updates };
      setConfig(updated);
    }
  };

  return (
    <div className="settings-grid-layout">
      {/* 🛡️ LEFT COLUMN: Admin Mode & Admin PIN */}
      <div className="settings-grid-col">
        {/* 🛡️ Card 1: Režim správce (Admin Mode) */}
      <div className="settings-section-card" style={{ background: isAdminMode ? 'rgba(245, 158, 11, 0.05)' : 'var(--bg-main)', borderColor: isAdminMode ? 'var(--accent-amber)' : 'var(--border-color)' }}>
        <div className="settings-section-header">
          <div>
            <h3 className="settings-section-title" style={{ color: isAdminMode ? 'var(--accent-amber)' : 'var(--text-primary)' }}>
              {isAdminMode ? <Unlock size={20} style={{ color: 'var(--accent-amber)' }} /> : <Lock size={20} style={{ color: 'var(--text-muted)' }} />}
              <span>Režim správce pokladny</span>
            </h3>
            <p className="settings-section-desc">
              Umožňuje přístup k mazání prodejů, systémové konfiguraci a pokročilé správě.
            </p>
          </div>

          <span className="status-badge" style={{
            background: isAdminMode ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.05)',
            color: isAdminMode ? 'var(--accent-amber)' : 'var(--text-muted)',
            borderColor: isAdminMode ? 'rgba(245, 158, 11, 0.3)' : 'var(--border-color)',
            fontWeight: '800',
            fontSize: '0.8rem'
          }}>
            {isAdminMode ? 'Správce Aktivní' : 'Uzamčeno'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4', maxWidth: '520px' }}>
            {isAdminMode
              ? 'Správcovský režim je zapnutý. Pokladní aplikace má plná oprávnění k mazání záznamů a systémovým zásahům.'
              : 'Pro aktivaci režimu správce budete vyzváni k zadání 4místného bezpečnostního kódu Admin PIN.'}
          </p>

          <button
            type="button"
            className="pay-btn"
            style={{
              height: '44px',
              padding: '0 1.25rem',
              fontSize: '0.88rem',
              fontWeight: '800',
              background: isAdminMode ? 'var(--accent-amber)' : 'var(--bg-card)',
              color: isAdminMode ? '#ffffff' : 'var(--text-primary)',
              border: isAdminMode ? 'none' : '1px solid var(--border-color)'
            }}
            onClick={onToggleAdminMode}
          >
            {isAdminMode ? <Unlock size={18} /> : <Lock size={18} />}
            <span>{isAdminMode ? 'Ukončit Režim Správce' : 'Aktivovat Režim Správce'}</span>
          </button>
        </div>
      </div>

      {/* 🔑 Card 2: Změna Admin PIN */}
      <div className="settings-section-card">
        <div className="settings-section-header">
          <div>
            <h3 className="settings-section-title">
              <KeyRound size={19} style={{ color: 'var(--accent-amber)' }} />
              <span>Správa kódu Admin PIN</span>
            </h3>
            <p className="settings-section-desc">
              Ochranný kód bránící nepovolaným osobám v přístupu do pokročilých nastavení.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.92rem', fontWeight: '800', color: 'var(--text-primary)' }}>
              Stav Admin PIN: <span style={{ fontFamily: 'monospace', letterSpacing: '3px', color: 'var(--accent-amber)' }}>••••</span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              Výchozí kód z výroby je 1234. Pro vyšší bezpečnost doporučujeme kód změnit.
            </div>
          </div>

          <button
            type="button"
            className="clear-cart-btn"
            style={{
              height: '44px',
              padding: '0 1.25rem',
              fontSize: '0.88rem',
              fontWeight: '800',
              borderColor: 'var(--accent-amber)',
              color: 'var(--accent-amber)',
              background: 'rgba(245, 158, 11, 0.1)'
            }}
            onClick={onOpenPinChange}
          >
            <Lock size={16} />
            <span>Změnit kód Admin PIN</span>
          </button>
        </div>
      </div>
      </div>

      {/* 🔒 RIGHT COLUMN: Cashier PIN & Inactivity Auto-Lock */}
      <div className="settings-grid-col">
        {/* 🔒 Card 3: PIN Pokladny & Automatické Zamykání */}
        <div className="settings-section-card">
        <div className="settings-section-header">
          <div>
            <h3 className="settings-section-title">
              <Shield size={19} style={{ color: 'var(--accent-blue)' }} />
              <span>Zabezpečení a Uzamčení Pokladny</span>
            </h3>
            <p className="settings-section-desc">
              Nastavte automatické zamykání obrazovky, když se pokladna nepoužívá.
            </p>
          </div>
        </div>

        <div className="settings-form-grid">
          <div className="settings-field">
            <label className="settings-label">
              PIN kód obsluhy pokladny (4–8 číslic)
            </label>
            <input
              type="password"
              className="settings-input"
              maxLength={8}
              value={config.cashierPin || '1234'}
              onChange={e => setConfig({ ...config, cashierPin: e.target.value.replace(/\D/g, '').slice(0, 8) })}
              onBlur={e => handleUpdate({ cashierPin: e.target.value })}
              style={{ fontSize: '1.2rem', letterSpacing: '0.2em', textAlign: 'center' }}
            />
          </div>

          <div className="settings-field">
            <label className="settings-label">
              Automatické uzamčení při nečinnosti
            </label>
            <select
              className="settings-input"
              value={config.autoLockMinutes !== undefined ? config.autoLockMinutes : 15}
              onChange={e => handleUpdate({ autoLockMinutes: parseInt(e.target.value, 10) })}
            >
              <option value={15}>Po 15 minutách nečinnosti (Doporučeno)</option>
              <option value={5}>Po 5 minutách nečinnosti</option>
              <option value={30}>Po 30 minutách nečinnosti</option>
              <option value={0}>Vypnuto (Pouze ruční zamknutí tlačítkem)</option>
            </select>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
