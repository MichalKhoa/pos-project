import React from 'react';
import { HardDrive, Download, Upload, Trash2, Shield, RefreshCw } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext.jsx';

export default function BackupSection({
  config,
  setConfig,
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Backup Management */}
      <div className="table-card" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <HardDrive size={18} style={{ color: 'var(--accent-emerald)' }} />
          <span>Zálohování & Obnova Databází (Local & JSON)</span>
        </h3>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <button className="nav-tab" style={{ flex: 1, minWidth: '160px', padding: '0.65rem' }} onClick={onExportJSON}>
            <Download size={16} />
            <span>{t('settings.export_backup')}</span>
          </button>

          <label className="nav-tab" style={{ flex: 1, minWidth: '160px', padding: '0.65rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <Upload size={16} />
            <span>{t('settings.import_backup')}</span>
            <input
              type="file"
              accept=".json"
              onChange={onImportJSON}
              style={{ display: 'none' }}
            />
          </label>

          <button className="nav-tab" style={{ padding: '0.65rem', color: 'var(--accent-rose)' }} onClick={onResetData}>
            <Trash2 size={16} />
            <span>Resetovat Data</span>
          </button>
        </div>

        {/* Litestream Status Panel */}
        <div style={{ background: 'var(--bg-input)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Shield size={14} style={{ color: litestreamData?.is_running ? 'var(--accent-emerald)' : 'var(--accent-amber)' }} />
              <span>Litestream Cloud Replikace (WAL)</span>
            </span>
            <span className="status-badge" style={{
              padding: '0.2rem 0.5rem',
              fontSize: '0.7rem',
              background: litestreamData?.is_running ? 'rgba(5, 150, 105, 0.15)' : litestreamData?.litestream_configured ? 'rgba(245, 158, 11, 0.15)' : 'rgba(100, 116, 139, 0.15)',
              color: litestreamData?.is_running ? 'var(--accent-emerald)' : litestreamData?.litestream_configured ? 'var(--accent-amber)' : 'var(--text-muted)'
            }}>
              {litestreamData?.is_running ? '🟢 Aktivní replikace' : litestreamData?.litestream_configured ? '🟡 Konfigurace OK' : '⚪ Neaktivní'}
            </span>
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
            {litestreamData?.message || 'Kontrola stavu replikace SQLite databáze...'}
          </div>
        </div>
      </div>

      {/* System Updates Management */}
      <div className="table-card" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <RefreshCw size={18} style={{ color: 'var(--accent-blue)' }} />
          <span>{t('settings.updates_title')}</span>
        </h3>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', background: 'var(--bg-input)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-primary)' }}>
              Verze: {updateData?.current_version?.hash ? `#${updateData.current_version.hash}` : 'Himmel POS 1.0.0'}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className="nav-tab"
              disabled={updateLoading}
              onClick={onCheckUpdate}
              style={{ padding: '0.5rem 0.85rem', fontSize: '0.8rem' }}
            >
              <RefreshCw size={14} className={updateLoading ? 'spin-icon' : ''} />
              <span>Zkontrolovat aktualizace</span>
            </button>
          </div>
        </div>
      </div>

      {/* Czech EET Fiscalization (Optional) */}
      <div className="table-card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <div style={{ fontWeight: '800', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
              <Shield size={18} style={{ color: config.eetEnabled ? 'var(--accent-emerald)' : 'var(--text-muted)' }} />
              <span>{t('settings.eet_toggle_label')}</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>
              {t('settings.eet_toggle_desc')}
            </div>
          </div>
          <label style={{ position: 'relative', display: 'inline-block', width: '50px', height: '28px', flexShrink: 0 }}>
            <input
              type="checkbox"
              checked={!!config.eetEnabled}
              onChange={e => {
                const updated = { ...config, eetEnabled: e.target.checked };
                setConfig(updated);
                onSaveStoreConfig(updated);
              }}
              style={{ opacity: 0, width: 0, height: 0 }}
            />
            <span style={{
              position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: config.eetEnabled ? 'var(--accent-emerald)' : 'var(--border-color)',
              transition: '.3s', borderRadius: '34px'
            }}>
              <span style={{
                position: 'absolute', content: '""', height: '22px', width: '22px', left: config.eetEnabled ? '25px' : '3px', bottom: '3px',
                backgroundColor: 'white', transition: '.3s', borderRadius: '50%'
              }} />
            </span>
          </label>
        </div>

        {!config.eetEnabled && (
          <div style={{ padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.25)', fontSize: '0.8rem', color: 'var(--accent-blue)' }}>
            {t('settings.eet_disabled_banner')}
          </div>
        )}
      </div>
    </div>
  );
}
