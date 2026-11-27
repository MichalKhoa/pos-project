import React, { useEffect, useState, useMemo, useRef } from 'react';
import { ShoppingCart, Trash2, Plus, Minus, CreditCard, Banknote, Percent, Split, RotateCcw, Clock, PauseCircle } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext.jsx';
import { calculateCartTotals, roundCashTotal } from '../utils/tax';
import CashDrawerIcon from './CashDrawerIcon';
import CartItemInspector from './cart/CartItemInspector';
import { countCartItems } from '../utils/cartCount';
import { formatKc } from '../utils/money';

function ClearedCartBanner({ snapshot, onRestore }) {
  const { t } = useTranslation();
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
            {t('cart.cleared_title')}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {t('cart.cleared_sub', { count: itemTotalCount })}
          </div>
        </div>
      </div>

      <button type="button" className="restore-cart-btn" onClick={onRestore}>
        <RotateCcw size={16} />
        <span>{t('cart.restore_cart')}</span>
      </button>

      <div className="cleared-banner-progress-bg">
        <div className="cleared-banner-progress-fill" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

function formatQty(qty) {
  if (qty === null || qty === undefined) return '0';
  const num = Number(qty);
  if (Number.isInteger(num)) return num.toString();
  return Number(num.toFixed(3)).toString();
}

function formatQtyWithUnit(item) {
  const formatted = formatQty(item.quantity);
  const isWeighted = item.unit === 'kg' || item.unit === 'g' || item.isWeighted || item.is_weighted;
  const defaultUnit = (isWeighted || !Number.isInteger(Number(item.quantity))) ? 'kg' : 'ks';
  const unit = item.unit || defaultUnit;
  return `${formatted} ${unit}`;
}

// Lines are addressed by lineId; two lines of one product (different price) share the same id
const lineKey = (item) => item.lineId ?? item.id;

// "Základ daně (Netto):" becomes "Základ daně" so base and VAT fit on one line
const shortTaxLabel = (label) => label.replace(/\s*\([^)]*\)/, '').replace(/:\s*$/, '');

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
  onParkCart = null,
  cartItemStyle = 'elevated-card'
}) {
  const { t, language } = useTranslation();
  const [selectedLineKey, setSelectedLineKey] = useState(null);
  const itemsContainerRef = useRef(null);
  const prevItemsRef = useRef(cartItems);
  const flashTimerRef = useRef(null);

  // Bring the line that was just added or increased into view and flash it
  useEffect(() => {
    const prev = prevItemsRef.current;
    prevItemsRef.current = cartItems;
    if (prev === cartItems) return;

    let changedIndex = null;
    if (cartItems.length === prev.length + 1) {
      // Append lands last; undoing a removal restores the line in the middle
      const firstDiff = cartItems.findIndex((item, i) => item !== prev[i]);
      changedIndex = firstDiff > -1 ? firstDiff : cartItems.length - 1;
    } else if (cartItems.length === prev.length) {
      const idx = cartItems.findIndex((item, i) => item.id === prev[i]?.id && item.quantity > prev[i].quantity);
      if (idx > -1) changedIndex = idx;
    }
    if (changedIndex === null) return;

    const card = itemsContainerRef.current?.querySelector(`[data-line-index="${changedIndex}"]`);
    if (!card) return;
    card.scrollIntoView?.({ block: 'nearest' });
    // Restart the CSS flash outside React state so repeat scans re-flash and a later render cannot strand it
    itemsContainerRef.current.querySelectorAll('.is-flash').forEach((el) => el.classList.remove('is-flash'));
    void card.offsetWidth;
    card.classList.add('is-flash');
    clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => card.classList.remove('is-flash'), 600);
  }, [cartItems]);

  useEffect(() => () => clearTimeout(flashTimerRef.current), []);

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
  const totalItemCount = useMemo(() => countCartItems(cartItems), [cartItems]);
  // Cash rounds to whole koruna; show it next to the item count so the cashier knows before opening payment
  const cashRounded = roundCashTotal(finalGrandTotal);
  const showCashHint = cartItems.length > 0 && Math.abs(cashRounded - finalGrandTotal) > 0.004;
  const itemCountLabel = (() => {
    const category = new Intl.PluralRules(language).select(Math.abs(totalItemCount));
    const word = t(`cart.items_${category}`);
    return word.startsWith('cart.items_') ? t('cart.items_other') : word;
  })();

  const activeItem = useMemo(() => {
    return cartItems.find(i => lineKey(i) === selectedLineKey) || null;
  }, [cartItems, selectedLineKey]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      {/* Active Cart Item Overlap Inspector */}
      {activeItem && (
        <CartItemInspector
          item={activeItem}
          onClose={() => setSelectedLineKey(null)}
          onUpdateDetails={onUpdateItemDetails || onUpdateQty}
          onRemoveItem={(id) => {
            onRemoveItem(id);
            setSelectedLineKey(null);
          }}
        />
      )}

      {/* Cart Header */}
      <div className="cart-header" style={{ gap: '0.75rem' }}>
        <div className="cart-title" style={{ flexShrink: 1, minWidth: 0, gap: '0.4rem' }}>
          <ShoppingCart size={18} style={{ color: isRefundTransaction ? 'var(--accent-rose)' : 'var(--accent-blue)', flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {isRefundTransaction ? t('cart.refund_title') : t('cart.title')}
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
              {/* Park Active Cart Button */}
              {onParkCart && (
                <button
                  type="button"
                  className="clear-cart-btn btn-park is-icon"
                  onClick={onParkCart}
                  title={t('parked_carts.park_btn_title')}
                  aria-label={t('parked_carts.park_btn')}
                >
                  <PauseCircle size={16} style={{ flexShrink: 0 }} />
                </button>
              )}

              {/* Open Custom Discount Modal for Cart */}
              <button
                type="button"
                className={`clear-cart-btn is-icon ${cartDiscountPercent > 0 ? 'btn-active-discount' : ''}`}
                onClick={() => onOpenCustomDiscount && onOpenCustomDiscount(null)}
                title={t('cart.discount')}
                aria-label={t('cart.discount')}
              >
                <Percent size={16} style={{ flexShrink: 0 }} />
                {cartDiscountPercent > 0 && <span>-{cartDiscountPercent}%</span>}
              </button>

              <button
                type="button"
                className="clear-cart-btn btn-danger is-icon"
                onClick={() => {
                  setSelectedLineKey(null);
                  onClearCart();
                }}
                title={t('cart.clear')}
                aria-label={t('cart.clear')}
              >
                <Trash2 size={16} style={{ flexShrink: 0 }} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Cart Items List */}
      <div ref={itemsContainerRef} className={`cart-items-container cart-item-style-${activeCartItemStyle}`}>
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
                <div style={{ fontSize: '0.92rem' }}>{t('cart.empty_sub')}</div>
              </>
            )}
          </div>
        ) : (
          cartItems.map((item, index) => {
            const itemDisc = item.discountPercent || 0;
            const effectiveUnitPrice = item.price * (1 - itemDisc / 100);
            const lineTotal = effectiveUnitPrice * item.quantity;
            const isItemReturn = item.price < 0 || lineTotal < 0;
            const isSelected = selectedLineKey === lineKey(item);
            const isItemWeighted = item.unit === 'kg' || item.unit === 'g' || item.isWeighted || item.is_weighted;
            const step = isItemWeighted ? 0.1 : 1;
            const isLastUnit = item.quantity <= step;

            return (
              <div
                key={lineKey(item)}
                data-line-index={index}
                className={`cart-item-card style-${activeCartItemStyle} ${isSelected ? 'is-active' : ''}`}
                style={{
                  borderColor: isItemReturn ? 'rgba(239, 68, 68, 0.4)' : undefined,
                  background: isItemReturn ? 'rgba(239, 68, 68, 0.05)' : undefined
                }}
                onClick={() => setSelectedLineKey(prev => prev === lineKey(item) ? null : lineKey(item))}
                title={t('cart.edit_hint')}
              >
                {/* Row 1 Top: Item Name & Action Buttons (Qty Stepper, Delete) */}
                <div className="cart-item-row-top">
                  <div className="cart-item-name-group" style={{ flexWrap: 'wrap' }}>
                    <span className="cart-item-name-text">
                      {isItemReturn && (
                        <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: 'var(--accent-rose)', padding: '1px 5px', borderRadius: '4px', fontSize: '0.84rem', fontWeight: '700', marginRight: '5px' }}>
                          {t('cart.return_badge')}
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
                        className={`cart-stepper-btn cart-stepper-btn-minus ${isLastUnit ? 'is-last' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateQty(lineKey(item), Math.round((item.quantity - step) * 1000) / 1000);
                        }}
                        title={isLastUnit ? t('inspector.delete_item') : (isItemWeighted ? "-0.1 kg" : "-1 ks")}
                        aria-label={isLastUnit ? t('inspector.delete_item') : `${t('cart.decrease_qty')} (${isItemWeighted ? '-0.1 kg' : '-1 ks'})`}
                      >
                        <Minus size={15} strokeWidth={2.5} />
                      </button>
                      <span className="cart-stepper-num">{formatQty(item.quantity)}</span>
                      <button
                        type="button"
                        className="cart-stepper-btn cart-stepper-btn-plus"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateQty(lineKey(item), Math.round((item.quantity + step) * 1000) / 1000);
                        }}
                        title={isItemWeighted ? "+0.1 kg" : "+1 ks"}
                        aria-label={`${t('cart.increase_qty')} (${isItemWeighted ? '+0.1 kg' : '+1 ks'})`}
                      >
                        <Plus size={15} strokeWidth={2.5} />
                      </button>
                    </div>

                    <button
                      type="button"
                      className="cart-del-btn touch-target-lg"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveItem(lineKey(item));
                        if (selectedLineKey === lineKey(item)) setSelectedLineKey(null);
                      }}
                      title={t('inspector.delete_item')}
                      aria-label={t('inspector.delete_item')}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>

                {/* Row 2 Bottom: Unit Price breakdown (Left) & Line Total Price (Right) */}
                <div className="cart-item-row-bottom">
                  <div className="cart-item-unit-details">
                    {isItemWeighted ? (
                      <span>
                        {formatQty(item.quantity)} {item.unit || 'kg'} × {formatKc(effectiveUnitPrice)} Kč
                      </span>
                    ) : (
                      <>
                        {itemDisc > 0 ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                            <s style={{ opacity: 0.5, fontSize: '0.8rem' }}>
                              {formatKc(item.price)} Kč
                            </s>
                            <span style={{ color: isItemReturn ? 'var(--accent-rose)' : 'var(--accent-emerald)', fontWeight: '700' }}>
                              {formatKc(effectiveUnitPrice)} Kč
                            </span>
                          </span>
                        ) : (
                          <span style={{ color: isItemReturn ? 'var(--accent-rose)' : undefined, fontWeight: isItemReturn ? '800' : 'normal' }}>
                            {formatKc(item.price)} Kč
                          </span>
                        )}
                        <span style={{ opacity: 0.6 }}> × {formatQtyWithUnit(item)}</span>
                      </>
                    )}
                  </div>

                  <div className="cart-item-line-total-price" style={{ color: isItemReturn ? 'var(--accent-rose)' : undefined }}>
                    {formatKc(lineTotal)} Kč
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
              <span style={{ fontFamily: 'var(--font-mono)' }}>-{formatKc(cartDiscountAmount)} Kč</span>
            </div>
          )}

          <div className="summary-row summary-row-tax">
            <span>{shortTaxLabel(t('cart.tax_base'))} <span className="summary-value">{formatKc(totalNet)} Kč</span></span>
            <span>{shortTaxLabel(t('cart.tax_total'))} <span className="summary-value">{formatKc(totalTax)} Kč</span></span>
          </div>
        </div>

        {/* Grand Total Hero Card */}
        <div className={`total-hero-card ${isRefundTransaction ? 'is-refund' : ''}`}>
          <div className="total-hero-label">
            <span className="total-hero-title">
              {isRefundTransaction ? t('cart.refund_total') : t('cart.total')}
            </span>
            <span className="total-items-badge">
              {totalItemCount} {itemCountLabel}
              {showCashHint && ` · ${t('cart.cash_short', { amount: formatKc(Math.abs(cashRounded)).replace(/\.00$/, '') })}`}
            </span>
          </div>
          <span className="total-hero-amount total-amount">
            {isRefundTransaction ? `${formatKc(Math.abs(finalGrandTotal))} Kč` : `${formatKc(finalGrandTotal)} Kč`}
          </span>
        </div>

        <div className="payment-actions-grid">
          <button
            type="button"
            className="pay-btn pay-btn-cash"
            style={{ background: isRefundTransaction ? '#dc2626' : undefined }}
            disabled={cartItems.length === 0}
            onClick={() => onOpenPayment('cash')}
          >
            <Banknote size={18} />
            <span>{isRefundTransaction ? t('cart.refund_cash') : t('payment.cash')}</span>
          </button>

          <button
            type="button"
            className="pay-btn pay-btn-card"
            style={isRefundTransaction ? { background: 'var(--accent-rose)', color: '#ffffff' } : undefined}
            disabled={cartItems.length === 0}
            onClick={() => onOpenPayment('card')}
          >
            <CreditCard size={18} style={{ flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {isRefundTransaction ? t('cart.refund_card') : t('payment.card_btn')}
            </span>
          </button>
        </div>

        {/* Secondary actions: split payment and cash drawer share one row */}
        {(cartItems.length > 0 || onOpenCashDrawer) && (
          <div className="cart-secondary-actions">
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

            {onOpenCashDrawer && (
              <button
                type="button"
                className={`cart-drawer-btn ${cartItems.length > 0 ? 'is-compact' : ''}`}
                onClick={onOpenCashDrawer}
                title={t('cart.open_drawer')}
                aria-label={t('cart.open_drawer')}
              >
                <CashDrawerIcon size={17} color="var(--accent-amber)" />
                {cartItems.length === 0 && <span>{t('cart.open_drawer')}</span>}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default React.memo(Cart);
