import React, { useState, useEffect, useRef } from 'react';
import { X, Trash2, Plus, Minus, Percent, Tag, FileText, DollarSign } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext.jsx';

export default function CartItemInspector({
  item,
  onClose,
  onUpdateDetails,
  onRemoveItem
}) {
  const { t } = useTranslation();
  const [customDiscount, setCustomDiscount] = useState(() => item?.discountPercent ? String(item.discountPercent) : '');
  const [customPrice, setCustomPrice] = useState(() => item?.price !== undefined ? String(item.price) : '');
  const [noteText, setNoteText] = useState(() => item?.note || '');
  const noteInputRef = useRef(null);
  const inspectorRef = useRef(null);

  // Sync state when selected item changes
  useEffect(() => {
    if (item) {
      setCustomDiscount(item.discountPercent ? String(item.discountPercent) : '');
      setCustomPrice(item.price !== undefined ? String(item.price) : '');
      setNoteText(item.note || '');
    }
  }, [item]);

  // Close on Escape key or clicking outside both Inspector and Cart
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handlePointerDown = (e) => {
      if (inspectorRef.current && inspectorRef.current.contains(e.target)) {
        return;
      }
      // Do not close when tapping inside the cart items list so another item can be selected directly
      if (e.target.closest('.cart-items-container') || e.target.closest('.cart-item-card')) {
        return;
      }
      onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [onClose]);

  if (!item) return null;

  const currentDisc = item.discountPercent || 0;
  const itemVat = item.vat !== undefined && item.vat !== null ? parseInt(item.vat, 10) : 21;
  const effectiveUnitPrice = (parseFloat(item.price) || 0) * (1 - currentDisc / 100);
  const lineTotal = effectiveUnitPrice * (item.quantity || 1);

  const handleQtyChange = (newQty) => {
    const clamped = Math.max(1, Math.min(9999, parseInt(newQty, 10) || 1));
    onUpdateDetails(item.id, { quantity: clamped });
  };

  const handleApplyDiscount = (discPercent) => {
    const val = Math.max(0, Math.min(100, parseInt(discPercent, 10) || 0));
    setCustomDiscount(val > 0 ? String(val) : '');
    onUpdateDetails(item.id, { discountPercent: val });
  };

  const handleCustomDiscountChange = (val) => {
    setCustomDiscount(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
      onUpdateDetails(item.id, { discountPercent: parsed });
    } else if (val === '') {
      onUpdateDetails(item.id, { discountPercent: 0 });
    }
  };

  const handleCustomPriceBlur = () => {
    const parsed = parseFloat(customPrice);
    if (!isNaN(parsed) && parsed >= 0) {
      onUpdateDetails(item.id, { price: parsed });
    } else {
      setCustomPrice(String(item.price));
    }
  };

  const handleNoteChange = (text) => {
    setNoteText(text);
    onUpdateDetails(item.id, { note: text.trim() });
  };

  return (
    <div
      ref={inspectorRef}
      className="cart-item-inspector"
      role="dialog"
      aria-label={t('inspector.title') || 'Úprava položky'}
    >
        {/* Header */}
        <div className="inspector-header">
          <div className="inspector-title-group">
            <div className="inspector-title" title={item.name}>
              {item.name}
            </div>
            <div className="inspector-subtitle">
              {parseFloat(item.price).toFixed(2)} Kč / ks • DPH {itemVat}%
            </div>
          </div>
          <button
            type="button"
            className="inspector-close-btn"
            onClick={onClose}
            title={t('inspector.close') || 'Zavřít'}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body Controls */}
        <div className="inspector-body">
          {/* Section 1: Quantity */}
          <div className="inspector-section">
            <span className="inspector-section-label">
              <Tag size={13} />
              <span>{t('inspector.quantity') || 'Množství'}</span>
            </span>

            {/* Stepper + Quick Quantity Chips */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <div
                className="cart-stepper-box"
                style={{ height: '38px', flex: '1 1 auto', background: 'var(--bg-input)' }}
              >
                <button
                  type="button"
                  className="cart-stepper-btn"
                  style={{ width: '38px' }}
                  onClick={() => handleQtyChange(item.quantity - 1)}
                  disabled={item.quantity <= 1}
                  title="-1 ks"
                >
                  <Minus size={16} />
                </button>
                <input
                  type="number"
                  min="1"
                  max="9999"
                  className="cart-stepper-num"
                  style={{
                    width: '50px',
                    border: 'none',
                    background: 'transparent',
                    fontSize: '1.16rem',
                    textAlign: 'center',
                    outline: 'none'
                  }}
                  value={item.quantity}
                  onChange={(e) => handleQtyChange(e.target.value)}
                />
                <button
                  type="button"
                  className="cart-stepper-btn"
                  style={{ width: '38px' }}
                  onClick={() => handleQtyChange(item.quantity + 1)}
                  title="+1 ks"
                >
                  <Plus size={16} />
                </button>
              </div>

              {[1, 2, 5, 10].map((q) => (
                <button
                  key={q}
                  type="button"
                  className={`inspector-chip ${item.quantity === q ? 'active' : ''}`}
                  style={{ flex: '0 0 38px', height: '38px', padding: 0 }}
                  onClick={() => handleQtyChange(q)}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Section 2: Item Discount */}
          <div className="inspector-section">
            <span className="inspector-section-label">
              <Percent size={13} />
              <span>{t('inspector.discount') || 'Sleva na položku'}</span>
            </span>

            <div className="inspector-chip-grid">
              <button
                type="button"
                className={`inspector-chip ${currentDisc === 0 ? 'active' : ''}`}
                onClick={() => handleApplyDiscount(0)}
              >
                0%
              </button>
              {[5, 10, 20, 50].map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`inspector-chip ${currentDisc === d ? 'active-disc' : ''}`}
                  onClick={() => handleApplyDiscount(d)}
                >
                  -{d}%
                </button>
              ))}
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="%"
                  value={customDiscount}
                  onChange={(e) => handleCustomDiscountChange(e.target.value)}
                  className="input-field"
                  style={{
                    width: '100%',
                    height: '38px',
                    padding: '0 0.35rem',
                    textAlign: 'center',
                    fontSize: '0.95rem',
                    fontWeight: '800',
                    fontFamily: 'var(--font-mono)'
                  }}
                  title={t('inspector.custom_discount') || 'Vlastní %'}
                />
              </div>
            </div>
          </div>

          {/* Section 3: Price Override */}
          <div className="inspector-section">
            <span className="inspector-section-label">
              <DollarSign size={13} />
              <span>{t('inspector.unit_price') || 'Jednotková cena (Kč)'}</span>
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="number"
                step="any"
                min="0"
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                onBlur={handleCustomPriceBlur}
                className="input-field"
                style={{
                  flex: 1,
                  height: '38px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: '800',
                  fontSize: '1.05rem'
                }}
              />
              <span style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-muted)' }}>
                Kč
              </span>
            </div>
          </div>

          {/* Section 4: Item Note / Kitchen Modifier */}
          <div className="inspector-section">
            <span className="inspector-section-label">
              <FileText size={13} />
              <span>{t('inspector.note') || 'Poznámka / Modifikátor'}</span>
            </span>
            <input
              ref={noteInputRef}
              type="text"
              className="input-field"
              placeholder={t('inspector.note_placeholder') || 'např. Bez ledu, S sebou...'}
              value={noteText}
              onChange={(e) => handleNoteChange(e.target.value)}
              style={{ height: '38px', fontSize: '0.95rem' }}
            />
          </div>

          {/* Line Total Summary Preview */}
          <div style={{
            background: 'var(--bg-main)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '0.6rem 0.85rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 'auto'
          }}>
            <span style={{ fontSize: '0.88rem', fontWeight: '700', color: 'var(--text-muted)' }}>
              Celkem za položku:
            </span>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '1.25rem',
              fontWeight: '900',
              color: 'var(--accent-emerald)'
            }}>
              {lineTotal.toFixed(2)} Kč
            </span>
          </div>
        </div>

        {/* Footer with Delete Action */}
        <div className="inspector-footer">
          <button
            type="button"
            className="clear-cart-btn"
            style={{
              width: '100%',
              height: '42px',
              justifyContent: 'center',
              fontSize: '0.96rem',
              fontWeight: '800',
              gap: '0.5rem'
            }}
            onClick={() => {
              onRemoveItem(item.id);
              onClose();
            }}
            title={t('inspector.delete_item') || 'Odstranit položku'}
          >
            <Trash2 size={16} />
            <span>{t('inspector.delete_item') || 'Odstranit položku'}</span>
          </button>
        </div>
      </div>
  );
}
