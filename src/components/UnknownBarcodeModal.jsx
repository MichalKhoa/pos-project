import React, { useState, useEffect, useRef } from 'react';
import { Barcode, Check, X, Tag, Percent } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext.jsx';
import { soundFx } from '../utils/audio.js';

export default function UnknownBarcodeModal({
  scannedBarcode,
  categories = [],
  defaultVat = 21,
  itemMultiplier = 1,
  onSaveAndAdd,
  onClose
}) {
  const { t } = useTranslation();
  const nameInputRef = useRef(null);

  const initialCat = categories.find(c => c.id !== 'all')?.id || 'all';

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [vat, setVat] = useState(Number(defaultVat) || 21);
  const [category, setCategory] = useState(initialCat);
  const [errorMsg, setErrorMsg] = useState('');

  // Auto-focus name field on mount
  useEffect(() => {
    if (nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, []);

  // Keyboard accessibility: Escape to cancel, Enter to submit
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    const cleanName = name.trim();
    const numPrice = parseFloat(price.replace(',', '.'));

    if (!cleanName) {
      setErrorMsg(t('scanner.err_name_required') || 'Zadejte název zboží');
      if (nameInputRef.current) nameInputRef.current.focus();
      return;
    }

    if (isNaN(numPrice) || numPrice < 0) {
      setErrorMsg(t('scanner.err_price_invalid') || 'Zadejte platnou prodejní cenu');
      return;
    }

    setErrorMsg('');
    const newPreset = {
      name: cleanName,
      price: Math.round((numPrice + Number.EPSILON) * 100) / 100,
      vat: parseInt(vat, 10),
      category: category || 'all',
      barcode: scannedBarcode,
      color: '#0284c7',
      trackStock: false,
      stockQuantity: 0
    };

    soundFx.playSuccessChime();
    onSaveAndAdd(newPreset, Math.max(1, Math.abs(itemMultiplier || 1)));
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem'
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--surface-color, #1e293b)',
          color: 'var(--text-color, #f8fafc)',
          borderRadius: '1rem',
          border: '1px solid var(--border-color, #334155)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          width: '100%',
          maxWidth: '480px',
          maxHeight: '90dvh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-color, #334155)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'rgba(2, 132, 199, 0.1)',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '0.5rem',
                backgroundColor: 'rgba(2, 132, 199, 0.2)',
                color: '#38bdf8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Barcode size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: '700', margin: 0, lineHeight: 1.2 }}>
                {t('scanner.unknown_barcode_title') || 'Neznámý čárový kód'}
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)', margin: '0.2rem 0 0 0' }}>
                {t('scanner.unknown_barcode_subtitle') || 'Zadejte název a cenu pro okamžité uložení a prodej'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted, #94a3b8)',
              cursor: 'pointer',
              padding: '0.5rem',
              borderRadius: '0.375rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '40px',
              minWidth: '40px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '1.25rem 1.5rem', gap: '1.25rem' }}>
          {/* Scanned Barcode Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'rgba(15, 23, 42, 0.6)',
              padding: '0.75rem 1rem',
              borderRadius: '0.5rem',
              border: '1px dashed var(--border-color, #475569)'
            }}
          >
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted, #94a3b8)' }}>
              {t('scanner.scanned_code') || 'Naskenovaný kód'}:
            </span>
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: '1.1rem',
                fontWeight: '700',
                letterSpacing: '1px',
                color: '#38bdf8',
                backgroundColor: 'rgba(2, 132, 199, 0.15)',
                padding: '0.2rem 0.6rem',
                borderRadius: '0.25rem'
              }}
            >
              {scannedBarcode}
            </span>
          </div>

          {errorMsg && (
            <div
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#f87171',
                padding: '0.6rem 0.8rem',
                borderRadius: '0.5rem',
                fontSize: '0.85rem',
                fontWeight: '600'
              }}
            >
              {errorMsg}
            </div>
          )}

          {/* Product Name Input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-color, #f8fafc)' }}>
              {t('scanner.item_name') || 'Název zboží'} *
            </label>
            <input
              ref={nameInputRef}
              type="text"
              required
              placeholder={t('scanner.item_name_placeholder') || 'např. Kofola 0.5L plech'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-color, #334155)',
                backgroundColor: 'var(--bg-color, #0f172a)',
                color: 'var(--text-color, #f8fafc)',
                fontSize: '1rem',
                minHeight: '44px',
                outline: 'none'
              }}
            />
          </div>

          {/* Selling Price Input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-color, #f8fafc)' }}>
              {t('scanner.item_price') || 'Prodejní cena (Kč)'} *
            </label>
            <input
              type="text"
              inputMode="decimal"
              required
              placeholder="0.00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-color, #334155)',
                backgroundColor: 'var(--bg-color, #0f172a)',
                color: 'var(--text-color, #f8fafc)',
                fontSize: '1.25rem',
                fontWeight: '700',
                minHeight: '44px',
                outline: 'none'
              }}
            />
          </div>

          {/* VAT Selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-color, #f8fafc)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Percent size={14} /> {t('scanner.vat_rate') || 'Sazba DPH'}
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
              {[21, 12, 0].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => setVat(rate)}
                  style={{
                    padding: '0.6rem',
                    borderRadius: '0.5rem',
                    border: vat === rate ? '2px solid #0284c7' : '1px solid var(--border-color, #334155)',
                    backgroundColor: vat === rate ? 'rgba(2, 132, 199, 0.2)' : 'rgba(15, 23, 42, 0.5)',
                    color: vat === rate ? '#38bdf8' : 'var(--text-color, #f8fafc)',
                    fontWeight: '700',
                    fontSize: '0.95rem',
                    cursor: 'pointer',
                    minHeight: '44px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {rate} %
                </button>
              ))}
            </div>
          </div>

          {/* Category Dropdown */}
          {categories.filter(c => c.id !== 'all').length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-color, #f8fafc)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Tag size={14} /> {t('scanner.category') || 'Kategorie'}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border-color, #334155)',
                  backgroundColor: 'var(--bg-color, #0f172a)',
                  color: 'var(--text-color, #f8fafc)',
                  fontSize: '0.95rem',
                  minHeight: '44px',
                  outline: 'none'
                }}
              >
                {categories.filter(c => c.id !== 'all').map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Footer Actions */}
          <div
            style={{
              display: 'flex',
              gap: '0.75rem',
              marginTop: '0.5rem',
              paddingTop: '1rem',
              borderTop: '1px solid var(--border-color, #334155)'
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '0.75rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-color, #475569)',
                backgroundColor: 'transparent',
                color: 'var(--text-color, #f8fafc)',
                fontWeight: '600',
                cursor: 'pointer',
                minHeight: '44px',
                whiteSpace: 'nowrap'
              }}
            >
              {t('scanner.cancel') || 'Zrušit'}
            </button>
            <button
              type="submit"
              style={{
                flex: 2,
                padding: '0.75rem',
                borderRadius: '0.5rem',
                border: 'none',
                backgroundColor: '#0284c7',
                color: '#ffffff',
                fontWeight: '700',
                cursor: 'pointer',
                minHeight: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                whiteSpace: 'nowrap',
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.4)'
              }}
            >
              <Check size={18} />
              {t('scanner.save_and_add') || 'Uložit & do košíku'}
              {itemMultiplier > 1 && ` (${itemMultiplier}×)`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
