import React, { useState, useEffect, useCallback } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  PackageX, 
  Clock, 
  DollarSign, 
  BarChart2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Calendar
} from 'lucide-react';
import cloudApi from '../api/cloudApi';

function formatCZK(val) {
  if (val === undefined || val === null || val === '') return '0,00 CZK';
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num)) return '0,00 CZK';
  return `${num.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CZK`;
}

const SectionCard = ({ title, icon: Icon, children, color = "var(--color-primary, #0052cc)", alert = false, badge = null }) => (
  <div style={{
    backgroundColor: 'var(--color-surface, #ffffff)',
    borderRadius: '12px',
    padding: '1.5rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    border: alert ? '1px solid #fca5a5' : '1px solid var(--color-border, #e2e8f0)'
  }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: alert ? 'var(--color-danger, #ef4444)' : 'var(--color-text-secondary, #64748b)' }}>
        <Icon size={20} color={alert ? 'var(--color-danger, #ef4444)' : color} />
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, color: 'var(--color-text, #0f172a)' }}>{title}</h2>
      </div>
      {badge && (
        <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.5rem', borderRadius: '6px', backgroundColor: alert ? '#fee2e2' : '#eff6ff', color: alert ? '#dc2626' : '#1d4ed8' }}>
          {badge}
        </span>
      )}
    </div>
    {children}
  </div>
);

