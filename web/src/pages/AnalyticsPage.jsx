import React from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  PackageX, 
  Clock, 
  DollarSign, 
  BarChart2
} from 'lucide-react';

const PROFIT_DRIVERS = [
  { id: 1, name: "Espresso Roast Beans 1kg", volume: 145, profit: "29,000 CZK", margin: "45%" },
  { id: 2, name: "Chemex Filters", volume: 320, profit: "12,800 CZK", margin: "60%" },
  { id: 3, name: "KeepCup 8oz", volume: 45, profit: "9,000 CZK", margin: "40%" }
];

const VOLUME_DRIVERS = [
  { id: 1, name: "Espresso single (takeaway)", volume: 1450, profit: "58,000 CZK", margin: "75%" },
  { id: 2, name: "Oat Milk Surcharge", volume: 890, profit: "13,350 CZK", margin: "80%" },
  { id: 3, name: "Tap Water (glass)", volume: 3200, profit: "0 CZK", margin: "0%" }
];

const MARGIN_ALERTS = [
  { id: 1, name: "Avocado Toast", currentMargin: "15%", targetMargin: "45%", trend: "-30%" },
  { id: 2, name: "Almond Milk", currentMargin: "5%", targetMargin: "25%", trend: "-20%" },
];

const DEAD_STOCK = [
  { id: 1, name: "Matcha Powder (seasonal)", daysUnsold: 45, tiedCapital: "1,200 CZK" },
  { id: 2, name: "Decaf Beans (Q1)", daysUnsold: 60, tiedCapital: "800 CZK" },
];

const HEATMAP_DATA = [
  { hour: "07:00", intensity: 0.2, sales: "4,000 CZK" },
  { hour: "08:00", intensity: 0.8, sales: "15,000 CZK" },
  { hour: "09:00", intensity: 1.0, sales: "22,000 CZK" },
  { hour: "10:00", intensity: 0.5, sales: "8,000 CZK" },
  { hour: "11:00", intensity: 0.3, sales: "5,000 CZK" },
  { hour: "12:00", intensity: 0.9, sales: "18,000 CZK" },
  { hour: "13:00", intensity: 0.7, sales: "12,000 CZK" },
  { hour: "14:00", intensity: 0.4, sales: "7,000 CZK" },
];

const SectionCard = ({ title, icon: Icon, children, color = "var(--color-primary, #0052cc)", alert = false }) => (
  <div style={{
    backgroundColor: 'var(--color-surface, #ffffff)',
    borderRadius: '12px',
    padding: '1.5rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    border: alert ? '1px solid var(--color-danger, #ef4444)' : '1px solid var(--color-border, #e2e8f0)'
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: alert ? 'var(--color-danger, #ef4444)' : 'var(--color-text-secondary, #64748b)' }}>
      <Icon size={20} color={alert ? 'var(--color-danger, #ef4444)' : color} />
      <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, color: 'var(--color-text, #0f172a)' }}>{title}</h2>
    </div>
    {children}
  </div>
);

