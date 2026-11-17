import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { ShoppingBag, History, Settings, Clock, Tag, Package, Lock, AlertTriangle, Power, Sun, Moon, Volume2, VolumeX, BarChart3, Printer, Type, Wrench } from 'lucide-react';
import voltflowLogo from '../assets/voltflow_logo_icon_nobg.png';
import { useTranslation } from '../i18n/LanguageContext.jsx';
import { useStoreConfig } from '../context/StoreConfigContext.jsx';
import LanguageSelector from './LanguageSelector.jsx';
import CashDrawerIcon from './CashDrawerIcon';
import { soundFx } from '../utils/audio';
import { getApiHost } from '../api/posApi';

const FONT_SIZE_LABELS = {
  sm: 'S',
  md: 'M',
  lg: 'L',
  xl: 'XL'
};

function Navbar({
  activeTab,
  setActiveTab,
  storeConfig,
  isAdminMode: propIsAdminMode,
  onToggleAdminMode,
  pendingCount = 0,
  onOpenSyncModal,
  unsentCount = 0,
  onOpenUnsentSales,
  onOpenShutdownModal,
  onOpenCalendarModal,
  onLockApp,
  onOpenCashDrawer,
  onPrintDailySummary
}) {
  const { t, language } = useTranslation();
  const {
    fontSize,
    cycleFontSize,
    isAdminMode: ctxIsAdminMode,
    adminSessionRemainingSeconds: ctxRemainingSeconds,
    exitAdminMode
  } = useStoreConfig();
  const isAdmin = propIsAdminMode !== undefined ? propIsAdminMode : ctxIsAdminMode;
  const remainingSeconds = ctxRemainingSeconds ?? 0;

  const handleExitTechnician = () => {
    if (exitAdminMode) exitAdminMode();
    else if (onToggleAdminMode) onToggleAdminMode();
  };

  const formatCountdown = (totalSec) => {
    const m = Math.floor(Math.max(0, totalSec) / 60);
    const s = Math.max(0, totalSec) % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };
  const [currentTime, setCurrentTime] = useState(new Date());
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('pos_theme') || 'light';
  });
  const [soundEnabled, setSoundEnabled] = useState(() => soundFx.isSoundEnabled());
  const [latency, setLatency] = useState(null);
  const [isOnline, setIsOnline] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);

  const handleToggleSound = () => {
    const next = !soundEnabled;
    soundFx.setSoundEnabled(next);
    setSoundEnabled(next);
  };

  // Apply theme attribute to html root element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('pos_theme', theme);
  }, [theme]);

  // Periodically check backend latency
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let timer = null;
    let isMounted = true;
    let consecutiveFailures = 0;

    const checkLatency = async () => {
      const start = performance.now();
      try {
        const host = getApiHost();
        const res = await fetch(`http://${host}:8000/api/v1/status`, { method: 'GET', cache: 'no-store' });
        if (!isMounted) return;
        if (res.ok) {
          const end = performance.now();
          setLatency(Math.max(1, Math.round(end - start)));
          setIsOnline(true);
          setIsConnecting(false);
          consecutiveFailures = 0;
          window.dispatchEvent(new CustomEvent('pos:backend-online'));
          timer = setTimeout(checkLatency, 8000);
        } else {
          handleFailure();
        }
      } catch {
        if (!isMounted) return;
        handleFailure();
      }
    };

    const handleFailure = () => {
      consecutiveFailures++;
      setIsOnline(false);
      // Give 15 seconds grace period on cold start before switching from connecting to offline
      if (consecutiveFailures > 40) {
        setIsConnecting(false);
      }
      // Rapid 350ms probing during cold boot/connecting, backing off to 2000ms after 20s
      const nextDelay = consecutiveFailures < 60 ? 350 : 2000;
      timer = setTimeout(checkLatency, nextDelay);
    };

    checkLatency();

    const handleInstantWakeup = () => {
      if (timer) clearTimeout(timer);
      checkLatency();
    };
    window.addEventListener('pos:wake-backend-check', handleInstantWakeup);

    let unlistenTauri = null;
    if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
      import('@tauri-apps/api/event').then(({ listen }) => {
        listen('backend-ready', () => {
          handleInstantWakeup();
        }).then(unlistenFn => {
          unlistenTauri = unlistenFn;
        }).catch(() => {});
      }).catch(() => {});
    }

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
      window.removeEventListener('pos:wake-backend-check', handleInstantWakeup);
      if (unlistenTauri) unlistenTauri();
    };
  }, []);

  const navbarStyle = storeConfig?.navbarStyle || (() => {
    try {
      return localStorage.getItem('voltflow_navbar_style') || 'floating';
    } catch {
      return 'floating';
    }
  })();

  const tabRefs = useRef({});
  const navTabsRef = useRef(null);
  const [pillStyle, setPillStyle] = useState({ left: 0, width: 0, opacity: 0 });

  useLayoutEffect(() => {
    const el = tabRefs.current[activeTab];
    if (el) {
      setPillStyle({
        left: el.offsetLeft,
        width: el.offsetWidth,
        opacity: 1
      });
    }
  }, [activeTab, navbarStyle]);

  useEffect(() => {
    const handleResize = () => {
      const el = tabRefs.current[activeTab];
      if (el) {
        setPillStyle({
          left: el.offsetLeft,
          width: el.offsetWidth,
          opacity: 1
        });
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [activeTab]);

  return (
    <header className={`navbar style-${navbarStyle}`}>
      {/* Left Island: Status & System Health */}
      <div className="nav-island-left">
        <div
          className="nav-status-indicator"
          title={isOnline ? (import.meta.env.DEV ? `Vývojový režim • Backend ${latency !== null ? latency : '--'} ms` : (storeConfig?.eetEnabled ? `EET 2.0 Online • Odezva: ${latency !== null ? latency : '--'} ms` : `Online • Odezva: ${latency !== null ? latency : '--'} ms`)) : (isConnecting ? t('settings.backend_connecting') : t('nav.offline'))}
        >
          <span className={`status-pulse-dot ${isOnline ? 'online' : (isConnecting ? 'connecting' : 'offline')}`} />
          <span className="status-label">
            {isOnline ? (import.meta.env.DEV ? `DEV • ${latency !== null ? `${latency}ms` : 'OK'}` : (storeConfig?.eetEnabled ? 'Online • EET' : 'Online')) : (isConnecting ? t('settings.backend_status_connecting') : t('nav.offline'))}
          </span>
        </div>
        {unsentCount > 0 && (
          <button
            type="button"
            className="status-badge pulse-badge nav-badge-unsent"
            onClick={onOpenUnsentSales}
            title={t('unsent_sales.badge_title')}
            aria-label={`${t('unsent_sales.title')}: ${unsentCount}`}
            style={{ background: 'var(--accent-red)', color: '#ffffff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', minHeight: '34px', padding: '0 0.7rem', borderRadius: '999px', fontWeight: 700 }}
          >
            <AlertTriangle size={14} />
            <span>{unsentCount}</span>
          </button>
        )}
        {storeConfig?.eetEnabled && pendingCount > 0 && (
          <button type="button"
            className="status-badge badge-pending-sync pulse-badge nav-badge-sync"
            onClick={onOpenSyncModal}
            title="Klikněte pro odeslání neodeslaných účtenek na EET"
            aria-label="Klikněte pro odeslání neodeslaných účtenek na EET"
          >
            <AlertTriangle size={14} />
            <span>{pendingCount}</span>
          </button>
        )}

        {isAdmin && (
          <div
            className={`nav-technician-badge ${remainingSeconds < 60 ? 'critical-warning' : ''}`}
            title={
              language === 'cs'
                ? `Režim servisního technika aktivní • Automatické zamčení za ${formatCountdown(remainingSeconds)} • Klikněte pro okamžité uzamčení`
                : language === 'vi'
                ? `Chế độ kỹ thuật viên đang bật • Tự động khóa sau ${formatCountdown(remainingSeconds)} • Nhấp để khóa ngay`
                : `Technician Mode Active • Auto-lock in ${formatCountdown(remainingSeconds)} • Click to lock`
            }
          >
            <span className="technician-pulse-dot" />
            <Wrench size={13} className="technician-icon" />
            <span className="technician-label">{t('nav.technician_active') || 'Technik'}</span>
            <span className="technician-timer">{formatCountdown(remainingSeconds)}</span>
            <button
              type="button"
              className="technician-exit-btn"
              onClick={handleExitTechnician}
              title={t('nav.technician_lock_now') || 'Uzamknout'}
              aria-label={t('nav.technician_lock_now') || 'Uzamknout'}
            >
              <Lock size={11} />
            </button>
          </div>
        )}
      </div>

      {/* Center Island: Main Capsule with Embedded Circular Logo & Tabs */}
      <div className="nav-island-center">
        <div className="nav-embedded-logo" title="VoltFlow POS">
          <img src={voltflowLogo} alt="VoltFlow POS" />
        </div>

        <nav className="nav-tabs" ref={navTabsRef}>
          <div
            className="nav-sliding-pill"
            style={{
              transform: `translateX(${pillStyle.left}px)`,
              width: `${pillStyle.width}px`,
              opacity: pillStyle.opacity
            }}
          />

          <button type="button"
            ref={el => { tabRefs.current['register'] = el; }}
            className={`nav-tab ${activeTab === 'register' ? 'active' : ''}`}
            onClick={() => setActiveTab('register')}
          >
            <ShoppingBag size={17} />
            <span>{t('nav.register')}</span>
          </button>

          <button type="button"
            ref={el => { tabRefs.current['presets'] = el; }}
            className={`nav-tab ${activeTab === 'presets' ? 'active' : ''}`}
            onClick={() => setActiveTab('presets')}
          >
            <Tag size={17} />
            <span>{t('nav.presets')}</span>
          </button>

          <button type="button"
            ref={el => { tabRefs.current['inventory'] = el; }}
            className={`nav-tab ${activeTab === 'inventory' ? 'active' : ''}`}
            onClick={() => setActiveTab('inventory')}
          >
            <Package size={17} />
            <span>{t('nav.inventory')}</span>
          </button>

          <button type="button"
            ref={el => { tabRefs.current['history'] = el; }}
            className={`nav-tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <History size={17} />
            <span>{t('nav.history')}</span>
          </button>

          <button type="button"
            ref={el => { tabRefs.current['analytics'] = el; }}
            className={`nav-tab ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            <BarChart3 size={17} />
            <span>{t('nav.analytics') || 'Analytika'}</span>
          </button>

          <button type="button"
            ref={el => { tabRefs.current['settings'] = el; }}
            className={`nav-tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <Settings size={17} />
            <span>{t('nav.settings')}</span>
          </button>
        </nav>
      </div>

      {/* Right Island: Utility Actions & Time */}
      <div className="nav-island-right nav-meta">
        {/* Status badges and quick tools */}
        <div className="nav-status-group">
          {/* Language Switcher */}
          <LanguageSelector
            compact
            buttonStyle={{
              height: '32px',
              background: 'transparent',
              border: 'none',
              padding: '0 0.4rem',
              borderRadius: '9999px'
            }}
          />

          <div className="nav-tool-divider" />

          {/* Open Cash Drawer Button */}
          <button
            type="button"
            className="nav-tool-btn"
            onClick={onOpenCashDrawer}
            title={t('nav.open_drawer') || 'Otevřít peněžní zásuvku'}
            aria-label={t('nav.open_drawer') || 'Otevřít peněžní zásuvku'}
          >
            <CashDrawerIcon size={16} color="var(--text-secondary)" />
          </button>

          {/* Theme Mode Switcher Icon Button */}
          <button
            type="button"
            className="nav-tool-btn"
            onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
            title={theme === 'light' ? 'Přepnout do tmavého režimu (Dark Mode)' : 'Přepnout do světlého režimu (Light Mode)'}
            aria-label={theme === 'light' ? 'Přepnout do tmavého režimu (Dark Mode)' : 'Přepnout do světlého režimu (Light Mode)'}
          >
            {theme === 'light' ? <Moon size={15} style={{ color: 'var(--accent-purple)' }} /> : <Sun size={15} style={{ color: 'var(--accent-amber)' }} />}
          </button>

          {/* Font Size Quick Cycle Button */}
          <button
            type="button"
            className="nav-tool-btn nav-font-size-btn"
            onClick={cycleFontSize}
            title={`${t('nav.font_size_cycle') || 'Velikost písma'}: ${FONT_SIZE_LABELS[fontSize] || 'M'}`}
            aria-label={`${t('nav.font_size_cycle') || 'Velikost písma'}: ${FONT_SIZE_LABELS[fontSize] || 'M'}`}
          >
            <Type size={15} style={{ color: 'var(--accent-indigo)' }} />
            <span className="nav-font-size-badge">{FONT_SIZE_LABELS[fontSize] || 'M'}</span>
          </button>

          {/* Sound Effects Volume Mute Toggle */}
          <button
            type="button"
            className="nav-tool-btn"
            onClick={handleToggleSound}
            title={soundEnabled ? 'Zvuky jsou zapnuty (Klikněte pro ztišení)' : 'Zvuky jsou vypnuty (Klikněte pro zapnutí)'}
            aria-label={soundEnabled ? 'Zvuky jsou zapnuty (Klikněte pro ztišení)' : 'Zvuky jsou vypnuty (Klikněte pro zapnutí)'}
          >
            {soundEnabled ? (
              <Volume2 size={15} style={{ color: 'var(--accent-blue)' }} />
            ) : (
              <VolumeX size={15} style={{ color: 'var(--text-muted)' }} />
            )}
          </button>

          {/* Print Daily Summary Slip Button */}
          {onPrintDailySummary && (
            <button
              type="button"
              className="nav-tool-btn"
              onClick={onPrintDailySummary}
              title={t('nav.print_daily_summary') || 'Vytisknout denní tržbu na tiskárnu a otevřít zásuvku'}
              aria-label={t('nav.print_daily_summary') || 'Vytisknout denní tržbu na tiskárnu a otevřít zásuvku'}
            >
              <Printer size={15} style={{ color: '#0284c7' }} />
            </button>
          )}

          {/* Quick Lock Icon Button: only when the owner has switched the lock screen on */}
          {storeConfig?.lockScreenEnabled && (
            <button
              type="button"
              className="nav-tool-btn"
              onClick={onLockApp}
              title="Zamknout pokladnu (Quick Lock)"
              aria-label="Zamknout pokladnu (Quick Lock)"
            >
              <Lock size={15} style={{ color: 'var(--accent-amber)' }} />
            </button>
          )}

          <div className="nav-tool-divider" />

          {/* Live Time & Calendar Chip */}
          {(() => {
            const localeMap = {
              cs: 'cs-CZ',
              vi: 'vi-VN',
              en: 'en-US'
            };
            const currentLocale = localeMap[language] || 'cs-CZ';
            const weekdayStr = currentTime.toLocaleDateString(currentLocale, { weekday: 'short' });
            const dayStr = String(currentTime.getDate()).padStart(2, '0');
            const monthStr = String(currentTime.getMonth() + 1).padStart(2, '0');
            const formattedDate = `${weekdayStr} ${dayStr}/${monthStr}`;

            return (
              <button
                type="button"
                className="nav-clock-chip"
                onClick={onOpenCalendarModal}
                title="Klikněte pro otevření kalendáře a přehledu tržeb"
                aria-label="Klikněte pro otevření kalendáře a přehledu tržeb"
              >
                <Clock size={13} style={{ color: 'var(--accent-emerald)', flexShrink: 0 }} />
                <span className="nav-clock-time">
                  {currentTime.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="nav-clock-dot">•</span>
                <span className="nav-clock-date">
                  {formattedDate}
                </span>
              </button>
            );
          })()}

          <div className="nav-tool-divider" />

          {/* Turn Off / Shutdown Button */}
          <button
            type="button"
            className="nav-tool-btn btn-power"
            onClick={onOpenShutdownModal}
            title={t('nav.shutdown') || 'Ukončit směnu a vypnout pokladní systém'}
            aria-label={t('nav.shutdown') || 'Ukončit směnu a vypnout pokladní systém'}
          >
            <Power size={15} style={{ color: 'var(--accent-rose)' }} />
          </button>
        </div>
      </div>
    </header>
  );
}

export default React.memo(Navbar);


