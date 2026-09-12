import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  FileText, 
  Calendar, 
  Search, 
  RefreshCw, 
  Printer, 
  Copy, 
  Check, 
  CheckCircle2, 
  AlertTriangle 
} from 'lucide-react';
import { cloudApi } from '../api/cloudApi';

const FALLBACK_Z_REPORTS = [
  {
    id: 'shift-104',
    z_seq: 104,
    shift_number: 1,
    opened_at: '2026-09-12 08:00:00',
    closed_at: '2026-09-12 20:30:00',
    opening_cash: '5000.00',
    expected_cash: '20200.00',
    actual_cash: '20200.00',
    discrepancy: '0.00',
    is_closed: true,
    gross_total: 45200,
    card_sales: 30000,
  },
  {
    id: 'shift-103',
    z_seq: 103,
    shift_number: 1,
    opened_at: '2026-09-11 08:00:00',
    closed_at: '2026-09-11 21:05:00',
    opening_cash: '5000.00',
    expected_cash: '22100.00',
    actual_cash: '22115.00',
    discrepancy: '15.00',
    is_closed: true,
    gross_total: 52100,
    card_sales: 35000,
  },
  {
    id: 'shift-102',
    z_seq: 102,
    shift_number: 1,
    opened_at: '2026-09-10 08:00:00',
    closed_at: '2026-09-10 20:15:00',
    opening_cash: '5000.00',
    expected_cash: '19800.00',
    actual_cash: '19795.00',
    discrepancy: '-5.00',
    is_closed: true,
    gross_total: 39800,
    card_sales: 25000,
  },
  {
    id: 'shift-101',
    z_seq: 101,
    shift_number: 1,
    opened_at: '2026-09-09 08:00:00',
    closed_at: '2026-09-09 20:45:00',
    opening_cash: '5000.00',
    expected_cash: '21500.00',
    actual_cash: '21500.00',
    discrepancy: '0.00',
    is_closed: true,
    gross_total: 41500,
    card_sales: 25000,
  },
];

