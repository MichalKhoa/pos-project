import React, { useState } from 'react';
import { FileText, Calendar, DollarSign, Search, ChevronRight } from 'lucide-react';

const MOCK_Z_REPORTS = [
  { id: 'Z-2026-09-12-01', date: '2026-09-12 20:30', cashVariance: '0.00 CZK', grossTotal: '45,200 CZK' },
  { id: 'Z-2026-09-11-01', date: '2026-09-11 21:05', cashVariance: '+15.00 CZK', grossTotal: '52,100 CZK' },
  { id: 'Z-2026-09-10-01', date: '2026-09-10 20:15', cashVariance: '-5.00 CZK', grossTotal: '39,800 CZK' },
  { id: 'Z-2026-09-09-01', date: '2026-09-09 20:45', cashVariance: '0.00 CZK', grossTotal: '41,500 CZK' },
];

const MOCK_THERMAL_TAPE = `
      VOLTFLOW POS SYSTEM
      ===================
       Z-REPORT SUMMARY
      ===================
  ID: Z-2026-09-12-01
  Date: 2026-09-12 20:30:00
  Cashier: Admin
  
  -------------------------
  GROSS REVENUE: 45,200 CZK
  NET REVENUE:   37,355 CZK
  TAX (21%):      7,845 CZK
  -------------------------
  PAYMENTS
  Cash:          15,200 CZK
  Card:          30,000 CZK
  -------------------------
  CASH DRAWER
  Expected:      15,200 CZK
  Actual:        15,200 CZK
  Variance:           0 CZK
  
  ===================
  END OF REPORT
  ===================
`;

export default function ZReportsPage() {
  const [selectedReport, setSelectedReport] = useState(MOCK_Z_REPORTS[0]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', height: 'calc(100vh - 4rem)' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: 0 }}>Z-Reports</h1>
      
      <div style={{ display: 'flex', gap: '2rem', flex: 1, overflow: 'hidden' }}>
        {/* Z-Report Browser (Left) */}
        <div style={{ 
          flex: '1', 
          backgroundColor: 'var(--color-surface, #ffffff)', 
          borderRadius: '12px', 
          border: '1px solid var(--color-border, #e2e8f0)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--color-border, #e2e8f0)' }}>
            <h2 style={{ fontSize: '1.25rem', margin: '0 0 1rem 0' }}>Report History</h2>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', backgroundColor: 'var(--color-background, #f8fafc)', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--color-border, #e2e8f0)' }}>
              <Search size={18} color="var(--color-text-secondary, #64748b)" />
              <input 
                type="text" 
                placeholder="Search by ID or Date..." 
                style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%' }}
              />
            </div>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ backgroundColor: 'var(--color-background, #f8fafc)', position: 'sticky', top: 0 }}>
                <tr>
                  <th style={{ padding: '1rem', borderBottom: '1px solid var(--color-border, #e2e8f0)', fontWeight: 600, color: 'var(--color-text-secondary, #475569)' }}>ID</th>
                  <th style={{ padding: '1rem', borderBottom: '1px solid var(--color-border, #e2e8f0)', fontWeight: 600, color: 'var(--color-text-secondary, #475569)' }}>Date</th>
                  <th style={{ padding: '1rem', borderBottom: '1px solid var(--color-border, #e2e8f0)', fontWeight: 600, color: 'var(--color-text-secondary, #475569)' }}>Variance</th>
                  <th style={{ padding: '1rem', borderBottom: '1px solid var(--color-border, #e2e8f0)', fontWeight: 600, color: 'var(--color-text-secondary, #475569)' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_Z_REPORTS.map((report) => (
                  <tr 
                    key={report.id} 
                    onClick={() => setSelectedReport(report)}
                    style={{ 
                      cursor: 'pointer', 
                      backgroundColor: selectedReport.id === report.id ? 'var(--color-primary-light, #eff6ff)' : 'transparent',
                      borderBottom: '1px solid var(--color-border, #e2e8f0)',
                      transition: 'background-color 0.15s'
                    }}
                  >
                    <td style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500 }}><FileText size={16} color="var(--color-primary, #0052cc)"/> {report.id}</td>
                    <td style={{ padding: '1rem', color: 'var(--color-text-secondary, #475569)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Calendar size={14}/> {report.date}</span>
                    </td>
                    <td style={{ padding: '1rem', color: report.cashVariance.startsWith('-') ? 'var(--color-danger, #ef4444)' : report.cashVariance.startsWith('+') ? 'var(--color-success, #10b981)' : 'var(--color-text-secondary, #475569)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><DollarSign size={14}/> {report.cashVariance}</span>
                    </td>
                    <td style={{ padding: '1rem', fontWeight: 600 }}>{report.grossTotal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Digital Thermal Tape Viewer (Right) */}
        <div style={{ 
          width: '350px', 
          backgroundColor: '#f1f5f9', 
          borderRadius: '12px', 
          border: '1px solid var(--color-border, #e2e8f0)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '1.5rem'
        }}>
          <h2 style={{ fontSize: '1.1rem', margin: '0 0 1rem 0', alignSelf: 'flex-start' }}>Digital Tape Viewer</h2>
          <div style={{
            backgroundColor: '#ffffff',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            padding: '2rem 1rem',
            width: '300px',
            flex: 1,
            overflowY: 'auto',
            fontFamily: 'monospace, "Courier New", Courier',
            fontSize: '14px',
            lineHeight: '1.5',
            whiteSpace: 'pre-wrap',
            color: '#1e293b'
          }}>
            {MOCK_THERMAL_TAPE}
          </div>
        </div>
      </div>
    </div>
  );
}
