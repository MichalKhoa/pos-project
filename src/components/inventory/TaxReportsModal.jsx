import React, { useState, useEffect } from 'react';
import { X, FileText, Printer, Calendar, TrendingUp, TrendingDown, DollarSign, PieChart, ShieldAlert } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext';

export default function TaxReportsModal({ isOpen, onClose }) {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [activeTab, setActiveTab] = useState('dpfo'); // 'dpfo' | 'vat'
  const [taxData, setTaxData] = useState(null);
  const [vatData, setVatData] = useState(null);
  const [vatPeriod, setVatPeriod] = useState('FULL_YEAR');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const fetchTaxStatement = async (year) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/v1/reports/tax-statement?year=${year}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Nepodařilo se načíst daňové podklady.');
      }
      const data = await res.json();
      setTaxData(data);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchVatOverview = async (year, period) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/v1/reports/vat-overview?year=${year}&period=${period}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Nepodařilo se načíst přehled DPH.');
      }
      const data = await res.json();
      setVatData(data);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (activeTab === 'dpfo') {
        fetchTaxStatement(selectedYear);
      } else {
        fetchVatOverview(selectedYear, vatPeriod);
      }
    }
  }, [isOpen, selectedYear, activeTab, vatPeriod]);

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  const yearOptions = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        maxWidth: '100vw',
        maxHeight: '100dvh'
      }}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          color: 'var(--text-primary)',
          borderRadius: 'var(--radius-lg, 12px)',
          border: '1px solid var(--border-color)',
          width: '100%',
          maxWidth: '960px',
          maxHeight: '90dvh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-card-hover, rgba(255, 255, 255, 0.03))'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <FileText size={22} style={{ color: 'var(--accent-blue)' }} />
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
                {t('inventory.tax_reports_title') || 'Daňové přehledy & Příloha č. 1 DPFO (§ 7b ZDP)'}
              </h2>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {t('inventory.tax_reports_subtitle') || 'Oficiální podklady pro daňové přiznání k dani z příjmů a DPH z pokladního systému'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {/* Year Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'var(--bg-input)', padding: '0 0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
              <Calendar size={15} style={{ color: 'var(--text-secondary)' }} />
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(parseInt(e.target.value, 10))}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-primary)',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  height: '38px',
                  cursor: 'pointer'
                }}
              >
                {yearOptions.map(y => (
                  <option key={y} value={y} style={{ background: 'var(--bg-card)' }}>Rok {y}</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handlePrint}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                height: '38px',
                padding: '0 0.85rem',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--accent-blue)',
                color: '#fff',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer'
              }}
              title="Vytisknout sestavu"
            >
              <Printer size={15} />
              <span>Tisk</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '0.5rem',
                borderRadius: 'var(--radius-md)',
                minWidth: '40px',
                minHeight: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-input)' }}>
          <button
            type="button"
            onClick={() => setActiveTab('dpfo')}
            style={{
              padding: '0.75rem 1.25rem',
              fontWeight: 700,
              fontSize: '0.88rem',
              border: 'none',
              borderBottom: activeTab === 'dpfo' ? '2px solid var(--accent-blue)' : '2px solid transparent',
              background: activeTab === 'dpfo' ? 'var(--bg-card)' : 'transparent',
              color: activeTab === 'dpfo' ? 'var(--accent-blue)' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem'
            }}
          >
            <DollarSign size={16} />
            <span>Příloha č. 1 DPFO (Příjmy & Výdaje)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('vat')}
            style={{
              padding: '0.75rem 1.25rem',
              fontWeight: 700,
              fontSize: '0.88rem',
              border: 'none',
              borderBottom: activeTab === 'vat' ? '2px solid var(--accent-blue)' : '2px solid transparent',
              background: activeTab === 'vat' ? 'var(--bg-card)' : 'transparent',
              color: activeTab === 'vat' ? 'var(--accent-blue)' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem'
            }}
          >
            <PieChart size={16} />
            <span>Přehled DPH (21%, 12%, 0%)</span>
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '1.25rem', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {errorMsg && (
            <div style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--accent-rose)', border: '1px solid var(--accent-rose)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', fontSize: '0.88rem', fontWeight: 600 }}>
              {errorMsg}
            </div>
          )}

          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
              Načítám daňové údaje za rok {selectedYear}...
            </div>
          ) : activeTab === 'dpfo' && taxData ? (
            /* DPFO TAB */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Top Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
                {/* Net Revenue */}
                <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-emerald)', fontSize: '0.82rem', fontWeight: 700 }}>
                    <TrendingUp size={16} />
                    <span>Zdanitelné příjmy (§ 7 ZDP)</span>
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, marginTop: '0.35rem', color: 'var(--accent-emerald)' }}>
                    {taxData.revenue?.net_revenue?.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    Tržby {taxData.revenue?.total_sales?.toFixed(0)} Kč − Vratky {taxData.revenue?.total_refunds?.toFixed(0)} Kč
                  </div>
                </div>

                {/* Deductible Expenses */}
                <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-amber)', fontSize: '0.82rem', fontWeight: 700 }}>
                    <TrendingDown size={16} />
                    <span>Daňově uznatelné výdaje</span>
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, marginTop: '0.35rem', color: 'var(--accent-amber)' }}>
                    {taxData.expenses?.total_deductible_expenses?.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    Nákup zboží {taxData.expenses?.goods_intake_expenses?.toFixed(0)} Kč + Výdaje {taxData.expenses?.cash_payouts_expenses?.toFixed(0)} Kč
                  </div>
                </div>

                {/* Operating Result */}
                <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-blue)', fontSize: '0.82rem', fontWeight: 700 }}>
                    <DollarSign size={16} />
                    <span>Dílčí základ daně (§ 7)</span>
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, marginTop: '0.35rem', color: 'var(--accent-blue)' }}>
                    {taxData.operating_profit_tax_base?.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    Příjmy minus daňové výdaje
                  </div>
                </div>
              </div>

              {/* Table: Tabulka D - Údaje o zásobách (§ 7b ZDP) */}
              <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', fontWeight: 800, fontSize: '0.92rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Příloha č. 1, Tabulka D: Stav zásob na začátku a konci zdaňovacího období</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Ocenění v pořizovacích cenách</span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '0.65rem 1rem', textAlign: 'left' }}>Položka daňové evidence</th>
                      <th style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>Stav k 1. 1. {selectedYear}</th>
                      <th style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>Stav k 31. 12. {selectedYear}</th>
                      <th style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>Změna stavu zásob</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Zásoby zboží a materiálu na skladě</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700 }}>
                        {taxData.inventory_valuation?.opening_inventory_valuation?.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700 }}>
                        {taxData.inventory_valuation?.closing_inventory_valuation?.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 800, color: (taxData.inventory_valuation?.inventory_difference || 0) >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                        {(taxData.inventory_valuation?.inventory_difference || 0) >= 0 ? '+' : ''}
                        {taxData.inventory_valuation?.inventory_difference?.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Note / Disclaimer */}
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <ShieldAlert size={14} />
                <span>
                  Hodnoty vycházejí z evidence naskladněných položek (příjemek), hotovostních plateb pokladny a evidence skladových pohybů k 31.12.
                </span>
              </div>
            </div>
          ) : activeTab === 'vat' && vatData ? (
            /* VAT TAB */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Period Filter Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Období DPH:</span>
                {['FULL_YEAR', 'Q1', 'Q2', 'Q3', 'Q4'].map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setVatPeriod(p)}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      border: `1px solid ${vatPeriod === p ? 'var(--accent-blue)' : 'var(--border-color)'}`,
                      background: vatPeriod === p ? 'var(--accent-blue)' : 'var(--bg-input)',
                      color: vatPeriod === p ? '#fff' : 'var(--text-primary)',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: 'pointer'
                    }}
                  >
                    {p === 'FULL_YEAR' ? 'Celý rok' : p}
                  </button>
                ))}
              </div>

              {/* VAT Breakdown Table */}
              <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', fontWeight: 800, fontSize: '0.92rem' }}>
                  Rozpis DPH podle sazeb (§ 47 ZDPH) — {vatPeriod === 'FULL_YEAR' ? `Rok ${selectedYear}` : `${vatPeriod}/${selectedYear}`}
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '0.65rem 1rem', textAlign: 'left' }}>Sazba DPH</th>
                      <th style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>Základ daně (Kč)</th>
                      <th style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>Vypočtená daň (Kč)</th>
                      <th style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>Celkem s DPH (Kč)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vatData.rates && Object.entries(vatData.rates).map(([rateKey, vals]) => {
                      const gross = (vals.base || 0) + (vals.vat || 0);
                      return (
                        <tr key={rateKey} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>
                            {rateKey === '0%' ? 'Osvobozeno / 0%' : `Sazba ${rateKey}`}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600 }}>
                            {vals.base?.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč
                          </td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600, color: 'var(--accent-blue)' }}>
                            {vals.vat?.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč
                          </td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700 }}>
                            {gross?.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč
                          </td>
                        </tr>
                      );
                    })}
                    <tr style={{ background: 'rgba(59, 130, 246, 0.05)', fontWeight: 800 }}>
                      <td style={{ padding: '0.85rem 1rem' }}>CELKEM</td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                        {vatData.total_base?.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right', color: 'var(--accent-blue)' }}>
                        {vatData.total_vat?.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right', color: 'var(--accent-emerald)', fontSize: '1rem' }}>
                        {vatData.total_gross?.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
