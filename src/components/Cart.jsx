import React from 'react';
import { ShoppingCart, Trash2, Plus, Minus, CreditCard, Banknote, Percent, Split } from 'lucide-react';

export default function Cart({
  cartItems,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
  onOpenPayment,
  onUpdateItemDiscount,
  cartDiscountPercent = 0,
  onSetCartDiscountPercent,
  onOpenCustomDiscount
}) {
  // Calculate item effective gross totals after item-level discounts
  const rawSubtotal = cartItems.reduce((sum, item) => {
    const disc = item.discountPercent || 0;
    const effectivePrice = item.price * (1 - disc / 100);
    return sum + (effectivePrice * item.quantity);
  }, 0);

  // Apply Cart-Level Discount
  const cartDiscountAmount = rawSubtotal * (cartDiscountPercent / 100);
  const finalGrandTotal = Math.max(0, rawSubtotal - cartDiscountAmount);
  const cartDiscountFactor = rawSubtotal > 0 ? finalGrandTotal / rawSubtotal : 1;

  // Group tax totals accurately per VAT rate (21%, 12%, 0%) after all discounts
  const taxSummary = cartItems.reduce((acc, item) => {
    const rate = item.vat !== undefined && item.vat !== null ? parseInt(item.vat, 10) : 21;
    const itemDisc = item.discountPercent || 0;
    const itemEffectivePrice = item.price * (1 - itemDisc / 100);
    const itemGrossBeforeCartDisc = itemEffectivePrice * item.quantity;
    const itemFinalGross = itemGrossBeforeCartDisc * cartDiscountFactor;

    let netPrice = itemFinalGross;
    let taxAmount = 0;

    if (rate > 0) {
      netPrice = itemFinalGross / (1 + rate / 100);
      taxAmount = itemFinalGross - netPrice;
    }

    if (!acc[rate]) {
      acc[rate] = { rate, gross: 0, net: 0, tax: 0 };
    }
    acc[rate].gross += itemFinalGross;
    acc[rate].net += netPrice;
    acc[rate].tax += taxAmount;
    return acc;
  }, {});

  const sortedRates = Object.values(taxSummary).sort((a, b) => b.rate - a.rate);
  const totalNet = sortedRates.reduce((sum, t) => sum + t.net, 0);
  const totalTax = sortedRates.reduce((sum, t) => sum + t.tax, 0);
  const totalItemCount = cartItems.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Cart Header */}
      <div className="cart-header">
        <div className="cart-title" style={{ flexShrink: 1, minWidth: 0 }}>
          <ShoppingCart size={18} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
          <span>Košík</span>
          {cartItems.length > 0 && (
            <span className="cart-badge-count">
              {totalItemCount}
            </span>
          )}
        </div>

        {cartItems.length > 0 && (
          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexShrink: 0 }}>
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
                fontWeight: '800'
              }}
              onClick={() => onOpenCustomDiscount && onOpenCustomDiscount(null)}
              title="Sleva na celý košík"
            >
              <Percent size={13} />
              <span>{cartDiscountPercent > 0 ? `-${cartDiscountPercent}%` : 'Sleva'}</span>
            </button>

            <button
              type="button"
              className="clear-cart-btn"
              style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
              onClick={onClearCart}
              title="Vysypat celý košík"
            >
              <Trash2 size={13} />
              <span>Vysypat</span>
            </button>
          </div>
        )}
      </div>

      {/* Cart Items List */}
      <div className="cart-items-container">
        {cartItems.length === 0 ? (
          <div className="empty-cart">
            <div className="empty-cart-icon">
              <ShoppingCart size={28} />
            </div>
            <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>Košík je prázdný</div>
            <div style={{ fontSize: '0.8rem' }}>Klikněte na rychlé tlačítko nebo zadejte částku na klávesnici</div>
          </div>
        ) : (
          cartItems.map((item, index) => {
            const itemVat = item.vat !== undefined && item.vat !== null ? parseInt(item.vat, 10) : 21;
            const itemDisc = item.discountPercent || 0;
            const effectiveUnitPrice = item.price * (1 - itemDisc / 100);
            const lineTotal = effectiveUnitPrice * item.quantity;

            return (
              <div key={`${item.id}-${index}`} className="cart-item-card">
                {/* Row 1 Top: Item Name & Action Buttons (%, Qty Stepper, Delete) */}
                <div className="cart-item-row-top">
                  <div className="cart-item-name-group">
                    <span className="cart-item-name-text">{item.name}</span>
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
                        <Minus size={10} />
                      </button>
                      <span className="cart-stepper-num">{item.quantity}</span>
                      <button type="button" className="cart-stepper-btn" onClick={() => onUpdateQty(item.id, item.quantity + 1)}>
                        <Plus size={10} />
                      </button>
                    </div>

                    <button type="button" className="cart-del-btn" onClick={() => onRemoveItem(item.id)} title="Smazat položku">
                      <Trash2 size={14} />
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
                        <span style={{ color: 'var(--accent-rose)', fontWeight: '800' }}>
                          {effectiveUnitPrice.toFixed(2)} Kč
                        </span>
                      </span>
                    ) : (
                      <span>{parseFloat(item.price).toFixed(2)} Kč</span>
                    )}
                    <span style={{ opacity: 0.6 }}> × {item.quantity} (DPH {itemVat}%)</span>
                  </div>

                  <div className="cart-item-line-total-price">
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
          <div className="summary-row">
            <span>Celkový počet položek:</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', color: 'var(--text-primary)' }}>
              {totalItemCount} ks
            </span>
          </div>

          {cartDiscountPercent > 0 && (
            <div className="summary-row" style={{ color: 'var(--accent-rose)', fontWeight: '700' }}>
              <span>Sleva na košík ({cartDiscountPercent}%):</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>-{cartDiscountAmount.toFixed(2)} Kč</span>
            </div>
          )}

          <div className="summary-row">
            <span>Základ daně (Netto):</span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>{totalNet.toFixed(2)} Kč</span>
          </div>

          <div className="summary-row">
            <span>DPH celkem:</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-purple)' }}>{totalTax.toFixed(2)} Kč</span>
          </div>

          <div className="summary-row total-row">
            <span>CELKEM K ÚHRADĚ:</span>
            <span className="total-amount">{finalGrandTotal.toFixed(2)} Kč</span>
          </div>
        </div>

        <div className="payment-actions-grid">
          <button
            type="button"
            className="pay-btn pay-btn-cash"
            disabled={cartItems.length === 0}
            onClick={() => onOpenPayment('cash')}
          >
            <Banknote size={18} />
            <span>Hotově</span>
          </button>

          <button
            type="button"
            className="pay-btn pay-btn-card"
            disabled={cartItems.length === 0}
            onClick={() => onOpenPayment('card')}
          >
            <CreditCard size={18} />
            <span>Karta / QR</span>
          </button>
        </div>

        {/* Split Payment Button */}
        {cartItems.length > 0 && (
          <button
            type="button"
            className="nav-tab"
            style={{
              width: '100%',
              justifyContent: 'center',
              padding: '0.6rem',
              fontSize: '0.85rem',
              background: 'rgba(124, 58, 237, 0.1)',
              color: 'var(--accent-purple)',
              border: '1px solid rgba(124, 58, 237, 0.3)',
              fontWeight: '700',
              cursor: 'pointer'
            }}
            onClick={() => onOpenPayment('split')}
          >
            <Split size={16} />
            <span>Kombinovaná platba (Hotovost + Karta)</span>
          </button>
        )}
      </div>
    </div>
  );
}
