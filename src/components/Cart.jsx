import React, { useEffect, useState, useMemo } from 'react';
import { ShoppingCart, Trash2, Plus, Minus, CreditCard, Banknote, Percent, Split, RotateCcw, Clock } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext.jsx';
import { calculateCartTotals } from '../utils/tax';
import CashDrawerIcon from './CashDrawerIcon';
import CartItemInspector from './cart/CartItemInspector';

function ClearedCartBanner({ snapshot, onRestore }) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!snapshot) return;
    setProgress(100);
    const startTime = Date.now();
    const duration = 8000;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 50);

    return () => clearInterval(interval);
  }, [snapshot]);

  const itemTotalCount = snapshot?.snapshot?.cartItems?.reduce((s, i) => s + i.quantity, 0) || 0;

  return (
    <div className="cleared-cart-restore-banner">
      <div className="cleared-banner-title">
        <RotateCcw size={22} className="cleared-banner-icon" />
        <div>
          <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--accent-blue)' }}>
            Košík byl vysypán
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {itemTotalCount} položek v paměti (8s)
          </div>
        </div>
      </div>

      <button type="button" className="restore-cart-btn" onClick={onRestore}>
        <RotateCcw size={16} />
        <span>Obnovit košík</span>
      </button>

      <div className="cleared-banner-progress-bg">
        <div className="cleared-banner-progress-fill" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