function formatThermalTape(report) {
  if (!report) return 'Žádná uzávěrka k zobrazení';

  const zSeq = report.z_seq ? `#${report.z_seq}` : (report.shift_number ? `#${report.shift_number}` : report.id);
  const openTime = report.opened_at || '-';
  const closeTime = report.closed_at || report.date || 'Probíhající směna';
  const isClosed = report.is_closed ?? true;

  const openCash = parseFloat(report.opening_cash || 0);
  const expCash = parseFloat(report.expected_cash || 0);
  const actCash = report.actual_cash !== null && report.actual_cash !== undefined 
    ? parseFloat(report.actual_cash) 
    : expCash;
  const variance = report.discrepancy !== null && report.discrepancy !== undefined 
    ? parseFloat(report.discrepancy) 
    : (actCash - expCash);

  const cashSales = Math.max(0, expCash - openCash);
  const cardSales = parseFloat(report.card_sales || report.card || 0);
  const grossRev = report.gross_total 
    ? parseFloat(report.gross_total) 
    : (cashSales + cardSales > 0 ? (cashSales + cardSales) : expCash);

  const vat21Base = report.vat_21_base 
    ? parseFloat(report.vat_21_base) 
    : Math.round((grossRev / 1.21) * 100) / 100;
  const vat21Tax = report.vat_21_tax 
    ? parseFloat(report.vat_21_tax) 
    : Math.round((grossRev - vat21Base) * 100) / 100;
  const vat12Base = parseFloat(report.vat_12_base || 0);
  const vat12Tax = parseFloat(report.vat_12_tax || 0);
  const vat0Base = parseFloat(report.vat_0_base || 0);

  const fmt = (v) => Number(v).toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' CZK';
  const fmtVar = (v) => {
    const num = Number(v);
    const prefix = num > 0 ? '+' : '';
    return prefix + num.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' CZK';
  };

  const line = '---------------------------------';
  const doubleLine = '=================================';

  return `      VOLTFLOW POS SYSTEM
${doubleLine}
       DENNÍ Z-UZÁVĚRKA
${doubleLine}
Doklad:      ${report.id}
Z-Sekvence:  ${zSeq}
Směna č.:    ${report.shift_number || 1}
Otevřeno:    ${openTime}
Uzavřeno:    ${closeTime}
Pokladník:   ${report.cashier || 'Admin / Hlavní pokladna'}
Stav směny:  ${isClosed ? 'UZAVŘENO (Z-Stav)' : 'OTEVŘENO (X-Mezisoučet)'}

${line}
TRŽBY CELKEM (REVENUE)
Hrubý obrat:       ${fmt(grossRev)}
Základ daně (net): ${fmt(vat21Base + vat12Base + vat0Base)}
Celkem DPH:        ${fmt(vat21Tax + vat12Tax)}
${line}
ROZPIS DPH (VAT TIERS)
Sazba 21% základ:  ${fmt(vat21Base)}
Sazba 21% DPH:     ${fmt(vat21Tax)}
Sazba 12% základ:  ${fmt(vat12Base)}
Sazba 12% DPH:     ${fmt(vat12Tax)}
Sazba  0% osvob.:  ${fmt(vat0Base)}
${line}
ROZPIS TRŽEB DLE PLATIDEL
Hotovost:          ${fmt(cashSales)}
Platební karty:    ${fmt(cardSales)}
${line}
HOTOVOSTNÍ POKLADNA (DRAWER)
Počáteční vklad:   ${fmt(openCash)}
Očekávaný stav:    ${fmt(expCash)}
Skutečný stav:     ${fmt(actCash)}
Rozdíl (Manko/Př): ${fmtVar(variance)}
${variance === 0 
    ? '>>> HOTOVOST V POŘÁDKU (0 CZK) <<<' 
    : variance < 0 
      ? '>>> POZOR: ZJIŠTĚNO MANKO! <<<' 
      : '>>> PŘEBYTEK HOTOVOSTI <<<'
}
${doubleLine}
       KONEC TISKOVÉHO ZÁZNAMU
${doubleLine}`;
}

