import React, { useState, useEffect } from 'react';
import { ShoppingBag, PauseCircle, PlayCircle, Clock, Trash2, X, Tag, Check, Edit2, AlertCircle } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext.jsx';

export default function ParkedCartsDrawer({
  hasCartItems,
  parkedCarts = [],
  onParkCart,
  onRestoreParkedCart,
  onDeleteParkedCart,
  onUpdateParkedCartNote,
  isOpen,
  onOpenChange
}) {
  const { t } = useTranslation();
  const [internalOpen, setInternalOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [autoParkNotice, setAutoParkNotice] = useState(false);

  const showHoldModal = isOpen !== undefined ? isOpen : internalOpen;
  const setModalOpen = (open) => {
    if (onOpenChange) onOpenChange(open);
    setInternalOpen(open);
  };

  useEffect(() => {
    if (!confirmDeleteId) return;
    const timer = setTimeout(() => setConfirmDeleteId(null), 4000);
    return () => clearTimeout(timer);
  }, [confirmDeleteId]);

  const handleStartEditNote = (cart) => {
    setEditingNoteId(cart.id);
    setNoteText(cart.note || '');
  };

  const handleSaveNote = (id) => {
    if (onUpdateParkedCartNote) {
      onUpdateParkedCartNote(id, noteText.trim());
    }
    setEditingNoteId(null);
    setNoteText('');
  };

  const handleRestore = (id) => {
    if (onRestoreParkedCart) {
      const res = onRestoreParkedCart(id);
      if (res && res.autoParked) {
        setAutoParkNotice(true);
        setTimeout(() => setAutoParkNotice(false), 3500);
      }
    }
    setModalOpen(false);
  };

  const handleDeleteClick = (id) => {
    if (confirmDeleteId === id) {
      if (onDeleteParkedCart) onDeleteParkedCart(id);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(id);
    }
  };

  return (
    <>
      <div
        className="hold-cart-card-standalone pos-standalone-card"
        style={{
          background: 'color-mix(in srgb, var(--text-primary) 3%, transparent)',
          border: '1px solid color-mix(in srgb, var(--border-color) 70%, transparent)',
          borderRadius: 'var(--radius-md)',
          padding: '0.65rem 0.85rem',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.45rem',
          flexShrink: 0
        }}
      >
        <div style={{
          fontSize: '0.7rem',
          fontWeight: '800',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem'
        }}>
          <ShoppingBag size={14} style={{ color: 'var(--accent-amber)' }} />
          <span>{t('parked_carts.card_title')}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
          {/* ODLOŽIT NÁKUP (Park active cart) */}
          <button
            type="button"
            className="key-btn"
            disabled={!hasCartItems}
            onClick={() => onParkCart && onParkCart()}
            style={{
              height: '42px',
              fontSize: '0.84rem',
              fontWeight: '800',
              background: hasCartItems
                ? 'color-mix(in srgb, var(--accent-amber) 16%, transparent)'
                : 'transparent',
              color: hasCartItems ? 'var(--accent-amber)' : 'var(--text-muted)',
              border: hasCartItems ? '1.5px solid color-mix(in srgb, var(--accent-amber) 50%, transparent)' : '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              opacity: hasCartItems ? 1 : 0.45,
              cursor: hasCartItems ? 'pointer' : 'default',
              boxShadow: hasCartItems ? '0 2px 8px rgba(245,158,11,0.18)' : 'none',
              whiteSpace: 'nowrap',
              padding: '0 0.5rem',
              overflow: 'hidden'
            }}
            title={t('parked_carts.park_btn_title')}
          >
            <PauseCircle size={16} style={{ flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{t('parked_carts.park_btn')}</span>
          </button>

          {/* OBNOVIT NÁKUP (Restore held cart) */}
          <button
            type="button"
            className="key-btn"
            disabled={parkedCarts.length === 0}
            onClick={() => setModalOpen(true)}
            style={{
              height: '42px',
              fontSize: '0.84rem',
              fontWeight: '800',
              background: parkedCarts.length > 0
                ? 'var(--accent-blue)'
                : 'transparent',
              color: parkedCarts.length > 0 ? '#fff' : 'var(--text-muted)',
              border: parkedCarts.length > 0 ? 'none' : '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              opacity: parkedCarts.length > 0 ? 1 : 0.45,
              cursor: parkedCarts.length > 0 ? 'pointer' : 'default',
              boxShadow: parkedCarts.length > 0 ? '0 2px 10px rgba(59,130,246,0.3)' : 'none',
              whiteSpace: 'nowrap',
              padding: '0 0.5rem',
              overflow: 'hidden'
            }}
            title={t('parked_carts.restore_btn_title')}
          >
            <PlayCircle size={16} style={{ flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{t('parked_carts.restore_btn')} ({parkedCarts.length})</span>
          </button>
        </div>
      </div>

      {/* ── Auto-parked notice notification banner ────────────────── */}
      {autoParkNotice && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--bg-card, #1e293b)',
          border: '1px solid var(--accent-amber)',
          color: 'var(--text-primary, #fff)',
          padding: '0.75rem 1.25rem',
          borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          zIndex: 10000,
          fontWeight: '700',
          fontSize: '0.9rem'
        }}>
          <AlertCircle size={18} style={{ color: 'var(--accent-amber)' }} />
          <span>{t('parked_carts.auto_parked_toast')}</span>
        </div>
      )}

      {/* ── Modal Dialog for Parked / Held Carts ────────────────── */}
      {showHoldModal && (
        <div className="modal-overlay" style={{ zIndex: 9999 }} onClick={() => setModalOpen(false)}>
          <div
            className="modal-card"
            style={{
              width: '95vw',
              maxWidth: '780px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              padding: '1.25rem',
              borderRadius: '16px',
              overflow: 'hidden'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
              borderBottom: '1px solid var(--border-color)',
              paddingBottom: '0.75rem',
              flexShrink: 0
            }}>
              <h3 style={{
                margin: 0,
                fontSize: '1.25rem',
                fontWeight: '800',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                color: 'var(--text-primary)'
              }}>
                <Clock size={22} style={{ color: 'var(--accent-amber)' }} />
                <span>{t('parked_carts.modal_title')} ({parkedCarts.length})</span>
              </h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setModalOpen(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.4rem' }}
              >
                <X size={24} />
              </button>
            </div>

            {parkedCarts.length === 0 ? (
              <div style={{ padding: '3.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                {t('parked_carts.empty')}
              </div>
            ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem',
                flex: 1,
                maxHeight: 'calc(90vh - 130px)',
                overflowY: 'auto',
                paddingRight: '0.35rem'
              }}>
                {parkedCarts.map((holdItem, index) => {
                  const isConfirmingDelete = confirmDeleteId === holdItem.id;
                  const isEditingNote = editingNoteId === holdItem.id;

                  return (
                    <div
                      key={holdItem.id}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        padding: '0.75rem 1rem',
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '12px',
                        gap: '0.5rem'
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.75rem'
                      }}>
                        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: '800', fontSize: '0.95rem', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                              {t('parked_carts.cart_prefix')}{index + 1} — <span style={{ color: 'var(--accent-blue)' }}>{holdItem.timeStr}</span>
                            </span>
                            {holdItem.note && !isEditingNote && (
                              <span
                                onClick={() => handleStartEditNote(holdItem)}
                                style={{
                                  background: 'rgba(245,158,11,0.15)',
                                  color: 'var(--accent-amber)',
                                  border: '1px solid rgba(245,158,11,0.3)',
                                  borderRadius: '6px',
                                  padding: '0.15rem 0.45rem',
                                  fontSize: '0.75rem',
                                  fontWeight: '700',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap'
                                }}
                                title={t('parked_carts.note_placeholder')}
                              >
                                <Tag size={11} />
                                {holdItem.note}
                              </span>
                            )}
                          </div>

                          <div style={{
                            fontSize: '0.8rem',
                            color: 'var(--text-muted)',
                            marginTop: '0.2rem',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {holdItem.itemCount} {t('parked_carts.items_unit')} • {holdItem.items.map(i => `${i.name}${i.quantity > 1 ? ` (${i.quantity}x)` : ''}`).slice(0, 4).join(', ')}{holdItem.items.length > 4 ? '...' : ''}
                          </div>
                        </div>

                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          flexShrink: 0
                        }}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{
                              fontSize: '1.12rem',
                              fontWeight: '900',
                              color: 'var(--accent-emerald)',
                              fontFamily: 'var(--font-mono)',
                              whiteSpace: 'nowrap'
                            }}>
                              {holdItem.totalAmount.toFixed(2)} Kč
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', flexShrink: 0 }}>
                            <button
                              type="button"
                              onClick={() => handleRestore(holdItem.id)}
                              style={{
                                width: 'auto',
                                height: '42px',
                                padding: '0 1.15rem',
                                fontSize: '0.88rem',
                                fontWeight: '800',
                                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '10px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.4rem',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                boxShadow: '0 3px 10px rgba(16, 185, 129, 0.3)',
                                flexShrink: 0
                              }}
                            >
                              <PlayCircle size={17} />
                              <span>{t('parked_carts.restore_btn')}</span>
                            </button>

                            <button
                              type="button"
                              className="key-btn"
                              onClick={() => handleDeleteClick(holdItem.id)}
                              style={{
                                height: '42px',
                                width: isConfirmingDelete ? 'auto' : '42px',
                                minWidth: isConfirmingDelete ? 'auto' : '42px',
                                padding: isConfirmingDelete ? '0 0.8rem' : '0',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: isConfirmingDelete ? 'var(--accent-rose, #ef4444)' : 'rgba(239,68,68,0.1)',
                                color: isConfirmingDelete ? '#fff' : 'var(--accent-rose)',
                                border: isConfirmingDelete ? '1px solid var(--accent-rose)' : '1px solid rgba(239,68,68,0.3)',
                                borderRadius: '10px',
                                fontSize: isConfirmingDelete ? '0.8rem' : 'inherit',
                                fontWeight: isConfirmingDelete ? '800' : 'normal',
                                whiteSpace: 'nowrap',
                                gap: '0.35rem',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                flexShrink: 0
                              }}
                              title={t('parked_carts.delete_title')}
                            >
                              <Trash2 size={17} />
                              {isConfirmingDelete && <span>{t('parked_carts.delete_confirm')}</span>}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Note edit row or add note button */}
                      {isEditingNote ? (
                        <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.2rem' }}>
                          <input
                            type="text"
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveNote(holdItem.id);
                              if (e.key === 'Escape') setEditingNoteId(null);
                            }}
                            placeholder={t('parked_carts.note_placeholder')}
                            autoFocus
                            style={{
                              flex: 1,
                              height: '36px',
                              padding: '0 0.6rem',
                              fontSize: '0.82rem',
                              borderRadius: '6px',
                              border: '1px solid var(--accent-blue)',
                              background: 'var(--bg-main)',
                              color: 'var(--text-primary)'
                            }}
                          />
                          <button
                            type="button"
                            className="key-btn"
                            onClick={() => handleSaveNote(holdItem.id)}
                            style={{
                              height: '36px',
                              padding: '0 0.75rem',
                              fontSize: '0.8rem',
                              fontWeight: '700',
                              background: 'var(--accent-emerald)',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '6px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            <Check size={14} />
                            <span>{t('parked_carts.save_note')}</span>
                          </button>
                          <button
                            type="button"
                            className="key-btn"
                            onClick={() => setEditingNoteId(null)}
                            style={{
                              height: '36px',
                              padding: '0 0.5rem',
                              fontSize: '0.8rem',
                              background: 'transparent',
                              border: '1px solid var(--border-color)',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {t('parked_carts.cancel')}
                          </button>
                        </div>
                      ) : !holdItem.note ? (
                        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                          <button
                            type="button"
                            onClick={() => handleStartEditNote(holdItem)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-muted)',
                              fontSize: '0.75rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              cursor: 'pointer',
                              padding: '0.1rem 0'
                            }}
                          >
                            <Edit2 size={12} />
                            <span>{t('parked_carts.note_placeholder')}</span>
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
