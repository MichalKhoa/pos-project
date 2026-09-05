import React, { useState, useEffect } from 'react';
import {
  Store,
  Layout,
  RefreshCw,
  Printer,
  CreditCard,
  Shield,
  HardDrive,
  Check,
  Activity,
  Receipt,
  Lock,
  Wrench
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
import { useStoreConfig } from '../context/StoreConfigContext.jsx';
import AdminPinModal from './AdminPinModal.jsx';
import StoreProfileSection from './settings/StoreProfileSection.jsx';
import LayoutSection from './settings/LayoutSection.jsx';
import PrinterSection from './settings/PrinterSection.jsx';
import ReceiptSection from './settings/ReceiptSection.jsx';
import TerminalSection from './settings/TerminalSection.jsx';
import SecuritySection from './settings/SecuritySection.jsx';
import BackupSection from './settings/BackupSection.jsx';
import DiagnosticsSection from './settings/DiagnosticsSection.jsx';
import TechnicianTab from './settings/TechnicianTab.jsx';


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
  const {
    isAdminMode: ctxIsAdminMode,
    enterAdminMode,
    exitAdminMode
  } = useStoreConfig();
  const effectiveIsAdmin = isAdminMode !== undefined ? isAdminMode : ctxIsAdminMode;
  const [activeSubTab, setActiveSubTab] = useState('store');
  const [diagSubMode, setDiagSubMode] = useState('technician');

  const [config, setConfig] = useState({
    id_provozovny: '11',
    id_pokl: '1',
    eet_environment: 'playground',
    printerInterface: 'USB',
    printerAddress: '/dev/usb/lp0',
    ...storeConfig
  });

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
    if (effectiveIsAdmin) {
      callback();
    } else {
      setPinModalState({
        mode: 'VERIFY',
        onAuthenticated: (verifiedPin) => {
          setPinModalState(null);
          if (enterAdminMode) {
            enterAdminMode(verifiedPin);
          } else if (onToggleAdminMode && !effectiveIsAdmin) {
            onToggleAdminMode();
          }
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

  const handleExportJSON = () => {
    const categories = JSON.parse(localStorage.getItem('voltflow_pos_categories') || localStorage.getItem('himmel_pos_categories') || '[]');
    const salesHistory = JSON.parse(localStorage.getItem('voltflow_pos_sales') || localStorage.getItem('himmel_pos_sales') || '[]');

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
    downloadAnchor.setAttribute("download", `voltflow_pos_backup_${new Date().toISOString().slice(0, 10)}.json`);
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

  const [autoSaved, setAutoSaved] = useState(false);
  const autoSaveTimerRef = React.useRef(null);

  const triggerAutoSaveToast = () => {
    setAutoSaved(true);
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => setAutoSaved(false), 2400);
  };

  const saveConfigField = (key, value) => {
    const updated = { ...config, [key]: value };
    setConfig(updated);
    onSaveStoreConfig(updated);
    triggerAutoSaveToast();
    if (key === 'defaultLanguage') {
      setLanguage(value);
    }
  };

  const saveConfigBatch = (updates) => {
    const updated = { ...config, ...updates };
    setConfig(updated);
    onSaveStoreConfig(updated);
    triggerAutoSaveToast();
    if (updates.defaultLanguage) {
      setLanguage(updates.defaultLanguage);
    }
  };

  const SUBTABS = [
    { id: 'store', icon: Store, title: t('settings.tab_store') || 'Údaje prodejny', heading: t('settings.tab_store_heading') || 'Nastavení prodejny a provozovny', subtitle: t('settings.tab_store_sub') || 'Firma, IČO, adresa, DPH a IBAN', locked: false },
    { id: 'layout', icon: Layout, title: t('settings.tab_layout') || 'Rozvržení & Zobrazení', heading: t('settings.tab_layout_heading') || 'Rozvržení a vzhled pokladny', subtitle: t('settings.tab_layout_sub') || 'Tlačítka sortimentu, košík, LCD', locked: false },
    { id: 'hardware', icon: Printer, title: t('settings.tab_hardware') || 'Tiskárna & Periferie', heading: t('settings.tab_hardware_heading') || 'Pokladní tiskárna a periferie', subtitle: t('settings.tab_hardware_sub') || 'ESC/POS tiskárna a pokladní zásuvka', locked: false },
    { id: 'receipt', icon: Receipt, title: t('settings.tab_receipt') || 'Účtenka & Vzhled', heading: t('settings.tab_receipt_heading') || 'Vzhled a formátování účtenky', subtitle: t('settings.tab_receipt_sub') || 'Oddělovače, písmo, okraje a logo', locked: false },
    { id: 'terminal', icon: CreditCard, title: t('settings.tab_terminal') || 'Platební Terminál', heading: t('settings.tab_terminal_heading') || 'Platební terminál', subtitle: t('settings.tab_terminal_sub') || 'ČSOB terminál a ruční režim', locked: true },
    { id: 'security', icon: Shield, title: t('settings.tab_security') || 'Bezpečnost & PIN', heading: t('settings.tab_security_heading') || 'Zabezpečení a PIN kód', subtitle: t('settings.tab_security_sub') || 'Správce, PIN kód a zamykání', locked: true },
    { id: 'system', icon: HardDrive, title: t('settings.tab_system') || 'Zálohy & Systém', heading: t('settings.tab_system_heading') || 'Zálohování a systémová správa', subtitle: t('settings.tab_system_sub') || 'Export/import dat, aktualizace a EET', locked: true },
    { id: 'diagnostics', icon: Activity, title: t('settings.tab_diagnostics') || 'Náhled & Diagnostika', heading: t('settings.tab_diagnostics_heading') || 'Živý náhled účtenky a diagnostika', subtitle: t('settings.tab_diagnostics_sub') || 'Reálná účtenka, kontrola periferií a tržba', locked: true },
  ];

  const handleSelectSubTab = (tab) => {
    if (tab.locked && !effectiveIsAdmin) {
      setPinModalState({
        mode: 'VERIFY',
        onAuthenticated: (verifiedPin) => {
          if (enterAdminMode) {
            enterAdminMode(verifiedPin);
          } else if (onToggleAdminMode && !effectiveIsAdmin) {
            onToggleAdminMode();
          }
          setActiveSubTab(tab.id);
          setPinModalState(null);
        }
      });
      return;
    }
    setActiveSubTab(tab.id);
  };

  const currentTabObj = SUBTABS.find(t => t.id === activeSubTab) || SUBTABS[0];

  return (
    <div className="settings-view-container">
      {/* 🧭 LEFT TOUCH-OPTIMIZED SIDEBAR */}
      <aside className="settings-sidebar">
        <div className="settings-sidebar-header">
          <div className="settings-sidebar-title">
            <Store size={20} style={{ color: 'var(--accent-blue)' }} />
            <span>{t('settings.title') || 'Nastavení'}</span>
          </div>
          <div className="settings-sidebar-desc">
            {t('settings.sidebar_desc') || 'Konfigurace prodejny a periferií'}
          </div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {SUBTABS.map(tab => {
            const IconComponent = tab.icon;
            const isActive = activeSubTab === tab.id;
            const isTabGated = tab.locked && !effectiveIsAdmin;
            return (
              <button
                key={tab.id}
                type="button"
                className={`settings-sidebar-btn ${isActive ? 'active' : ''} ${isTabGated ? 'locked-subtab' : ''}`}
                onClick={() => handleSelectSubTab(tab)}
              >
                <div className="settings-sidebar-icon">
                  <IconComponent size={20} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
                  <span style={{ fontSize: '0.92rem', whiteSpace: 'nowrap' }}>{tab.title}</span>
                  <span style={{ fontSize: '0.72rem', color: isActive ? 'var(--accent-blue)' : 'var(--text-muted)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {tab.subtitle}
                  </span>
                </div>
                {isTabGated && (
                  <div className="subtab-lock-indicator" title={t('settings.tab_locked_badge') || 'Zamčeno'}>
                    <Lock size={13} style={{ color: 'var(--accent-amber)', flexShrink: 0 }} />
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        <div className="settings-sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0.6rem', background: 'var(--bg-main)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <span className="status-badge" style={{
              background: backendConnected ? 'rgba(5, 150, 105, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: backendConnected ? 'var(--accent-emerald)' : 'var(--accent-rose)',
              border: 'none',
              padding: '0.2rem 0.5rem',
              fontSize: '0.75rem'
            }}>
              <span className="status-dot" style={{ background: backendConnected ? 'var(--accent-emerald)' : 'var(--accent-rose)' }} />
              <span>{backendLoading ? 'Ověřuji...' : (backendConnected ? 'Online' : 'Offline')}</span>
            </span>

            <button
              type="button"
              onClick={loadBackendInfo}
              title={t('settings.ping_test') || 'Znovu zkontrolovat spojení se serverem'}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}
            >
              <RefreshCw size={15} className={backendLoading ? 'spin-icon' : ''} />
            </button>
          </div>
        </div>
      </aside>

      {/* 📄 RIGHT MAIN CONTENT PANE */}
      <main className="settings-content-area">
        {/* Header with Title and Auto-save toast */}
        <header className="settings-content-header">
          <div className="settings-content-title-wrap">
            <h2 className="settings-content-title">
              {React.createElement(currentTabObj.icon, { size: 22, style: { color: 'var(--accent-blue)' } })}
              <span>{currentTabObj.heading || currentTabObj.title}</span>
            </h2>
            <p className="settings-content-subtitle">
              {currentTabObj.subtitle}
            </p>
          </div>

          <div>
            {autoSaved && (
              <div className="settings-save-toast">
                <Check size={15} strokeWidth={3} />
                <span>{t('settings.saved_toast') || 'Uloženo'}</span>
              </div>
            )}
          </div>
        </header>

        {/* Scrollable Subtab Content or Locked Gate */}
        {currentTabObj.locked && !effectiveIsAdmin ? (
          <div className="settings-locked-gate">
            <div className="settings-locked-card">
              <div className="locked-icon-wrap">
                <Shield size={44} style={{ color: 'var(--accent-amber)' }} />
              </div>
              <h3 className="locked-title">{t('settings.tab_locked_title') || 'Sekce vyžaduje oprávnění technika'}</h3>
              <p className="locked-desc">
                {t('settings.tab_locked_desc') || 'Tato konfigurace je zabezpečena a přístupná pouze v režimu servisního technika.'}
              </p>
              <div className="locked-actions">
                <button
                  type="button"
                  className="pay-btn pay-btn-card"
                  style={{ height: '44px', padding: '0 1.5rem', fontWeight: '800' }}
                  onClick={() => {
                    setPinModalState({
                      mode: 'VERIFY',
                      onAuthenticated: (verifiedPin) => {
                        if (enterAdminMode) {
                          enterAdminMode(verifiedPin);
                        } else if (onToggleAdminMode && !effectiveIsAdmin) {
                          onToggleAdminMode();
                        }
                        setPinModalState(null);
                      }
                    });
                  }}
                >
                  <Lock size={16} />
                  <span>{t('settings.tab_locked_btn') || 'Odemknout režim technika'}</span>
                </button>
                <button
                  type="button"
                  className="nav-tab"
                  style={{ height: '44px', padding: '0 1.25rem' }}
                  onClick={() => setActiveSubTab('store')}
                >
                  <span>{t('settings.tab_locked_back') || 'Zpět na údaje prodejny'}</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="settings-content-scroll">
            {activeSubTab === 'store' && (
              <StoreProfileSection
                config={config}
                setConfig={setConfig}
                saveConfigField={saveConfigField}
              />
            )}

            {activeSubTab === 'layout' && (
              <LayoutSection
                config={config}
                setConfig={setConfig}
                saveConfigBatch={saveConfigBatch}
                presets={presets}
                onNavigateToPresets={onNavigateToPresets}
                onSaveStoreConfig={onSaveStoreConfig}
              />
            )}

            {activeSubTab === 'hardware' && (
              <PrinterSection
                config={config}
                setConfig={setConfig}
                saveConfigBatch={saveConfigBatch}
                printerDevices={printerDevices}
                scanningPrinters={scanningPrinters}
                onScanPrinters={handleScanPrinters}
              />
            )}

            {activeSubTab === 'receipt' && (
              <ReceiptSection
                config={config}
                setConfig={setConfig}
                saveConfigBatch={saveConfigBatch}
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
                saveConfigBatch={saveConfigBatch}
                isAdminMode={effectiveIsAdmin}
                onToggleAdminMode={effectiveIsAdmin ? (exitAdminMode || onToggleAdminMode) : () => requireAdminPin(() => {})}
                onOpenPinChange={handleOpenPinChange}
              />
            )}

            {activeSubTab === 'system' && (
              <BackupSection
                config={config}
                setConfig={setConfig}
                saveConfigBatch={saveConfigBatch}
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

            {activeSubTab === 'diagnostics' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
                {/* 🔀 Subtab Switcher: Technician Suite vs Hardware & Receipt Overview */}
                <div
                  style={{
                    display: 'inline-flex',
                    background: 'var(--bg-card)',
                    padding: '4px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    alignSelf: 'flex-start',
                    gap: '4px'
                  }}
                  data-testid="diag-subtab-switcher"
                >
                  <button
                    type="button"
                    onClick={() => setDiagSubMode('technician')}
                    style={{
                      minHeight: '38px',
                      padding: '0 1rem',
                      borderRadius: 'var(--radius-sm)',
                      border: 'none',
                      fontSize: '0.84rem',
                      fontWeight: '800',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      cursor: 'pointer',
                      background: diagSubMode === 'technician' ? 'var(--accent-blue)' : 'transparent',
                      color: diagSubMode === 'technician' ? '#fff' : 'var(--text-secondary)'
                    }}
                    data-testid="diag-subtab-tech-btn"
                  >
                    <Wrench size={15} />
                    <span>{t('settings.diag_subtab_technician') || 'Servisní diagnostika'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDiagSubMode('overview')}
                    style={{
                      minHeight: '38px',
                      padding: '0 1rem',
                      borderRadius: 'var(--radius-sm)',
                      border: 'none',
                      fontSize: '0.84rem',
                      fontWeight: '800',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      cursor: 'pointer',
                      background: diagSubMode === 'overview' ? 'var(--accent-blue)' : 'transparent',
                      color: diagSubMode === 'overview' ? '#fff' : 'var(--text-secondary)'
                    }}
                    data-testid="diag-subtab-overview-btn"
                  >
                    <Receipt size={15} />
                    <span>{t('settings.diag_subtab_overview') || 'Náhled & Periferie'}</span>
                  </button>
                </div>

                {diagSubMode === 'technician' ? (
                  <TechnicianTab />
                ) : (
                  <DiagnosticsSection
                    config={config}
                    printerDevices={printerDevices}
                    scanningPrinters={scanningPrinters}
                    onScanPrinters={handleScanPrinters}
                  />
                )}
              </div>
            )}

          </div>
        )}
      </main>

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
