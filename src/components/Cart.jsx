import React, { useState } from 'react';
import { ShoppingCart, Trash2, Plus, Minus, CreditCard, Banknote, Percent, Tag, Split } from 'lucide-react';

export default function Cart({
  cartItems,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
  onOpenPayment,
  onUpdateItemDiscount,
  cartDiscountPercent = 0,
  onSetCartDiscountPercent
}) {
  const [activeDiscountItem, setActiveDiscountItem] = useState(null);
  const [showCartDiscountBar, setShowCartDiscountBar] = useState(false);

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="cart-header">
        <div className="cart-title">
          <ShoppingCart size={20} style={{ color: 'var(--accent-blue)' }} />
          <span>Účtenka / Košík</span>
          {cartItems.length > 0 && (
            <span className="qty-value" style={{ background: 'var(--accent-blue)', color: '#fff', borderRadius: '999px', fontSize: '0.75rem', padding: '2px 8px' }}>
              {cartItems.reduce((sum, i) => sum + i.quantity, 0)}
            </span>
          )}
        </div>

        {cartItems.length > 0 && (
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button
              className="clear-cart-btn"
              style={{ background: cartDiscountPercent > 0 ? 'rgba(37, 99, 235, 0.15)' : 'rgba(0,0,0,0.05)', color: cartDiscountPercent > 0 ? 'var(--accent-blue)' : 'var(--text-secondary)' }}
              onClick={() => setShowCartDiscountBar(!showCartDiscountBar)}
              title="Sleva na celý košík"
            >
              <Percent size={14} />
              <span>Sleva {cartDiscountPercent > 0 ? `${cartDiscountPercent}%` : ''}</span>
            </button>

            <button className="clear-cart-btn" onClick={onClearCart}>
              <Trash2 size={14} />
              <span>Vysypat</span>
            </button>
          </div>
        )}
      </div>

      {/* Cart Discount Selector Drawer */}
      {showCartDiscountBar && cartItems.length > 0 && (
        <div style={{
          background: 'var(--bg-input)',
          borderBottom: '1px solid var(--border-color)',
          padding: '0.6rem 1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          flexWrap: 'wrap'
        }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '700' }}>Sleva košíku:</span>
          {[0, 5, 10, 15, 20, 50].map(pct => (
            <button
              key={pct}
              className={`vat-btn ${cartDiscountPercent === pct ? 'active' : ''}`}
              style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
              onClick={() => {
                onSetCartDiscountPercent(pct);
                setShowCartDiscountBar(false);
              }}
            >
              {pct === 0 ? 'Bez slevy' : `-${pct}%`}
            </button>
          ))}
        </div>
      )}

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
            const isDiscountOpen = activeDiscountItem === item.id;

            return (
              <div key={`${item.id}-${index}`} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div className="cart-item">
                  <div className="cart-item-info">
                    <div className="cart-item-name" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span>{item.name}</span>
                      {itemDisc > 0 && (
                        <span className="status-badge" style={{ padding: '1px 6px', fontSize: '0.7rem', background: 'rgba(225, 29, 72, 0.12)', color: 'var(--accent-rose)', borderColor: 'rgba(225, 29, 72, 0.3)' }}>
                          -{itemDisc}%
                        </span>
                      )}
                    </div>

                    <div className="cart-item-meta">
                      {itemDisc > 0 ? (
                        <>
                          <span style={{ textDecoration: 'line-through', color: 'var(--text-muted)', marginRight: '4px' }}>
                            {parseFloat(item.price).toFixed(2)} Kč
                          </span>
                          <span style={{ color: 'var(--accent-rose)', fontWeight: '700' }}>
                            {effectiveUnitPrice.toFixed(2)} Kč
                          </span>
                        </>
                      ) : (
                        <span>{parseFloat(item.price).toFixed(2)} Kč</span>
                      )}
                      <span> × {item.quantity} (DPH {itemVat}%)</span>
                    </div>
                  </div>

                  <div className="cart-item-right">
                    <button
                      className="qty-btn"
                      style={{ background: itemDisc > 0 ? 'rgba(225, 29, 72, 0.15)' : 'var(--bg-card)', color: itemDisc > 0 ? 'var(--accent-rose)' : 'var(--text-secondary)' }}
                      onClick={() => setActiveDiscountItem(isDiscountOpen ? null : item.id)}
                      title="Sleva na položku"
                    >
                      <Percent size={12} />
                    </button>

                    <div className="qty-controls">
                      <button className="qty-btn" onClick={() => onUpdateQty(item.id, item.quantity - 1)}>
                        <Minus size={12} />
                      </button>
                      <span className="qty-value">{item.quantity}</span>
                      <button className="qty-btn" onClick={() => onUpdateQty(item.id, item.quantity + 1)}>
                        <Plus size={12} />
                      </button>
                    </div>

                    <div className="cart-item-price">
                      {lineTotal.toFixed(2)} Kč
                    </div>

                    <button className="delete-item-btn" onClick={() => onRemoveItem(item.id)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Item-level discount selector drawer */}
                {isDiscountOpen && (
                  <div style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.4rem 0.6rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    marginLeft: '0.5rem'
                  }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '700' }}>Sleva položky:</span>
                    {[0, 5, 10, 15, 20, 50].map(pct => (
                      <button
                        key={pct}
                        className={`vat-btn ${itemDisc === pct ? 'active' : ''}`}
                        style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem' }}
                        onClick={() => {
                          onUpdateItemDiscount(item.id, pct);
                          setActiveDiscountItem(null);
                        }}
                      >
                        {pct === 0 ? '0%' : `-${pct}%`}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="cart-footer">
        <div className="summary-rows">
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
            className="pay-btn pay-btn-cash"
            disabled={cartItems.length === 0}
            onClick={() => onOpenPayment('cash')}
          >
            <Banknote size={18} />
            <span>Hotově</span>
          </button>

          <button
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
            className="nav-tab"
            style={{
              width: '100%',
              justify: 'center',
              padding: '0.5rem',
              fontSize: '0.85rem',
              background: 'rgba(124, 58, 237, 0.1)',
              color: 'var(--accent-purple)',
              border: '1px solid rgba(124, 58, 237, 0.3)',
              fontWeight: '700'
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
