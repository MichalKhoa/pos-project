import React, { useState, useEffect } from 'react';
import { ShoppingBag, History, Settings, ShieldCheck, Clock, Tag, Lock, Unlock, AlertTriangle, Power, Calendar, Sun, Moon, Globe } from 'lucide-react';
import himmelLogo from '../assets/himmel_logo_icon_nobg.png';
import { useTranslation } from '../i18n/LanguageContext.jsx';

export default function Navbar({
  activeTab,
  setActiveTab,
  storeConfig,
  isAdminMode,
  onToggleAdminMode,
  pendingCount = 0,
  onOpenSyncModal,
  onOpenShutdownModal,
  onOpenCalendarModal,
  onLockApp
}) {
  const { t, language, setLanguage, languages } = useTranslation();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('pos_theme') || 'light';
  });
  const [latency, setLatency] = useState(null);
  const [isOnline, setIsOnline] = useState(true);

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
        const res = await fetch('http://localhost:8000/', { method: 'GET', cache: 'no-store' });
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
        <div className="brand-icon" style={{ overflow: 'hidden', padding: '0', border: 'none', background: 'transparent', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src={himmelLogo} alt="Himmel POS Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.15))' }} />
        </div>
        <div>
          <div className="brand-title">{storeConfig?.storeName || 'Himmel POS'}</div>
          <div className="brand-subtitle">{storeConfig?.registerNo || 'Pokladna #01'}</div>
        </div>
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
          className={`nav-tab ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <Settings size={18} />
          <span>{t('nav.settings')}</span>
        </button>
      </nav>

      <div className="nav-meta">
        {/* Language Switcher Dropdown */}
        <div className="status-badge" style={{ padding: '0.4rem 0.6rem', background: 'var(--bg-main)' }}>
          <select
            value={language}
            onChange={e => setLanguage(e.target.value)}
            style={{
              background: 'transparent',
              color: 'var(--text-primary)',
              border: 'none',
              fontSize: '0.8rem',
              fontWeight: '800',
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            {languages.map(l => (
              <option key={l.code} value={l.code} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                {l.flag} {l.label}
              </option>
            ))}
          </select>
        </div>

        {/* Combined EET 2.0 & Online Latency Status Pill */}
        <div
          className="status-badge"
          style={{ gap: '0.4rem' }}
          title={isOnline ? `EET 2.0 Online • Odezva backendu: ${latency !== null ? latency : '--'} ms` : 'EET Offline'}
        >
          <span className={isOnline ? 'status-dot' : 'status-dot-offline'} style={{ background: isOnline ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}></span>
          <ShieldCheck size={14} style={{ color: isOnline ? 'var(--accent-emerald)' : 'var(--accent-rose)' }} />
          <span style={{ fontSize: '0.78rem', fontWeight: '700' }}>
            EET 2.0 • {isOnline ? `${latency !== null ? latency : 12}ms` : t('nav.offline')}
          </span>
        </div>

        {/* Compact Theme Mode Switcher Icon Button */}
        <button
          type="button"
          className="status-badge"
          style={{ cursor: 'pointer', padding: '0.4rem 0.6rem', background: 'var(--bg-main)' }}
          onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
          title={theme === 'light' ? 'Přepnout do tmavého režimu (Dark Mode)' : 'Přepnout do světlého režimu (Light Mode)'}
        >
          {theme === 'light' ? <Moon size={15} style={{ color: 'var(--accent-purple)' }} /> : <Sun size={15} style={{ color: 'var(--accent-amber)' }} />}
        </button>

        {pendingCount > 0 && (
          <button
            className="status-badge badge-pending-sync pulse-badge"
            onClick={onOpenSyncModal}
            title="Klikněte pro odeslání neodeslaných účtenek na EET"
          >
            <AlertTriangle size={14} />
            <span>{pendingCount} {t('nav.not_sent')}</span>
          </button>
        )}

        <button
          className="status-badge"
          style={{
            cursor: 'pointer',
            background: isAdminMode ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.05)',
            color: isAdminMode ? 'var(--accent-amber)' : 'var(--text-muted)',
            borderColor: isAdminMode ? 'var(--accent-amber)' : 'var(--border-color)',
            transition: 'all 0.2s ease'
          }}
          onClick={onToggleAdminMode}
          title={isAdminMode ? 'Režim správce je AKTIVNÍ' : 'Klikněte pro aktivaci Admin režimu'}
        >
          {isAdminMode ? <Unlock size={14} /> : <Lock size={14} />}
          <span>{isAdminMode ? t('nav.admin_active') : t('nav.admin')}</span>
        </button>

        {/* Streamlined Quick Lock Icon Button */}
        <button
          type="button"
          className="status-badge"
          style={{ cursor: 'pointer', padding: '0.4rem 0.6rem', background: 'var(--bg-main)' }}
          onClick={onLockApp}
          title="Zamknout pokladnu (Quick Lock)"
        >
          <Lock size={15} style={{ color: 'var(--accent-amber)' }} />
        </button>

        <button
          className="status-badge btn-shutdown-badge"
          onClick={onOpenShutdownModal}
          title="Ukončit směnu a vypnout pokladní systém"
          style={{ cursor: 'pointer' }}
        >
          <Power size={14} />
          <span>{t('nav.shutdown')}</span>
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
          <span style={{ fontWeight: '700', textTransform: 'capitalize', letterSpacing: '-0.01em' }}>
            {currentTime.toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric' })}
          </span>
          <div className="time-badge-divider" />
          <div className="time-badge-clock">
            <Clock size={13} style={{ color: 'var(--accent-emerald)' }} />
            <span>
              {currentTime.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        </button>
      </div>
    </header>
  );
}


