import React from 'react';
import { DollarSign, Banknote, CreditCard, Receipt, TrendingUp } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext.jsx';

export default function SalesMetricsCards({ metrics }) {
  const { t } = useTranslation();

  return (
    <div className="metrics-grid">
      <div className="metric-card">
        <div className="metric-icon" style={{ background: 'var(--accent-emerald)' }}>
          <DollarSign size={24} />
        </div>
        <div className="metric-info">
          <span className="metric-label">{t('history.revenue')}</span>
          <span className="metric-value" style={{ color: 'var(--accent-emerald)' }}>
            {metrics.totalRevenue.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kč
          </span>
        </div>
      </div>

      <div className="metric-card">
        <div className="metric-icon" style={{ background: 'var(--accent-amber)' }}>
          <Banknote size={24} />
        </div>
        <div className="metric-info">
          <span className="metric-label">{t('history.cash_revenue')}</span>
          <span className="metric-value">
            {metrics.cashRevenue.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kč
          </span>
        </div>
      </div>

      <div className="metric-card">
        <div className="metric-icon" style={{ background: 'var(--accent-blue)' }}>
          <CreditCard size={24} />
        </div>
        <div className="metric-info">
          <span className="metric-label">{t('history.card_revenue')}</span>
          <span className="metric-value">
            {metrics.cardRevenue.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kč
          </span>
        </div>
      </div>

      <div className="metric-card">
        <div className="metric-icon" style={{ background: 'var(--accent-purple)' }}>
          <Receipt size={24} />
        </div>
        <div className="metric-info">
          <span className="metric-label">{t('history.txn_count')}</span>
          <span className="metric-value">{metrics.txnCount}</span>
        </div>
      </div>

      <div className="metric-card">
        <div className="metric-icon" style={{ background: 'var(--accent-indigo, #6366f1)' }}>
          <TrendingUp size={24} />
        </div>
        <div className="metric-info">
          <span className="metric-label">{t('history.avg_receipt')}</span>
          <span className="metric-value">
            {metrics.avgTicket.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kč
          </span>
        </div>
      </div>
    </div>
  );
}
