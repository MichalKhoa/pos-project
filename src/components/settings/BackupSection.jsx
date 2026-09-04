import React, { useState, useEffect } from 'react';
import { HardDrive, Download, Upload, Trash2, Shield, RefreshCw, CheckCircle, Database, ArrowDownCircle, AlertCircle } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext.jsx';
import { fetchDatabaseBackupStatus, triggerDatabaseBackup } from '../../api/posApi.js';
import { useTauri } from '../../hooks/useTauri.js';

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
  const { isTauri, checkTauriUpdate, installTauriUpdate } = useTauri();
  const [dbBackupStatus, setDbBackupStatus] = useState(null);
  const [dbBackupLoading, setDbBackupLoading] = useState(false);
  const [dbBackupMsg, setDbBackupMsg] = useState(null);

  // Tauri updater state
  const [tauriChecking, setTauriChecking] = useState(false);
  const [tauriUpdateInfo, setTauriUpdateInfo] = useState(null);
  const [tauriCheckedOnce, setTauriCheckedOnce] = useState(false);
  const [tauriInstallProgress, setTauriInstallProgress] = useState(null);
  const [tauriInstallError, setTauriInstallError] = useState(null);
  const [tauriInstalling, setTauriInstalling] = useState(false);

  const handleTauriCheck = async () => {
    setTauriChecking(true);
    setTauriInstallError(null);
    const result = await checkTauriUpdate();
    setTauriUpdateInfo(result);
    setTauriCheckedOnce(true);
    setTauriChecking(false);
  };

  const handleTauriInstall = async () => {
    if (!tauriUpdateInfo?.updateRef) return;
    setTauriInstalling(true);
    setTauriInstallError(null);
    setTauriInstallProgress({ percent: 0, downloaded: 0, total: 0 });

    const res = await installTauriUpdate(tauriUpdateInfo.updateRef, (prog) => {
      setTauriInstallProgress(prog);
    });

    if (!res.success) {
      setTauriInstallError(res.error || 'Instalace aktualizace selhala');
      setTauriInstalling(false);
    }
  };

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
              <span>{t('settings.backup_title') || 'Zálohování & Obnova Dat'}</span>
            </h3>
            <p className="settings-section-desc">
              {t('settings.backup_desc') || 'Vytvářejte bezpečné online zálohy SQLite databáze a exportujte konfiguraci produktů.'}
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
            <span>{dbBackupLoading ? t('settings.backup_creating') || 'Vytvářím zálohu...' : t('settings.backup_create_sqlite') || 'Vytvořit SQLite zálohu'}</span>
          </button>

          <button
            type="button"
            className="pay-btn pay-btn-card"
            style={{ flex: 1, minWidth: '180px', height: '44px', fontSize: '0.85rem' }}
            onClick={onExportJSON}
          >
            <Download size={16} />
            <span>{t('settings.backup_export_json') || 'Exportovat položky (JSON)'}</span>
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
            <span>{t('settings.backup_import_json') || 'Nahrát JSON zálohu'}</span>
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
            <span>{t('settings.backup_reset_btn') || 'Resetovat'}</span>
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
            {t('settings.backup_last_time') || 'Poslední SQLite záloha'}: <strong>{new Date(dbBackupStatus.last_backup_time).toLocaleString('cs-CZ')}</strong> ({dbBackupStatus.last_backup_file})
          </div>
        )}

        {/* Automatická ochrana databáze (Litestream) */}
        <div style={{ background: 'var(--bg-card)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span style={{ fontWeight: '800', color: 'var(--text-primary)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Shield size={15} style={{ color: litestreamData?.is_running ? 'var(--accent-emerald)' : 'var(--accent-amber)' }} />
              <span>{t('settings.litestream_title') || 'Automatická ochrana a replikace databáze'}</span>
            </span>
            <span className="status-badge" style={{
              padding: '0.2rem 0.55rem',
              fontSize: '0.72rem',
              background: litestreamData?.is_running ? 'rgba(5, 150, 105, 0.15)' : 'rgba(245, 158, 11, 0.15)',
              color: litestreamData?.is_running ? 'var(--accent-emerald)' : 'var(--accent-amber)',
              border: 'none',
              fontWeight: '800'
            }}>
              {litestreamData?.is_running ? t('settings.litestream_active') || '🟢 Aktivní ochrana' : t('settings.litestream_local') || '⚪ Lokální SQLite úložiště'}
            </span>
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
            {litestreamData?.message || t('settings.litestream_default_msg') || 'Data se okamžitě a bezpečně ukládají do lokální databáze SQLite v pokladně.'}
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
                {t('settings.updates_desc') || 'Zkontrolujte a nainstalujte nejnovější vylepšení a opravy pokladního systému.'}
              </p>
            </div>
          </div>

          {isTauri ? (
            /* --- NATIVE TAURI DESKTOP UPDATER --- */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.92rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                    {t('settings.current_version') || 'Nainstalovaná verze'}: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-blue)' }}>v{tauriUpdateInfo?.currentVersion || '1.0.0'}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    {t('settings.updates_tauri_desc') || 'Nativní desktopová aplikace (Tauri v2 NSIS). Aktualizace se instalují bez nutnosti vývojářských nástrojů.'}
                  </div>
                </div>

                <button
                  type="button"
                  className="nav-tab"
                  disabled={tauriChecking || tauriInstalling}
                  onClick={handleTauriCheck}
                  style={{ minHeight: '44px', padding: '0 1.25rem', fontSize: '0.85rem', fontWeight: '800' }}
                >
                  <RefreshCw size={15} className={tauriChecking ? 'spin-icon' : ''} />
                  <span>{tauriChecking ? (t('settings.checking') || 'Kontroluji...') : (t('settings.check_updates') || 'Zkontrolovat aktualizace')}</span>
                </button>
              </div>

              {/* Status banner when up-to-date */}
              {tauriCheckedOnce && !tauriUpdateInfo?.available && !tauriUpdateInfo?.error && (
                <div style={{
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(5, 150, 105, 0.1)',
                  border: '1px solid rgba(5, 150, 105, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  fontSize: '0.85rem',
                  color: 'var(--accent-emerald)',
                  fontWeight: '700'
                }}>
                  <CheckCircle size={18} />
                  <span>{t('settings.up_to_date') || 'Systém je aktuální'} (v{tauriUpdateInfo?.currentVersion || '1.0.0'})</span>
                </div>
              )}

              {/* Error banner if check failed */}
              {tauriUpdateInfo?.error && (
                <div style={{
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  fontSize: '0.82rem',
                  color: 'var(--accent-rose)',
                  fontWeight: '600'
                }}>
                  <AlertCircle size={18} />
                  <span>{t('settings.updates_check_error') || 'Chyba při kontrole aktualizací:'} {tauriUpdateInfo.error}</span>
                </div>
              )}

              {/* Update available card */}
              {tauriUpdateInfo?.available && (
                <div style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--accent-blue)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <ArrowDownCircle size={20} style={{ color: 'var(--accent-blue)' }} />
                      <span style={{ fontWeight: '800', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                        {t('settings.new_version_available') || 'K dispozici je nová verze'}: <span style={{ color: 'var(--accent-blue)' }}>v{tauriUpdateInfo.version}</span>
                      </span>
                    </div>
                    {tauriUpdateInfo.date && (
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {tauriUpdateInfo.date}
                      </span>
                    )}
                  </div>

                  {tauriUpdateInfo.body && (
                    <div style={{
                      background: 'var(--bg-card)',
                      padding: '0.65rem 0.85rem',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.82rem',
                      color: 'var(--text-secondary)',
                      whiteSpace: 'pre-wrap',
                      maxHeight: '120px',
                      overflowY: 'auto'
                    }}>
                      {tauriUpdateInfo.body}
                    </div>
                  )}

                  {tauriInstalling ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.25rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: '700' }}>
                        <span>{t('settings.downloading') || 'Stahování aktualizace...'}</span>
                        <span>{tauriInstallProgress?.percent || 0}%</span>
                      </div>
                      <div style={{
                        width: '100%',
                        height: '8px',
                        background: 'var(--border-color)',
                        borderRadius: '4px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${tauriInstallProgress?.percent || 0}%`,
                          height: '100%',
                          background: 'var(--accent-blue)',
                          transition: 'width 0.2s ease-in-out'
                        }} />
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        {tauriInstallProgress?.total > 0 && (
                          <span>{((tauriInstallProgress.downloaded || 0) / (1024 * 1024)).toFixed(1)} MB / {((tauriInstallProgress.total || 0) / (1024 * 1024)).toFixed(1)} MB — </span>
                        )}
                        <span>{t('settings.updates_restart_note') || 'Pokladna se po instalaci automaticky restartuje.'}</span>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="pay-btn pay-btn-card"
                      onClick={handleTauriInstall}
                      style={{ height: '44px', fontWeight: '800', fontSize: '0.88rem', justifyContent: 'center' }}
                    >
                      <ArrowDownCircle size={18} />
                      <span>{t('settings.download_and_install') || 'Stáhnout a instalovat'}</span>
                    </button>
                  )}

                  {tauriInstallError && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--accent-rose)', fontWeight: '600' }}>
                      {tauriInstallError}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* --- WEB / BROWSER RUNTIME FALLBACK --- */
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.92rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                  {t('settings.current_version') || 'Nainstalovaná verze'}: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-blue)' }}>{updateData?.current_version?.hash ? `#${updateData.current_version.hash}` : 'VoltFlow POS 1.0.0'}</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                  {t('settings.updates_web_desc') || 'Webový režim prohlížeče. Pro produkční automatické aktualizace spusťte nativní desktopovou aplikaci VoltFlow POS.'}
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
                <span>{updateLoading ? (t('settings.checking') || 'Kontroluji...') : (t('settings.check_updates') || 'Zkontrolovat aktualizace')}</span>
              </button>
            </div>
          )}
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
            <span>{t('settings.eet_off_offline_banner') || 'EET je vypnuté. Pokladna funguje v plném rychlém offline režimu bez generování EET podpisů.'}</span>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