const Table = ({ columns, data, renderRow, emptyMessage, loading }) => {
  if (loading) {
    return (
      <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--color-text-secondary, #64748b)' }}>
        <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', marginBottom: '0.5rem' }} />
        <div style={{ fontSize: '0.9rem' }}>Načítání analytických dat...</div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div style={{ 
        padding: '2rem 1rem', 
        textAlign: 'center', 
        color: '#94a3b8', 
        fontSize: '0.9rem',
        backgroundColor: '#f8fafc',
        borderRadius: '8px',
        border: '1px dashed #e2e8f0'
      }}>
        {emptyMessage || 'Žádná data k zobrazení'}
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--color-border, #e2e8f0)', color: 'var(--color-text-secondary, #64748b)' }}>
            {columns.map((col, i) => (
              <th key={i} style={{ padding: '0.75rem 0.5rem', fontWeight: 600, fontSize: '0.85rem' }}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--color-border, #f1f5f9)', transition: 'background-color 0.15s' }}>
              {renderRow(row)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [topProfit, setTopProfit] = useState([]);
  const [volumeDrivers, setVolumeDrivers] = useState([]);
  const [marginAlerts, setMarginAlerts] = useState([]);
  const [deadStock, setDeadStock] = useState([]);
  const [heatmap, setHeatmap] = useState({});
  const [selectedDay, setSelectedDay] = useState('all');

  const fetchAnalytics = useCallback(async (isManual = false) => {
    if (isManual) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [profitRes, volumeRes, deadStockRes, heatmapRes, alertsRes] = await Promise.allSettled([
        cloudApi.getTopProfit(10),
        cloudApi.getVolumeDrivers(10),
        cloudApi.getDeadStock(30),
        cloudApi.getHeatmap(),
        cloudApi.getMarginAlerts(),
      ]);

      if (profitRes.status === 'fulfilled' && Array.isArray(profitRes.value)) {
        setTopProfit(profitRes.value);
      }
      if (volumeRes.status === 'fulfilled' && Array.isArray(volumeRes.value)) {
        setVolumeDrivers(volumeRes.value);
      }
      if (deadStockRes.status === 'fulfilled' && Array.isArray(deadStockRes.value)) {
        setDeadStock(deadStockRes.value);
      }
      if (heatmapRes.status === 'fulfilled' && heatmapRes.value) {
        setHeatmap(heatmapRes.value);
      }
      if (alertsRes.status === 'fulfilled' && Array.isArray(alertsRes.value)) {
        setMarginAlerts(alertsRes.value);
      }

      const allFailed = [profitRes, volumeRes, deadStockRes, heatmapRes, alertsRes].every(
        (res) => res.status === 'rejected'
      );
      if (allFailed) {
        throw new Error('Chyba při komunikaci s analytickým rozhraním');
      }
    } catch (err) {
      console.error('Error loading analytics:', err);
      setError(err.message || 'Nepodařilo se načíst data hloubkové analýzy.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics(false);
  }, [fetchAnalytics]);

  // Aggregate heatmap data based on selectedDay
  const daysList = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const dayLabels = {
    all: 'Celý týden',
    monday: 'Pondělí',
    tuesday: 'Úterý',
    wednesday: 'Středa',
    thursday: 'Čtvrtek',
    friday: 'Pátek',
    saturday: 'Sobota',
    sunday: 'Neděle',
  };

  const hourlyCounts = Array.from({ length: 24 }, (_, hour) => {
    if (selectedDay === 'all') {
      return daysList.reduce((sum, d) => sum + (heatmap?.[d]?.[hour] || 0), 0);
    }
    return heatmap?.[selectedDay]?.[hour] || 0;
  });

  const maxHourCount = Math.max(...hourlyCounts, 0);
  const totalHeatmapCount = hourlyCounts.reduce((a, b) => a + b, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: 0 }}>Deep Analytics</h1>
          <p style={{ color: 'var(--color-text-secondary, #64748b)', margin: '0.25rem 0 0 0', fontSize: '0.95rem' }}>
            Hloubková analýza ziskovosti, objemů prodeje, eroze marží a ležáků na skladě.
          </p>
        </div>

        <button
          onClick={() => fetchAnalytics(true)}
          disabled={refreshing || loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.55rem 1rem',
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
          {refreshing ? 'Aktualizuji...' : 'Obnovit data'}
        </button>
      </div>

      {error && (
        <div style={{
          padding: '1rem 1.25rem',
          backgroundColor: '#fee2e2',
          border: '1px solid #fca5a5',
          borderRadius: '10px',
          color: '#991b1b',
          fontSize: '0.9rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
        }}>
          <AlertCircle size={20} color="#dc2626" />
          <div style={{ flex: 1 }}>{error}</div>
          <button
            onClick={() => fetchAnalytics(true)}
            style={{
              backgroundColor: 'transparent',
              border: '1px solid #f87171',
              borderRadius: '6px',
              padding: '0.35rem 0.75rem',
              fontWeight: 600,
              fontSize: '0.8rem',
              cursor: 'pointer',
              color: '#991b1b',
            }}
          >
            Zkusit znovu
          </button>
        </div>
      )}

      {/* Grid of 4 Key Deep-Dive Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.5rem' }}>
        
        {/* 1. Top Profit Drivers */}
        <SectionCard 
          title="Top Profit Drivers" 
          icon={DollarSign} 
          color="#10b981"
          badge={topProfit.length > 0 ? `${topProfit.length} položek` : null}
        >
          <Table 
            columns={["Produkt", "Objem", "Tržba", "Celkový zisk"]}
            data={topProfit}
            loading={loading}
            emptyMessage="Zatím žádné prodeje v historii pro výpočet ziskovosti."
            renderRow={(row) => (
              <>
                <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600, color: '#0f172a' }}>{row.product}</td>
                <td style={{ padding: '0.75rem 0.5rem', color: '#475569' }}>{row.quantity} ks</td>
                <td style={{ padding: '0.75rem 0.5rem', color: '#475569' }}>{formatCZK(row.revenue)}</td>
                <td style={{ padding: '0.75rem 0.5rem', fontWeight: 700, color: '#16a34a' }}>
                  {formatCZK(row.profit)}
                </td>
              </>
            )}
          />
        </SectionCard>

        {/* 2. Volume Drivers */}
        <SectionCard 
          title="Volume Drivers" 
          icon={BarChart2} 
          color="#3b82f6"
          badge={volumeDrivers.length > 0 ? `${volumeDrivers.length} položek` : null}
        >
          <Table 
            columns={["Produkt", "Počet prodaných ks", "Celková tržba"]}
            data={volumeDrivers}
            loading={loading}
            emptyMessage="Zatím žádná data o objemu prodejů."
            renderRow={(row) => (
              <>
                <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600, color: '#0f172a' }}>{row.product}</td>
                <td style={{ padding: '0.75rem 0.5rem', fontWeight: 700, color: '#2563eb' }}>
                  {row.quantity} ks
                </td>
                <td style={{ padding: '0.75rem 0.5rem', fontWeight: 500, color: '#475569' }}>
                  {formatCZK(row.revenue)}
                </td>
              </>
            )}
          />
        </SectionCard>

        {/* 3. Margin Erosion Alerts */}
        <SectionCard 
          title="Margin Erosion Alerts" 
          icon={AlertTriangle} 
          alert={marginAlerts.length > 0}
          badge={marginAlerts.length > 0 ? `${marginAlerts.length} varování` : 'V pořádku'}
        >
          <Table 
            columns={["Produkt", "Prodejní", "Nákupní", "Marže", "Stav"]}
            data={marginAlerts}
            loading={loading}
            emptyMessage="✓ Vše v pořádku — žádné produkty se zápornou či kriticky nízkou marží."
            renderRow={(row) => {
              const isNegative = row.issue === 'NEGATIVE_MARGIN';
              return (
                <>
                  <td style={{ padding: '0.75rem 0.5rem', fontWeight: 500 }}>{row.product}</td>
                  <td style={{ padding: '0.75rem 0.5rem', color: '#475569' }}>{formatCZK(row.price)}</td>
                  <td style={{ padding: '0.75rem 0.5rem', color: '#475569' }}>{formatCZK(row.cost_price)}</td>
                  <td style={{ padding: '0.75rem 0.5rem', color: isNegative ? '#dc2626' : '#d97706', fontWeight: 700 }}>
                    {parseFloat(row.margin_percent || 0).toFixed(1)}%
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem' }}>
                    <span style={{
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      backgroundColor: isNegative ? '#fee2e2' : '#fef3c7',
                      color: isNegative ? '#dc2626' : '#b45309',
                    }}>
                      {isNegative ? 'Záporná marže' : 'Nízká marže (<10%)'}
                    </span>
                  </td>
                </>
              );
            }}
          />
        </SectionCard>

        {/* 4. Dead Stock & Trapped Capital */}
        <SectionCard 
          title="Dead Stock & Trapped Capital" 
          icon={PackageX} 
          color="#f59e0b"
          badge={deadStock.length > 0 ? `${deadStock.length} ležáků` : 'Bez ležáků'}
        >
          <Table 
            columns={["Produkt", "Skladem", "Dní bez prodeje", "Vázaný kapitál"]}
            data={deadStock}
            loading={loading}
            emptyMessage="✓ Žádný ležák — všechny skladové zásoby se aktivně prodávají."
            renderRow={(row) => (
              <>
                <td style={{ padding: '0.75rem 0.5rem', fontWeight: 500 }}>{row.product}</td>
                <td style={{ padding: '0.75rem 0.5rem', color: '#475569' }}>{row.stock_quantity} ks</td>
                <td style={{ padding: '0.75rem 0.5rem', color: '#64748b' }}>{row.days_in_stock} d</td>
                <td style={{ padding: '0.75rem 0.5rem', fontWeight: 700, color: '#d97706' }}>
                  {formatCZK(row.idle_capital)}
                </td>
              </>
            )}
          />
        </SectionCard>
      </div>

      {/* 5. Rush-Hour Heatmap */}
      <section style={{ 
        backgroundColor: 'var(--color-surface, #ffffff)',
        borderRadius: '12px',
        padding: '1.5rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        border: '1px solid var(--color-border, #e2e8f0)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-secondary, #64748b)' }}>
            <Clock size={20} color="#8b5cf6" />
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, color: 'var(--color-text, #0f172a)' }}>
                Rush-Hour Heatmap (Návštěvnost a špičky)
              </h2>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Frekvence prodejů v jednotlivých hodinách dne ({totalHeatmapCount} celkem transakcí).
              </span>
            </div>
          </div>

          {/* Day Selector */}
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setSelectedDay('all')}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
                border: selectedDay === 'all' ? '1px solid #8b5cf6' : '1px solid #e2e8f0',
                backgroundColor: selectedDay === 'all' ? '#f5f3ff' : '#ffffff',
                color: selectedDay === 'all' ? '#6d28d9' : '#64748b',
                fontWeight: selectedDay === 'all' ? 600 : 500,
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              Celý týden
            </button>
            {daysList.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setSelectedDay(d)}
                style={{
                  padding: '0.35rem 0.6rem',
                  borderRadius: '6px',
                  border: selectedDay === d ? '1px solid #8b5cf6' : '1px solid #e2e8f0',
                  backgroundColor: selectedDay === d ? '#f5f3ff' : '#ffffff',
                  color: selectedDay === d ? '#6d28d9' : '#64748b',
                  fontWeight: selectedDay === d ? 600 : 500,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              >
                {dayLabels[d].slice(0, 2)}
              </button>
            ))}
          </div>
        </div>
        
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
            <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', marginBottom: '0.5rem' }} />
            <div>Generuji hodinovou heatmapu...</div>
          </div>
        ) : totalHeatmapCount === 0 ? (
          <div style={{ 
            padding: '2.5rem 1rem', 
            textAlign: 'center', 
            color: '#94a3b8', 
            fontSize: '0.9rem',
            backgroundColor: '#f8fafc',
            borderRadius: '8px',
            border: '1px dashed #e2e8f0'
          }}>
            Žádné zaznamenané transakce pro sestavení heatmapy ({dayLabels[selectedDay]}).
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.75rem' }}>
            {hourlyCounts.map((count, hour) => {
              const intensity = maxHourCount > 0 ? count / maxHourCount : 0;
              const hourLabel = `${hour.toString().padStart(2, '0')}:00`;
              
              let bgColor = '#f8fafc';
              let textColor = '#64748b';
              let border = '1px solid #e2e8f0';

              if (count > 0) {
                const lightness = Math.max(25, 96 - Math.round(intensity * 60));
                bgColor = `hsl(255, 85%, ${lightness}%)`;
                textColor = intensity > 0.5 ? '#ffffff' : '#1e1b4b';
                border = '1px solid transparent';
              }

              return (
                <div key={hour} style={{
                  flex: '1',
                  minWidth: '60px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}>
                  <div 
                    title={`${hourLabel}: ${count} transakcí`}
                    style={{
                      width: '100%',
                      height: '75px',
                      backgroundColor: bgColor,
                      border,
                      borderRadius: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      color: textColor,
                      transition: 'transform 0.15s ease',
                      cursor: 'default',
                      boxShadow: intensity > 0.6 ? '0 4px 6px -1px rgba(139, 92, 246, 0.2)' : 'none'
                    }}
                  >
                    {intensity > 0.75 && <TrendingUp size={14} style={{ marginBottom: '2px' }} />}
                    <span>{count}</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>
                    {hourLabel}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

