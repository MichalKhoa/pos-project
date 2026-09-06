import React, { useEffect } from 'react';
import { Search, X, Plus, Barcode, Layers, Percent, Package, AlertCircle } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext.jsx';
import { soundFx } from '../utils/audio.js';

export default function PriceCheckModal({
  item = null,
  unknownBarcode = null,
  categories = [],
  onAddToCart,
  onCreateProduct,
  onClose
}) {
  const { t } = useTranslation();

  // Keyboard shortcut support: Escape to close, Enter to add to cart
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter' && item) {
        e.preventDefault();
        soundFx.playScanChime();
        if (onAddToCart) onAddToCart(item);
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [item, onAddToCart, onClose]);

  const categoryName = React.useMemo(() => {
    if (!item || !item.category) return '';
    const found = (categories || []).find(c => c.id === item.category);
    return found ? found.name : item.category;
  }, [item, categories]);

  const rawPrice = item ? parseFloat(item.price || 0) : 0;
  const vatRate = item && item.vat !== undefined && item.vat !== null ? parseInt(item.vat, 10) : 21;
  const barcode = item ? item.barcode : (unknownBarcode || '');

  // Stock status
  const hasTrackStock = Boolean(item && (item.trackStock || item.track_stock));
  const stockQty = item ? (item.stockQuantity !== undefined ? item.stockQuantity : (item.stock_quantity !== undefined ? item.stock_quantity : null)) : null;
  const isOutOfStock = hasTrackStock && stockQty !== null && stockQty <= 0;

  return (
    <div className="modal-overlay price-check-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-card price-check-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '520px',
          width: '92vw',
          background: 'var(--bg-secondary, #1e293b)',
          border: '2px solid var(--accent-blue, #3b82f6)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5), 0 0 25px rgba(59, 130, 246, 0.25)',
          borderRadius: 'var(--radius-lg, 16px)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div
          className="modal-header"
          style={{
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.05) 100%)',
            padding: '1rem 1.25rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'var(--accent-blue, #3b82f6)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Search size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-primary, #ffffff)' }}>
                {t('price_check.modal_title')}
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>
                {t('price_check.toggle_short')} • VoltFlow POS
              </span>
            </div>
          </div>

          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label={t('price_check.close')}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              borderRadius: '8px',
              color: 'var(--text-secondary, #94a3b8)',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body Content */}
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {item ? (
            <>
              {/* Product Title & Category */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                  {categoryName && (
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        background: 'rgba(59, 130, 246, 0.15)',
                        color: 'var(--accent-blue, #60a5fa)',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}
                    >
                      <Layers size={11} />
                      {categoryName}
                    </span>
                  )}
                  {barcode && (
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontFamily: 'var(--font-mono, monospace)',
                        color: 'var(--text-secondary, #94a3b8)',
                        background: 'rgba(255, 255, 255, 0.05)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}
                    >
                      <Barcode size={12} />
                      {barcode}
                    </span>
                  )}
                </div>

                <div
                  className="price-check-item-name"
                  style={{
                    fontSize: '1.45rem',
                    fontWeight: '900',
                    color: 'var(--text-primary, #ffffff)',
                    lineHeight: '1.25',
                    wordBreak: 'break-word'
                  }}
                >
                  {item.name}
                </div>
              </div>

              {/* High-Contrast Bold Price Card */}
              <div
                className="price-check-hero-card"
                style={{
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.04) 100%)',
                  border: '2px solid var(--accent-emerald, #10b981)',
                  borderRadius: '12px',
                  padding: '1.25rem 1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: 'inset 0 1px 2px rgba(255, 255, 255, 0.08)'
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: '0.82rem',
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      color: 'var(--accent-emerald, #34d399)'
                    }}
                  >
                    {t('price_check.price_label')}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #94a3b8)' }}>
                    Včetně DPH ({vatRate}%)
                  </div>
                </div>

                <div
                  className="price-check-bold-price"
                  style={{
                    fontSize: '2.5rem',
                    fontWeight: '900',
                    color: 'var(--accent-emerald, #10b981)',
                    fontFamily: 'var(--font-mono, monospace)',
                    letterSpacing: '-0.5px'
                  }}
                >
                  {rawPrice.toFixed(2)} <span style={{ fontSize: '1.5rem', fontWeight: '700' }}>Kč</span>
                </div>
              </div>

              {/* Metadata Grid (VAT, Stock, EAN) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.75rem',
                  background: 'rgba(255, 255, 255, 0.03)',
                  padding: '0.85rem 1rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.06)'
                }}
              >
                {/* VAT Rate */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Percent size={16} style={{ color: 'var(--accent-purple, #a855f7)' }} />
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #94a3b8)' }}>
                      {t('price_check.vat_label')}
                    </div>
                    <div style={{ fontSize: '0.92rem', fontWeight: '700', color: 'var(--text-primary, #ffffff)' }}>
                      {vatRate}%
                    </div>
                  </div>
                </div>

                {/* Stock Level */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Package
                    size={16}
                    style={{
                      color: isOutOfStock
                        ? 'var(--accent-rose, #f43f5e)'
                        : (hasTrackStock ? 'var(--accent-emerald, #10b981)' : 'var(--text-secondary, #94a3b8)')
                    }}
                  />
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #94a3b8)' }}>
                      {t('price_check.stock_label')}
                    </div>
                    <div
                      style={{
                        fontSize: '0.92rem',
                        fontWeight: '700',
                        color: isOutOfStock
                          ? 'var(--accent-rose, #f43f5e)'
                          : (hasTrackStock ? 'var(--text-primary, #ffffff)' : 'var(--text-secondary, #94a3b8)')
                      }}
                    >
                      {hasTrackStock
                        ? (stockQty !== null ? `${stockQty} ks` : t('price_check.in_stock'))
                        : t('price_check.in_stock')}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Unknown barcode scanned during price check mode */
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: 'rgba(245, 158, 11, 0.15)',
                  color: 'var(--accent-amber, #f59e0b)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem'
                }}
              >
                <AlertCircle size={32} />
              </div>

              <h4 style={{ margin: '0 0 0.5rem', fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-primary, #ffffff)' }}>
                {t('price_check.unknown_title')}
              </h4>

              <div
                style={{
                  fontSize: '1rem',
                  fontFamily: 'var(--font-mono, monospace)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  display: 'inline-block',
                  color: 'var(--accent-amber, #f59e0b)',
                  marginBottom: '0.75rem'
                }}
              >
                {unknownBarcode}
              </div>

              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary, #94a3b8)' }}>
                {t('price_check.unknown_msg')}
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          className="modal-footer"
          style={{
            padding: '1rem 1.25rem',
            background: 'rgba(0, 0, 0, 0.15)',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            gap: '0.75rem',
            justifyContent: 'flex-end'
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            style={{
              minHeight: '46px',
              padding: '0 1.25rem',
              fontSize: '0.92rem',
              fontWeight: '700',
              borderRadius: '8px',
              touchAction: 'manipulation',
              flex: '1'
            }}
          >
            {t('price_check.close')}
          </button>

          {item ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                soundFx.playScanChime();
                if (onAddToCart) onAddToCart(item);
                onClose();
              }}
              style={{
                minHeight: '46px',
                padding: '0 1.5rem',
                fontSize: '0.95rem',
                fontWeight: '800',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                touchAction: 'manipulation',
                flex: '2'
              }}
            >
              <Plus size={18} strokeWidth={2.5} />
              <span>{t('price_check.add_to_cart')}</span>
            </button>
          ) : (
            onCreateProduct && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  if (onCreateProduct) onCreateProduct(unknownBarcode);
                  onClose();
                }}
                style={{
                  minHeight: '46px',
                  padding: '0 1.5rem',
                  fontSize: '0.95rem',
                  fontWeight: '800',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                  touchAction: 'manipulation',
                  flex: '2'
                }}
              >
                <Plus size={18} strokeWidth={2.5} />
                <span>{t('price_check.create_product')}</span>
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
