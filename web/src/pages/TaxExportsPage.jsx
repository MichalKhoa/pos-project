import React, { useState, useEffect, useMemo } from 'react';
import { 
  Download, 
  FileText, 
  FileSpreadsheet, 
  FileCode,
  Calculator,
  Landmark,
  Calendar,
  Printer,
  RefreshCw,
  ArrowRight,
  Receipt
} from 'lucide-react';
import { cloudApi } from '../api/cloudApi';

const getRangePresets = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-based

  const pad = (n) => String(n).padStart(2, '0');
  const format = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  // Current Month
  const curMonthStart = format(new Date(y, m, 1));
  const curMonthEnd = format(new Date(y, m + 1, 0));

  // Previous Month
  const prevMonthStart = format(new Date(y, m - 1, 1));
  const prevMonthEnd = format(new Date(y, m, 0));

  // Whole Year
  const yearStart = `${y}-01-01`;
  const yearEnd = `${y}-12-31`;

  return {
    curMonth: { start: curMonthStart, end: curMonthEnd, label: 'Tento měsíc' },
    prevMonth: { start: prevMonthStart, end: prevMonthEnd, label: 'Minulý měsíc' },
    year: { start: yearStart, end: yearEnd, label: `Celý rok ${y}` },
  };
};

const formatCZK = (val) => {
  if (val === undefined || val === null || val === '') return '0,00 CZK';
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/\s/g, '').replace(',', '.'));
  if (isNaN(num)) return '0,00 CZK';
  return num.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' CZK';
};

