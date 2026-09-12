import React, { useState, useEffect, useCallback } from 'react';
import { 
  Banknote, 
  CreditCard, 
  Receipt, 
  TrendingUp, 
  Percent, 
  Activity, 
  Clock, 
  Wallet,
  FileText,
  QrCode,
  Layers,
  RefreshCw,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import cloudApi from '../api/cloudApi';

function formatCZK(val) {
  if (val === undefined || val === null || val === '') return '0,00 CZK';
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num)) return '0,00 CZK';
  return `${num.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CZK`;
}

function formatSyncTime(isoStr) {
  if (!isoStr) return 'Nikdy / offline';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return String(isoStr);
    return d.toLocaleString('cs-CZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(isoStr);
  }
}

const Card = ({ title, value, icon: Icon, color = "var(--color-primary, #0052cc)", loading = false }) => (
  <div style={{
    backgroundColor: 'var(--color-surface, #ffffff)',
    borderRadius: '12px',
    padding: '1.5rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    border: '1px solid var(--color-border, #e2e8f0)'
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-secondary, #64748b)' }}>
      <Icon size={18} color={color} />
      <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{title}</span>
    </div>
    <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-text, #0f172a)' }}>
      {loading ? (
        <span style={{ color: 'var(--color-text-secondary, #94a3b8)', fontSize: '1.25rem', fontWeight: 500 }}>
          Načítání...
        </span>
      ) : (
        value
      )}
    </div>
  </div>
);

export default function OverviewPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [kpi, setKpi] = useState(null);
  const [splits, setSplits] = useState(null);
  const [health, setHealth] = useState(null);

  const fetchOverviewData = useCallback(async (isManual = false) => {
    if (isManual) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [kpiRes, splitsRes, healthRes] = await Promise.allSettled([
        cloudApi.getDashboardKpi(),
        cloudApi.getPaymentSplits(),
        cloudApi.getHealth(),
      ]);

      if (kpiRes.status === 'fulfilled' && kpiRes.value) {
        setKpi(kpiRes.value);
      } else if (kpiRes.status === 'rejected') {
        console.warn('Failed to load KPI:', kpiRes.reason);
      }

      if (splitsRes.status === 'fulfilled' && splitsRes.value) {
        setSplits(splitsRes.value);
      } else if (splitsRes.status === 'rejected') {
        console.warn('Failed to load payment splits:', splitsRes.reason);
      }

      if (healthRes.status === 'fulfilled' && healthRes.value) {
        setHealth(healthRes.value);
      } else if (healthRes.status === 'rejected') {
        console.warn('Failed to check health:', healthRes.reason);
      }

      if (kpiRes.status === 'rejected' && splitsRes.status === 'rejected') {
        throw new Error(kpiRes.reason?.message || 'Chyba připojení ke cloudovému serveru');
      }
    } catch (err) {
      setError(err.message || 'Nepodařilo se načíst data přehledu');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOverviewData(false);
  }, [fetchOverviewData]);

  const isOnline = health?.available !== false && !error;
  const isSnapshotMissing = health?.available === false;
  const lastSyncTime = health?.last_sync || kpi?.last_sync_time;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: 0 }}>Dashboard Overview</h1>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => fetchOverviewData(true)}
            disabled={refreshing || loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              backgroundColor: 'var(--color-surface, #ffffff)',
              border: '1px solid var(--color-border, #cbd5e1)',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.875rem',
              color: 'var(--color-text, #0f172a)',
              cursor: (refreshing || loading) ? 'not-allowed' : 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              opacity: (refreshing || loading) ? 0.7 : 1,
            }}
          >
            <RefreshCw size={15} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            {refreshing ? 'Obnovuji...' : 'Obnovit data'}
          </button>

          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem', 
            color: isOnline ? 'var(--color-success, #10b981)' : '#b45309', 
            backgroundColor: isOnline ? 'var(--color-success-bg, #d1fae5)' : '#fef3c7', 
            padding: '0.5rem 1rem', 
            borderRadius: '9999px', 
            fontSize: '0.875rem', 
            fontWeight: 600 
          }}>
            <Activity size={16} />
            {isOnline ? 'System Online' : 'Snapshot Offline'}
            <span style={{ color: 'var(--color-text-secondary, #64748b)', fontWeight: 400, marginLeft: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Clock size={14} /> Sync: {formatSyncTime(lastSyncTime)}
            </span>
          </div>
        </div>
      </div>

      {/* Snapshot missing / Error Banner */}
      {(isSnapshotMissing || error) && (
        <div style={{
          padding: '1rem 1.25rem',
          borderRadius: '10px',
          backgroundColor: error ? '#fee2e2' : '#fffbeb',
          border: `1px solid ${error ? '#fca5a5' : '#fde68a'}`,
          color: error ? '#991b1b' : '#92400e',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem',
          fontSize: '0.9rem',
        }}>
          <AlertTriangle size={20} color={error ? '#dc2626' : '#d97706'} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
              {error ? 'Chyba synchronizace s cloudem' : 'Snapshot databáze pokladny není k dispozici nebo je offline'}
            </div>
            <div>
              {error 
                ? `Nepodařilo se kontaktovat server: ${error}. Zkontrolujte stav cloudového rozhraní.`
                : 'Lokální kopie pos_store.db nebyla nalezena. Zobrazují se výchozí nulové hodnoty. Data se automaticky naplní po první synchronizaci z pokladny.'}
            </div>
          </div>
          <button
            onClick={() => fetchOverviewData(true)}
            style={{
              backgroundColor: 'transparent',
              border: `1px solid ${error ? '#f87171' : '#fcd34d'}`,
              borderRadius: '6px',
              padding: '0.35rem 0.75rem',
              fontWeight: 600,
              fontSize: '0.8rem',
              cursor: 'pointer',
              color: error ? '#991b1b' : '#92400e',
            }}
          >
            Zkusit znovu
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <section>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--color-text-secondary, #475569)' }}>
          Key Performance Indicators
        </h2>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
          gap: '1.5rem' 
        }}>
          <Card 
            title="Gross Revenue" 
            value={formatCZK(kpi?.gross_revenue)} 
            icon={Banknote} 
            color="#10b981" 
            loading={loading}
          />
          <Card 
            title="Net Revenue" 
            value={formatCZK(kpi?.net_revenue)} 
            icon={Banknote} 
            loading={loading}
          />
          <Card 
            title="Realized Gross Profit" 
            value={formatCZK(kpi?.realized_gross_profit)} 
            icon={TrendingUp} 
            color="#3b82f6" 
            loading={loading}
          />
          <Card 
            title="Margin %" 
            value={`${parseFloat(kpi?.margin_percent || '0').toFixed(1)}%`} 
            icon={Percent} 
            color="#8b5cf6" 
            loading={loading}
          />
          <Card 
            title="Total Receipts" 
            value={kpi?.receipt_count !== undefined ? String(kpi.receipt_count) : '0'} 
            icon={Receipt} 
            color="#f59e0b" 
            loading={loading}
          />
          <Card 
            title="Average Order Value" 
            value={formatCZK(kpi?.aov)} 
            icon={Activity} 
            color="#ec4899" 
            loading={loading}
          />
          <Card 
            title="Cash Drawer Balance" 
            value={formatCZK(kpi?.cash_drawer_balance)} 
            icon={Wallet} 
            color="#06b6d4" 
            loading={loading}
          />
        </div>
      </section>

      {/* Payment Splits */}
      <section>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--color-text-secondary, #475569)' }}>
          Payment Split Breakdown
        </h2>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
          gap: '1.5rem',
          backgroundColor: 'var(--color-surface, #ffffff)',
          padding: '1.5rem',
          borderRadius: '12px',
          border: '1px solid var(--color-border, #e2e8f0)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ color: 'var(--color-text-secondary, #64748b)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Banknote size={16} color="#10b981" /> Hotovost (Cash)
            </span>
            <span style={{ fontSize: '1.25rem', fontWeight: 600 }}>
              {loading ? '...' : formatCZK(splits?.cash)}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ color: 'var(--color-text-secondary, #64748b)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CreditCard size={16} color="#3b82f6" /> Platební karta
            </span>
            <span style={{ fontSize: '1.25rem', fontWeight: 600 }}>
              {loading ? '...' : formatCZK(splits?.card)}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ color: 'var(--color-text-secondary, #64748b)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <QrCode size={16} color="#8b5cf6" /> QR Platba
            </span>
            <span style={{ fontSize: '1.25rem', fontWeight: 600 }}>
              {loading ? '...' : formatCZK(splits?.qr)}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ color: 'var(--color-text-secondary, #64748b)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Layers size={16} color="#f59e0b" /> Kombinovaná (Split)
            </span>
            <span style={{ fontSize: '1.25rem', fontWeight: 600 }}>
              {loading ? '...' : formatCZK(splits?.split)}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ color: 'var(--color-text-secondary, #64748b)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={16} color="#64748b" /> Faktura / Převod
            </span>
            <span style={{ fontSize: '1.25rem', fontWeight: 600 }}>
              {loading ? '...' : formatCZK(splits?.invoice ?? splits?.faktura ?? '0.00')}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