export default function ZReportsPage() {
  const [reports, setReports] = useState(FALLBACK_Z_REPORTS);
  const [selectedReport, setSelectedReport] = useState(FALLBACK_Z_REPORTS[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await cloudApi.getZReports(50);
      if (Array.isArray(data) && data.length > 0) {
        setReports(data);
        setSelectedReport(prev => {
          if (!prev || !data.some(r => r.id === prev.id)) {
            return data[0];
          }
          return prev;
        });
      }
    } catch (err) {
      console.warn('Failed to load Z-reports from API, keeping fallback list:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const filteredReports = useMemo(() => {
    if (!searchTerm.trim()) return reports;
    const q = searchTerm.toLowerCase();
    return reports.filter(r => {
      const idMatch = String(r.id || '').toLowerCase().includes(q);
      const zSeqMatch = String(r.z_seq || '').toLowerCase().includes(q);
      const dateMatch = String(r.closed_at || r.opened_at || r.date || '').toLowerCase().includes(q);
      return idMatch || zSeqMatch || dateMatch;
    });
  }, [reports, searchTerm]);

  const tapeContent = useMemo(() => {
    return formatThermalTape(selectedReport);
  }, [selectedReport]);

  const handleCopyTape = () => {
    navigator.clipboard.writeText(tapeContent);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handlePrintTape = () => {
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Z-Report ${selectedReport?.z_seq || selectedReport?.id || ''}</title>
          <style>
            body { font-family: monospace; font-size: 13px; line-height: 1.4; padding: 20px; white-space: pre-wrap; }
          </style>
        </head>
        <body>${tapeContent}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  const renderVarianceBadge = (report) => {
    const v = parseFloat(report.discrepancy || 0);
    if (v === 0) {
      return (
        <span style={{ 
          display: 'inline-flex', 
          alignItems: 'center', 
          gap: '0.25rem', 
          color: '#64748b', 
          fontSize: '0.85rem' 
        }}>
          <CheckCircle2 size={13} color="#10b981" /> 0,00 CZK
        </span>
      );
    }
    if (v < 0) {
      return (
        <span style={{ 
          display: 'inline-flex', 
          alignItems: 'center', 
          gap: '0.25rem', 
          color: '#ef4444', 
          fontWeight: 600, 
          fontSize: '0.85rem',
          backgroundColor: '#fee2e2',
          padding: '0.15rem 0.45rem',
          borderRadius: '4px'
        }}>
          <AlertTriangle size={13} /> {v.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} CZK
        </span>
      );
    }
    return (
      <span style={{ 
        display: 'inline-flex', 
        alignItems: 'center', 
        gap: '0.25rem', 
        color: '#16a34a', 
        fontWeight: 600, 
        fontSize: '0.85rem',
        backgroundColor: '#dcfce7',
        padding: '0.15rem 0.45rem',
        borderRadius: '4px'
      }}>
        +{v.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} CZK
      </span>
    );
  };

  const getReportTotalDisplay = (report) => {
    if (report.gross_total) {
      return Number(report.gross_total).toLocaleString('cs-CZ', { minimumFractionDigits: 2 }) + ' CZK';
    }
    const exp = parseFloat(report.expected_cash || 0);
    const open = parseFloat(report.opening_cash || 0);
    const card = parseFloat(report.card_sales || report.card || 0);
    const gross = Math.max(0, exp - open) + card;
    return (gross > 0 ? gross : exp).toLocaleString('cs-CZ', { minimumFractionDigits: 2 }) + ' CZK';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: 'calc(100vh - 4rem)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: 0 }}>Z-Reports & Pásky uzávěrek</h1>
          <p style={{ color: 'var(--color-text-secondary, #64748b)', margin: '0.25rem 0 0 0', fontSize: '0.95rem' }}>
            Přehled uzavřených směn, kontrola pokladního manka/přebytku a digitální kopie termopásky.
          </p>
        </div>
        <button
          onClick={fetchReports}
          disabled={isLoading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.6rem 1rem',
            backgroundColor: 'var(--color-surface, #ffffff)',
            border: '1px solid var(--color-border, #e2e8f0)',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: 500,
            color: 'var(--color-text, #0f172a)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          {isLoading ? 'Načítám...' : 'Aktualizovat'}
        </button>
      </div>
      
      <div style={{ display: 'flex', gap: '1.75rem', flex: 1, overflow: 'hidden' }}>
        {/* Z-Report Browser (Left) */}
        <div style={{ 
          flex: '1', 
          backgroundColor: 'var(--color-surface, #ffffff)', 
          borderRadius: '12px', 
          border: '1px solid var(--color-border, #e2e8f0)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--color-border, #e2e8f0)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h2 style={{ fontSize: '1.15rem', margin: 0, fontWeight: 600 }}>Historie směn ({filteredReports.length})</h2>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', backgroundColor: 'var(--color-background, #f8fafc)', padding: '0.5rem 0.85rem', borderRadius: '8px', border: '1px solid var(--color-border, #e2e8f0)' }}>
              <Search size={18} color="var(--color-text-secondary, #64748b)" />
              <input 
                type="text" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filtrovat dle Z-čísla (#104), ID nebo data..." 
                style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '0.9rem' }}
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '0.8rem' }}
                >
                  Zrušit
                </button>
              )}
            </div>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead style={{ backgroundColor: 'var(--color-background, #f8fafc)', position: 'sticky', top: 0, zIndex: 1 }}>
                <tr>
                  <th style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--color-border, #e2e8f0)', fontWeight: 600, color: 'var(--color-text-secondary, #475569)' }}>Z-Číslo / ID</th>
                  <th style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--color-border, #e2e8f0)', fontWeight: 600, color: 'var(--color-text-secondary, #475569)' }}>Datum uzávěrky</th>
                  <th style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--color-border, #e2e8f0)', fontWeight: 600, color: 'var(--color-text-secondary, #475569)' }}>Rozdíl kasy</th>
                  <th style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--color-border, #e2e8f0)', fontWeight: 600, color: 'var(--color-text-secondary, #475569)', textAlign: 'right' }}>Hrubá tržba</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
                      Nenalezeny žádné Z-uzávěrky odpovídající filtru.
                    </td>
                  </tr>
                ) : (
                  filteredReports.map((report) => {
                    const isSelected = selectedReport && selectedReport.id === report.id;
                    const dateDisplay = report.closed_at || report.opened_at || report.date || 'Neznámé datum';
                    const seqLabel = report.z_seq ? `Z-#${report.z_seq}` : (report.shift_number ? `Směna #${report.shift_number}` : report.id);

                    return (
                      <tr 
                        key={report.id} 
                        onClick={() => setSelectedReport(report)}
                        style={{ 
                          cursor: 'pointer', 
                          backgroundColor: isSelected ? 'var(--color-primary-light, #eff6ff)' : 'transparent',
                          borderBottom: '1px solid var(--color-border, #e2e8f0)',
                          borderLeft: isSelected ? '4px solid var(--color-primary, #0052cc)' : '4px solid transparent',
                          transition: 'all 0.15s'
                        }}
                      >
                        <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: isSelected ? 'var(--color-primary, #0052cc)' : '#1e293b' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <FileText size={16} color={isSelected ? 'var(--color-primary, #0052cc)' : '#64748b'} />
                            <span>{seqLabel}</span>
                          </div>
                        </td>
                        <td style={{ padding: '0.85rem 1rem', color: 'var(--color-text-secondary, #475569)' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <Calendar size={14} /> {dateDisplay}
                          </span>
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          {renderVarianceBadge(report)}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: 600, textAlign: 'right', color: '#0f172a' }}>
                          {getReportTotalDisplay(report)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Digital Thermal Tape Viewer (Right) */}
        <div style={{ 
          width: '380px', 
          backgroundColor: '#f8fafc', 
          borderRadius: '12px', 
          border: '1px solid var(--color-border, #e2e8f0)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '1.25rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h2 style={{ fontSize: '1.05rem', margin: 0, fontWeight: 600, color: '#334155' }}>
              Termopáska {selectedReport?.z_seq ? `#${selectedReport.z_seq}` : ''}
            </h2>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button 
                onClick={handleCopyTape}
                title="Kopírovat text"
                style={{ 
                  background: '#ffffff', 
                  border: '1px solid #cbd5e1', 
                  borderRadius: '6px', 
                  padding: '0.35rem 0.6rem', 
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  fontSize: '0.75rem',
                  color: '#475569'
                }}
              >
                {isCopied ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                {isCopied ? 'Zkopírováno' : 'Kopírovat'}
              </button>
              <button 
                onClick={handlePrintTape}
                title="Vytisknout termopásku"
                style={{ 
                  background: '#ffffff', 
                  border: '1px solid #cbd5e1', 
                  borderRadius: '6px', 
                  padding: '0.35rem 0.6rem', 
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  fontSize: '0.75rem',
                  color: '#475569'
                }}
              >
                <Printer size={14} /> Tisk
              </button>
            </div>
          </div>

          <div style={{
            backgroundColor: '#ffffff',
            boxShadow: '0 4px 10px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.05)',
            border: '1px solid #e2e8f0',
            borderRadius: '4px',
            padding: '1.5rem 1rem',
            width: '100%',
            boxSizing: 'border-box',
            flex: 1,
            overflowY: 'auto',
            fontFamily: 'Consolas, Monaco, "Courier New", monospace',
            fontSize: '12.5px',
            lineHeight: '1.45',
            whiteSpace: 'pre-wrap',
            color: '#1e293b'
          }}>
            {tapeContent}
          </div>
        </div>
      </div>
    </div>
  );
}
