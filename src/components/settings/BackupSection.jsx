import React, { useState, useEffect } from 'react';
import { HardDrive, Download, Upload, Trash2, Shield, RefreshCw, CheckCircle, Database } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext.jsx';
import { fetchDatabaseBackupStatus, triggerDatabaseBackup } from '../../api/posApi.js';

export default function BackupSection({
  config,
  setConfig,
  saveConfigBatch,
  onSaveStoreConfig,
  onExportJSON,
  onImportJSON,
  onResetData,
  litestreamData,
  updateData,
  updateLoading,
  onCheckUpdate
}) {
  const { t } = useTranslation();
  const [dbBackupStatus, setDbBackupStatus] = useState(null);
  const [dbBackupLoading, setDbBackupLoading] = useState(false);
  const [dbBackupMsg, setDbBackupMsg] = useState(null);

  useEffect(() => {
    fetchDatabaseBackupStatus().then(res => {
      if (res && res.status === 'SUCCESS') setDbBackupStatus(res);
    }).catch(() => {});
  }, []);

  const handleCreateDbBackup = async () => {
    setDbBackupLoading(true);
    setDbBackupMsg(null);
    try {
      const res = await triggerDatabaseBackup();
      if (res && res.status === 'SUCCESS') {
        setDbBackupMsg({ type: 'success', text: `Záloha vytvořena: ${res.filename} (${((res.size_bytes || 0) / 1024).toFixed(1)} KB)` });
        const updated = await fetchDatabaseBackupStatus();
        if (updated && updated.status === 'SUCCESS') setDbBackupStatus(updated);
      } else {
        setDbBackupMsg({ type: 'error', text: res?.message || 'Chyba při vytváření zálohy' });
      }
    } catch (err) {
      setDbBackupMsg({ type: 'error', text: err.message });
    } finally {
      setDbBackupLoading(false);
    }
  };

  const handleUpdate = (updates) => {
    if (saveConfigBatch) {
      saveConfigBatch(updates);
    } else {
      const updated = { ...config, ...updates };
      setConfig(updated);
      onSaveStoreConfig(updated);
    }
  };

  return (
    <div className="settings-grid-layout">
      {/* 💾 LEFT COLUMN: Backup & Restore */}
      <div className="settings-grid-col">
        {/* 💾 Card 1: Zálohování a obnova dat */}
        <div className="settings-section-card">
        <div className="settings-section-header">
          <div>
            <h3 className="settings-section-title">
              <HardDrive size={19} style={{ color: 'var(--accent-emerald)' }} />
              <span>Zálohování & Obnova Dat</span>
            </h3>
            <p className="settings-section-desc">
              Vytvářejte bezpečné online zálohy SQLite databáze a exportujte konfiguraci produktů.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="pay-btn"
            disabled={dbBackupLoading}
            style={{ flex: 1, minWidth: '190px', height: '44px', fontSize: '0.85rem', background: 'var(--accent-emerald)', color: '#fff' }}
            onClick={handleCreateDbBackup}
          >
            <Database size={16} />
            <span>{dbBackupLoading ? 'Vytvářím zálohu...' : 'Vytvořit SQLite zálohu'}</span>
          </button>

          <button
            type="button"
            className="pay-btn pay-btn-card"
            style={{ flex: 1, minWidth: '180px', height: '44px', fontSize: '0.85rem' }}
            onClick={onExportJSON}
          >
            <Download size={16} />
            <span>Exportovat položky (JSON)</span>
          </button>

          <label
            className="nav-tab"
            style={{
              flex: 1,
              minWidth: '180px',
              height: '44px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              fontSize: '0.85rem',
              fontWeight: '800'
            }}
          >
            <Upload size={16} />
            <span>Nahrát JSON zálohu</span>
            <input
              type="file"
              accept=".json"
              onChange={onImportJSON}
              style={{ display: 'none' }}
            />
          </label>

          <button
            type="button"
            className="clear-cart-btn"
            style={{ height: '44px', padding: '0 1rem', fontSize: '0.85rem', fontWeight: '800' }}
            onClick={onResetData}
          >
            <Trash2 size={16} />
            <span>Resetovat</span>
          </button>
        </div>

        {dbBackupMsg && (
          <div style={{
            marginTop: '0.65rem',
            padding: '0.45rem 0.75rem',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.8rem',
            background: dbBackupMsg.type === 'success' ? 'rgba(5, 150, 105, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            color: dbBackupMsg.type === 'success' ? 'var(--accent-emerald)' : 'var(--accent-rose)',
            fontWeight: '600'
          }}>
            {dbBackupMsg.text}
          </div>
        )}

        {dbBackupStatus?.last_backup_time && (
          <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            Poslední SQLite záloha: <strong>{new Date(dbBackupStatus.last_backup_time).toLocaleString('cs-CZ')}</strong> ({dbBackupStatus.last_backup_file})
          </div>
        )}

        {/* Automatická ochrana databáze (Litestream) */}
        <div style={{ background: 'var(--bg-card)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span style={{ fontWeight: '800', color: 'var(--text-primary)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Shield size={15} style={{ color: litestreamData?.is_running ? 'var(--accent-emerald)' : 'var(--accent-amber)' }} />
              <span>Automatická ochrana a replikace databáze</span>
            </span>
            <span className="status-badge" style={{
              padding: '0.2rem 0.55rem',
              fontSize: '0.72rem',
              background: litestreamData?.is_running ? 'rgba(5, 150, 105, 0.15)' : 'rgba(245, 158, 11, 0.15)',
              color: litestreamData?.is_running ? 'var(--accent-emerald)' : 'var(--accent-amber)',
              border: 'none',
              fontWeight: '800'
            }}>
              {litestreamData?.is_running ? '🟢 Aktivní ochrana' : '⚪ Lokální SQLite úložiště'}
            </span>
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
            {litestreamData?.message || 'Data se okamžitě a bezpečně ukládají do lokální databáze SQLite v pokladně.'}
          </div>
        </div>
      </div>
      </div>

      {/* 🔄 RIGHT COLUMN: System Updates & EET 2.0 */}
      <div className="settings-grid-col">
        {/* 🔄 Card 2: Aktualizace systému */}
        <div className="settings-section-card">
        <div className="settings-section-header">
          <div>
            <h3 className="settings-section-title">
              <RefreshCw size={19} style={{ color: 'var(--accent-blue)' }} />
              <span>{t('settings.updates_title') || 'Aktualizace pokladny'}</span>
            </h3>
            <p className="settings-section-desc">
              Zkontrolujte a nainstalujte nejnovější vylepšení a opravy pokladního systému.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.92rem', fontWeight: '800', color: 'var(--text-primary)' }}>
              Nainstalovaná verze: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-blue)' }}>{updateData?.current_version?.hash ? `#${updateData.current_version.hash}` : 'VoltFlow POS 1.0.0'}</span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              Systém se automaticky udržuje v aktuálním stabilním stavu.
            </div>
          </div>

          <button
            type="button"
            className="nav-tab"
            disabled={updateLoading}
            onClick={onCheckUpdate}
            style={{ minHeight: '44px', padding: '0 1.25rem', fontSize: '0.85rem', fontWeight: '800' }}
          >
            <RefreshCw size={15} className={updateLoading ? 'spin-icon' : ''} />
            <span>{updateLoading ? 'Kontroluji...' : 'Zkontrolovat aktualizace'}</span>
          </button>
        </div>
      </div>

      {/* 🇨🇿 Card 3: EET 2.0 (Fiskalizace) */}
      <div className="settings-section-card">
        <div className="settings-section-header">
          <div>
            <h3 className="settings-section-title">
              <Shield size={19} style={{ color: config.eetEnabled ? 'var(--accent-emerald)' : 'var(--text-muted)' }} />
              <span>{t('settings.eet_toggle_label') || 'Elektronická evidence tržeb (EET 2.0)'}</span>
            </h3>
            <p className="settings-section-desc">
              {t('settings.eet_toggle_desc') || 'EET v ČR není v provozu. Ponechte vypnuté pro běžný provoz bez odesílání tržeb na Finanční správu.'}
            </p>
          </div>

          <label className="settings-switch-toggle">
            <input
              type="checkbox"
              checked={!!config.eetEnabled}
              onChange={e => handleUpdate({ eetEnabled: e.target.checked })}
            />
            <span className="settings-switch-slider" />
          </label>
        </div>

        {!config.eetEnabled && (
          <div style={{ padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle size={16} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
            <span>EET je vypnuté. Pokladna funguje v plném rychlém offline režimu bez generování EET podpisů.</span>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