const Table = ({ columns, data, renderRow }) => (
  <div style={{ overflowX: 'auto' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
      <thead>
        <tr style={{ borderBottom: '1px solid var(--color-border, #e2e8f0)', color: 'var(--color-text-secondary, #64748b)' }}>
          {columns.map((col, i) => (
            <th key={i} style={{ padding: '0.75rem 0.5rem', fontWeight: 500 }}>{col}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr key={i} style={{ borderBottom: '1px solid var(--color-border, #f1f5f9)' }}>
            {renderRow(row)}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default function AnalyticsPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: 0 }}>Deep Analytics</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
        {/* Top Profit Drivers */}
        <SectionCard title="Top Profit Drivers" icon={DollarSign} color="#10b981">
          <Table 
            columns={["Item", "Volume", "Margin", "Total Profit"]}
            data={PROFIT_DRIVERS}
            renderRow={(row) => (
              <>
                <td style={{ padding: '0.75rem 0.5rem', fontWeight: 500 }}>{row.name}</td>
                <td style={{ padding: '0.75rem 0.5rem' }}>{row.volume}</td>
                <td style={{ padding: '0.75rem 0.5rem', color: 'var(--color-success, #10b981)' }}>{row.margin}</td>
                <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>{row.profit}</td>
              </>
            )}
          />
        </SectionCard>

        {/* Volume Drivers */}
        <SectionCard title="Volume Drivers" icon={BarChart2} color="#3b82f6">
          <Table 
            columns={["Item", "Volume", "Margin", "Total Profit"]}
            data={VOLUME_DRIVERS}
            renderRow={(row) => (
              <>
                <td style={{ padding: '0.75rem 0.5rem', fontWeight: 500 }}>{row.name}</td>
                <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>{row.volume}</td>
                <td style={{ padding: '0.75rem 0.5rem' }}>{row.margin}</td>
                <td style={{ padding: '0.75rem 0.5rem' }}>{row.profit}</td>
              </>
            )}
          />
        </SectionCard>

        {/* Margin Erosion Alerts */}
        <SectionCard title="Margin Erosion Alerts" icon={AlertTriangle} alert={true}>
          <Table 
            columns={["Item", "Current", "Target", "Trend"]}
            data={MARGIN_ALERTS}
            renderRow={(row) => (
              <>
                <td style={{ padding: '0.75rem 0.5rem', fontWeight: 500 }}>{row.name}</td>
                <td style={{ padding: '0.75rem 0.5rem', color: 'var(--color-danger, #ef4444)', fontWeight: 600 }}>{row.currentMargin}</td>
                <td style={{ padding: '0.75rem 0.5rem' }}>{row.targetMargin}</td>
                <td style={{ padding: '0.75rem 0.5rem', color: 'var(--color-danger, #ef4444)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <TrendingDown size={14} /> {row.trend}
                </td>
              </>
            )}
          />
        </SectionCard>

        {/* Dead Stock & Trapped Capital */}
        <SectionCard title="Dead Stock & Trapped Capital" icon={PackageX} color="#f59e0b">
          <Table 
            columns={["Item", "Days Unsold", "Tied Capital"]}
            data={DEAD_STOCK}
            renderRow={(row) => (
              <>
                <td style={{ padding: '0.75rem 0.5rem', fontWeight: 500 }}>{row.name}</td>
                <td style={{ padding: '0.75rem 0.5rem' }}>{row.daysUnsold} d</td>
                <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600, color: 'var(--color-warning, #d97706)' }}>{row.tiedCapital}</td>
              </>
            )}
          />
        </SectionCard>
      </div>

      {/* Rush-Hour Heatmap */}
      <section style={{ 
          backgroundColor: 'var(--color-surface, #ffffff)',
          borderRadius: '12px',
          padding: '1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          border: '1px solid var(--color-border, #e2e8f0)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', color: 'var(--color-text-secondary, #64748b)' }}>
          <Clock size={20} color="#8b5cf6" />
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, color: 'var(--color-text, #0f172a)' }}>Rush-Hour Heatmap (Sales Volume)</h2>
        </div>
        
        <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
          {HEATMAP_DATA.map((slot, index) => {
            const hue = 260; // purple-ish
            const saturation = 80;
            const lightness = 95 - (slot.intensity * 50); // darker for higher intensity
            const bgColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
            const textColor = slot.intensity > 0.6 ? '#fff' : '#1e293b';

            return (
              <div key={index} style={{
                flex: '1',
                minWidth: '80px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <div style={{
                  width: '100%',
                  height: '80px',
                  backgroundColor: bgColor,
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  color: textColor,
                  transition: 'transform 0.2s',
                  cursor: 'pointer'
                }} title={slot.sales}>
                  {slot.intensity > 0.7 ? <TrendingUp size={16} /> : null}
                </div>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary, #64748b)' }}>{slot.hour}</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{slot.sales}</span>
              </div>
            );
          })}
        </div>
      </section>

    </div>
  );
}
