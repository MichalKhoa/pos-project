import React, { useState, useMemo, useEffect } from 'react';
import { Printer, X, Plus, Minus, Check, FileText, ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext';
import { generateBarcodeSVG } from '../../utils/barcodeGenerator';
import { printBarcodeLabelBackend } from '../../api/posApi';

export default function BarcodeLabelModal({
  isOpen,
  onClose,
  preset,
  presets,
  storeConfig = {}
}) {
  const { t } = useTranslation();

  const itemsToPrint = useMemo(() => {
    if (Array.isArray(presets) && presets.length > 0) {
      return presets;
    }
    if (preset) {
      return [preset];
    }
    return [];
  }, [preset, presets]);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [copies, setCopies] = useState(1);
  const [isPrinting, setIsPrinting] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  const getTodayCzechDate = () => {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  };

  const [validityDate, setValidityDate] = useState(getTodayCzechDate);

  useEffect(() => {
    if (isOpen) {
      setSelectedIndex(0);
      setValidityDate(getTodayCzechDate());
      setStatusMsg(null);
    }
  }, [isOpen, preset, presets]);

  if (!isOpen || itemsToPrint.length === 0) return null;

  const currentPreset = itemsToPrint[selectedIndex] || itemsToPrint[0];
  const isBatch = itemsToPrint.length > 1;

  const barcodeVal = String(currentPreset.barcode || currentPreset.id || '').trim();
  const barcodeData = generateBarcodeSVG(barcodeVal, { height: 50, barWidth: 2, quietZone: 10 });
  const storeName = storeConfig.storeName || storeConfig.store_name || 'VoltFlow POS';

  const isWeighted = Boolean(currentPreset.isWeighted || currentPreset.is_weighted || currentPreset.unit === 'kg');
  const unit = currentPreset.unit || 'ks';

  const handleEscposPrint = async () => {
    setIsPrinting(true);
    setStatusMsg(null);
    try {
      for (const p of itemsToPrint) {
        await printBarcodeLabelBackend(p, copies, storeConfig, validityDate);
      }
      setStatusMsg({
        type: 'success',
        text: isBatch
          ? (t('inventory.batch_labels_printed_success') || `Vytištěno ${itemsToPrint.length} cenovek (${copies}x) na termální tiskárně.`)
          : (t('inventory.label_printed_success') || `Vytištěno ${copies} ks štítků na termální tiskárně.`)
      });
      setTimeout(() => {
        setStatusMsg(null);
        onClose();
      }, 1800);
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setIsPrinting(false);
    }
  };

  const handleBrowserPrint = () => {
    window.print();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}
      onClick={e => { if (e.target === e.currentTarget && !isPrinting) onClose(); }}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          width: '100%',
          maxWidth: '500px',
          maxHeight: '90dvh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-input)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(59, 130, 246, 0.15)',
                color: 'var(--accent-blue)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Printer size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                {isBatch
                  ? (t('inventory.batch_shelf_tags_title') || 'Hromadný tisk regálových cenovek')
                  : (t('inventory.label_modal_title') || 'Tisk regálové cenovky')}
              </h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {isBatch
                  ? `${itemsToPrint.length} ${t('inventory.items_in_batch') || 'položek v dávce'}`
                  : currentPreset.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPrinting}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '0.25rem',
              minWidth: '40px',
              minHeight: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {statusMsg && (
            <div
              style={{
                padding: '0.75rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.84rem',
                fontWeight: '700',
                background: statusMsg.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: statusMsg.type === 'success' ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                border: `1px solid ${statusMsg.type === 'success' ? 'var(--accent-emerald)' : 'var(--accent-rose)'}`,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <Check size={16} />
              <div>{statusMsg.text}</div>
            </div>
          )}

          {/* Batch Navigation Selector */}
          {isBatch && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.5rem 0.75rem',
                background: 'var(--bg-input)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                fontSize: '0.84rem',
                fontWeight: '700'
              }}
            >
              <button
                type="button"
                data-testid="batch-prev-btn"
                disabled={selectedIndex === 0}
                onClick={() => setSelectedIndex(prev => Math.max(0, prev - 1))}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: selectedIndex === 0 ? 'var(--text-muted)' : 'var(--accent-blue)',
                  cursor: selectedIndex === 0 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px'
                }}
              >
                <ChevronLeft size={18} />
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-primary)' }}>
                <Layers size={15} style={{ color: 'var(--accent-blue)' }} />
                <span>
                  {selectedIndex + 1} / {itemsToPrint.length}: <strong style={{ color: 'var(--accent-blue)' }}>{currentPreset.name}</strong>
                </span>
              </div>

              <button
                type="button"
                data-testid="batch-next-btn"
                disabled={selectedIndex >= itemsToPrint.length - 1}
                onClick={() => setSelectedIndex(prev => Math.min(itemsToPrint.length - 1, prev + 1))}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: selectedIndex >= itemsToPrint.length - 1 ? 'var(--text-muted)' : 'var(--accent-blue)',
                  cursor: selectedIndex >= itemsToPrint.length - 1 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px'
                }}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}

          {/* Realistic Shelf Label Card Preview */}
          <div
            id="printable-barcode-label"
            data-testid="printable-barcode-label"
            style={{
              background: '#ffffff',
              color: '#000000',
              padding: '1.25rem 1rem',
              borderRadius: 'var(--radius-md)',
              border: '2px dashed #cbd5e1',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              userSelect: 'none'
            }}
          >
            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {storeName}
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: '900', color: '#0f172a', margin: '0.35rem 0 0.25rem 0', lineHeight: 1.2 }}>
              {currentPreset.name}
            </div>

            {/* Selling Price with Unit and VAT */}
            <div style={{ fontSize: '1.75rem', fontWeight: '900', color: '#047857', marginBottom: '0.2rem', display: 'flex', alignItems: 'baseline', justifyContent: 'center', flexWrap: 'wrap', gap: '0.35rem' }}>
              <span>{(currentPreset.price || 0).toFixed(2)} Kč</span>
              <span data-testid="label-unit" style={{ fontSize: '0.88rem', fontWeight: '700', color: '#475569' }}>
                / {unit}
              </span>
              <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b' }}>
                s DPH
              </span>
            </div>

            {/* Weighted Item Price per 1 kg */}
            {isWeighted && (
              <div
                data-testid="label-weighted-price"
                style={{
                  fontSize: '0.88rem',
                  fontWeight: '800',
                  color: '#047857',
                  background: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  padding: '2px 10px',
                  borderRadius: '999px',
                  marginBottom: '0.35rem'
                }}
              >
                Cena za 1 kg: {(currentPreset.price || 0).toFixed(2)} Kč
              </div>
            )}

            {/* Price Validity Date */}
            <div
              data-testid="label-validity-date"
              style={{
                fontSize: '0.74rem',
                fontWeight: '700',
                color: '#64748b',
                marginBottom: '0.45rem'
              }}
            >
              Platnost od: {validityDate}
            </div>

            {/* SVG Barcode Graphic */}
            {barcodeData ? (
              <div style={{ margin: '0.25rem 0' }}>
                <svg
                  width={barcodeData.svgWidth}
                  height={barcodeData.svgHeight}
                  viewBox={`0 0 ${barcodeData.svgWidth} ${barcodeData.svgHeight}`}
                  style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
                >
                  <rect width="100%" height="100%" fill="#ffffff" />
                  {barcodeData.rects.map((r, i) => (
                    <rect key={i} x={r.x} y={0} width={r.width} height={r.height} fill="#000000" />
                  ))}
                  <text
                    x={barcodeData.svgWidth / 2}
                    y={barcodeData.svgHeight - 4}
                    textAnchor="middle"
                    fill="#000000"
                    fontSize="12"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    {barcodeData.text}
                  </text>
                </svg>
              </div>
            ) : (
              <div style={{ padding: '0.5rem', background: '#f1f5f9', borderRadius: '4px', fontSize: '0.85rem', color: '#64748b', fontFamily: 'monospace' }}>
                {barcodeVal || 'Bez kódu'}
              </div>
            )}

            <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.25rem' }}>
              {currentPreset.category} • DPH {currentPreset.vat !== undefined ? currentPreset.vat : 21}%
            </div>
          </div>

          {/* Controls: Validity Date & Copies */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
            {/* Validity Date Input */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '800', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                {t('inventory.label_validity_date') || 'Platnost ceny od:'}
              </label>
              <input
                type="text"
                data-testid="validity-date-input"
                value={validityDate}
                onChange={e => setValidityDate(e.target.value)}
                placeholder="DD.MM.YYYY"
                style={{
                  width: '100%',
                  height: '42px',
                  padding: '0 0.75rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  fontWeight: '700',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Copies Control */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '800', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                {t('inventory.label_copies') || 'Kopií na položku'}:
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <button
                  type="button"
                  onClick={() => setCopies(prev => Math.max(1, prev - 1))}
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <Minus size={18} />
                </button>

                <input
                  type="number"
                  min="1"
                  max="100"
                  value={copies}
                  onChange={e => setCopies(Math.max(1, parseInt(e.target.value || '1', 10)))}
                  style={{
                    width: '60px',
                    height: '42px',
                    textAlign: 'center',
                    fontSize: '1.05rem',
                    fontWeight: '900',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)'
                  }}
                />

                <button
                  type="button"
                  onClick={() => setCopies(prev => Math.min(100, prev + 1))}
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '0.85rem 1.25rem',
            borderTop: '1px solid var(--border-color)',
            background: 'var(--bg-input)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '0.65rem',
            flexWrap: 'wrap'
          }}
        >
          <button
            type="button"
            onClick={handleBrowserPrint}
            style={{
              height: '42px',
              padding: '0 1rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              fontSize: '0.84rem',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
            title="Tisk přes standardní tiskový dialog Windows/prohlížeče"
          >
            <FileText size={16} />
            <span>{t('inventory.label_browser_print') || 'Tisk z PC'}</span>
          </button>

          <button
            type="button"
            data-testid="thermal-print-submit-btn"
            onClick={handleEscposPrint}
            disabled={isPrinting}
            style={{
              height: '42px',
              padding: '0 1.25rem',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: 'var(--accent-emerald)',
              color: '#ffffff',
              fontSize: '0.88rem',
              fontWeight: '800',
              cursor: isPrinting ? 'default' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              opacity: isPrinting ? 0.6 : 1
            }}
          >
            <Printer size={18} />
            <span>
              {isPrinting
                ? (t('common.saving') || 'Tisknu...')
                : isBatch
                  ? `${t('inventory.batch_print_btn') || 'Vytisknout cenovky'} (${itemsToPrint.length} ks × ${copies}x)`
                  : `${t('inventory.label_thermal_print') || 'Vytisknout štítek'} (${copies}x)`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

