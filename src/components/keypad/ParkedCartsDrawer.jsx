import React, { useState } from 'react';
import { ShoppingBag, PauseCircle, PlayCircle, Clock, Trash2, X } from 'lucide-react';

export default function ParkedCartsDrawer({
  hasCartItems,
  parkedCarts = [],
  onParkCart,
  onRestoreParkedCart,
  onDeleteParkedCart
}) {
  const [showHoldModal, setShowHoldModal] = useState(false);

  return (
    <>
      <div
        className="hold-cart-card-standalone pos-standalone-card"
        style={{
          background: 'var(--bg-main)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '0.75rem 0.85rem',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          flexShrink: 0
        }}
      >
        <div style={{
          fontSize: '0.72rem',
          fontWeight: '800',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem'
        }}>
          <ShoppingBag size={14} style={{ color: 'var(--accent-amber)' }} />
          <span>Odložené Nákupy (Zákazníci)</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          {/* ODLOŽIT NÁKUP (Park active cart) */}
          <button
            type="button"
            className="key-btn"
            disabled={!hasCartItems}
            onClick={() => onParkCart && onParkCart()}
            style={{
              height: '50px',
              fontSize: '0.88rem',
              fontWeight: '900',
              background: hasCartItems
                ? 'linear-gradient(135deg, rgba(245,158,11,0.25) 0%, rgba(217,119,6,0.35) 100%)'
                : 'var(--bg-card)',
              color: hasCartItems ? 'var(--accent-amber)' : 'var(--text-muted)',
              border: hasCartItems ? '2px solid rgba(245,158,11,0.6)' : '1px solid var(--border-color)',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              opacity: hasCartItems ? 1 : 0.45,
              cursor: hasCartItems ? 'pointer' : 'default',
              boxShadow: hasCartItems ? '0 3px 10px rgba(245,158,11,0.2)' : 'none'
            }}
            title="Odložit aktuální nákup pro vyřízení jiného zákazníka"
          >
            <PauseCircle size={19} />
            <span>Odložit nákup</span>
          </button>

          {/* OBNOVIT NÁKUP (Restore held cart) */}
          <button
            type="button"
            className="key-btn"
            disabled={parkedCarts.length === 0}
            onClick={() => setShowHoldModal(true)}
            style={{
              height: '50px',
              fontSize: '0.88rem',
              fontWeight: '900',
              background: parkedCarts.length > 0
                ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                : 'var(--bg-card)',
              color: parkedCarts.length > 0 ? '#fff' : 'var(--text-muted)',
              border: parkedCarts.length > 0 ? 'none' : '1px solid var(--border-color)',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              opacity: parkedCarts.length > 0 ? 1 : 0.45,
              cursor: parkedCarts.length > 0 ? 'pointer' : 'default',
              boxShadow: parkedCarts.length > 0 ? '0 4px 14px rgba(59,130,246,0.4)' : 'none'
            }}
            title="Obnovit odložený nákup"
          >
            <PlayCircle size={19} />
            <span>Obnovit ({parkedCarts.length})</span>
          </button>
        </div>
      </div>

      {/* ── Modal Dialog for Parked / Held Carts ────────────────── */}
      {showHoldModal && (
        <div className="modal-overlay" style={{ zIndex: 9999 }} onClick={() => setShowHoldModal(false)}>
          <div
            className="modal-card"
            style={{ width: '92%', maxWidth: '520px', padding: '1.25rem', borderRadius: '16px' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                <Clock size={20} style={{ color: 'var(--accent-amber)' }} />
                <span>Odložené nákupy ({parkedCarts.length})</span>
              </h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowHoldModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.3rem' }}
              >
                <X size={22} />
              </button>
            </div>

            {parkedCarts.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Žádné odložené nákupy.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '360px', overflowY: 'auto' }}>
                {parkedCarts.map((holdItem, index) => (
                  <div
                    key={holdItem.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.85rem 1rem',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '12px',
                      gap: '0.75rem'
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: '800', fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                        Nákup #{index + 1} — <span style={{ color: 'var(--accent-blue)' }}>{holdItem.timeStr}</span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                        {holdItem.itemCount} položek • {holdItem.items.map(i => i.name).slice(0, 3).join(', ')}{holdItem.items.length > 3 ? '...' : ''}
                      </div>
                      <div style={{ fontSize: '1rem', fontWeight: '900', color: 'var(--accent-emerald)', marginTop: '0.2rem', fontFamily: 'var(--font-mono)' }}>
                        {holdItem.totalAmount.toLocaleString('cs-CZ')} Kč
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                      <button
                        type="button"
                        className="pay-btn pay-btn-cash"
                        onClick={() => {
                          if (onRestoreParkedCart) onRestoreParkedCart(holdItem.id);
                          setShowHoldModal(false);
                        }}
                        style={{ height: '42px', padding: '0 1rem', fontSize: '0.85rem', fontWeight: '800', gap: '0.3rem' }}
                      >
                        <PlayCircle size={16} />
                        <span>Obnovit</span>
                      </button>

                      <button
                        type="button"
                        className="key-btn"
                        onClick={() => onDeleteParkedCart && onDeleteParkedCart(holdItem.id)}
                        style={{
                          height: '42px',
                          width: '42px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'rgba(239,68,68,0.1)',
                          color: 'var(--accent-rose)',
                          border: '1px solid rgba(239,68,68,0.3)',
                          borderRadius: '8px'
                        }}
                        title="Smazat tento odložený nákup"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
