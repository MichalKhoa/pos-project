import React from 'react';
import { Package, AlertTriangle, ShieldAlert, TrendingUp, CheckCircle2, Download, Upload } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext';

export default function InventoryMetricsBar({
  totalTrackedCount = 0,
  healthyStockCount = 0,
  lowStockCount = 0,
  outOfStockCount = 0,
  totalValuation = 0,
  totalCostValuation = 0,
  healthyPct = 100,
  lowPct = 0,
  outPct = 0,
  showLowStockOnly = false,
  setShowLowStockOnly,
  onExportCSV,
  onImportCSVClick
}) {
  const { t } = useTranslation();

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        padding: '0.65rem 0.85rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
      }}
    >
      {/* Top horizontal metrics & actions strip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.65rem'
        }}
      >
        {/* Left: KPI indicators */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          {/* Total items badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0 0.85rem',
              height: '38px',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.84rem',
              fontWeight: '700',
              color: 'var(--text-secondary)'
            }}
          >
            <Package size={16} style={{ color: 'var(--accent-blue)' }} />
            <span>{t('inventory.tracked_items') || 'Sledované položky'}:</span>
            <strong style={{ color: 'var(--text-primary)', fontSize: '0.92rem' }}>{totalTrackedCount}</strong>
          </div>

          {/* Retail Valuation badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0 0.85rem',
              height: '38px',
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.84rem',
              fontWeight: '700'
            }}
          >
            <TrendingUp size={16} style={{ color: 'var(--accent-emerald)' }} />
            <span style={{ color: 'var(--text-muted)' }}>{t('inventory.valuation') || 'Hodnota'}:</span>
            <strong style={{ color: 'var(--accent-emerald)', fontSize: '0.92rem' }}>
              {Math.round(totalValuation).toLocaleString('cs-CZ')} Kč
            </strong>
            {totalCostValuation > 0 && (
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: '0.2rem' }}>
                (nákup: {Math.round(totalCostValuation).toLocaleString('cs-CZ')} Kč)
              </span>
            )}
          </div>

          {/* Low Stock interactive chip */}
          {setShowLowStockOnly && (
            <button
              type="button"
              onClick={() => setShowLowStockOnly(prev => !prev)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0 0.85rem',
                height: '38px',
                background: showLowStockOnly ? 'var(--accent-amber)' : (lowStockCount > 0 ? 'rgba(245, 158, 11, 0.12)' : 'var(--bg-input)'),
                color: showLowStockOnly ? '#000000' : (lowStockCount > 0 ? 'var(--accent-amber)' : 'var(--text-muted)'),
                border: `1px solid ${showLowStockOnly ? 'var(--accent-amber)' : (lowStockCount > 0 ? 'rgba(245, 158, 11, 0.35)' : 'var(--border-color)')}`,
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.84rem',
                fontWeight: '800',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title="Kliknutím vyfiltrujete položky pod minimálním stavem"
            >
              <AlertTriangle size={15} />
              <span>{t('inventory.low_stock') || 'Nízký stav'}:</span>
              <strong style={{ fontSize: '0.92rem' }}>{lowStockCount}</strong>
            </button>
          )}

          {/* Out of Stock badge */}
          {outOfStockCount > 0 && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0 0.85rem',
                height: '38px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.84rem',
                fontWeight: '800',
                color: 'var(--accent-rose)'
              }}
            >
              <ShieldAlert size={15} />
              <span>{t('inventory.out_of_stock') || 'Vyprodáno'}:</span>
              <strong style={{ fontSize: '0.92rem' }}>{outOfStockCount}</strong>
            </div>
          )}
        </div>

        {/* Right: CSV Actions & Stock Health summary */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginLeft: 'auto' }}>
          {onExportCSV && (
            <button
              type="button"
              onClick={onExportCSV}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                height: '38px',
                padding: '0 0.85rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title="Stáhnout skladové zásoby a položky do CSV pro Excel"
            >
              <Download size={15} />
              <span>{t('inventory.export_csv') || 'Exportovat CSV'}</span>
            </button>
          )}

          {onImportCSVClick && (
            <button
              type="button"
              onClick={onImportCSVClick}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                height: '38px',
                padding: '0 0.85rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title="Nahrát a hromadně aktualizovat položky z CSV"
            >
              <Upload size={15} />
              <span>{t('inventory.import_csv') || 'Importovat CSV'}</span>
            </button>
          )}

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-muted)', paddingLeft: '0.4rem' }}>
            <CheckCircle2 size={15} style={{ color: 'var(--accent-emerald)' }} />
            <span>{healthyStockCount} {t('inventory.in_stock') || 'v pořádku'}</span>
          </div>
        </div>
      </div>

      {/* Slim 4px visual health progress bar */}
      <div
        style={{
          display: 'flex',
          height: '4px',
          borderRadius: '2px',
          overflow: 'hidden',
          background: 'var(--bg-input)'
        }}
        title={`V pořádku: ${healthyPct.toFixed(0)}% • Dochází: ${lowPct.toFixed(0)}% • Vyprodáno: ${outPct.toFixed(0)}%`}
      >
        <div style={{ width: `${healthyPct}%`, background: 'var(--accent-emerald)', transition: 'width 0.3s' }} />
        <div style={{ width: `${lowPct}%`, background: 'var(--accent-amber)', transition: 'width 0.3s' }} />
        <div style={{ width: `${outPct}%`, background: 'var(--accent-rose)', transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}
