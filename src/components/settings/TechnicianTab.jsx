import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Database,
  Cpu,
  ShieldCheck,
  FileText,
  Download,
  Upload,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Archive,
  Terminal,
  Search,
  Filter,
  Layers,
  Copy,
  Check
} from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext.jsx';
import { useStoreConfig } from '../../context/StoreConfigContext.jsx';
import { useTauri } from '../../hooks/useTauri.js';
import {
  fetchSystemDiagnostics,
  triggerDbVacuum,
  fetchSystemLogs,
  downloadDatabaseSnapshot,
  restoreDatabaseSnapshot,
  downloadDiagnosticBundle
} from '../../api/posApi.js';
import { soundFx } from '../../utils/audio.js';

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatUptime(seconds) {
  if (!seconds || seconds <= 0) return '0s';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0) parts.push(`${mins}m`);
  parts.push(`${secs}s`);
  return parts.join(' ');
}

export default function TechnicianTab() {
  const { t } = useTranslation();
  const { adminPin } = useStoreConfig();

  // Diagnostics state
  const [diagnostics, setDiagnostics] = useState(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagError, setDiagError] = useState(null);

  // VACUUM state
  const [vacuumLoading, setVacuumLoading] = useState(false);
  const [vacuumResult, setVacuumResult] = useState(null);

  // Logs state
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logLevel, setLogLevel] = useState('ALL');
  const [logSearch, setLogSearch] = useState('');
  const [logLinesCount, setLogLinesCount] = useState(200);
  const [autoRefreshLogs, setAutoRefreshLogs] = useState(false);
  const [copiedLogs, setCopiedLogs] = useState(false);
  const logTerminalRef = useRef(null);

  // Snapshot / Restore state
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [selectedRestoreFile, setSelectedRestoreFile] = useState(null);
  const [restoreResult, setRestoreResult] = useState(null);
  const fileInputRef = useRef(null);

  // Diagnostic bundle state
  const [bundleLoading, setBundleLoading] = useState(false);
  const [bundleResult, setBundleResult] = useState(null);

  // Backend restart state
  const { restartBackend, isTauri } = useTauri();
  const [restartingBackend, setRestartingBackend] = useState(false);
  const [restartResult, setRestartResult] = useState(null);

  // 1. Load system diagnostics
  const loadDiagnostics = useCallback(async () => {
    setDiagLoading(true);
    setDiagError(null);
    try {
      const res = await fetchSystemDiagnostics(adminPin);
      if (res && res.status === 'SUCCESS') {
        setDiagnostics(res);
      } else {
        setDiagError(res?.error || 'Nepodařilo se načíst diagnostická data.');
      }
    } catch (err) {
      setDiagError(err.message || 'Chyba při komunikaci s backendem.');
    } finally {
      setDiagLoading(false);
    }
  }, [adminPin]);

  // 2. Load system logs
  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const res = await fetchSystemLogs({
        lines: logLinesCount,
        level: logLevel === 'ALL' ? null : logLevel,
        search: logSearch,
        pin: adminPin
      });
      if (res && res.status === 'SUCCESS') {
        setLogs(res.lines || []);
      }
    } catch {
      // ignore
    } finally {
      setLogsLoading(false);
    }
  }, [logLinesCount, logLevel, logSearch, adminPin]);

  useEffect(() => {
    loadDiagnostics();
    loadLogs();
  }, [loadDiagnostics, loadLogs]);

  // Auto-refresh logs timer
  useEffect(() => {
    if (!autoRefreshLogs) return;
    const interval = setInterval(() => {
      loadLogs();
    }, 3000);
    return () => clearInterval(interval);
  }, [autoRefreshLogs, loadLogs]);

  // Scroll to bottom of log terminal when lines change
  useEffect(() => {
    if (logTerminalRef.current) {
      logTerminalRef.current.scrollTop = logTerminalRef.current.scrollHeight;
    }
  }, [logs]);

  // Trigger VACUUM
  const handleTriggerVacuum = async () => {
    setVacuumLoading(true);
    setVacuumResult(null);
    soundFx.playKeypadClick?.();
    try {
      const res = await triggerDbVacuum(adminPin);
      if (res && res.status === 'SUCCESS') {
        soundFx.playSuccessChime?.();
        setVacuumResult({
          type: 'success',
          message: `${res.message} (DB: ${formatBytes(res.db_size_bytes)}, WAL: ${formatBytes(res.wal_size_bytes)})`
        });
        loadDiagnostics();
      } else {
        soundFx.playErrorChime?.();
        setVacuumResult({ type: 'error', message: res?.error || 'Chyba při optimalizaci databáze.' });
      }
    } catch (err) {
      soundFx.playErrorChime?.();
      setVacuumResult({ type: 'error', message: err.message });
    } finally {
      setVacuumLoading(false);
      setTimeout(() => setVacuumResult(null), 7000);
    }
  };

  // Restart backend sidecar process & cold-start reconnect flow
  const handleRestartBackend = async () => {
    if (!isTauri) {
      soundFx.playErrorChime?.();
      setRestartResult({
        type: 'error',
        message: t('settings.tech_restart_tauri_only') || 'Restart je dostupný pouze v desktopové aplikaci (Tauri).'
      });
      setTimeout(() => setRestartResult(null), 5000);
      return;
    }

    setRestartingBackend(true);
    setRestartResult({
      type: 'reconnecting',
      message: t('settings.tech_restarting') || 'Restartování backendu...'
    });
    soundFx.playKeypadClick?.();

    try {
      const res = await restartBackend();
      if (!res.success) {
        throw new Error(res.error || 'Nepodařilo se spustit restart backendu.');
      }

      setRestartResult({
        type: 'reconnecting',
        message: t('settings.tech_reconnecting') || 'Čekání na obnovení spojení s backendem...'
      });

      // Cold-start reconnect polling flow
      const maxAttempts = 25;
      let connected = false;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        try {
          const diagRes = await fetchSystemDiagnostics(adminPin);
          if (diagRes && diagRes.status === 'SUCCESS') {
            connected = true;
            setDiagnostics(diagRes);
            break;
          }
        } catch {
          // Keep polling while backend cold-starts
        }
      }

      if (connected) {
        soundFx.playSuccessChime?.();
        setRestartResult({
          type: 'success',
          message: t('settings.tech_restart_success') || 'Backend byl úspěšně restartován a znovu připojen!'
        });
        loadLogs();
      } else {
        soundFx.playErrorChime?.();
        setRestartResult({
          type: 'error',
          message: t('settings.tech_restart_timeout') || 'Vypršel časový limit pro spojení s backendem.'
        });
      }
    } catch (err) {
      soundFx.playErrorChime?.();
      setRestartResult({
        type: 'error',
        message: `${t('settings.tech_restart_failed') || 'Restart backendu selhal:'} ${err.message}`
      });
    } finally {
      setRestartingBackend(false);
      setTimeout(() => setRestartResult(null), 8000);
    }
  };

  // Download DB snapshot
  const handleDownloadSnapshot = async () => {
    setSnapshotLoading(true);
    soundFx.playKeypadClick?.();
    try {
      const res = await downloadDatabaseSnapshot(adminPin);
      if (res.success) {
        soundFx.playSuccessChime?.();
      } else {
        soundFx.playErrorChime?.();
        alert('Chyba při stahování zálohy: ' + (res.error || 'Neznámá chyba'));
      }
    } catch (err) {
      soundFx.playErrorChime?.();
      alert('Chyba při stahování: ' + err.message);
    } finally {
      setSnapshotLoading(false);
    }
  };

  // File selection for restore
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedRestoreFile(file);
      setShowRestoreModal(true);
    }
    // reset input value so user can select same file again if needed
    e.target.value = '';
  };

  // Confirm DB restore
  const handleConfirmRestore = async () => {
    if (!selectedRestoreFile) return;
    setRestoreLoading(true);
    setShowRestoreModal(false);
    soundFx.playKeypadClick?.();
    try {
      const res = await restoreDatabaseSnapshot(selectedRestoreFile, adminPin);
      if (res && res.status === 'SUCCESS') {
        soundFx.playSuccessChime?.();
        setRestoreResult({
          type: 'success',
          message: `${t('settings.tech_restore_success') || 'Databáze byla úspěšně obnovena.'} (${res.backup_filename || ''})`
        });
        loadDiagnostics();
      } else {
        soundFx.playErrorChime?.();
        setRestoreResult({
          type: 'error',
          message: `${t('settings.tech_restore_fail') || 'Obnovení selhalo:'} ${res?.error || 'Neznámá chyba'}`
        });
      }
    } catch (err) {
      soundFx.playErrorChime?.();
      setRestoreResult({
        type: 'error',
        message: `${t('settings.tech_restore_fail') || 'Obnovení selhalo:'} ${err.message}`
      });
    } finally {
      setRestoreLoading(false);
      setSelectedRestoreFile(null);
      setTimeout(() => setRestoreResult(null), 8000);
    }
  };

  // Download diagnostic bundle
  const handleDownloadBundle = async () => {
    setBundleLoading(true);
    setBundleResult(null);
    soundFx.playKeypadClick?.();
    try {
      const res = await downloadDiagnosticBundle(adminPin);
      if (res.success) {
        soundFx.playSuccessChime?.();
        setBundleResult({ type: 'success', message: 'Diagnostický balíček byl úspěšně stažen.' });
      } else {
        soundFx.playErrorChime?.();
        setBundleResult({ type: 'error', message: res.error || 'Export selhal.' });
      }
    } catch (err) {
      soundFx.playErrorChime?.();
      setBundleResult({ type: 'error', message: err.message });
    } finally {
      setBundleLoading(false);
      setTimeout(() => setBundleResult(null), 5000);
    }
  };

  // Copy logs to clipboard
  const handleCopyLogs = () => {
    if (!logs.length) return;
    const textToCopy = logs.join('\n');
    navigator.clipboard?.writeText(textToCopy);
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  const db = diagnostics?.database;
  const sys = diagnostics?.system;
  const eet = diagnostics?.eet;
  const litestream = diagnostics?.litestream;

  return (
    <div className="settings-grid-layout" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
      {/* 🚀 TOP ACTION BAR: REFRESH TELEMETRY & NOTICES */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', background: 'var(--bg-card)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div style={{ background: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent-blue)', padding: '0.4rem', borderRadius: 'var(--radius-md)', display: 'flex' }}>
            <Layers size={20} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800' }}>
              {t('settings.diag_subtab_technician') || 'Servisní diagnostika technika'}
            </h4>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {diagnostics?.timestamp ? `Aktualizováno: ${new Date(diagnostics.timestamp).toLocaleTimeString('cs-CZ')}` : 'Načítání telemetrie...'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <button
            type="button"
            className="settings-action-btn secondary"
            style={{ minHeight: '40px', padding: '0 0.85rem', gap: '0.4rem', fontSize: '0.82rem' }}
            onClick={loadDiagnostics}
            disabled={diagLoading}
            data-testid="refresh-diagnostics-btn"
          >
            <RefreshCw size={14} className={diagLoading ? 'spin-icon' : ''} />
            <span>{diagLoading ? 'Aktualizuji...' : 'Obnovit data'}</span>
          </button>
        </div>
      </div>

      {diagError && (
        <div style={{ padding: '0.75rem 1rem', background: 'rgba(239, 68, 68, 0.15)', color: 'var(--accent-red)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={17} />
          <span>{diagError}</span>
        </div>
      )}

      {/* 📊 TELEMETRY CARDS ROW */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
        {/* 1. SQLite Database Health */}
        <div className="settings-section-card" style={{ margin: 0 }}>
          <div className="settings-section-header">
            <div>
              <h3 className="settings-section-title">
                <Database size={19} style={{ color: 'var(--accent-blue)' }} />
                <span>{t('settings.tech_db_health_title') || 'Stav a integrita databáze'}</span>
              </h3>
              <p className="settings-section-desc">
                {t('settings.tech_db_health_desc') || 'Fyzické úložiště, velikost WAL a PRAGMA test.'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid var(--border-color)', fontSize: '0.82rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('settings.tech_integrity_check') || 'PRAGMA integrity_check'}</span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontWeight: '800',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  background: db?.integrity === 'ok' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: db?.integrity === 'ok' ? 'var(--accent-emerald)' : 'var(--accent-red)'
                }}
                data-testid="db-integrity-badge"
              >
                {db?.integrity === 'ok' ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                <span>{db?.integrity === 'ok' ? (t('settings.tech_integrity_ok') || 'OK') : (db?.integrity || 'CHYBA')}</span>
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--border-color)', fontSize: '0.82rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('settings.tech_db_size') || 'Velikost DB'}</span>
              <span style={{ fontWeight: '800' }} data-testid="db-size-val">
                {db ? formatBytes(db.size_bytes) : '—'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--border-color)', fontSize: '0.82rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('settings.tech_wal_size') || 'Velikost WAL žurnálu'}</span>
              <span style={{ fontWeight: '800' }}>
                {db ? formatBytes(db.wal_size_bytes) : '—'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--border-color)', fontSize: '0.82rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('settings.tech_sqlite_ver') || 'Verze SQLite'}</span>
              <span style={{ fontWeight: '700' }}>
                {db?.sqlite_version || '—'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden' }}>
              <span style={{ flexShrink: 0, marginRight: '0.5rem' }}>{t('settings.tech_db_path') || 'Cesta'}:</span>
              <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', direction: 'rtl', textAlign: 'left' }} title={db?.path || ''}>
                {db?.path || '—'}
              </span>
            </div>

            {/* VACUUM action button */}
            <div style={{ marginTop: '0.5rem' }}>
              <button
                type="button"
                className="settings-action-btn primary"
                style={{ width: '100%', minHeight: '42px', gap: '0.5rem', fontSize: '0.84rem' }}
                onClick={handleTriggerVacuum}
                disabled={vacuumLoading}
                data-testid="vacuum-btn"
              >
                <RefreshCw size={15} className={vacuumLoading ? 'spin-icon' : ''} />
                <span>{vacuumLoading ? (t('settings.tech_vacuum_running') || 'Probíhá VACUUM...') : (t('settings.tech_vacuum_btn') || 'Optimalizovat databázi (VACUUM)')}</span>
              </button>
            </div>

            {vacuumResult && (
              <div
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.78rem',
                  fontWeight: '700',
                  background: vacuumResult.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: vacuumResult.type === 'success' ? 'var(--accent-emerald)' : 'var(--accent-red)',
                  border: `1px solid ${vacuumResult.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                }}
                data-testid="vacuum-result-banner"
              >
                {vacuumResult.message}
              </div>
            )}
          </div>
        </div>

        {/* 2. System Resources & Process */}
        <div className="settings-section-card" style={{ margin: 0 }}>
          <div className="settings-section-header">
            <div>
              <h3 className="settings-section-title">
                <Cpu size={19} style={{ color: 'var(--accent-purple)' }} />
                <span>{t('settings.tech_system_health_title') || 'Systémové prostředky a proces'}</span>
              </h3>
              <p className="settings-section-desc">
                {t('settings.tech_system_health_desc') || 'Běh backend serveru, CPU, paměť RAM a disk.'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--border-color)', fontSize: '0.82rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('settings.tech_uptime') || 'Doba běhu backendu'}</span>
              <span style={{ fontWeight: '800', color: 'var(--accent-emerald)' }} data-testid="uptime-val">
                {sys ? formatUptime(sys.uptime_seconds) : '—'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--border-color)', fontSize: '0.82rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('settings.tech_cpu_usage') || 'Využití procesoru (CPU)'}</span>
              <span style={{ fontWeight: '800' }}>
                {sys && sys.cpu_percent != null ? `${sys.cpu_percent}%` : '—'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--border-color)', fontSize: '0.82rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('settings.tech_ram_usage') || 'Operační paměť (RAM)'}</span>
              <span style={{ fontWeight: '800' }}>
                {sys && sys.ram_used_mb != null && sys.ram_total_mb != null
                  ? `${sys.ram_used_mb} MB / ${sys.ram_total_mb} MB`
                  : '—'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--border-color)', fontSize: '0.82rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('settings.tech_disk_usage') || 'Volné místo na disku'}</span>
              <span style={{ fontWeight: '800' }}>
                {sys && sys.disk_free_gb != null && sys.disk_total_gb != null
                  ? `${sys.disk_free_gb} GB / ${sys.disk_total_gb} GB`
                  : '—'}
              </span>
            </div>


            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--border-color)', fontSize: '0.82rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('settings.tech_pid') || 'ID procesu (PID)'}</span>
              <span style={{ fontWeight: '700' }}>
                {sys?.pid ? `${sys.pid} ${sys.is_frozen ? '(Standalone Binary)' : '(Python Host)'}` : '—'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', fontSize: '0.82rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('settings.tech_platform') || 'Platforma / Python'}</span>
              <span style={{ fontWeight: '700' }}>
                {sys ? `${sys.platform} (Py ${sys.python_version})` : '—'}
              </span>
            </div>

            {/* Backend Restart action button & status banner */}
            <div style={{ marginTop: '0.5rem' }}>
              <button
                type="button"
                className="settings-action-btn secondary"
                style={{ width: '100%', minHeight: '42px', gap: '0.5rem', fontSize: '0.84rem' }}
                onClick={handleRestartBackend}
                disabled={restartingBackend}
                data-testid="restart-backend-btn"
                title={t('settings.tech_restart_backend_desc') || 'Ukončí a znovu nastartuje proces backendového serveru.'}
              >
                <RefreshCw size={15} className={restartingBackend ? 'spin-icon' : ''} />
                <span>
                  {restartingBackend
                    ? (t('settings.tech_restarting') || 'Restartování backendu...')
                    : (t('settings.tech_restart_backend_btn') || 'Restartovat backend')}
                </span>
              </button>
            </div>

            {restartResult && (
              <div
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.78rem',
                  fontWeight: '700',
                  background:
                    restartResult.type === 'success'
                      ? 'rgba(16, 185, 129, 0.15)'
                      : restartResult.type === 'reconnecting'
                      ? 'rgba(59, 130, 246, 0.15)'
                      : 'rgba(239, 68, 68, 0.15)',
                  color:
                    restartResult.type === 'success'
                      ? 'var(--accent-emerald)'
                      : restartResult.type === 'reconnecting'
                      ? 'var(--accent-blue)'
                      : 'var(--accent-red)',
                  border: `1px solid ${
                    restartResult.type === 'success'
                      ? 'rgba(16, 185, 129, 0.3)'
                      : restartResult.type === 'reconnecting'
                      ? 'rgba(59, 130, 246, 0.3)'
                      : 'rgba(239, 68, 68, 0.3)'
                  }`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
                data-testid="restart-backend-banner"
              >
                {restartResult.type === 'reconnecting' && <RefreshCw size={13} className="spin-icon" />}
                {restartResult.type === 'success' && <CheckCircle2 size={13} />}
                {restartResult.type === 'error' && <AlertTriangle size={13} />}
                <span>{restartResult.message}</span>
              </div>
            )}
          </div>
        </div>

        {/* 3. EET 2.0 PKCS#12 Certificate & Litestream Status */}
        <div className="settings-section-card" style={{ margin: 0 }}>
          <div className="settings-section-header">
            <div>
              <h3 className="settings-section-title">
                <ShieldCheck size={19} style={{ color: 'var(--accent-emerald)' }} />
                <span>{t('settings.tech_eet_health_title') || 'Fiskální certifikát EET 2.0'}</span>
              </h3>
              <p className="settings-section-desc">
                {t('settings.tech_eet_health_desc') || 'Ověření platnosti klíče PKCS#12 a replikace.'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid var(--border-color)', fontSize: '0.82rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Stav certifikátu</span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontWeight: '800',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  background: eet?.loaded
                    ? (eet.is_expired ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)')
                    : 'rgba(156, 163, 175, 0.15)',
                  color: eet?.loaded
                    ? (eet.is_expired ? 'var(--accent-red)' : 'var(--accent-emerald)')
                    : 'var(--text-muted)'
                }}
              >
                {eet?.loaded
                  ? (eet.is_expired ? <AlertTriangle size={13} /> : <CheckCircle2 size={13} />)
                  : <XCircle size={13} />}
                <span>
                  {eet?.loaded
                    ? (eet.is_expired ? (t('settings.tech_eet_expired') || 'EXPIROVÁNO') : 'PLATNÝ')
                    : (t('settings.tech_eet_not_configured') || 'NENÍ NAČTEN')}
                </span>
              </span>
            </div>

            {eet?.loaded ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--border-color)', fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{t('settings.tech_eet_days_remaining') || 'Zbývající platnost'}</span>
                  <span style={{ fontWeight: '800', color: (eet.days_remaining != null && eet.days_remaining < 30) ? 'var(--accent-amber)' : 'var(--text-primary)' }}>
                    {eet.days_remaining != null ? `${eet.days_remaining} ${t('settings.tech_eet_days_unit') || 'dní'}` : '—'}
                  </span>

                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--border-color)', fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{t('settings.tech_eet_valid_to') || 'Platnost do'}</span>
                  <span style={{ fontWeight: '700' }}>
                    {eet.valid_to ? new Date(eet.valid_to).toLocaleDateString('cs-CZ') : '—'}
                  </span>
                </div>

                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', overflow: 'hidden' }}>
                  <span>{t('settings.tech_eet_cert_subject') || 'Subjekt'}: </span>
                  <span style={{ color: 'var(--text-primary)', wordBreak: 'break-all' }}>{eet.subject || '—'}</span>
                </div>
              </>
            ) : (
              <div style={{ padding: '0.5rem 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {eet?.error || 'Certifikát EET není nainstalován nebo chybí heslo v konfiguraci.'}
              </div>
            )}

            {/* Litestream replication indicator */}
            <div style={{ marginTop: '0.35rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Replikace Litestream</span>
              <span style={{
                fontWeight: '800',
                fontSize: '0.75rem',
                color: litestream?.running ? 'var(--accent-emerald)' : 'var(--text-muted)'
              }}>
                {litestream?.running ? '🟢 AKTIVNÍ' : '⚪ POUZE LOKÁLNÍ'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 📜 LIVE SYSTEM LOG VIEWER */}
      <div className="settings-section-card" style={{ margin: 0 }}>
        <div className="settings-section-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h3 className="settings-section-title">
              <Terminal size={19} style={{ color: 'var(--accent-blue)' }} />
              <span>{t('settings.tech_logs_title') || 'Živý prohlížeč systémového logu'}</span>
            </h3>
            <p className="settings-section-desc">
              {t('settings.tech_logs_desc') || 'Sledování událostí backendu v reálném čase s filtrováním.'}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {/* Auto-refresh checkbox */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={autoRefreshLogs}
                onChange={(e) => setAutoRefreshLogs(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <span>{t('settings.tech_logs_auto_refresh') || 'Auto (3s)'}</span>
            </label>

            {/* Copy button */}
            <button
              type="button"
              className="settings-action-btn secondary"
              style={{ minHeight: '38px', padding: '0 0.65rem', gap: '0.35rem', fontSize: '0.78rem' }}
              onClick={handleCopyLogs}
              title="Kopírovat zobrazené logy"
            >
              {copiedLogs ? <Check size={14} style={{ color: 'var(--accent-emerald)' }} /> : <Copy size={14} />}
              <span>{copiedLogs ? 'Zkopírováno' : 'Kopírovat'}</span>
            </button>

            {/* Manual refresh button */}
            <button
              type="button"
              className="settings-action-btn secondary"
              style={{ minHeight: '38px', padding: '0 0.75rem', gap: '0.35rem', fontSize: '0.78rem' }}
              onClick={loadLogs}
              disabled={logsLoading}
              data-testid="refresh-logs-btn"
            >
              <RefreshCw size={14} className={logsLoading ? 'spin-icon' : ''} />
              <span>{t('settings.tech_logs_refresh_btn') || 'Obnovit'}</span>
            </button>
          </div>
        </div>

        {/* Filter controls bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          {/* Level pills */}
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {['ALL', 'INFO', 'WARNING', 'ERROR', 'DEBUG'].map((lvl) => {
              const isActive = logLevel === lvl;
              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setLogLevel(lvl)}
                  style={{
                    minHeight: '34px',
                    padding: '0 0.65rem',
                    fontSize: '0.76rem',
                    fontWeight: '800',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid',
                    borderColor: isActive ? 'var(--accent-blue)' : 'var(--border-color)',
                    background: isActive ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-card)',
                    color: isActive ? 'var(--accent-blue)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                  data-testid={`log-level-${lvl}`}
                >
                  {lvl}
                </button>
              );
            })}
          </div>

          {/* Search input */}
          <div style={{ flex: 1, minWidth: '180px', position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={logSearch}
              onChange={(e) => setLogSearch(e.target.value)}
              placeholder={t('settings.tech_logs_search_placeholder') || 'Filtrovat podle textu...'}
              style={{
                width: '100%',
                height: '34px',
                padding: '0 0.65rem 0 32px',
                fontSize: '0.8rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-main)',
                color: 'var(--text-primary)'
              }}
              data-testid="log-search-input"
            />
          </div>

          {/* Lines count selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            <Filter size={14} />
            <select
              value={logLinesCount}
              onChange={(e) => setLogLinesCount(parseInt(e.target.value, 10))}
              style={{
                height: '34px',
                padding: '0 0.5rem',
                fontSize: '0.78rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-main)',
                color: 'var(--text-primary)',
                cursor: 'pointer'
              }}
              data-testid="log-lines-select"
            >
              <option value={50}>50 řádků</option>
              <option value={100}>100 řádků</option>
              <option value={200}>200 řádků</option>
              <option value={500}>500 řádků</option>
              <option value={1000}>1000 řádků</option>
            </select>
          </div>
        </div>

        {/* Terminal Log Console */}
        <div
          ref={logTerminalRef}
          style={{
            background: '#090d16',
            color: '#e2e8f0',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontSize: '0.76rem',
            lineHeight: '1.45',
            padding: '0.75rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            height: '340px',
            overflowY: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all'
          }}
          data-testid="log-terminal-output"
        >
          {logs.length === 0 ? (
            <div style={{ color: '#64748b', fontStyle: 'italic', padding: '1rem', textAlign: 'center' }}>
              {logsLoading ? 'Načítání logů...' : (t('settings.tech_logs_empty') || 'Žádné záznamy neodpovídají zadanému filtru.')}
            </div>
          ) : (
            logs.map((line, idx) => {
              let lineStyle = { color: '#cbd5e1' };
              if (line.includes('[ERROR]') || line.includes('CRITICAL')) {
                lineStyle = { color: '#f87171', fontWeight: 'bold' };
              } else if (line.includes('[WARNING]') || line.includes('[WARN]')) {
                lineStyle = { color: '#fbbf24' };
              } else if (line.includes('[INFO]')) {
                lineStyle = { color: '#38bdf8' };
              } else if (line.includes('[DEBUG]')) {
                lineStyle = { color: '#94a3b8' };
              }
              return (
                <div key={idx} style={lineStyle}>
                  {line}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 📦 SNAPSHOT BACKUP & DIAGNOSTIC BUNDLE ROW */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
        {/* Database Snapshot & Restore */}
        <div className="settings-section-card" style={{ margin: 0 }}>
          <div className="settings-section-header">
            <div>
              <h3 className="settings-section-title">
                <Archive size={19} style={{ color: 'var(--accent-emerald)' }} />
                <span>{t('settings.tech_backup_snapshot_title') || 'Záloha & Obnova SQLite databáze'}</span>
              </h3>
              <p className="settings-section-desc">
                {t('settings.tech_backup_snapshot_desc') || 'Okamžité stažení snapshotu a bezpečné nahrání s rollback ochranou.'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Download snapshot */}
            <button
              type="button"
              className="settings-action-btn primary"
              style={{ width: '100%', minHeight: '44px', gap: '0.5rem', fontSize: '0.84rem' }}
              onClick={handleDownloadSnapshot}
              disabled={snapshotLoading}
              data-testid="download-snapshot-btn"
            >
              <Download size={16} />
              <span>{snapshotLoading ? 'Generuji snapshot...' : (t('settings.tech_download_snapshot_btn') || 'Stáhnout SQLite snapshot (.zip)')}</span>
            </button>

            {/* Hidden file input for restore */}
            <input
              type="file"
              ref={fileInputRef}
              accept=".db,.zip"
              style={{ display: 'none' }}
              onChange={handleFileChange}
              data-testid="restore-file-input"
            />

            {/* Trigger upload */}
            <button
              type="button"
              className="settings-action-btn secondary"
              style={{ width: '100%', minHeight: '44px', gap: '0.5rem', fontSize: '0.84rem' }}
              onClick={() => fileInputRef.current?.click()}
              disabled={restoreLoading}
              data-testid="trigger-restore-btn"
            >
              <Upload size={16} />
              <span>{restoreLoading ? 'Obnovuji databázi...' : (t('settings.tech_restore_snapshot_btn') || 'Nahrát a obnovit snapshot (.db / .zip)')}</span>
            </button>

            {restoreResult && (
              <div
                style={{
                  padding: '0.65rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.82rem',
                  fontWeight: '700',
                  background: restoreResult.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: restoreResult.type === 'success' ? 'var(--accent-emerald)' : 'var(--accent-red)',
                  border: `1px solid ${restoreResult.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                }}
                data-testid="restore-result-banner"
              >
                {restoreResult.message}
              </div>
            )}
          </div>
        </div>

        {/* Diagnostic Bundle Export */}
        <div className="settings-section-card" style={{ margin: 0 }}>
          <div className="settings-section-header">
            <div>
              <h3 className="settings-section-title">
                <FileText size={19} style={{ color: 'var(--accent-blue)' }} />
                <span>{t('settings.tech_export_bundle_title') || 'Export diagnostického balíčku'}</span>
              </h3>
              <p className="settings-section-desc">
                {t('settings.tech_export_bundle_desc') || 'Kompletní balíček pro servis: telemetrie, hardware a 2000 řádků logu.'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
              Obsahuje soubory <code>diagnostics.json</code> a <code>recent_pos_backend.log</code> pro technickou podporu a analýzu incidentů.
            </p>

            <button
              type="button"
              className="settings-action-btn secondary"
              style={{ width: '100%', minHeight: '44px', gap: '0.5rem', fontSize: '0.84rem', marginTop: 'auto' }}
              onClick={handleDownloadBundle}
              disabled={bundleLoading}
              data-testid="export-bundle-btn"
            >
              <Download size={16} className={bundleLoading ? 'spin-icon' : ''} />
              <span>{bundleLoading ? (t('settings.tech_exporting') || 'Generuji balíček...') : (t('settings.tech_export_bundle_btn') || 'Stáhnout diagnostický balíček (.zip)')}</span>
            </button>

            {bundleResult && (
              <div
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  background: bundleResult.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: bundleResult.type === 'success' ? 'var(--accent-emerald)' : 'var(--accent-red)',
                  border: `1px solid ${bundleResult.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                }}
              >
                {bundleResult.message}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ⚠️ RESTORE CONFIRMATION MODAL */}
      {showRestoreModal && selectedRestoreFile && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem'
          }}
          data-testid="restore-confirm-modal"
        >
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1.5px solid var(--accent-amber)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.5rem',
              maxWidth: '480px',
              width: '100%',
              boxShadow: 'var(--shadow-xl)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-amber)', padding: '0.5rem', borderRadius: 'var(--radius-md)' }}>
                <AlertTriangle size={24} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800' }}>
                {t('settings.tech_restore_confirm_title') || 'Potvrzení obnovení databáze'}
              </h3>
            </div>

            <p style={{ margin: 0, fontSize: '0.86rem', lineHeight: '1.5', color: 'var(--text-secondary)' }}>
              {t('settings.tech_restore_confirm_desc') || 'Pozor: Tato operace nahradí aktuální databázi nahraným souborem. Bude vytvořena automatická bezpečnostní záloha. Přejete si pokračovat?'}
            </p>

            <div style={{ background: 'var(--bg-main)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.8rem', fontWeight: '700' }}>
              Soubor: <span style={{ color: 'var(--accent-blue)' }}>{selectedRestoreFile.name}</span> ({formatBytes(selectedRestoreFile.size)})
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                className="settings-action-btn primary"
                style={{ flex: 1, minHeight: '44px', background: 'var(--accent-amber)', color: '#000', fontWeight: '800' }}
                onClick={handleConfirmRestore}
                data-testid="confirm-restore-action-btn"
              >
                <span>Ano, obnovit databázi</span>
              </button>

              <button
                type="button"
                className="settings-action-btn secondary"
                style={{ flex: 1, minHeight: '44px' }}
                onClick={() => {
                  setShowRestoreModal(false);
                  setSelectedRestoreFile(null);
                }}
              >
                <span>Zrušit</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
