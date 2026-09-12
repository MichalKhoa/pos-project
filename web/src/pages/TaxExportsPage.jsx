import React from 'react';
import { 
  Download, 
  FileText, 
  FileSpreadsheet, 
  FileCode,
  Calculator,
  Landmark,
  PieChart
} from 'lucide-react';

const TAX_SUMMARY = {
  dpfo: {
    income: "1,250,000 CZK",
    expenses: "450,000 CZK",
    base: "800,000 CZK"
  },
  dph: {
    rate21: { base: "500,000 CZK", tax: "105,000 CZK" },
    rate12: { base: "300,000 CZK", tax: "36,000 CZK" },
    rate0: { base: "20,000 CZK", tax: "0 CZK" },
    totalTax: "141,000 CZK"
  }
};

const SectionCard = ({ title, icon: Icon, children, color = "var(--color-primary, #0052cc)" }) => (
  <div style={{
    backgroundColor: 'var(--color-surface, #ffffff)',
    borderRadius: '12px',
    padding: '1.5rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    border: '1px solid var(--color-border, #e2e8f0)'
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-secondary, #64748b)' }}>
      <Icon size={20} color={color} />
      <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, color: 'var(--color-text, #0f172a)' }}>{title}</h2>
    </div>
    {children}
  </div>
);

const ExportButton = ({ title, description, icon: Icon, color }) => (
  <button style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1rem',
    backgroundColor: 'var(--color-surface, #ffffff)',
    border: '1px solid var(--color-border, #e2e8f0)',
    borderRadius: '8px',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.2s',
  }} 
  onMouseOver={(e) => e.currentTarget.style.borderColor = color}
  onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--color-border, #e2e8f0)'}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <div style={{ 
        backgroundColor: `${color}15`, 
        color: color, 
        padding: '0.75rem', 
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Icon size={24} />
      </div>
      <div>
        <div style={{ fontWeight: 600, color: 'var(--color-text, #0f172a)' }}>{title}</div>
        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary, #64748b)' }}>{description}</div>
      </div>
    </div>
    <Download size={20} color="var(--color-text-secondary, #64748b)" />
  </button>
);

const ValueRow = ({ label, value, highlight = false }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--color-border, #f1f5f9)' }}>
    <span style={{ color: highlight ? 'var(--color-text, #0f172a)' : 'var(--color-text-secondary, #64748b)', fontWeight: highlight ? 600 : 400 }}>{label}</span>
    <span style={{ fontWeight: highlight ? 700 : 500, color: 'var(--color-text, #0f172a)' }}>{value}</span>
  </div>
);

export default function TaxExportsPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: 0 }}>Tax & Exports</h1>
        <div style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary, #64748b)' }}>
          Period: <strong>Q1 2024</strong> (Jan - Mar)
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
        {/* DPFO Příloha č. 1 */}
        <SectionCard title="Income Tax (DPFO Příloha č. 1)" icon={Calculator} color="#3b82f6">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <ValueRow label="Total Revenue (Income)" value={TAX_SUMMARY.dpfo.income} />
            <ValueRow label="Deductible Expenses (Paušál 60%)" value={TAX_SUMMARY.dpfo.expenses} />
            <div style={{ marginTop: '0.5rem' }}>
              <ValueRow label="Tax Base" value={TAX_SUMMARY.dpfo.base} highlight={true} />
            </div>
          </div>
        </SectionCard>

        {/* DPH Přehled */}
        <SectionCard title="VAT Summary (DPH Přehled)" icon={Landmark} color="#10b981">
           <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', borderBottom: '1px solid var(--color-border, #f1f5f9)', paddingBottom: '0.5rem' }}>
              <span style={{ color: 'var(--color-text-secondary, #64748b)' }}>Rate / Base</span>
              <span style={{ color: 'var(--color-text-secondary, #64748b)', textAlign: 'right' }}>Tax Amount</span>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <span>21% ({TAX_SUMMARY.dph.rate21.base})</span>
              <span style={{ textAlign: 'right', fontWeight: 500 }}>{TAX_SUMMARY.dph.rate21.tax}</span>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <span>12% ({TAX_SUMMARY.dph.rate12.base})</span>
              <span style={{ textAlign: 'right', fontWeight: 500 }}>{TAX_SUMMARY.dph.rate12.tax}</span>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', borderBottom: '1px solid var(--color-border, #f1f5f9)', paddingBottom: '0.5rem' }}>
              <span>0% ({TAX_SUMMARY.dph.rate0.base})</span>
              <span style={{ textAlign: 'right', fontWeight: 500 }}>{TAX_SUMMARY.dph.rate0.tax}</span>
            </div>
            
            <div style={{ marginTop: '0.5rem' }}>
              <ValueRow label="Total VAT to Pay" value={TAX_SUMMARY.dph.totalTax} highlight={true} />
            </div>
          </div>
        </SectionCard>
      </div>

      <section>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--color-text-secondary, #475569)' }}>Export Bridges</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
          
          <ExportButton 
            title="Download POHODA XML" 
            description="Accounting sync format for Stormware Pohoda"
            icon={FileCode}
            color="#eab308"
          />
          
          <ExportButton 
            title="Export CSV" 
            description="Raw receipt data for Excel/Numbers"
            icon={FileSpreadsheet}
            color="#10b981"
          />
          
          <ExportButton 
            title="Export PDF Report" 
            description="Signed summary for tax advisor"
            icon={FileText}
            color="#ef4444"
          />

        </div>
      </section>
    </div>
  );
}
