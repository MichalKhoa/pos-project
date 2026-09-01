import React from 'react';
import { Package, AlertTriangle, ShieldAlert, TrendingUp } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext';

export default function InventoryMetricsBar({
  totalTrackedCount,
  healthyStockCount,
  lowStockCount,
  outOfStockCount,
  totalValuation,
  healthyPct,
  lowPct,
  outPct
}) {
  const { t } = useTranslation();

  return (
    <div className="table-card" style={{ padding: '1.25rem' }}>
      <div className="metrics-grid" style={{ marginBottom: '1rem' }}>
        <div className="metric-card">
          <div className="metric-icon" style={{ background: 'var(--accent-blue)' }}>
            <Package size={22} />
          </div>
          <div className="metric-info">
            <span className="metric-label">{t('inventory.total_items')}</span>
            <span className="metric-value">{totalTrackedCount} položek</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon" style={{ background: 'var(--accent-emerald)' }}>
            <TrendingUp size={22} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Hodnota Skladu (v prodejních cenách)</span>
            <span className="metric-value" style={{ color: 'var(--accent-emerald)' }}>
              {totalValuation.toLocaleString('cs-CZ')} Kč
            </span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon" style={{ background: lowStockCount > 0 ? 'var(--accent-amber)' : 'rgba(255,255,255,0.1)' }}>
            <AlertTriangle size={22} />
          </div>
          <div className="metric-info">
            <span className="metric-label">{t('inventory.low_stock')}</span>
            <span className="metric-value" style={{ color: lowStockCount > 0 ? 'var(--accent-amber)' : 'inherit' }}>
              {lowStockCount} položek
            </span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon" style={{ background: outOfStockCount > 0 ? 'var(--accent-rose)' : 'rgba(255,255,255,0.1)' }}>
            <ShieldAlert size={22} />
          </div>
          <div className="metric-info">
            <span className="metric-label">{t('inventory.out_of_stock')}</span>
            <span className="metric-value" style={{ color: outOfStockCount > 0 ? 'var(--accent-rose)' : 'inherit' }}>
              {outOfStockCount} položek
            </span>
          </div>
        </div>
      </div>

      {/* Visual Stock Health Multi-Color Progress Bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-muted)' }}>
          <span>Zdraví skladu</span>
          <span>{healthyStockCount} v pořádku • {lowStockCount - outOfStockCount} dochází • {outOfStockCount} vyprodáno</span>
        </div>
        <div style={{ display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', background: 'var(--bg-input)' }}>
          <div style={{ width: `${healthyPct}%`, background: 'var(--accent-emerald)', transition: 'width 0.3s' }} title={`V pořádku: ${healthyPct.toFixed(0)}%`} />
          <div style={{ width: `${lowPct}%`, background: 'var(--accent-amber)', transition: 'width 0.3s' }} title={`Dochází: ${lowPct.toFixed(0)}%`} />
          <div style={{ width: `${outPct}%`, background: 'var(--accent-rose)', transition: 'width 0.3s' }} title={`Vyprodáno: ${outPct.toFixed(0)}%`} />
        </div>
      </div>
    </div>
  );
}