function Cart({
  cartItems,
  onUpdateQty,
  onUpdateItemDetails,
  onRemoveItem,
  onClearCart,
  onOpenPayment,
  cartDiscountPercent = 0,
  onOpenCustomDiscount,
  clearedCartSnapshot = null,
  onRestoreClearedCart = null,
  onDismissClearedCart = null,
  onOpenCashDrawer = null,
  parkedCartsCount = 0,
  onOpenParkedModal = null,
  cartItemStyle = 'elevated-card'
}) {
  const { t } = useTranslation();
  const [selectedItemId, setSelectedItemId] = useState(null);

  const activeCartItemStyle = useMemo(() => {
    try {
      return localStorage.getItem('pos_cart_item_style') || cartItemStyle || 'elevated-card';
    } catch {
      return cartItemStyle || 'elevated-card';
    }
  }, [cartItemStyle]);

  const {
    cartDiscountAmount,
    finalGrandTotal,
    totalNet,
    totalTax
  } = useMemo(() => {
    return calculateCartTotals(cartItems, cartDiscountPercent);
  }, [cartItems, cartDiscountPercent]);

  const isRefundTransaction = finalGrandTotal < 0;
  const totalItemCount = useMemo(() => {
    return cartItems.reduce((sum, i) => sum + i.quantity, 0);
  }, [cartItems]);

  const activeItem = useMemo(() => {
    return cartItems.find(i => i.id === selectedItemId) || null;
  }, [cartItems, selectedItemId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      {/* Active Cart Item Overlap Inspector */}
      {activeItem && (
        <CartItemInspector
          item={activeItem}
          onClose={() => setSelectedItemId(null)}
          onUpdateDetails={onUpdateItemDetails || onUpdateQty}
          onRemoveItem={(id) => {
            onRemoveItem(id);
            setSelectedItemId(null);
          }}
        />
      )}

      {/* Cart Header */}
      <div className="cart-header" style={{ gap: '0.75rem' }}>
        <div className="cart-title" style={{ flexShrink: 1, minWidth: 0, gap: '0.4rem' }}>
          <ShoppingCart size={18} style={{ color: isRefundTransaction ? 'var(--accent-rose)' : 'var(--accent-blue)', flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {isRefundTransaction ? '↩️ Vratka / Vrácení Zboží' : t('cart.title')}
          </span>
          {cartItems.length > 0 && (
            <span className="cart-badge-count" style={{ marginLeft: '0.2rem', flexShrink: 0, background: isRefundTransaction ? 'var(--accent-rose)' : undefined }}>
              {totalItemCount}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexShrink: 0, marginLeft: 'auto' }}>
          {parkedCartsCount > 0 && (
            <button
              type="button"
              className="clear-cart-btn btn-restore"
              onClick={() => onOpenParkedModal && onOpenParkedModal()}
              title={t('parked_carts.restore_btn_title')}
            >
              <Clock size={13} style={{ flexShrink: 0 }} />
              <span>{t('parked_carts.restore_btn')} ({parkedCartsCount})</span>
            </button>
          )}

          {cartItems.length > 0 && (
            <>
              {/* Open Custom Discount Modal for Cart */}
              <button
                type="button"
                className={`clear-cart-btn ${cartDiscountPercent > 0 ? 'btn-active-discount' : ''}`}
                onClick={() => onOpenCustomDiscount && onOpenCustomDiscount(null)}
                title={t('cart.discount')}
              >
                <Percent size={13} style={{ flexShrink: 0 }} />
                <span>{cartDiscountPercent > 0 ? `-${cartDiscountPercent}%` : t('cart.discount_short')}</span>
              </button>

              <button
                type="button"
                className="clear-cart-btn btn-danger"
                onClick={() => {
                  setSelectedItemId(null);
                  onClearCart();
                }}
                title={t('cart.clear')}
              >
                <Trash2 size={13} style={{ flexShrink: 0 }} />
                <span>{t('cart.clear')}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Cart Items List */}
      <div className={`cart-items-container cart-item-style-${activeCartItemStyle}`}>
        {cartItems.length === 0 ? (
          <div className="empty-cart">
            {clearedCartSnapshot ? (
              <ClearedCartBanner
                snapshot={clearedCartSnapshot}
                onRestore={onRestoreClearedCart}
                onDismiss={onDismissClearedCart}
              />
            ) : (
              <>
                <div className="empty-cart-icon">
                  <ShoppingCart size={28} />
                </div>
                <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{t('cart.empty')}</div>
                <div style={{ fontSize: '0.8rem' }}>{t('cart.empty_sub')}</div>
              </>
            )}
          </div>
        ) : (
          cartItems.map((item, index) => {
            const itemVat = item.vat !== undefined && item.vat !== null ? parseInt(item.vat, 10) : 21;
            const itemDisc = item.discountPercent || 0;
            const effectiveUnitPrice = item.price * (1 - itemDisc / 100);
            const lineTotal = effectiveUnitPrice * item.quantity;
            const isItemReturn = item.price < 0 || lineTotal < 0;
            const isSelected = selectedItemId === item.id;

            return (
              <div
                key={`${item.id}-${index}`}
                className={`cart-item-card style-${activeCartItemStyle} ${isSelected ? 'is-active' : ''}`}
                style={{
                  borderColor: isItemReturn ? 'rgba(239, 68, 68, 0.4)' : undefined,
                  background: isItemReturn ? 'rgba(239, 68, 68, 0.05)' : undefined
                }}
                onClick={() => setSelectedItemId(prev => prev === item.id ? null : item.id)}
                title="Kliknutím upravíte množství, slevu nebo poznámku"
              >
                {/* Row 1 Top: Item Name & Action Buttons (Qty Stepper, Delete) */}
                <div className="cart-item-row-top">
                  <div className="cart-item-name-group" style={{ flexWrap: 'wrap' }}>
                    <span className="cart-item-name-text">
                      {isItemReturn && (
                        <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: 'var(--accent-rose)', padding: '1px 5px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: '900', marginRight: '5px' }}>
                          ↩️ VRATKA
                        </span>
                      )}
                      {item.name}
                    </span>
                    {itemDisc > 0 && (
                      <span className="cart-item-disc-tag">-{itemDisc}%</span>
                    )}
                    {item.note && (
                      <span className="cart-item-note-badge" title={item.note}>
                        📝 {item.note}
                      </span>
                    )}
                  </div>

                  <div className="cart-item-controls-group">
                    <div className="cart-stepper-box">
                      <button
                        type="button"
                        className="cart-stepper-btn cart-stepper-btn-minus"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateQty(item.id, item.quantity - 1);
                        }}
                        title="-1 ks"
                      >
                        <Minus size={15} strokeWidth={2.5} />
                      </button>
                      <span className="cart-stepper-num">{item.quantity}</span>
                      <button
                        type="button"
                        className="cart-stepper-btn cart-stepper-btn-plus"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateQty(item.id, item.quantity + 1);
                        }}
                        title="+1 ks"
                      >
                        <Plus size={15} strokeWidth={2.5} />
                      </button>
                    </div>

                    <button
                      type="button"
                      className="cart-del-btn touch-target-lg"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveItem(item.id);
                        if (selectedItemId === item.id) setSelectedItemId(null);
                      }}
                      title="Smazat položku"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>

                {/* Row 2 Bottom: Unit Price breakdown (Left) & Line Total Price (Right) */}
                <div className="cart-item-row-bottom">
                  <div className="cart-item-unit-details">
                    {itemDisc > 0 ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                        <s style={{ opacity: 0.5, fontSize: '0.72rem' }}>
                          {parseFloat(item.price).toFixed(2)} Kč
                        </s>
                        <span style={{ color: isItemReturn ? 'var(--accent-rose)' : 'var(--accent-emerald)', fontWeight: '800' }}>
                          {effectiveUnitPrice.toFixed(2)} Kč
                        </span>
                      </span>
                    ) : (
                      <span style={{ color: isItemReturn ? 'var(--accent-rose)' : undefined, fontWeight: isItemReturn ? '800' : 'normal' }}>
                        {parseFloat(item.price).toFixed(2)} Kč
                      </span>
                    )}
                    <span style={{ opacity: 0.6 }}> × {item.quantity} ({t('cart.vat')} {itemVat}%)</span>
                  </div>

                  <div className="cart-item-line-total-price" style={{ color: isItemReturn ? 'var(--accent-rose)' : undefined }}>
                    {lineTotal.toFixed(2)} Kč
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Cart Footer & Checkout Action Buttons */}
      <div className="cart-footer">
        <div className="summary-rows">
          {cartDiscountPercent > 0 && (
            <div className="summary-row" style={{ color: 'var(--accent-rose)', fontWeight: '700' }}>
              <span>{t('cart.discount')} ({cartDiscountPercent}%):</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>-{cartDiscountAmount.toFixed(2)} Kč</span>
            </div>
          )}

          <div className="summary-row">
            <span>{t('cart.tax_base')}</span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>{totalNet.toFixed(2)} Kč</span>
          </div>

          <div className="summary-row">
            <span>{t('cart.tax_total')}</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-purple)' }}>{totalTax.toFixed(2)} Kč</span>
          </div>
        </div>

        {/* Grand Total Hero Card */}
        <div className={`total-hero-card ${isRefundTransaction ? 'is-refund' : ''}`}>
          <div className="total-hero-label">
            <span className="total-hero-title">
              {isRefundTransaction ? '↩️ K VRÁCENÍ' : t('cart.total')}
            </span>
            <span className="total-items-badge">
              {totalItemCount} {totalItemCount === 1 ? 'položka' : (totalItemCount >= 2 && totalItemCount <= 4 ? 'položky' : 'položek')}
            </span>
          </div>
          <span className="total-hero-amount total-amount">
            {isRefundTransaction ? `${Math.abs(finalGrandTotal).toFixed(2)} Kč` : `${finalGrandTotal.toFixed(2)} Kč`}
          </span>
        </div>

        <div className="payment-actions-grid">
          <button
            type="button"
            className="pay-btn pay-btn-cash"
            style={{ background: isRefundTransaction ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : undefined }}
            disabled={cartItems.length === 0}
            onClick={() => onOpenPayment('cash')}
          >
            <Banknote size={18} />
            <span>{isRefundTransaction ? 'Vrátit Hotovost' : t('payment.cash')}</span>
          </button>

          <button
            type="button"
            className="pay-btn pay-btn-card"
            style={{ background: isRefundTransaction ? 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' : undefined }}
            disabled={cartItems.length === 0}
            onClick={() => onOpenPayment('card')}
          >
            <CreditCard size={18} style={{ flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {isRefundTransaction ? 'Vrátit na Kartu' : t('payment.card_btn')}
            </span>
          </button>
        </div>

        {/* Split Payment Button */}
        {cartItems.length > 0 && (
          <button
            type="button"
            className="split-pay-btn"
            onClick={() => onOpenPayment('split')}
          >
            <Split size={16} style={{ flexShrink: 0 }} />
            <span>{t('payment.split')} ({t('payment.cash')} + {t('payment.card')})</span>
          </button>
        )}

        {/* Cashier Drawer Release Button (Bottom of Cart) */}
        {onOpenCashDrawer && (
          <button
            type="button"
            className="cart-drawer-btn"
            onClick={onOpenCashDrawer}
            title={t('cart.open_drawer') || 'Otevřít pokladní zásuvku'}
            style={{
              height: '42px',
              fontSize: '0.84rem',
              fontWeight: '800',
              background: 'color-mix(in srgb, var(--text-primary) 3.5%, transparent)',
              color: 'var(--text-secondary)',
              border: '1px solid color-mix(in srgb, var(--border-color) 75%, transparent)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              width: '100%',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
              transition: 'all 0.15s ease',
              marginTop: '0.2rem',
              touchAction: 'manipulation'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'color-mix(in srgb, var(--text-primary) 6%, transparent)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'color-mix(in srgb, var(--text-primary) 3.5%, transparent)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            <CashDrawerIcon size={17} color="var(--accent-amber)" />
            <span>{t('cart.open_drawer') || 'Otevřít pokladní zásuvku'}</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default React.memo(Cart);
