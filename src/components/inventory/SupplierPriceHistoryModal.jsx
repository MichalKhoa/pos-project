import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus, X, Building2, Calendar, FileText, Package, AlertCircle, Loader2 } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext';
import { fetchSupplierPriceHistory } from '../../api/posApi';

export default function SupplierPriceHistoryModal({
  isOpen,
  onClose,
  preset
}) {
  const { t } = useTranslation();
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !preset?.id) {
      setHistory([]);
      setError(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    fetchSupplierPriceHistory(preset.id)
      .then(data => {
        if (isMounted) {
          setHistory(Array.isArray(data) ? data : []);
        }
      })
      .catch(err => {
        if (isMounted) {
          setError(err.message || 'Nepodařilo se načíst historii nákupních cen.');
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, preset?.id]);

  if (!isOpen || !preset) return null;

  const currentStock = preset.stockQuantity !== undefined ? preset.stockQuantity : (preset.stock_quantity || 0);
  const currentCost = preset.costPrice !== undefined ? preset.costPrice : (preset.cost_price || 0);
  const unit = preset.unit || 'ks';

  const renderTrendBadge = (trend) => {
    if (trend === 'rose') {
      return (
        <span
          data-testid="trend-badge-rose"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            padding: '2px 8px',
            borderRadius: '999px',
            fontSize: '0.74rem',
            fontWeight: '800',
            color: 'var(--accent-rose)',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            whiteSpace: 'nowrap'
          }}
        >
          <TrendingUp size={12} />
          <span>↗ {t('stock_history.trend_rose') || 'Zdražení (+)'}</span>
        </span>
      );
    }
    if (trend === 'fell') {
      return (
        <span
          data-testid="trend-badge-fell"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            padding: '2px 8px',
            borderRadius: '999px',
            fontSize: '0.74rem',
            fontWeight: '800',
            color: 'var(--accent-emerald)',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            whiteSpace: 'nowrap'
          }}
        >
          <TrendingDown size={12} />
          <span>↘ {t('stock_history.trend_fell') || 'Zlevnění (-)'}</span>
        </span>
      );
    }
    return (
      <span
        data-testid="trend-badge-stable"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem',
          padding: '2px 8px',
          borderRadius: '999px',
          fontSize: '0.74rem',
          fontWeight: '700',
          color: 'var(--text-muted)',
          background: 'var(--bg-input)',
          border: '1px solid var(--border-color)',
          whiteSpace: 'nowrap'
        }}
      >
        <Minus size={12} />
        <span>→ {t('stock_history.trend_stable') || 'Stabilní'}</span>
      </span>
    );
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(4px)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90dvh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4)',
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
            background: 'var(--bg-input)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(59, 130, 246, 0.15)',
                color: 'var(--accent-blue)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <TrendingUp size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                {t('stock_history.modal_title') || 'Historie nákupních cen dodavatelů'}
              </h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {preset.name} • {t('stock_history.stock_label') || 'Sklad'}: <strong style={{ color: 'var(--text-primary)' }}>{currentStock} {unit}</strong> • {t('stock_history.vap_cost_label') || 'VAP cena'}: <strong style={{ color: 'var(--accent-emerald)' }}>{Number(currentCost).toFixed(2)} Kč bez DPH</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '0.4rem',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '44px',
              minHeight: '44px'
            }}
            title={t('common.close') || 'Zavřít'}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {isLoading && (
            <div style={{ padding: '3rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', color: 'var(--text-muted)' }}>
              <Loader2 size={28} className="spin-animate" style={{ color: 'var(--accent-blue)' }} />
              <span style={{ fontSize: '0.88rem', fontWeight: '600' }}>
                {t('common.loading') || 'Načítám historii cen...'}
              </span>
            </div>
          )}

          {error && !isLoading && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.85rem 1rem',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(239, 68, 68, 0.15)',
                color: 'var(--accent-rose)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                fontSize: '0.86rem',
                fontWeight: '700'
              }}
            >
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {!isLoading && !error && history.length === 0 && (
            <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              <Package size={36} style={{ margin: '0 auto 0.75rem auto', opacity: 0.4 }} />
              <div>{t('stock_history.empty') || 'Zatím žádná historie naskladnění pro tento produkt.'}</div>
            </div>
          )}

          {!isLoading && !error && history.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {history.map((item, idx) => {
                const dt = item.timestamp ? new Date(item.timestamp) : null;
                const formattedDate = dt && !isNaN(dt.getTime())
                  ? dt.toLocaleString('cs-CZ', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })
                  : '—';

                return (
                  <div
                    key={item.id || idx}
                    data-testid="price-history-row"
                    style={{
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      padding: '0.85rem 1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem'
                    }}
                  >
                    {/* Top Row: Date, Trend badge, Unit cost */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Calendar size={15} style={{ color: 'var(--text-muted)' }} />
                        <span style={{ fontSize: '0.86rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                          {formattedDate}
                        </span>
                        {renderTrendBadge(item.trend)}
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '1rem', fontWeight: '900', color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>
                          {Number(item.unit_cost || 0).toFixed(2)} Kč
                        </span>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginLeft: '0.3rem' }}>
                          / {unit} bez DPH
                        </span>
                      </div>
                    </div>

                    {/* Middle Row: Supplier info & Document Ref & Quantity delta */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Building2 size={14} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
                        <span>
                          {item.supplier_name || 'Dodavatel neuveden'}
                          {item.supplier_ico ? ` (IČO: ${item.supplier_ico})` : ''}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {item.document_ref && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-muted)' }}>
                            <FileText size={13} />
                            <span>{item.document_ref}</span>
                          </span>
                        )}
                        <span style={{ fontWeight: '800', color: 'var(--accent-blue)', background: 'rgba(59, 130, 246, 0.1)', padding: '1px 7px', borderRadius: '4px' }}>
                          +{item.quantity_delta} {unit}
                        </span>
                      </div>
                    </div>

                    {item.note && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        {item.note}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '0.75rem 1.25rem',
            borderTop: '1px solid var(--border-color)',
            background: 'var(--bg-input)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end'
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              height: '44px',
              padding: '0 1.25rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              fontSize: '0.88rem',
              fontWeight: '700',
              cursor: 'pointer',
              minWidth: '88px',
              minHeight: '44px'
            }}
          >
            {t('common.close') || 'Zavřít'}
          </button>
        </div>
      </div>
    </div>
  );
}
