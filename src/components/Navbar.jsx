import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { ShoppingBag, History, Settings, Clock, Tag, Lock, AlertTriangle, Power, Sun, Moon, Package, Volume2, VolumeX, Menu, X, BarChart3 } from 'lucide-react';
import voltflowLogo from '../assets/voltflow_logo_icon_nobg.png';
import { useTranslation } from '../i18n/LanguageContext.jsx';
import LanguageSelector from './LanguageSelector.jsx';
import CashDrawerIcon from './CashDrawerIcon';
import { soundFx } from '../utils/audio';

export default function Navbar({
  activeTab,
  setActiveTab,
  storeConfig,
  pendingCount = 0,
  onOpenSyncModal,
  onOpenShutdownModal,
  onOpenCalendarModal,
  onLockApp,
  onOpenCashDrawer
}) {
  const { t, language } = useTranslation();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('pos_theme') || 'light';
  });
  const [soundEnabled, setSoundEnabled] = useState(() => soundFx.isSoundEnabled());
  const [isNavDrawerOpen, setIsNavDrawerOpen] = useState(false);
  const [latency, setLatency] = useState(null);
  const [isOnline, setIsOnline] = useState(true);

  const handleToggleSound = () => {
    const next = !soundEnabled;
    soundFx.setSoundEnabled(next);
    setSoundEnabled(next);
  };

  const handleNavTabSelect = (tabKey) => {
    setActiveTab(tabKey);
    setIsNavDrawerOpen(false);
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
    const checkLatency = async () => {
      const start = performance.now();
      try {
        const host = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
        const res = await fetch(`http://${host}:8000/`, { method: 'GET', cache: 'no-store' });
        if (res.ok) {
          const end = performance.now();
          setLatency(Math.max(1, Math.round(end - start)));
          setIsOnline(true);
        } else {
          setIsOnline(false);
        }
      } catch {
        setIsOnline(false);
      }
    };
    checkLatency();
    const interval = setInterval(checkLatency, 8000);
    return () => clearInterval(interval);
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
          title={isOnline ? `EET 2.0 Online • Odezva: ${latency !== null ? latency : '--'} ms` : 'EET Offline'}
        >
          <span className={`status-pulse-dot ${isOnline ? 'online' : 'offline'}`} />
          <span className="status-label">{isOnline ? 'Online • EET' : 'Offline'}</span>
        </div>
        {pendingCount > 0 && (
          <button
            className="status-badge badge-pending-sync pulse-badge nav-badge-sync"
            onClick={onOpenSyncModal}
            title="Klikněte pro odeslání neodeslaných účtenek na EET"
          >
            <AlertTriangle size={14} />
            <span>{pendingCount}</span>
          </button>
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

          <button
            ref={el => { tabRefs.current['register'] = el; }}
            className={`nav-tab ${activeTab === 'register' ? 'active' : ''}`}
            onClick={() => setActiveTab('register')}
          >
            <ShoppingBag size={17} />
            <span>{t('nav.register')}</span>
          </button>

          <button
            ref={el => { tabRefs.current['inventory'] = el; }}
            className={`nav-tab ${activeTab === 'inventory' ? 'active' : ''}`}
            onClick={() => setActiveTab('inventory')}
          >
            <Package size={17} />
            <span>{t('nav.inventory') || 'Sklad'}</span>
          </button>

          <button
            ref={el => { tabRefs.current['presets'] = el; }}
            className={`nav-tab ${activeTab === 'presets' ? 'active' : ''}`}
            onClick={() => setActiveTab('presets')}
          >
            <Tag size={17} />
            <span>{t('nav.presets')}</span>
          </button>

          <button
            ref={el => { tabRefs.current['history'] = el; }}
            className={`nav-tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <History size={17} />
            <span>{t('nav.history')}</span>
          </button>

          <button
            ref={el => { tabRefs.current['analytics'] = el; }}
            className={`nav-tab ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            <BarChart3 size={17} />
            <span>{t('nav.analytics') || 'Analytika'}</span>
          </button>

          <button
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
      <div className={`nav-island-right nav-meta ${isNavDrawerOpen ? 'drawer-open' : ''}`}>
        {/* Hamburger Drawer Toggle Button (Visible on screens < 900px) */}
        <button
          type="button"
          className="nav-hamburger-btn"
          onClick={() => setIsNavDrawerOpen(!isNavDrawerOpen)}
          title="Nabídka stavu a rychlých nástrojů"
        >
          {isNavDrawerOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        {/* Status badges container (desktop flex row / mobile slide drawer) */}
        <div className={`nav-status-group ${isNavDrawerOpen ? 'show-drawer' : ''}`}>
          {/* Mobile View Drawer Nav Section (Visible inside mobile drawer) */}
          <div className="drawer-nav-section">
            <div className="drawer-section-title">{t('nav.section_title') || 'Navigace'}</div>
            <div className="drawer-nav-grid">
              <button
                type="button"
                className={`drawer-nav-btn ${activeTab === 'register' ? 'active' : ''}`}
                onClick={() => handleNavTabSelect('register')}
              >
                <ShoppingBag size={18} />
                <span>{t('nav.register')}</span>
              </button>

              <button
                type="button"
                className={`drawer-nav-btn ${activeTab === 'inventory' ? 'active' : ''}`}
                onClick={() => handleNavTabSelect('inventory')}
              >
                <Package size={18} />
                <span>{t('nav.inventory') || 'Sklad'}</span>
              </button>

              <button
                type="button"
                className={`drawer-nav-btn ${activeTab === 'presets' ? 'active' : ''}`}
                onClick={() => handleNavTabSelect('presets')}
              >
                <Tag size={18} />
                <span>{t('nav.presets')}</span>
              </button>

              <button
                type="button"
                className={`drawer-nav-btn ${activeTab === 'history' ? 'active' : ''}`}
                onClick={() => handleNavTabSelect('history')}
              >
                <History size={18} />
                <span>{t('nav.history')}</span>
              </button>

              <button
                type="button"
                className={`drawer-nav-btn ${activeTab === 'analytics' ? 'active' : ''}`}
                onClick={() => handleNavTabSelect('analytics')}
              >
                <BarChart3 size={18} />
                <span>{t('nav.analytics') || 'Analytika'}</span>
              </button>

              <button
                type="button"
                className={`drawer-nav-btn ${activeTab === 'settings' ? 'active' : ''}`}
                onClick={() => handleNavTabSelect('settings')}
              >
                <Settings size={18} />
                <span>{t('nav.settings')}</span>
              </button>
            </div>
          </div>

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
          >
            <CashDrawerIcon size={16} color="var(--text-secondary)" />
          </button>

          {/* Theme Mode Switcher Icon Button */}
          <button
            type="button"
            className="nav-tool-btn"
            onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
            title={theme === 'light' ? 'Přepnout do tmavého režimu (Dark Mode)' : 'Přepnout do světlého režimu (Light Mode)'}
          >
            {theme === 'light' ? <Moon size={15} style={{ color: 'var(--accent-purple)' }} /> : <Sun size={15} style={{ color: 'var(--accent-amber)' }} />}
          </button>

          {/* Sound Effects Volume Mute Toggle */}
          <button
            type="button"
            className="nav-tool-btn"
            onClick={handleToggleSound}
            title={soundEnabled ? 'Zvuky jsou zapnuty (Klikněte pro ztišení)' : 'Zvuky jsou vypnuty (Klikněte pro zapnutí)'}
          >
            {soundEnabled ? (
              <Volume2 size={15} style={{ color: 'var(--accent-blue)' }} />
            ) : (
              <VolumeX size={15} style={{ color: 'var(--text-muted)' }} />
            )}
          </button>

          {/* Quick Lock Icon Button */}
          <button
            type="button"
            className="nav-tool-btn"
            onClick={onLockApp}
            title="Zamknout pokladnu (Quick Lock)"
          >
            <Lock size={15} style={{ color: 'var(--accent-amber)' }} />
          </button>

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
          >
            <Power size={15} style={{ color: 'var(--accent-rose)' }} />
          </button>
        </div>
      </div>
    </header>
  );
}


