import React, { useState } from 'react';
import { Printer, X, Plus, Minus, Check, FileText } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext';
import { generateBarcodeSVG } from '../../utils/barcodeGenerator';
import { printBarcodeLabelBackend } from '../../api/posApi';

export default function BarcodeLabelModal({
  isOpen,
  onClose,
  preset,
  storeConfig = {}
}) {
  const { t } = useTranslation();
  const [copies, setCopies] = useState(1);
  const [isPrinting, setIsPrinting] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  if (!isOpen || !preset) return null;

  const barcodeVal = String(preset.barcode || preset.id || '').trim();
  const barcodeData = generateBarcodeSVG(barcodeVal, { height: 50, barWidth: 2, quietZone: 10 });
  const storeName = storeConfig.storeName || storeConfig.store_name || 'VoltFlow POS';

  const handleEscposPrint = async () => {
    setIsPrinting(true);
    setStatusMsg(null);
    try {
      const res = await printBarcodeLabelBackend(preset, copies, storeConfig);
      if (res && res.success) {
        setStatusMsg({ type: 'success', text: t('inventory.label_printed_success') || `Vytištěno ${copies} ks štítků na termální tiskárně.` });
        setTimeout(() => {
          setStatusMsg(null);
          onClose();
        }, 1800);
      } else {
        setStatusMsg({ type: 'error', text: t('inventory.label_printed_error') || 'Nepodařilo se vytisknout štítek na tiskárně.' });
      }
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
          maxWidth: '460px',
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
                {t('inventory.label_modal_title') || 'Tisk čárového štítku'}
              </h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {preset.name}
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
              padding: '0.25rem'
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

          {/* Realistic Label Card Preview */}
          <div
            id="printable-barcode-label"
            style={{
              background: '#ffffff',
              color: '#000000',
              padding: '1rem',
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
            <div style={{ fontSize: '1.15rem', fontWeight: '900', color: '#0f172a', margin: '0.25rem 0 0.4rem 0', lineHeight: 1.2 }}>
              {preset.name}
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: '900', color: '#047857', marginBottom: '0.4rem' }}>
              {(preset.price || 0).toFixed(2)} Kč
              <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b', marginLeft: '0.35rem' }}>
                s DPH
              </span>
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
              {preset.category} • DPH {preset.vat || 21}%
            </div>
          </div>

          {/* Copies Control */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: '800', color: 'var(--text-secondary)' }}>
              {t('inventory.label_copies') || 'Počet kopií k vytištění'}:
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
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
                  width: '70px',
                  height: '42px',
                  textAlign: 'center',
                  fontSize: '1.15rem',
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

              {/* Quick count chips */}
              <div style={{ display: 'flex', gap: '0.35rem', marginLeft: 'auto' }}>
                {[1, 2, 5, 10].map(cnt => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => setCopies(cnt)}
                    style={{
                      height: '42px',
                      padding: '0 0.65rem',
                      borderRadius: 'var(--radius-md)',
                      border: copies === cnt ? '1px solid var(--accent-blue)' : '1px solid var(--border-color)',
                      background: copies === cnt ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-input)',
                      color: copies === cnt ? 'var(--accent-blue)' : 'var(--text-secondary)',
                      fontSize: '0.84rem',
                      fontWeight: '800',
                      cursor: 'pointer'
                    }}
                  >
                    {cnt}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
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
                : `${t('inventory.label_thermal_print') || 'Vytisknout štítek'} (${copies}x)`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
