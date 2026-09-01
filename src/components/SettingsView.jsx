import React, { useState, useEffect } from 'react';
import {
  Store,
  RefreshCw,
  Printer,
  CreditCard,
  Shield,
  HardDrive
} from 'lucide-react';
import {
  fetchBackendRoot,
  fetchEetStatus,
  fetchUpdateStatus,
  applySystemUpdate,
  fetchTerminalConfig,
  saveTerminalConfig,
  pingTerminal,
  reconcileTerminal,
  fetchPrinterDevices,
  fetchLitestreamStatus
} from '../api/posApi';
import { useTranslation } from '../i18n/LanguageContext.jsx';
import AdminPinModal from './AdminPinModal.jsx';
import StoreProfileSection from './settings/StoreProfileSection.jsx';
import PrinterSection from './settings/PrinterSection.jsx';
import TerminalSection from './settings/TerminalSection.jsx';
import SecuritySection from './settings/SecuritySection.jsx';
import BackupSection from './settings/BackupSection.jsx';

export default function SettingsView({
  storeConfig,
  onSaveStoreConfig,
  presets,
  onResetData,
  onNavigateToPresets,
  isAdminMode,
  onToggleAdminMode
}) {
  const { t, setLanguage } = useTranslation();
  const [activeSubTab, setActiveSubTab] = useState('store');

  const [config, setConfig] = useState({
    id_provozovny: '11',
    id_pokl: '1',
    eet_environment: 'playground',
    printerInterface: 'USB',
    printerAddress: '/dev/usb/lp0',
    ...storeConfig
  });
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Printer Hardware Scan State
  const [printerDevices, setPrinterDevices] = useState([]);
  const [scanningPrinters, setScanningPrinters] = useState(false);

  const handleScanPrinters = async () => {
    setScanningPrinters(true);
    const devs = await fetchPrinterDevices();
    setPrinterDevices(devs);
    setScanningPrinters(false);
  };

  useEffect(() => {
    handleScanPrinters();
  }, []);

  // Backend Connection & EET State
  const [backendConnected, setBackendConnected] = useState(false);
  const [backendLoading, setBackendLoading] = useState(true);
  const [litestreamData, setLitestreamData] = useState(null);

  // System Update State
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateData, setUpdateData] = useState(null);
  const [applyLoading, setApplyLoading] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  // ČSOB Terminal State
  const [termEnabled, setTermEnabled] = useState(false);
  const [termIp, setTermIp] = useState('');
  const [termPort, setTermPort] = useState('8888');
  const [termId, setTermId] = useState('');
  const [termSaveSuccess, setTermSaveSuccess] = useState(false);
  const [pingLoading, setPingLoading] = useState(false);
  const [pingResult, setPingResult] = useState(null);
  const [reconcileLoading, setReconcileLoading] = useState(false);
  const [reconcileResult, setReconcileResult] = useState(null);

  // PIN verification modal state
  const [pinModalState, setPinModalState] = useState(null);

  const loadBackendInfo = async () => {
    setBackendLoading(true);
    const rootRes = await fetchBackendRoot();
    setBackendConnected(rootRes.online);

    if (rootRes.online) {
      const eetStatus = await fetchEetStatus();
      if (eetStatus) {
        setConfig(prev => ({
          ...prev,
          dic: eetStatus.dic || prev.dic,
          id_provozovny: eetStatus.id_provozovny || eetStatus.id_jednotky || prev.id_provozovny || '11',
          id_pokl: eetStatus.id_pokl || prev.id_pokl || '1',
          eet_environment: eetStatus.environment || prev.eet_environment || 'playground',
          eetEnabled: eetStatus.eet_enabled !== undefined ? eetStatus.eet_enabled : prev.eetEnabled
        }));
      }

      const termConfig = await fetchTerminalConfig();
      if (termConfig) {
        setTermEnabled(termConfig.enabled || false);
        setTermIp(termConfig.ip || '');
        setTermPort(termConfig.port ? termConfig.port.toString() : '8888');
        setTermId(termConfig.terminalId || '');
      }

      const liteStatus = await fetchLitestreamStatus();
      if (liteStatus) {
        setLitestreamData(liteStatus);
      }
    }
    setBackendLoading(false);
  };

  useEffect(() => {
    loadBackendInfo();
  }, []);

  const handleCheckUpdate = async () => {
    setUpdateLoading(true);
    const res = await fetchUpdateStatus();
    if (res) {
      setUpdateData(res);
    }
    setUpdateLoading(false);
  };

  const handleTriggerApplyUpdate = async () => {
    setApplyLoading(true);
    await applySystemUpdate();
    setApplyLoading(false);
    setShowUpdateModal(false);
  };

  const handleSaveTerminal = async (e) => {
    e.preventDefault();
    const res = await saveTerminalConfig({
      enabled: termEnabled,
      ip: termIp,
      port: parseInt(termPort, 10) || 8888,
      terminalId: termId
    });
    if (res?.status === 'SUCCESS') {
      setTermSaveSuccess(true);
      setTimeout(() => setTermSaveSuccess(false), 3000);
    }
  };

  const handlePingTerminal = async () => {
    setPingLoading(true);
    setPingResult(null);
    const res = await pingTerminal(termIp, parseInt(termPort, 10) || 8888);
    setPingResult(res);
    setPingLoading(false);
  };

  const handleReconcileTerminal = async () => {
    setReconcileLoading(true);
    setReconcileResult(null);
    const res = await reconcileTerminal();
    setReconcileResult(res);
    setReconcileLoading(false);
  };

  const requireAdminPin = (callback) => {
    if (isAdminMode) {
      callback();
    } else {
      setPinModalState({
        mode: 'VERIFY',
        onAuthenticated: () => {
          setPinModalState(null);
          if (onToggleAdminMode) onToggleAdminMode();
          callback();
        }
      });
    }
  };

  const handleOpenPinChange = () => {
    requireAdminPin(() => {
      setPinModalState({
        mode: 'CHANGE_PIN',
        onAuthenticated: (newPinVal) => {
          const updated = { ...config, cashierPin: newPinVal };
          setConfig(updated);
          onSaveStoreConfig(updated);
          setPinModalState(null);
        }
      });
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    requireAdminPin(() => {
      if (config.cashierPin && (config.cashierPin.length < 4 || config.cashierPin.length > 8)) {
        alert('PIN kód musí mít 4 až 8 číslic.');
        return;
      }
      onSaveStoreConfig(config);
      if (config.defaultLanguage) {
        setLanguage(config.defaultLanguage);
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    });
  };

  const handleExportJSON = () => {
    const categories = JSON.parse(localStorage.getItem('himmel_pos_categories') || '[]');
    const salesHistory = JSON.parse(localStorage.getItem('himmel_pos_sales') || '[]');

    const backupData = {
      storeConfig: config,
      presets,
      categories,
      salesHistory,
      exportedAt: new Date().toISOString()
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `himmel_pos_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportJSON = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (imported.storeConfig) {
          onSaveStoreConfig(imported.storeConfig);
          setConfig(imported.storeConfig);
        }
        alert('Data byla úspěšně importována. Stránka se obnoví.');
        window.location.reload();
      } catch (err) {
        alert('Chyba při čtení záložního souboru: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="full-view-container">
      {/* View Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Store size={24} style={{ color: 'var(--accent-blue)' }} />
            <span>{t('settings.title')}</span>
          </h2>
          <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Konfigurace provozovny, tiskárny, platebního terminálu ČSOB a systémové správy.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span className="status-badge" style={{
            background: backendConnected ? 'rgba(5, 150, 105, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            color: backendConnected ? 'var(--accent-emerald)' : 'var(--accent-rose)',
            borderColor: backendConnected ? 'rgba(5, 150, 105, 0.3)' : 'rgba(239, 68, 68, 0.3)'
          }}>
            <span className="status-dot" style={{ background: backendConnected ? 'var(--accent-emerald)' : 'var(--accent-rose)' }} />
            <span>{backendLoading ? t('settings.backend_verifying') : (backendConnected ? t('settings.backend_online') : t('settings.backend_offline'))}</span>
          </span>

          <button
            className="nav-tab"
            onClick={loadBackendInfo}
            title={t('settings.ping_test')}
            style={{ padding: '0.4rem 0.6rem' }}
          >
            <RefreshCw size={16} className={backendLoading ? 'spin-icon' : ''} />
          </button>
        </div>
      </div>

      {/* Subtab Selector */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', overflowX: 'auto', paddingBottom: '0.25rem', borderBottom: '1px solid var(--border-color)' }}>
        <button
          type="button"
          className={`nav-tab ${activeSubTab === 'store' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('store')}
          style={{ padding: '0.65rem 1.1rem', fontSize: '0.9rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Store size={18} />
          <span>Prodejna & Rozvržení</span>
        </button>

        <button
          type="button"
          className={`nav-tab ${activeSubTab === 'hardware' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('hardware')}
          style={{ padding: '0.65rem 1.1rem', fontSize: '0.9rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Printer size={18} />
          <span>Tiskárna & Periferie</span>
        </button>

        <button
          type="button"
          className={`nav-tab ${activeSubTab === 'terminal' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('terminal')}
          style={{ padding: '0.65rem 1.1rem', fontSize: '0.9rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <CreditCard size={18} />
          <span>Platební Terminál</span>
        </button>

        <button
          type="button"
          className={`nav-tab ${activeSubTab === 'security' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('security')}
          style={{ padding: '0.65rem 1.1rem', fontSize: '0.9rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Shield size={18} />
          <span>Bezpečnost & PIN</span>
        </button>

        <button
          type="button"
          className={`nav-tab ${activeSubTab === 'system' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('system')}
          style={{ padding: '0.65rem 1.1rem', fontSize: '0.9rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <HardDrive size={18} />
          <span>Zálohy & Systém</span>
        </button>
      </div>

      {/* SUBTABS */}
      {activeSubTab === 'store' && (
        <StoreProfileSection
          config={config}
          setConfig={setConfig}
          presets={presets}
          onNavigateToPresets={onNavigateToPresets}
          onSaveStoreConfig={onSaveStoreConfig}
          onSubmit={handleSubmit}
          saveSuccess={saveSuccess}
        />
      )}

      {activeSubTab === 'hardware' && (
        <PrinterSection
          config={config}
          setConfig={setConfig}
          printerDevices={printerDevices}
          scanningPrinters={scanningPrinters}
          onScanPrinters={handleScanPrinters}
          onSubmit={handleSubmit}
          saveSuccess={saveSuccess}
        />
      )}

      {activeSubTab === 'terminal' && (
        <TerminalSection
          termEnabled={termEnabled}
          setTermEnabled={setTermEnabled}
          termIp={termIp}
          setTermIp={setTermIp}
          termPort={termPort}
          setTermPort={setTermPort}
          termId={termId}
          setTermId={setTermId}
          onSaveTerminal={handleSaveTerminal}
          termSaveSuccess={termSaveSuccess}
          pingLoading={pingLoading}
          pingResult={pingResult}
          onPing={handlePingTerminal}
          reconcileLoading={reconcileLoading}
          reconcileResult={reconcileResult}
          onReconcile={handleReconcileTerminal}
        />
      )}

      {activeSubTab === 'security' && (
        <SecuritySection
          config={config}
          setConfig={setConfig}
          isAdminMode={isAdminMode}
          onToggleAdminMode={onToggleAdminMode}
          onOpenPinChange={handleOpenPinChange}
          onSubmit={handleSubmit}
          saveSuccess={saveSuccess}
        />
      )}

      {activeSubTab === 'system' && (
        <BackupSection
          config={config}
          setConfig={setConfig}
          onSaveStoreConfig={onSaveStoreConfig}
          onExportJSON={handleExportJSON}
          onImportJSON={handleImportJSON}
          onResetData={onResetData}
          litestreamData={litestreamData}
          updateData={updateData}
          updateLoading={updateLoading}
          onCheckUpdate={handleCheckUpdate}
        />
      )}

      {/* Confirmation Modal for System Update */}
      {showUpdateModal && (
        <div className="modal-overlay" onClick={() => setShowUpdateModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <div className="modal-title">
                <RefreshCw size={20} style={{ color: 'var(--accent-blue)' }} />
                <span>Potvrzení aktualizace pokladny</span>
              </div>
              <button className="close-modal-btn" onClick={() => setShowUpdateModal(false)}>✕</button>
            </div>

            <div className="modal-body" style={{ padding: '1.25rem' }}>
              <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', lineHeight: '1.5' }}>
                Opravdu chcete spustit aktualizaci pokladního systému?
              </p>

              {updateData?.latest_version && (
                <div style={{ background: 'var(--bg-input)', padding: '0.85rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
                  <div style={{ fontWeight: '700', color: 'var(--accent-emerald)', marginBottom: '4px' }}>
                    Nová verze #{updateData.latest_version.hash}
                  </div>
                  <div style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                    "{updateData.latest_version.message}"
                  </div>
                </div>
              )}

              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                Aplikace na malou chvíli ukončí pokladní rozhraní, stáhne nové soubory z Git repozitáře a automaticky se znovu spustí.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', padding: '1rem', borderTop: '1px solid var(--border-color)', justifyContent: 'flex-end' }}>
              <button className="nav-tab" onClick={() => setShowUpdateModal(false)}>
                Zrušit
              </button>
              <button
                className="pay-btn pay-btn-card"
                disabled={applyLoading}
                onClick={handleTriggerApplyUpdate}
                style={{ height: '42px', padding: '0 1.25rem' }}
              >
                <span>{applyLoading ? 'Spouštění...' : 'Stáhnout a instalovat'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin PIN Verification & Change Modal */}
      {pinModalState && (
        <AdminPinModal
          mode={pinModalState.mode}
          storeConfig={config}
          onSuccess={(pin) => {
            if (pinModalState.onAuthenticated) pinModalState.onAuthenticated(pin);
          }}
          onClose={() => setPinModalState(null)}
        />
      )}
    </div>
  );
}
