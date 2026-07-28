import React, { useState, useEffect } from 'react';
import { ShoppingBag, History, Settings, ShieldCheck, Clock, Store, Tag, Lock, Unlock, AlertTriangle, Power } from 'lucide-react';

export default function Navbar({
  activeTab,
  setActiveTab,
  storeConfig,
  isAdminMode,
  onToggleAdminMode,
  pendingCount = 0,
  onOpenSyncModal,
  onOpenShutdownModal
}) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="navbar">
      <div className="brand-section">
        <div className="brand-icon">
          <Store size={22} />
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
          <span>Pokladna</span>
        </button>

        <button
          className={`nav-tab ${activeTab === 'presets' ? 'active' : ''}`}
          onClick={() => setActiveTab('presets')}
        >
          <Tag size={18} />
          <span>Katalog položek</span>
        </button>

        <button
          className={`nav-tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <History size={18} />
          <span>Historie prodejů</span>
        </button>

        <button
          className={`nav-tab ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <Settings size={18} />
          <span>Nastavení</span>
        </button>
      </nav>

      <div className="nav-meta">
        {pendingCount > 0 && (
          <button
            className="status-badge badge-pending-sync pulse-badge"
            onClick={onOpenSyncModal}
            title="Klikněte pro odeslání neodeslaných účtenek na EET"
          >
            <AlertTriangle size={14} />
            <span>{pendingCount} Neodesláno</span>
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
          title={isAdminMode ? 'Režim správce je AKTIVNÍ (lze mazat testovací prodeje)' : 'Klikněte pro aktivaci Admin režimu'}
        >
          {isAdminMode ? <Unlock size={14} /> : <Lock size={14} />}
          <span>{isAdminMode ? 'Admin Režim' : 'Správce'}</span>
        </button>

        <div className="status-badge" title="Připraveno pro Českou EET regulaci">
          <span className="status-dot"></span>
          <ShieldCheck size={14} />
          <span>EET 2.0 Ready</span>
        </div>

        <button
          className="status-badge btn-shutdown-badge"
          onClick={onOpenShutdownModal}
          title="Ukončit směnu a vypnout pokladní systém"
        >
          <Power size={14} />
          <span>Vypnout Pokladnu</span>
        </button>

        <div className="time-display">
          <Clock size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: '-2px' }} />
          {currentTime.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
      </div>
    </header>
  );
}


