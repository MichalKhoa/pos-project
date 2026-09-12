import React from 'react';
import { 
  Banknote, 
  CreditCard, 
  Receipt, 
  TrendingUp, 
  Percent, 
  Activity, 
  Clock, 
  Wallet,
  FileText
} from 'lucide-react';

const MOCK_DATA = {
  kpis: {
    grossRevenue: "125,000 CZK",
    netRevenue: "103,305 CZK",
    grossProfit: "45,000 CZK",
    margin: "43.5%",
    receiptCount: 142,
    aov: "880 CZK",
    cashDrawer: "15,200 CZK"
  },
  splits: {
    cash: "45,000 CZK",
    card: "70,000 CZK",
    invoice: "5,000 CZK",
    mealVouchers: "5,000 CZK"
  },
  lastSync: "2 minutes ago"
};

const Card = ({ title, value, icon: Icon, color = "var(--color-primary, #0052cc)" }) => (
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
      {value}
    </div>
  </div>
);

export default function OverviewPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: 0 }}>Dashboard Overview</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-success, #10b981)', backgroundColor: 'var(--color-success-bg, #d1fae5)', padding: '0.5rem 1rem', borderRadius: '9999px', fontSize: '0.875rem', fontWeight: 600 }}>
          <Activity size={16} />
          System Online
          <span style={{ color: 'var(--color-text-secondary, #64748b)', fontWeight: 400, marginLeft: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Clock size={14} /> Last sync: {MOCK_DATA.lastSync}
          </span>
        </div>
      </div>

      <section>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--color-text-secondary, #475569)' }}>Key Performance Indicators</h2>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
          gap: '1.5rem' 
        }}>
          <Card title="Gross Revenue" value={MOCK_DATA.kpis.grossRevenue} icon={Banknote} color="#10b981" />
          <Card title="Net Revenue" value={MOCK_DATA.kpis.netRevenue} icon={Banknote} />
          <Card title="Realized Gross Profit" value={MOCK_DATA.kpis.grossProfit} icon={TrendingUp} color="#3b82f6" />
          <Card title="Margin %" value={MOCK_DATA.kpis.margin} icon={Percent} color="#8b5cf6" />
          <Card title="Total Receipts" value={MOCK_DATA.kpis.receiptCount} icon={Receipt} color="#f59e0b" />
          <Card title="Average Order Value" value={MOCK_DATA.kpis.aov} icon={Activity} color="#ec4899" />
          <Card title="Cash Drawer Balance" value={MOCK_DATA.kpis.cashDrawer} icon={Wallet} color="#06b6d4" />
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--color-text-secondary, #475569)' }}>Payment Split Breakdown</h2>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '1.5rem',
          backgroundColor: 'var(--color-surface, #ffffff)',
          padding: '1.5rem',
          borderRadius: '12px',
          border: '1px solid var(--color-border, #e2e8f0)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ color: 'var(--color-text-secondary, #64748b)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Banknote size={16}/> Cash</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 600 }}>{MOCK_DATA.splits.cash}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ color: 'var(--color-text-secondary, #64748b)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CreditCard size={16}/> Card</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 600 }}>{MOCK_DATA.splits.card}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ color: 'var(--color-text-secondary, #64748b)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><FileText size={16}/> Invoice</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 600 }}>{MOCK_DATA.splits.invoice}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ color: 'var(--color-text-secondary, #64748b)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Receipt size={16}/> Meal Vouchers</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 600 }}>{MOCK_DATA.splits.mealVouchers}</span>
          </div>
        </div>
      </section>
    </div>
  );
}
