import React, { useState, useEffect } from 'react';
import { ShoppingBag, History, Settings, ShieldCheck, Clock, Tag, Lock, AlertTriangle, Power, Calendar, Sun, Moon, Package, Volume2, VolumeX, Menu, X, BarChart3 } from 'lucide-react';
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
  const { t } = useTranslation();
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

  return (
    <header className="navbar">
      <div className="brand-section">
        <div className="brand-icon" style={{ overflow: 'hidden', padding: '0', border: 'none', background: 'transparent', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <img src={voltflowLogo} alt="VoltFlow POS Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.15))' }} />
        </div>
        <span className="brand-name">VoltFlow</span>
      </div>

      <nav className="nav-tabs">
        <button
          className={`nav-tab ${activeTab === 'register' ? 'active' : ''}`}
          onClick={() => setActiveTab('register')}
        >
          <ShoppingBag size={18} />
          <span>{t('nav.register')}</span>
        </button>

        <button
          className={`nav-tab ${activeTab === 'inventory' ? 'active' : ''}`}
          onClick={() => setActiveTab('inventory')}
        >
          <Package size={18} />
          <span>{t('nav.inventory') || 'Sklad'}</span>
        </button>

        <button
          className={`nav-tab ${activeTab === 'presets' ? 'active' : ''}`}
          onClick={() => setActiveTab('presets')}
        >
          <Tag size={18} />
          <span>{t('nav.presets')}</span>
        </button>

        <button
          className={`nav-tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <History size={18} />
          <span>{t('nav.history')}</span>
        </button>

        <button
          className={`nav-tab ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          <BarChart3 size={18} />
          <span>{t('nav.analytics') || 'Analytika'}</span>
        </button>

        <button
          className={`nav-tab ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <Settings size={18} />
          <span>{t('nav.settings')}</span>
        </button>
      </nav>

      <div className={`nav-meta ${isNavDrawerOpen ? 'drawer-open' : ''}`}>
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

          {/* Custom SVG Language Switcher Dropdown */}
          <LanguageSelector compact />

          {/* Compact EET Status Icon with EET text (Green = Online, Red = Offline, Blue = Disabled) */}
          {(() => {
            const isEetDisabled = storeConfig?.eetEnabled === false;
            const eetStatusColor = isEetDisabled ? 'var(--accent-blue)' : isOnline ? 'var(--accent-emerald)' : 'var(--accent-rose)';
            const eetStatusBg = isEetDisabled ? 'rgba(59, 130, 246, 0.12)' : isOnline ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)';
            const eetStatusBorder = isEetDisabled ? 'rgba(59, 130, 246, 0.35)' : isOnline ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)';

            return (
              <div
                className="nav-action-btn nav-badge-eet"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  padding: '0 0.55rem',
                  height: '36px',
                  width: 'auto',
                  borderRadius: 'var(--radius-md)',
                  background: eetStatusBg,
                  borderColor: eetStatusBorder,
                  color: eetStatusColor,
                  fontWeight: '800',
                  fontSize: '0.78rem',
                  letterSpacing: '0.02em',
                  cursor: 'default',
                  flexShrink: 0
                }}
                title={
                  isEetDisabled
                    ? 'EET evidování je v nastavení vypnuto'
                    : isOnline ? `EET 2.0 Online • Odezva backendu: ${latency !== null ? latency : '--'} ms` : 'EET Offline (server nedostupný)'
                }
              >
                <ShieldCheck size={15} style={{ color: eetStatusColor }} />
                <span>EET</span>
              </div>
            );
          })()}

          {/* Compact Theme Mode Switcher Icon Button */}
          <button
            type="button"
            className="nav-action-btn nav-badge-theme"
            onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
            title={theme === 'light' ? 'Přepnout do tmavého režimu (Dark Mode)' : 'Přepnout do světlého režimu (Light Mode)'}
          >
            {theme === 'light' ? <Moon size={16} style={{ color: 'var(--accent-purple)' }} /> : <Sun size={16} style={{ color: 'var(--accent-amber)' }} />}
          </button>

          {/* Sound Effects Volume Mute Toggle */}
          <button
            type="button"
            className="nav-action-btn nav-badge-sound"
            onClick={handleToggleSound}
            title={soundEnabled ? 'Zvuky jsou zapnuty (Klikněte pro ztišení)' : 'Zvuky jsou vypnuty (Klikněte pro zapnutí)'}
          >
            {soundEnabled ? (
              <Volume2 size={16} style={{ color: 'var(--accent-blue)' }} />
            ) : (
              <VolumeX size={16} style={{ color: 'var(--text-muted)' }} />
            )}
          </button>

          {pendingCount > 0 && (
            <button
              className="status-badge badge-pending-sync pulse-badge nav-badge-sync"
              onClick={onOpenSyncModal}
              title="Klikněte pro odeslání neodeslaných účtenek na EET"
            >
              <AlertTriangle size={14} />
              <span>{pendingCount} {t('nav.not_sent')}</span>
            </button>
          )}

          {/* Open Cash Drawer Button */}
          <button
            type="button"
            className="nav-action-btn nav-badge-drawer"
            onClick={onOpenCashDrawer}
            title={t('nav.open_drawer') || 'Otevřít peněžní zásuvku'}
            style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.25) 100%)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              color: 'var(--accent-emerald)'
            }}
          >
            <CashDrawerIcon size={16} color="var(--accent-emerald)" />
          </button>

          {/* Streamlined Quick Lock Icon Button */}
          <button
            type="button"
            className="nav-action-btn btn-lock nav-badge-lock"
            onClick={onLockApp}
            title="Zamknout pokladnu (Quick Lock)"
          >
            <Lock size={16} style={{ color: 'var(--accent-amber)' }} />
          </button>

          {/* Icon-Only Turn Off / Shutdown Button */}
          <button
            type="button"
            className="nav-action-btn btn-shutdown nav-badge-shutdown"
            onClick={onOpenShutdownModal}
            title={t('nav.shutdown') || 'Ukončit směnu a vypnout pokladní systém'}
          >
            <Power size={16} style={{ color: 'var(--accent-rose)' }} />
          </button>

          <button
            type="button"
            className="time-display-btn"
            onClick={onOpenCalendarModal}
            title="Klikněte pro otevření kalendáře a přehledu tržeb"
          >
            <div className="time-badge-icon">
              <Calendar size={13} />
            </div>
            <span className="time-badge-date" style={{ fontWeight: '700', textTransform: 'capitalize', letterSpacing: '-0.01em' }}>
              {currentTime.toLocaleDateString(t('locale') || 'cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric' })}
            </span>
            <div className="time-badge-divider" />
            <div className="time-badge-clock">
              <Clock size={13} style={{ color: 'var(--accent-emerald)' }} />
              <span>
                {currentTime.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </button>
        </div>
      </div>
    </header>
  );
}


