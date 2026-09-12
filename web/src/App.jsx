import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  BarChart3,
  Receipt,
  Download,
  Settings,
  PackageOpen,
  User,
  LogOut,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Radio,
} from 'lucide-react';
import OverviewPage from './pages/OverviewPage';
import AnalyticsPage from './pages/AnalyticsPage';
import ZReportsPage from './pages/ZReportsPage';
import IntakePage from './pages/IntakePage';
import TaxExportsPage from './pages/TaxExportsPage';
import CatalogPage from './pages/CatalogPage';
import { cloudApi } from './api/cloudApi';
import LoginModal from './components/LoginModal';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => cloudApi.isAuthenticated());
  const [username, setUsername] = useState(() => cloudApi.getUsername());
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [health, setHealth] = useState({
    status: 'loading',
    available: false,
    last_sync: null,
    file_size: 0,
    error: null,
  });
  const [isRefreshingHealth, setIsRefreshingHealth] = useState(false);

  // Sync auth state on custom events (e.g. 401 interceptor, bypass toggle)
  useEffect(() => {
    const handleAuthEvent = () => {
      setIsAuthenticated(cloudApi.isAuthenticated());
      setUsername(cloudApi.getUsername());
    };
    window.addEventListener('auth:required', handleAuthEvent);
    window.addEventListener('auth:updated', handleAuthEvent);
    return () => {
      window.removeEventListener('auth:required', handleAuthEvent);
      window.removeEventListener('auth:updated', handleAuthEvent);
    };
  }, []);

  // Poll snapshot health on mount and every 60s
  const fetchHealth = async () => {
    setIsRefreshingHealth(true);
    try {
      const data = await cloudApi.getHealth();
      setHealth({
        status: 'loaded',
        available: !!data?.available,
        last_sync: data?.last_sync || null,
        file_size: data?.file_size || 0,
        error: data?.error || null,
      });
    } catch (err) {
      setHealth({
        status: 'loaded',
        available: false,
        last_sync: null,
        file_size: 0,
        error: err.message || 'Offline',
      });
    } finally {
      setIsRefreshingHealth(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    setUsername(cloudApi.getUsername());
    setShowLoginModal(false);
    fetchHealth();
  };

  const handleLogout = () => {
    cloudApi.logout();
    setIsAuthenticated(false);
  };

  const getHealthBadge = () => {
    if (health.status === 'loading') {
      return {
        label: 'Checking...',
        subtext: 'Snapshot status',
        color: '#64748b',
        bg: '#f8fafc',
        border: '#e2e8f0',
        icon: Radio,
      };
    }
    if (!health.available) {
      return {
        label: 'Snapshot Missing',
        subtext: health.error ? String(health.error).slice(0, 32) : 'Database offline',
        color: '#ef4444',
        bg: '#fef2f2',
        border: '#fecaca',
        icon: XCircle,
      };
    }

    if (health.last_sync) {
      try {
        const syncDate = new Date(health.last_sync);
        const ageHours = (Date.now() - syncDate.getTime()) / (1000 * 60 * 60);
        if (ageHours > 24) {
          return {
            label: 'Sync Stale',
            subtext: `>24h old (${syncDate.toLocaleDateString()})`,
            color: '#d97706',
            bg: '#fffbeb',
            border: '#fde68a',
            icon: AlertTriangle,
          };
        }
        return {
          label: 'POS Synced',
          subtext: `Updated ${syncDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
          color: '#059669',
          bg: '#ecfdf5',
          border: '#a7f3d0',
          icon: CheckCircle2,
        };
      } catch {
        // ignore
      }
    }

    return {
      label: 'POS Synced',
      subtext: 'Online',
      color: '#059669',
      bg: '#ecfdf5',
      border: '#a7f3d0',
      icon: CheckCircle2,
    };
  };

  const badge = getHealthBadge();
  const BadgeIcon = badge.icon;
  const isBypass = cloudApi.isBypassMode();

  return (
    <Router>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        {/* Sidebar */}
        <aside
          style={{
            width: '260px',
            backgroundColor: 'var(--color-surface, #fff)',
            borderRight: '1px solid var(--color-border, #eee)',
            padding: '1.25rem 1rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxSizing: 'border-box',
          }}
        >
          <div>
            <div style={{ paddingLeft: '0.5rem', marginBottom: '1.75rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text, #0f172a)' }}>
                VoltFlow POS
              </h2>
              <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--color-text-secondary, #64748b)' }}>
                Cloud Dashboard
              </span>
            </div>

            <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <NavLink
                to="/"
                style={({ isActive }) => ({
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  textDecoration: 'none',
                  color: isActive ? 'var(--color-primary, #0052cc)' : 'inherit',
                  backgroundColor: isActive ? 'var(--color-surface-hover, #f0f4ff)' : 'transparent',
                  borderRadius: '8px',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '0.95rem',
                })}
              >
                <LayoutDashboard size={20} />
                Overview
              </NavLink>
              <NavLink
                to="/catalog"
                style={({ isActive }) => ({
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  textDecoration: 'none',
                  color: isActive ? 'var(--color-primary, #0052cc)' : 'inherit',
                  backgroundColor: isActive ? 'var(--color-surface-hover, #f0f4ff)' : 'transparent',
                  borderRadius: '8px',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '0.95rem',
                })}
              >
                <PackageOpen size={20} />
                Catalog
              </NavLink>
              <NavLink
                to="/analytics"
                style={({ isActive }) => ({
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  textDecoration: 'none',
                  color: isActive ? 'var(--color-primary, #0052cc)' : 'inherit',
                  backgroundColor: isActive ? 'var(--color-surface-hover, #f0f4ff)' : 'transparent',
                  borderRadius: '8px',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '0.95rem',
                })}
              >
                <BarChart3 size={20} />
                Analytics
              </NavLink>
              <NavLink
                to="/z-reports"
                style={({ isActive }) => ({
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  textDecoration: 'none',
                  color: isActive ? 'var(--color-primary, #0052cc)' : 'inherit',
                  backgroundColor: isActive ? 'var(--color-surface-hover, #f0f4ff)' : 'transparent',
                  borderRadius: '8px',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '0.95rem',
                })}
              >
                <Receipt size={20} />
                Z-Reports
              </NavLink>
              <NavLink
                to="/intake"
                style={({ isActive }) => ({
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  textDecoration: 'none',
                  color: isActive ? 'var(--color-primary, #0052cc)' : 'inherit',
                  backgroundColor: isActive ? 'var(--color-surface-hover, #f0f4ff)' : 'transparent',
                  borderRadius: '8px',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '0.95rem',
                })}
              >
                <Settings size={20} />
                Intake
              </NavLink>
              <NavLink
                to="/tax-exports"
                style={({ isActive }) => ({
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  textDecoration: 'none',
                  color: isActive ? 'var(--color-primary, #0052cc)' : 'inherit',
                  backgroundColor: isActive ? 'var(--color-surface-hover, #f0f4ff)' : 'transparent',
                  borderRadius: '8px',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '0.95rem',
                })}
              >
                <Download size={20} />
                Tax Exports
              </NavLink>
            </nav>
          </div>

          {/* Sidebar Footer: Health Status & User Profile */}
          <div
            style={{
              paddingTop: '1rem',
              borderTop: '1px solid var(--color-border, #e2e8f0)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            {/* Snapshot Health Badge */}
            <div
              style={{
                backgroundColor: badge.bg,
                border: `1px solid ${badge.border}`,
                borderRadius: '8px',
                padding: '0.65rem 0.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                <BadgeIcon size={16} color={badge.color} style={{ flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: badge.color, lineHeight: 1.2 }}>
                    {badge.label}
                  </div>
                  <div
                    style={{
                      fontSize: '0.7rem',
                      color: 'var(--color-text-secondary, #64748b)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {badge.subtext}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={fetchHealth}
                title="Refresh health"
                disabled={isRefreshingHealth}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  color: badge.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '4px',
                  opacity: isRefreshingHealth ? 0.6 : 1,
                }}
              >
                <RefreshCw
                  size={14}
                  style={{
                    animation: isRefreshingHealth ? 'spin 1s linear infinite' : 'none',
                  }}
                />
              </button>
            </div>

            {/* User Session & Logout */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.5rem 0.25rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-surface-hover, #e2e8f0)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--color-text, #334155)',
                  }}
                >
                  <User size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text, #0f172a)' }}>
                    {username}
                  </div>
                  {isBypass && (
                    <span
                      style={{
                        fontSize: '0.65rem',
                        padding: '1px 5px',
                        backgroundColor: '#e0e7ff',
                        color: '#3730a3',
                        borderRadius: '4px',
                        fontWeight: 500,
                      }}
                    >
                      Bypass Mode
                    </span>
                  )}
                </div>
              </div>

              {isAuthenticated && localStorage.getItem('voltflow_token') ? (
                <button
                  type="button"
                  onClick={handleLogout}
                  title="Log out"
                  style={{
                    minHeight: '40px',
                    minWidth: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'none',
                    border: '1px solid var(--color-border, #e2e8f0)',
                    borderRadius: '8px',
                    color: 'var(--color-text-secondary, #64748b)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.color = '#ef4444';
                    e.currentTarget.style.borderColor = '#fca5a5';
                    e.currentTarget.style.backgroundColor = '#fef2f2';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.color = 'var(--color-text-secondary, #64748b)';
                    e.currentTarget.style.borderColor = 'var(--color-border, #e2e8f0)';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <LogOut size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowLoginModal(true)}
                  title="Sign in with credentials"
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.35rem 0.65rem',
                    backgroundColor: 'var(--color-primary, #0052cc)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Sign In
                </button>
              )}
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main style={{ flex: 1, padding: '2rem' }}>
          <Routes>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/catalog" element={<CatalogPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/z-reports" element={<ZReportsPage />} />
            <Route path="/intake" element={<IntakePage />} />
            <Route path="/tax-exports" element={<TaxExportsPage />} />
          </Routes>
        </main>
      </div>

      {/* Dual-mode Authentication Modal */}
      {((!isAuthenticated && !isBypass) || showLoginModal) && (
        <LoginModal
          isOpen={true}
          onSuccess={handleLoginSuccess}
          onClose={() => setShowLoginModal(false)}
        />
      )}
    </Router>
  );
}

export default App;

