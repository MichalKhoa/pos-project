import React, { useEffect, useState } from 'react';
import { ShoppingCart, Trash2, Plus, Minus, CreditCard, Banknote, Percent, Split, RotateCcw, Vault } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext.jsx';

function ClearedCartBanner({ snapshot, onRestore, onDismiss }) {
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

export default function Cart({
  cartItems,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
  onOpenPayment,
  cartDiscountPercent = 0,
  onOpenCustomDiscount,
  clearedCartSnapshot = null,
  onRestoreClearedCart = null,
  onDismissClearedCart = null,
  onOpenCashDrawer = null
}) {
  const { t } = useTranslation();
  const roundCZK = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

  // Calculate item effective gross totals after item-level discounts
  const rawSubtotal = roundCZK(cartItems.reduce((sum, item) => {
    const disc = item.discountPercent || 0;
    const effectivePrice = item.price * (1 - disc / 100);
    return sum + (effectivePrice * item.quantity);
  }, 0));

  // Apply Cart-Level Discount
  const cartDiscountAmount = roundCZK(rawSubtotal * (cartDiscountPercent / 100));
  const finalGrandTotal = roundCZK(rawSubtotal - cartDiscountAmount);
  const cartDiscountFactor = rawSubtotal !== 0 ? finalGrandTotal / rawSubtotal : 1;
  const isRefundTransaction = finalGrandTotal < 0;

  // Group tax totals accurately per VAT rate (21%, 12%, 0%) after all discounts
  const taxSummary = cartItems.reduce((acc, item) => {
    const rate = item.vat !== undefined && item.vat !== null ? parseInt(item.vat, 10) : 21;
    const itemDisc = item.discountPercent || 0;
    const itemEffectivePrice = item.price * (1 - itemDisc / 100);
    const itemGrossBeforeCartDisc = itemEffectivePrice * item.quantity;
    const itemFinalGross = roundCZK(itemGrossBeforeCartDisc * cartDiscountFactor);

    let netPrice = itemFinalGross;
    let taxAmount = 0;

    if (rate > 0) {
      netPrice = roundCZK(itemFinalGross / (1 + rate / 100));
      taxAmount = roundCZK(itemFinalGross - netPrice);
    }

    if (!acc[rate]) {
      acc[rate] = { rate, gross: 0, net: 0, tax: 0 };
    }
    acc[rate].gross = roundCZK(acc[rate].gross + itemFinalGross);
    acc[rate].net = roundCZK(acc[rate].net + netPrice);
    acc[rate].tax = roundCZK(acc[rate].tax + taxAmount);
    return acc;
  }, {});

  const sortedRates = Object.values(taxSummary).sort((a, b) => b.rate - a.rate);
  const totalNet = roundCZK(sortedRates.reduce((sum, t) => sum + t.net, 0));
  const totalTax = roundCZK(sortedRates.reduce((sum, t) => sum + t.tax, 0));
  const totalItemCount = cartItems.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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
          {cartItems.length > 0 && (
            <>
              {/* Open Custom Discount Modal for Cart */}
              <button
                type="button"
                className="clear-cart-btn"
                style={{
                  background: cartDiscountPercent > 0 ? 'rgba(37, 99, 235, 0.15)' : 'var(--bg-input)',
                  color: cartDiscountPercent > 0 ? 'var(--accent-blue)' : 'var(--text-secondary)',
                  borderColor: cartDiscountPercent > 0 ? 'rgba(37, 99, 235, 0.3)' : 'var(--border-color)',
                  padding: '0.35rem 0.65rem',
                  fontSize: '0.8rem',
                  fontWeight: '800',
                  whiteSpace: 'nowrap'
                }}
                onClick={() => onOpenCustomDiscount && onOpenCustomDiscount(null)}
                title={t('cart.discount')}
              >
                <Percent size={13} />
                <span>{cartDiscountPercent > 0 ? `-${cartDiscountPercent}%` : t('cart.discount_short')}</span>
              </button>

              <button
                type="button"
                className="clear-cart-btn"
                style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                onClick={onClearCart}
                title={t('cart.clear')}
              >
                <Trash2 size={13} />
                <span>{t('cart.clear')}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Cart Items List */}
      <div className="cart-items-container">
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

            return (
              <div key={`${item.id}-${index}`} className="cart-item-card" style={{ borderColor: isItemReturn ? 'rgba(239, 68, 68, 0.4)' : undefined, background: isItemReturn ? 'rgba(239, 68, 68, 0.05)' : undefined }}>
                {/* Row 1 Top: Item Name & Action Buttons (%, Qty Stepper, Delete) */}
                <div className="cart-item-row-top">
                  <div className="cart-item-name-group">
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
                  </div>

                  <div className="cart-item-controls-group">
                    {/* Open Custom Discount Modal directly for Item */}
                    <button
                      type="button"
                      className={`cart-disc-btn ${itemDisc > 0 ? 'active' : ''}`}
                      onClick={() => onOpenCustomDiscount && onOpenCustomDiscount(item)}
                      title="Sleva na položku (% / Kč)"
                    >
                      <Percent size={12} />
                    </button>

                    <div className="cart-stepper-box">
                      <button type="button" className="cart-stepper-btn" onClick={() => onUpdateQty(item.id, item.quantity - 1)}>
                        <Minus size={12} />
                      </button>
                      <span className="cart-stepper-num">{item.quantity}</span>
                      <button type="button" className="cart-stepper-btn" onClick={() => onUpdateQty(item.id, item.quantity + 1)}>
                        <Plus size={12} />
                      </button>
                    </div>

                    <button type="button" className="cart-del-btn touch-target-lg" onClick={() => onRemoveItem(item.id)} title="Smazat položku">
                      <Trash2 size={16} />
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

          <div className="summary-row total-row" style={{ color: isRefundTransaction ? 'var(--accent-rose)' : undefined }}>
            <span>{isRefundTransaction ? '↩️ K VRÁCENÍ ZÁKAZNÍKOVI:' : `${t('cart.total')}:`}</span>
            <span className="total-amount" style={{ color: isRefundTransaction ? 'var(--accent-rose)' : undefined }}>
              {isRefundTransaction ? `${Math.abs(finalGrandTotal).toFixed(2)} Kč` : `${finalGrandTotal.toFixed(2)} Kč`}
            </span>
          </div>
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
            title={t('cart.open_drawer') || 'Otevřít zásuvku'}
          >
            <Vault size={16} style={{ flexShrink: 0 }} />
            <span>{t('cart.open_drawer') || 'Otevřít zásuvku'}</span>
          </button>
        )}
      </div>
    </div>
  );
}
