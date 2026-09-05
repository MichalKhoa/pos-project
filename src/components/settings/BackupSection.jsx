import React, { useState, useEffect } from 'react';
import {
  HardDrive,
  Download,
  Upload,
  Trash2,
  Shield,
  RefreshCw,
  CheckCircle,
  Database,
  ArrowDownCircle,
  AlertCircle,
  Cloud,
  CloudUpload,
  CloudDownload,
  Check,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext.jsx';
import {
  fetchDatabaseBackupStatus,
  triggerDatabaseBackup,
  fetchCloudBackupStatus,
  testCloudBackupConnection,
  configureCloudBackup,
  triggerCloudBackupUpload,
  fetchRemoteCloudBackups,
  restoreRemoteCloudBackup
} from '../../api/posApi.js';
import { useStoreConfig } from '../../context/StoreConfigContext.jsx';
import { useTauri } from '../../hooks/useTauri.js';

export default function BackupSection({
  config,
  setConfig,
  saveConfigBatch,
  onSaveStoreConfig,
  onExportJSON,
  onImportJSON,
  onResetData,
  _litestreamData,
  updateData,
  updateLoading,
  onCheckUpdate
}) {
  const { t } = useTranslation();
  const { isTauri, checkTauriUpdate, installTauriUpdate } = useTauri();

  // Get technician adminPin if authenticated
  let adminPin = null;
  try {
    const storeCtx = useStoreConfig();
    if (storeCtx) adminPin = storeCtx.adminPin;
  } catch {
    // Isolated test environment fallback
  }

  const [dbBackupStatus, setDbBackupStatus] = useState(null);
  const [dbBackupLoading, setDbBackupLoading] = useState(false);
  const [dbBackupMsg, setDbBackupMsg] = useState(null);

  // Cloud Backup state
  const [cloudEnabled, setCloudEnabled] = useState(false);
  const [cloudEndpoint, setCloudEndpoint] = useState('');
  const [cloudBucket, setCloudBucket] = useState('');
  const [cloudAccessKey, setCloudAccessKey] = useState('');
  const [cloudSecretKey, setCloudSecretKey] = useState('');
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [hasSecretKey, setHasSecretKey] = useState(false);
  const [cloudPrefix, setCloudPrefix] = useState('store_01');
  const [cloudRetentionDays, setCloudRetentionDays] = useState(30);
  const [cloudLastSync, setCloudLastSync] = useState('');
  const [cloudLastStatus, setCloudLastStatus] = useState('');
  const [cloudLastError, setCloudLastError] = useState('');

  // Actions state
  const [cloudTesting, setCloudTesting] = useState(false);
  const [cloudTestMsg, setCloudTestMsg] = useState(null);
  const [cloudSaving, setCloudSaving] = useState(false);
  const [cloudSaveMsg, setCloudSaveMsg] = useState(null);
  const [cloudSyncing, setCloudSyncing] = useState(false);
  const [cloudSyncMsg, setCloudSyncMsg] = useState(null);

  // Restore modal state
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [remoteBackups, setRemoteBackups] = useState([]);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteError, setRemoteError] = useState(null);
  const [selectedBackup, setSelectedBackup] = useState(null);
  const [showConfirmRestore, setShowConfirmRestore] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState(null);

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

    fetchCloudBackupStatus(adminPin).then(res => {
      if (res && res.status === 'SUCCESS') {
        setCloudEnabled(!!res.enabled);
        setCloudEndpoint(res.endpoint || '');
        setCloudBucket(res.bucket || '');
        setCloudAccessKey(res.access_key || '');
        setHasSecretKey(!!res.has_secret_key);
        setCloudPrefix(res.prefix || 'store_01');
        setCloudRetentionDays(res.retention_days || 30);
        setCloudLastSync(res.last_sync || '');
        setCloudLastStatus(res.last_status || '');
        setCloudLastError(res.last_error || '');
      }
    }).catch(() => {});
  }, [adminPin]);

  const formatSize = (bytes) => {
    if (!bytes || bytes <= 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleToggleCloudEnabled = async () => {
    const nextVal = !cloudEnabled;
    setCloudEnabled(nextVal);
    await handleSaveCloudConfig({ enabled: nextVal });
  };

  const handleTestCloudConnection = async () => {
    setCloudTesting(true);
    setCloudTestMsg(null);
    try {
      const payload = {
        endpoint: cloudEndpoint.trim(),
        bucket: cloudBucket.trim(),
        access_key: cloudAccessKey.trim(),
        secret_key: cloudSecretKey ? cloudSecretKey.trim() : undefined
      };
      const res = await testCloudBackupConnection(payload, adminPin);
      if (res && res.status === 'SUCCESS') {
        setCloudTestMsg({
          type: 'success',
          text: res.message || t('settings.cloud_backup_status_success') || 'Spojení s cloudovým úložištěm bylo úspěšně ověřeno.'
        });
      } else {
        setCloudTestMsg({
          type: 'error',
          text: res?.message || t('settings.cloud_backup_status_error') || 'Test spojení selhal.'
        });
      }
    } catch (err) {
      setCloudTestMsg({ type: 'error', text: err.message });
    } finally {
      setCloudTesting(false);
    }
  };

  const handleSaveCloudConfig = async (overrides = {}) => {
    setCloudSaving(true);
    setCloudSaveMsg(null);
    try {
      const payload = {
        enabled: overrides.enabled !== undefined ? overrides.enabled : cloudEnabled,
        endpoint: (overrides.endpoint !== undefined ? overrides.endpoint : cloudEndpoint).trim(),
        bucket: (overrides.bucket !== undefined ? overrides.bucket : cloudBucket).trim(),
        access_key: (overrides.access_key !== undefined ? overrides.access_key : cloudAccessKey).trim(),
        secret_key: (overrides.secret_key !== undefined ? overrides.secret_key : cloudSecretKey).trim(),
        prefix: (overrides.prefix !== undefined ? overrides.prefix : cloudPrefix).trim(),
        retention_days: Number(overrides.retention_days !== undefined ? overrides.retention_days : cloudRetentionDays) || 30
      };
      const res = await configureCloudBackup(payload, adminPin);
      if (res && res.status === 'SUCCESS') {
        setCloudSaveMsg({ type: 'success', text: res.message || t('common.saved') || 'Nastavení uloženo.' });
        if (res.config?.has_secret_key !== undefined) {
          setHasSecretKey(res.config.has_secret_key);
        }
        if (payload.secret_key) {
          setCloudSecretKey('');
        }
      } else {
        setCloudSaveMsg({ type: 'error', text: res?.message || 'Chyba při ukládání nastavení.' });
      }
    } catch (err) {
      setCloudSaveMsg({ type: 'error', text: err.message });
    } finally {
      setCloudSaving(false);
    }
  };

  const handleTriggerInstantSync = async () => {
    setCloudSyncing(true);
    setCloudSyncMsg(null);
    try {
      const res = await triggerCloudBackupUpload(adminPin);
      if (res && res.status === 'SUCCESS') {
        setCloudSyncMsg({
          type: 'success',
          text: `Záloha vytvořena a odeslána: ${res.filename} (${((res.size_bytes || 0) / 1024).toFixed(1)} KB)`
        });
        const updated = await fetchCloudBackupStatus(adminPin);
        if (updated && updated.status === 'SUCCESS') {
          setCloudLastSync(updated.last_sync || '');
          setCloudLastStatus(updated.last_status || '');
          setCloudLastError(updated.last_error || '');
        }
        const dbUpdated = await fetchDatabaseBackupStatus();
        if (dbUpdated && dbUpdated.status === 'SUCCESS') setDbBackupStatus(dbUpdated);
      } else {
        setCloudSyncMsg({ type: 'error', text: res?.message || 'Chyba při nahrávání do cloudu.' });
      }
    } catch (err) {
      setCloudSyncMsg({ type: 'error', text: err.message });
    } finally {
      setCloudSyncing(false);
    }
  };

  const loadRemoteBackups = async () => {
    setRemoteLoading(true);
    setRemoteError(null);
    try {
      const res = await fetchRemoteCloudBackups(adminPin);
      if (Array.isArray(res)) {
        setRemoteBackups(res);
      } else {
        setRemoteError(res?.message || 'Nepodařilo se načíst zálohy z cloudu.');
      }
    } catch (err) {
      setRemoteError(err.message);
    } finally {
      setRemoteLoading(false);
    }
  };

  const handleOpenRestoreModal = () => {
    setIsRestoreModalOpen(true);
    setSelectedBackup(null);
    setShowConfirmRestore(false);
    setRestoreMsg(null);
    loadRemoteBackups();
  };

  const handleSelectBackupToRestore = (backup) => {
    setSelectedBackup(backup);
    setShowConfirmRestore(true);
    setRestoreMsg(null);
  };

  const handleExecuteRestore = async () => {
    if (!selectedBackup) return;
    setRestoring(true);
    setRestoreMsg(null);
    try {
      const res = await restoreRemoteCloudBackup(selectedBackup.filename, adminPin);
      if (res && res.status === 'SUCCESS') {
        setRestoreMsg({
          type: 'success',
          text: res.message || t('settings.cloud_backup_restore_success') || 'Databáze byla úspěšně obnovena z cloudu.'
        });
        setShowConfirmRestore(false);
        fetchCloudBackupStatus(adminPin).then(cRes => {
          if (cRes && cRes.status === 'SUCCESS') {
            setCloudLastSync(cRes.last_sync || '');
            setCloudLastStatus(cRes.last_status || '');
            setCloudLastError(cRes.last_error || '');
          }
        });
        fetchDatabaseBackupStatus().then(dRes => {
          if (dRes && dRes.status === 'SUCCESS') setDbBackupStatus(dRes);
        });
      } else {
        setRestoreMsg({ type: 'error', text: res?.message || 'Obnovení selhalo.' });
      }
    } catch (err) {
      setRestoreMsg({ type: 'error', text: err.message });
    } finally {
      setRestoring(false);
    }
  };

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
      </div>

      {/* ☁️ Card 2: Cloudové zálohování (S3 / Cloudflare R2 / MinIO) */}
      <div className="settings-section-card" data-testid="cloud-backup-card">
        <div className="settings-section-header">
          <div>
            <h3 className="settings-section-title">
              <Cloud size={20} style={{ color: cloudEnabled ? 'var(--accent-blue)' : 'var(--text-muted)' }} />
              <span>{t('settings.cloud_backup_title') || 'Cloudové zálohování (S3 / Cloudflare R2)'}</span>
            </h3>
            <p className="settings-section-desc">
              {t('settings.cloud_backup_desc') || 'Automatická bezpečná synchronizace databáze pokladny do privátního cloudového úložiště kompatibilního s Amazon S3.'}
            </p>
          </div>

          <label className="settings-switch-toggle" title={t('settings.cloud_backup_enable_toggle') || 'Povolit automatické cloudové zálohování'}>
            <input
              type="checkbox"
              aria-label="cloud-backup-toggle"
              checked={cloudEnabled}
              onChange={handleToggleCloudEnabled}
            />
            <span className="settings-switch-slider" />
          </label>
        </div>

        {/* Live sync status pill bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.5rem',
          background: 'var(--bg-card)',
          padding: '0.65rem 0.85rem',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
          fontSize: '0.82rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span className="status-badge" style={{
              padding: '0.2rem 0.55rem',
              fontSize: '0.74rem',
              fontWeight: '800',
              background: !cloudEnabled
                ? 'rgba(148, 163, 184, 0.15)'
                : cloudLastStatus === 'SUCCESS'
                  ? 'rgba(5, 150, 105, 0.15)'
                  : cloudLastStatus === 'ERROR'
                    ? 'rgba(239, 68, 68, 0.15)'
                    : 'rgba(59, 130, 246, 0.15)',
              color: !cloudEnabled
                ? 'var(--text-muted)'
                : cloudLastStatus === 'SUCCESS'
                  ? 'var(--accent-emerald)'
                  : cloudLastStatus === 'ERROR'
                    ? 'var(--accent-rose)'
                    : 'var(--accent-blue)',
              border: 'none'
            }}>
              {!cloudEnabled
                ? t('settings.cloud_backup_status_disabled') || '⚪ Vypnuto'
                : cloudLastStatus === 'SUCCESS'
                  ? `🟢 ${t('settings.cloud_backup_status_success') || 'Synchronizováno'}`
                  : cloudLastStatus === 'ERROR'
                    ? `🔴 ${t('settings.cloud_backup_status_error') || 'Chyba'}`
                    : `🔵 ${t('settings.cloud_backup_status_ready') || 'Připraveno'}`}
            </span>

            {cloudLastSync && (
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                {t('settings.cloud_backup_last_sync_label') || 'Poslední synchronizace:'}{' '}
                <strong>{new Date(cloudLastSync).toLocaleString('cs-CZ')}</strong>
              </span>
            )}
          </div>

          {hasSecretKey && (
            <span style={{ fontSize: '0.74rem', color: 'var(--accent-emerald)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontWeight: '700' }}>
              <Lock size={13} />
              <span>AES-256</span>
            </span>
          )}
        </div>

        {cloudLastError && (
          <div style={{
            padding: '0.5rem 0.75rem',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            color: 'var(--accent-rose)',
            fontSize: '0.8rem',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{cloudLastError}</span>
          </div>
        )}

        {/* Credentials Form */}
        <div className="settings-form-grid" style={{ marginTop: '0.25rem' }}>
          <div className="settings-field" style={{ gridColumn: '1 / -1' }}>
            <label className="settings-label">
              {t('settings.cloud_backup_endpoint_label') || 'Endpoint URL (S3 / R2 / MinIO)'}
            </label>
            <input
              type="text"
              className="settings-input"
              aria-label="cloud-endpoint"
              placeholder={t('settings.cloud_backup_endpoint_placeholder') || 'https://<ACCOUNT_ID>.r2.cloudflarestorage.com'}
              value={cloudEndpoint}
              onChange={e => setCloudEndpoint(e.target.value)}
            />
          </div>

          <div className="settings-field">
            <label className="settings-label">
              {t('settings.cloud_backup_bucket_label') || 'Název bucketu'}
            </label>
            <input
              type="text"
              className="settings-input"
              aria-label="cloud-bucket"
              placeholder={t('settings.cloud_backup_bucket_placeholder') || 'himmel-pos-backups'}
              value={cloudBucket}
              onChange={e => setCloudBucket(e.target.value)}
            />
          </div>

          <div className="settings-field">
            <label className="settings-label">
              {t('settings.cloud_backup_prefix_label') || 'Složka / Prefix'}
            </label>
            <input
              type="text"
              className="settings-input"
              aria-label="cloud-prefix"
              placeholder="store_01"
              value={cloudPrefix}
              onChange={e => setCloudPrefix(e.target.value)}
            />
          </div>

          <div className="settings-field">
            <label className="settings-label">
              {t('settings.cloud_backup_access_key_label') || 'Přístupový klíč (Access Key ID)'}
            </label>
            <input
              type="text"
              className="settings-input"
              aria-label="cloud-access-key"
              placeholder="AKIAIOSFODNN7EXAMPLE"
              value={cloudAccessKey}
              onChange={e => setCloudAccessKey(e.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="settings-field">
            <label className="settings-label">
              {t('settings.cloud_backup_secret_key_label') || 'Tajný klíč (Secret Access Key)'}
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type={showSecretKey ? 'text' : 'password'}
                className="settings-input"
                aria-label="cloud-secret-key"
                placeholder={hasSecretKey ? (t('settings.cloud_backup_secret_saved') || '•••••••••••••••• (Uloženo šifrovaně)') : 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'}
                value={cloudSecretKey}
                onChange={e => setCloudSecretKey(e.target.value)}
                style={{ paddingRight: '2.5rem' }}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowSecretKey(prev => !prev)}
                style={{
                  position: 'absolute',
                  right: '8px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '6px',
                  display: 'flex',
                  alignItems: 'center'
                }}
                title={showSecretKey ? 'Skrýt' : 'Zobrazit'}
              >
                {showSecretKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="settings-field">
            <label className="settings-label">
              {t('settings.cloud_backup_retention_label') || 'Doba uchování záloh (dní)'}
            </label>
            <input
              type="number"
              min={1}
              max={365}
              className="settings-input"
              aria-label="cloud-retention"
              value={cloudRetentionDays}
              onChange={e => setCloudRetentionDays(Math.max(1, parseInt(e.target.value, 10) || 30))}
            />
          </div>
        </div>

        {/* Action buttons toolbar */}
        <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
          <button
            type="button"
            className="nav-tab"
            disabled={cloudTesting}
            onClick={handleTestCloudConnection}
            style={{ minHeight: '44px', padding: '0 1rem', fontSize: '0.84rem', fontWeight: '800' }}
          >
            <RefreshCw size={15} className={cloudTesting ? 'spin-icon' : ''} />
            <span>{cloudTesting ? (t('settings.cloud_backup_testing') || 'Testuji...') : (t('settings.cloud_backup_test_btn') || 'Otestovat spojení')}</span>
          </button>

          <button
            type="button"
            className="pay-btn pay-btn-card"
            disabled={cloudSaving}
            onClick={() => handleSaveCloudConfig()}
            style={{ minHeight: '44px', padding: '0 1rem', fontSize: '0.84rem', fontWeight: '800' }}
          >
            <Check size={16} />
            <span>{cloudSaving ? (t('settings.cloud_backup_saving') || 'Ukládám...') : (t('settings.cloud_backup_save_btn') || 'Uložit nastavení cloudu')}</span>
          </button>

          <button
            type="button"
            className="pay-btn"
            disabled={cloudSyncing || !cloudEnabled}
            onClick={handleTriggerInstantSync}
            style={{
              minHeight: '44px',
              padding: '0 1.15rem',
              fontSize: '0.84rem',
              fontWeight: '800',
              background: 'var(--accent-blue)',
              color: '#fff',
              opacity: (!cloudEnabled || cloudSyncing) ? 0.6 : 1
            }}
          >
            <CloudUpload size={16} />
            <span>{cloudSyncing ? (t('settings.cloud_backup_syncing') || 'Nahrávám...') : (t('settings.cloud_backup_sync_now_btn') || 'Zálohovat do cloudu nyní')}</span>
          </button>

          <button
            type="button"
            className="nav-tab"
            onClick={handleOpenRestoreModal}
            style={{ minHeight: '44px', padding: '0 1rem', fontSize: '0.84rem', fontWeight: '800', marginLeft: 'auto' }}
          >
            <CloudDownload size={16} />
            <span>{t('settings.cloud_backup_browse_restore_btn') || 'Procházet a obnovit z cloudu'}</span>
          </button>
        </div>

        {cloudTestMsg && (
          <div style={{
            padding: '0.45rem 0.75rem',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.8rem',
            background: cloudTestMsg.type === 'success' ? 'rgba(5, 150, 105, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            color: cloudTestMsg.type === 'success' ? 'var(--accent-emerald)' : 'var(--accent-rose)',
            fontWeight: '600'
          }}>
            {cloudTestMsg.text}
          </div>
        )}

        {cloudSaveMsg && (
          <div style={{
            padding: '0.45rem 0.75rem',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.8rem',
            background: cloudSaveMsg.type === 'success' ? 'rgba(5, 150, 105, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            color: cloudSaveMsg.type === 'success' ? 'var(--accent-emerald)' : 'var(--accent-rose)',
            fontWeight: '600'
          }}>
            {cloudSaveMsg.text}
          </div>
        )}

        {cloudSyncMsg && (
          <div style={{
            padding: '0.45rem 0.75rem',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.8rem',
            background: cloudSyncMsg.type === 'success' ? 'rgba(5, 150, 105, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            color: cloudSyncMsg.type === 'success' ? 'var(--accent-emerald)' : 'var(--accent-rose)',
            fontWeight: '600'
          }}>
            {cloudSyncMsg.text}
          </div>
        )}
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

      {/* 📦 CLOUD BACKUP RESTORE PICKER MODAL */}
      {isRestoreModalOpen && (
        <div className="modal-overlay" onClick={() => setIsRestoreModalOpen(false)} data-testid="cloud-restore-modal">
          <div
            className="modal-card"
            style={{ maxWidth: '640px', width: '92vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 className="modal-title">
                <CloudDownload size={20} style={{ color: 'var(--accent-blue)' }} />
                <span>{t('settings.cloud_backup_modal_title') || 'Zálohy v cloudovém úložišti'}</span>
              </h3>
              <button
                type="button"
                className="close-modal-btn"
                aria-label="close-modal"
                onClick={() => setIsRestoreModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
                {t('settings.cloud_backup_modal_desc') || 'Vyberte záložní archiv pro obnovení pokladny. Před obnovou proběhne kontrola SQLite integrity a vytvoří se lokální bezpečnostní snapshot.'}
              </p>

              {restoreMsg && (
                <div style={{
                  padding: '0.55rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.82rem',
                  background: restoreMsg.type === 'success' ? 'rgba(5, 150, 105, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: restoreMsg.type === 'success' ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                  fontWeight: '600'
                }}>
                  {restoreMsg.text}
                </div>
              )}

              {/* Confirmation box if an item is selected */}
              {showConfirmRestore && selectedBackup && (
                <div style={{
                  background: 'rgba(245, 158, 11, 0.12)',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}>
                  <div style={{ fontWeight: '800', color: 'var(--accent-amber)', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <AlertCircle size={18} />
                    <span>{t('settings.cloud_backup_confirm_title') || 'Opravdu obnovit databázi z cloudu?'}</span>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                    <strong>{selectedBackup.filename}</strong> ({formatSize(selectedBackup.size_bytes)})
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {t('settings.cloud_backup_confirm_desc') || 'Tato operace stáhne vybranou zálohu, provede kontrolu integrity SQLite a nahradí aktuální databázi. Bude vytvořena automatická bezpečnostní záloha.'}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
                    <button
                      type="button"
                      className="nav-tab"
                      disabled={restoring}
                      onClick={() => { setShowConfirmRestore(false); setSelectedBackup(null); }}
                      style={{ minHeight: '40px', padding: '0 1rem', fontSize: '0.82rem', fontWeight: '700' }}
                    >
                      {t('common.cancel') || 'Zrušit'}
                    </button>
                    <button
                      type="button"
                      className="pay-btn"
                      disabled={restoring}
                      onClick={handleExecuteRestore}
                      style={{
                        minHeight: '40px',
                        padding: '0 1.25rem',
                        fontSize: '0.82rem',
                        fontWeight: '800',
                        background: 'var(--accent-amber)',
                        color: '#000'
                      }}
                    >
                      {restoring ? (t('settings.cloud_backup_modal_restoring') || 'Obnovuji...') : (t('settings.cloud_backup_confirm_btn') || 'Potvrdit a obnovit databázi')}
                    </button>
                  </div>
                </div>
              )}

              {/* Backups List */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                  {t('settings.cloud_backup_modal_title') || 'Dostupné zálohy'} ({remoteBackups.length})
                </span>
                <button
                  type="button"
                  className="nav-tab"
                  aria-label="refresh-remote-backups"
                  disabled={remoteLoading}
                  onClick={loadRemoteBackups}
                  style={{ minHeight: '36px', padding: '0 0.75rem', fontSize: '0.78rem', fontWeight: '700' }}
                >
                  <RefreshCw size={14} className={remoteLoading ? 'spin-icon' : ''} />
                  <span>{t('tech_logs_refresh_btn') || 'Obnovit'}</span>
                </button>
              </div>

              {remoteLoading ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  <RefreshCw size={24} className="spin-icon" style={{ margin: '0 auto 0.5rem auto', display: 'block' }} />
                  <span>{t('settings.cloud_backup_modal_loading') || 'Načítání seznamu záloh z cloudu...'}</span>
                </div>
              ) : remoteError ? (
                <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-rose)', borderRadius: 'var(--radius-md)', fontSize: '0.82rem' }}>
                  {remoteError}
                </div>
              ) : remoteBackups.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {t('settings.cloud_backup_modal_empty') || 'V cloudu nebyly nalezeny žádné zálohy.'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {remoteBackups.map((item, idx) => (
                    <div
                      key={item.key || item.filename || idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem 0.9rem',
                        background: 'var(--bg-main)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        gap: '0.75rem'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', overflow: 'hidden' }}>
                        <span style={{ fontWeight: '700', fontSize: '0.86rem', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                          {item.filename || item.key}
                        </span>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', gap: '0.75rem' }}>
                          <span>{formatSize(item.size_bytes)}</span>
                          {item.last_modified && (
                            <span>{new Date(item.last_modified).toLocaleString('cs-CZ')}</span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        className="pay-btn pay-btn-card"
                        aria-label={`restore-${item.filename}`}
                        data-testid="restore-backup-btn"
                        disabled={restoring}
                        onClick={() => handleSelectBackupToRestore(item)}
                        style={{ height: '38px', padding: '0 1rem', fontSize: '0.8rem', fontWeight: '800', flexShrink: 0 }}
                      >
                        <CloudDownload size={14} />
                        <span>{t('settings.cloud_backup_modal_restore_btn') || 'Obnovit'}</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="nav-tab"
                onClick={() => setIsRestoreModalOpen(false)}
                style={{ minHeight: '42px', padding: '0 1.25rem', fontSize: '0.85rem', fontWeight: '700' }}
              >
                {t('common.close') || 'Zavřít'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