const triggerBlobDownload = async (url, filename) => {
  const token = localStorage.getItem('voltflow_token');
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Export selhal (${res.status} ${res.statusText})`);
  }
  const blob = await res.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(blobUrl);
};

const SectionCard = ({ title, icon: Icon, children, color = "var(--color-primary, #0052cc)" }) => (
  <div style={{
    backgroundColor: 'var(--color-surface, #ffffff)',
    borderRadius: '12px',
    padding: '1.5rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    border: '1px solid var(--color-border, #e2e8f0)'
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <div style={{ 
        backgroundColor: `${color}15`, 
        color: color, 
        padding: '0.45rem', 
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Icon size={20} />
      </div>
      <h2 style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0, color: 'var(--color-text, #0f172a)' }}>{title}</h2>
    </div>
    {children}
  </div>
);

const ValueRow = ({ label, value, highlight = false, sub = null }) => (
  <div style={{ 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: '0.65rem 0', 
    borderBottom: '1px solid var(--color-border, #f1f5f9)' 
  }}>
    <div>
      <span style={{ 
        color: highlight ? 'var(--color-text, #0f172a)' : 'var(--color-text-secondary, #64748b)', 
        fontWeight: highlight ? 600 : 400,
        fontSize: '0.92rem'
      }}>
        {label}
      </span>
      {sub && <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{sub}</div>}
    </div>
    <span style={{ 
      fontWeight: highlight ? 700 : 500, 
      fontSize: highlight ? '1.05rem' : '0.95rem',
      color: highlight ? '#0f172a' : 'var(--color-text, #0f172a)' 
    }}>
      {value}
    </span>
  </div>
);

export default function TaxExportsPage() {
  const presets = useMemo(() => getRangePresets(), []);
  const [selectedPreset, setSelectedPreset] = useState('curMonth');
  const [startDate, setStartDate] = useState(presets.curMonth.start);
  const [endDate, setEndDate] = useState(presets.curMonth.end);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isExportingPohoda, setIsExportingPohoda] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);

  const [dphSummary, setDphSummary] = useState(null);
  const [dpfoSummary, setDpfoSummary] = useState(null);

  const loadTaxData = async () => {
    setIsLoading(true);
    try {
      const [dph, dpfo] = await Promise.all([
        cloudApi.getDphSummary({ startDate, endDate }),
        cloudApi.getDpfoSummary({ startDate, endDate }),
      ]);
      setDphSummary(dph);
      setDpfoSummary(dpfo);
    } catch (err) {
      console.warn('Failed to load tax summaries:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTaxData();
  }, [startDate, endDate]);

  const handleApplyPreset = (key) => {
    const p = presets[key];
    if (p) {
      setSelectedPreset(key);
      setStartDate(p.start);
      setEndDate(p.end);
    }
  };

  const handleCustomDateChange = (type, val) => {
    setSelectedPreset('custom');
    if (type === 'start') setStartDate(val);
    else setEndDate(val);
  };

  const handleDownloadPohoda = async () => {
    setIsExportingPohoda(true);
    try {
      const url = cloudApi.getPohodaExportUrl({ startDate, endDate });
      await triggerBlobDownload(url, `pohoda_export_${startDate}_${endDate}.xml`);
    } catch (err) {
      alert(`Chyba při stahování POHODA XML: ${err.message}`);
    } finally {
      setIsExportingPohoda(false);
    }
  };

  const handleDownloadCsv = async () => {
    setIsExportingCsv(true);
    try {
      const url = cloudApi.getCsvExportUrl({ startDate, endDate });
      await triggerBlobDownload(url, `sales_export_${startDate}_${endDate}.csv`);
    } catch (err) {
      alert(`Chyba při stahování CSV: ${err.message}`);
    } finally {
      setIsExportingCsv(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Safe accessor data
  const dph = dphSummary || {
    base_21: '0.00', tax_21: '0.00',
    base_12: '0.00', tax_12: '0.00',
    base_0: '0.00', tax_0: '0.00',
    total_tax: '0.00', total_base: '0.00', total_gross: '0.00'
  };

  const dpfo = dpfoSummary || {
    total_income: '0.00',
    purchase_cost: '0.00',
    operating_expenses: '0.00',
    expenses: '0.00',
    tax_base: '0.00'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', paddingBottom: '3rem' }}>
      
      {/* Header & Date Range Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: 0 }}>Daňové podklady & Exporty</h1>
          <p style={{ color: 'var(--color-text-secondary, #64748b)', margin: '0.25rem 0 0 0', fontSize: '0.95rem' }}>
            Uzávěrkové přehledy DPH, příprava podkladů DPFO (§ 7b ZDP) a exporty pro účetní systémy.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={loadTaxData}
            disabled={isLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.55rem 0.9rem',
              backgroundColor: '#ffffff',
              border: '1px solid var(--color-border, #cbd5e1)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 500,
              color: '#475569'
            }}
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
            {isLoading ? 'Přepočítávám...' : 'Přepočítat'}
          </button>
          <button
            onClick={handlePrint}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.55rem 0.9rem',
              backgroundColor: '#0284c7',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            <Printer size={15} /> Tisk přehledu
          </button>
        </div>
      </div>

      {/* Date Range Selector Box */}
      <div style={{ 
        backgroundColor: '#ffffff', 
        border: '1px solid var(--color-border, #e2e8f0)', 
        borderRadius: '12px', 
        padding: '1.25rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
      }}>
        {/* Presets */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginRight: '0.25rem' }}>
            Rychlé období:
          </span>
          <button
            onClick={() => handleApplyPreset('curMonth')}
            style={{
              padding: '0.45rem 0.85rem',
              borderRadius: '6px',
              border: '1px solid',
              borderColor: selectedPreset === 'curMonth' ? '#0052cc' : '#cbd5e1',
              backgroundColor: selectedPreset === 'curMonth' ? '#eff6ff' : '#ffffff',
              color: selectedPreset === 'curMonth' ? '#0052cc' : '#475569',
              fontWeight: selectedPreset === 'curMonth' ? 600 : 500,
              cursor: 'pointer',
              fontSize: '0.85rem'
            }}
          >
            {presets.curMonth.label}
          </button>
          <button
            onClick={() => handleApplyPreset('prevMonth')}
            style={{
              padding: '0.45rem 0.85rem',
              borderRadius: '6px',
              border: '1px solid',
              borderColor: selectedPreset === 'prevMonth' ? '#0052cc' : '#cbd5e1',
              backgroundColor: selectedPreset === 'prevMonth' ? '#eff6ff' : '#ffffff',
              color: selectedPreset === 'prevMonth' ? '#0052cc' : '#475569',
              fontWeight: selectedPreset === 'prevMonth' ? 600 : 500,
              cursor: 'pointer',
              fontSize: '0.85rem'
            }}
          >
            {presets.prevMonth.label}
          </button>
          <button
            onClick={() => handleApplyPreset('year')}
            style={{
              padding: '0.45rem 0.85rem',
              borderRadius: '6px',
              border: '1px solid',
              borderColor: selectedPreset === 'year' ? '#0052cc' : '#cbd5e1',
              backgroundColor: selectedPreset === 'year' ? '#eff6ff' : '#ffffff',
              color: selectedPreset === 'year' ? '#0052cc' : '#475569',
              fontWeight: selectedPreset === 'year' ? 600 : 500,
              cursor: 'pointer',
              fontSize: '0.85rem'
            }}
          >
            {presets.year.label}
          </button>
        </div>

        {/* Custom Range Inputs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Calendar size={16} color="#64748b" />
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Od:</span>
            <input 
              type="date"
              value={startDate}
              onChange={(e) => handleCustomDateChange('start', e.target.value)}
              style={{
                padding: '0.4rem 0.6rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
                color: '#1e293b'
              }}
            />
          </div>
          <span style={{ color: '#94a3b8' }}>–</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Do:</span>
            <input 
              type="date"
              value={endDate}
              onChange={(e) => handleCustomDateChange('end', e.target.value)}
              style={{
                padding: '0.4rem 0.6rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
                color: '#1e293b'
              }}
            />
          </div>
        </div>
      </div>

      {/* Tax Summaries Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.5rem' }}>
        
        {/* DPFO Příloha č. 1 (§ 7b ZDP) */}
        <SectionCard title="Daň z příjmů (DPFO § 7b ZDP - Daňová evidence)" icon={Calculator} color="#3b82f6">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <ValueRow 
              label="Zdanitelné příjmy (Tržby bez vratek)" 
              value={formatCZK(dpfo.total_income || dpfo.income)} 
            />
            <ValueRow 
              label="Výdaje na nákup zboží (Příjemky / COGS)" 
              value={formatCZK(dpfo.purchase_cost)} 
              sub="Uplatněný nákup zásob a přímých nákladů"
            />
            <ValueRow 
              label="Provozní hotovostní výdaje (Pokladní výběry)" 
              value={formatCZK(dpfo.operating_expenses)} 
              sub="Drobné provozní režie evidované v kase"
            />
            <ValueRow 
              label="Uznatelné daňové výdaje celkem" 
              value={formatCZK(dpfo.expenses || dpfo.deductible_expenses)} 
              sub="Součet nákupu zboží a provozních výdajů"
            />
            <div style={{ marginTop: '0.5rem', borderTop: '2px solid #e2e8f0', paddingTop: '0.5rem' }}>
              <ValueRow 
                label="Dílčí základ daně (§ 7b ZDP)" 
                value={formatCZK(dpfo.tax_base || dpfo.base)} 
                highlight={true} 
                sub="Příjmy minus výdaje pro Přiznání k DPFO (Příloha 1)"
              />
            </div>
          </div>
        </SectionCard>

        {/* DPH Přehled */}
        <SectionCard title="Přehled DPH (Daňové přiznání a kontrolní hlášení)" icon={Landmark} color="#10b981">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1.2fr 1fr 1fr', 
              gap: '0.5rem', 
              borderBottom: '2px solid #e2e8f0', 
              paddingBottom: '0.5rem',
              fontSize: '0.82rem',
              fontWeight: 600,
              color: '#64748b'
            }}>
              <span>Sazba DPH</span>
              <span style={{ textAlign: 'right' }}>Základ daně</span>
              <span style={{ textAlign: 'right' }}>Výše daně</span>
            </div>
            
            {/* 21% Tier */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '0.5rem', padding: '0.5rem 0', borderBottom: '1px solid #f1f5f9', fontSize: '0.9rem' }}>
              <span style={{ fontWeight: 600, color: '#1e293b' }}>Základní sazba 21%</span>
              <span style={{ textAlign: 'right', color: '#475569' }}>{formatCZK(dph.base_21)}</span>
              <span style={{ textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>{formatCZK(dph.tax_21)}</span>
            </div>
            
            {/* 12% Tier */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '0.5rem', padding: '0.5rem 0', borderBottom: '1px solid #f1f5f9', fontSize: '0.9rem' }}>
              <span style={{ fontWeight: 600, color: '#1e293b' }}>Snížená sazba 12%</span>
              <span style={{ textAlign: 'right', color: '#475569' }}>{formatCZK(dph.base_12)}</span>
              <span style={{ textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>{formatCZK(dph.tax_12)}</span>
            </div>
            
            {/* 0% Tier */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '0.5rem', padding: '0.5rem 0', borderBottom: '1px solid #f1f5f9', fontSize: '0.9rem' }}>
              <span style={{ fontWeight: 600, color: '#1e293b' }}>Osvobozeno 0%</span>
              <span style={{ textAlign: 'right', color: '#475569' }}>{formatCZK(dph.base_0)}</span>
              <span style={{ textAlign: 'right', fontWeight: 500, color: '#64748b' }}>0,00 CZK</span>
            </div>

            <div style={{ marginTop: '0.5rem', borderTop: '2px solid #e2e8f0', paddingTop: '0.5rem' }}>
              <ValueRow 
                label="Celková daň na výstupu (DPH k odvodu)" 
                value={formatCZK(dph.total_tax)} 
                highlight={true} 
              />
              <ValueRow 
                label="Celkový obrat s DPH (Brutto)" 
                value={formatCZK(dph.total_gross)} 
              />
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Export Bridges Section */}
      <section>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: '#334155', fontWeight: 600 }}>
          Exportní můstky & Účetní balíčky
        </h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
          
          {/* POHODA XML */}
          <button 
            onClick={handleDownloadPohoda}
            disabled={isExportingPohoda}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1.25rem',
              backgroundColor: '#ffffff',
              border: '1px solid var(--color-border, #e2e8f0)',
              borderRadius: '10px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }} 
            onMouseOver={(e) => e.currentTarget.style.borderColor = '#eab308'}
            onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--color-border, #e2e8f0)'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ 
                backgroundColor: '#fef9c3', 
                color: '#ca8a04', 
                padding: '0.75rem', 
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <FileCode size={26} />
              </div>
              <div>
                <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '1rem' }}>
                  {isExportingPohoda ? 'Generuji XML...' : 'Exportovat POHODA XML'}
                </div>
                <div style={{ fontSize: '0.825rem', color: '#64748b', marginTop: '0.2rem' }}>
                  Stormware POHODA 2.0 dataPack (Vydané faktury a prodejky)
                </div>
              </div>
            </div>
            <Download size={20} color={isExportingPohoda ? '#eab308' : '#64748b'} className={isExportingPohoda ? 'animate-bounce' : ''} />
          </button>

          {/* CSV pro účetní */}
          <button 
            onClick={handleDownloadCsv}
            disabled={isExportingCsv}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1.25rem',
              backgroundColor: '#ffffff',
              border: '1px solid var(--color-border, #e2e8f0)',
              borderRadius: '10px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }} 
            onMouseOver={(e) => e.currentTarget.style.borderColor = '#10b981'}
            onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--color-border, #e2e8f0)'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ 
                backgroundColor: '#dcfce7', 
                color: '#16a34a', 
                padding: '0.75rem', 
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <FileSpreadsheet size={26} />
              </div>
              <div>
                <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '1rem' }}>
                  {isExportingCsv ? 'Generuji CSV...' : 'Exportovat CSV pro účetní'}
                </div>
                <div style={{ fontSize: '0.825rem', color: '#64748b', marginTop: '0.2rem' }}>
                  Strukturovaný deník prodejů pro Excel, Money S3 a Pohodu
                </div>
              </div>
            </div>
            <Download size={20} color={isExportingCsv ? '#10b981' : '#64748b'} className={isExportingCsv ? 'animate-bounce' : ''} />
          </button>

          {/* Printable Report Card */}
          <button 
            onClick={handlePrint}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1.25rem',
              backgroundColor: '#ffffff',
              border: '1px solid var(--color-border, #e2e8f0)',
              borderRadius: '10px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }} 
            onMouseOver={(e) => e.currentTarget.style.borderColor = '#ef4444'}
            onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--color-border, #e2e8f0)'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ 
                backgroundColor: '#fee2e2', 
                color: '#dc2626', 
                padding: '0.75rem', 
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <FileText size={26} />
              </div>
              <div>
                <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '1rem' }}>
                  Tisková sestava pro daňového poradce
                </div>
                <div style={{ fontSize: '0.825rem', color: '#64748b', marginTop: '0.2rem' }}>
                  Formátovaný tisk nebo uložení do PDF s podpisovým polem
                </div>
              </div>
            </div>
            <Printer size={20} color="#64748b" />
          </button>

        </div>
      </section>
    </div>
  );
}
