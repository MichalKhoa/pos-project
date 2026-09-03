import React, { useState, useEffect, useRef } from 'react';
import { Tag, Check, Trash2, Layers, ScanLine } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext';
import PresetColorPicker from './preset-modal/PresetColorPicker';
import PresetIconPicker from './preset-modal/PresetIconPicker';
import PresetStockFields from './preset-modal/PresetStockFields';
import PresetTileCard from './presets/PresetTileCard';

export default function PresetModal({
  isOpen,
  mode = 'add', // 'add' | 'edit'
  preset = null,
  categories = [],
  defaultCategory = 'all',
  defaultShowInPresets = true,
  onClose,
  onSave,
  onDelete,
  storeConfig = null,
  buttonStyle = null
}) {
  const { t } = useTranslation();

  const defaultVat = storeConfig?.defaultVat !== undefined ? parseInt(storeConfig.defaultVat, 10) : 21;

  const [formData, setFormData] = useState({
    name: '',
    price: '',
    costPrice: '',
    isOpenPrice: defaultShowInPresets,
    isGeneralPreset: false,
    vat: defaultVat,
    category: 'all',
    color: '#2563eb',
    icon: '',
    imageUrl: '',
    barcode: '',
    trackStock: !defaultShowInPresets,
    stockQuantity: 0,
    minStockAlert: 5,
    showInPresets: defaultShowInPresets
  });

  const [scannedFeedback, setScannedFeedback] = useState(false);
  const barcodeBufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && preset) {
        const isGen = !!preset.isGeneralPreset;
        const isPinned = preset.showInPresets !== undefined ? !!preset.showInPresets : (preset.show_in_presets !== undefined ? !!preset.show_in_presets : true);
        const cost = preset.costPrice !== undefined ? preset.costPrice : (preset.cost_price !== undefined ? preset.cost_price : '');
        setFormData({
          name: preset.name || '',
          price: preset.isOpenPrice ? '' : (preset.price !== undefined ? preset.price.toString() : ''),
          costPrice: cost !== '' && cost !== null && cost !== undefined ? cost.toString() : '',
          isOpenPrice: !!preset.isOpenPrice,
          isGeneralPreset: isGen,
          vat: preset.vat !== undefined ? preset.vat : defaultVat,
          category: preset.category || 'all',
          color: preset.color || '#2563eb',
          icon: preset.icon || '',
          imageUrl: preset.imageUrl || '',
          barcode: preset.barcode || '',
          trackStock: isGen ? false : (preset.trackStock !== undefined ? preset.trackStock : false),
          stockQuantity: isGen ? 0 : (preset.stockQuantity !== undefined ? preset.stockQuantity : 0),
          minStockAlert: preset.minStockAlert !== undefined ? preset.minStockAlert : 5,
          showInPresets: isPinned
        });
      } else {
        setFormData({
          name: '',
          price: '',
          costPrice: '',
          isOpenPrice: defaultShowInPresets,
          isGeneralPreset: false,
          vat: defaultVat,
          category: defaultCategory === 'all' ? (categories[1]?.id || categories[0]?.id || 'all') : defaultCategory,
          color: '#2563eb',
          icon: '',
          imageUrl: '',
          barcode: '',
          trackStock: !defaultShowInPresets,
          stockQuantity: 0,
          minStockAlert: 5,
          showInPresets: defaultShowInPresets
        });
      }
    }
  }, [isOpen, mode, preset, defaultCategory, categories, defaultVat, defaultShowInPresets]);

  // Hardware USB Barcode Scanner listener (captures rapid keystrokes ending in Enter)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      const activeTag = document.activeElement?.tagName;
      const activeType = document.activeElement?.getAttribute('type');
      const isInput = activeTag === 'INPUT' && activeType !== 'checkbox' && activeType !== 'color';

      const now = Date.now();
      const diff = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (e.key === 'Enter') {
        const buffer = barcodeBufferRef.current.trim();
        if (buffer.length >= 3) {
          e.preventDefault();
          e.stopPropagation();
          setFormData(prev => ({ ...prev, barcode: buffer }));
          setScannedFeedback(true);
          setTimeout(() => setScannedFeedback(false), 2500);
          barcodeBufferRef.current = '';
          return;
        }
        barcodeBufferRef.current = '';
        return;
      }

      if (e.key && e.key.length === 1) {
        if (diff > 80 && !isInput) {
          barcodeBufferRef.current = e.key;
        } else if (diff <= 80) {
          barcodeBufferRef.current += e.key;
        } else if (!isInput) {
          barcodeBufferRef.current += e.key;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    let numericPrice = parseFloat(formData.price);
    if (formData.isOpenPrice) {
      numericPrice = 0;
    } else if (isNaN(numericPrice)) {
      return;
    }

    const isGen = !!formData.isGeneralPreset;
    const result = {
      ...(preset || {}),
      id: mode === 'edit' && preset ? preset.id : `preset-${Date.now()}`,
      name: formData.name.trim(),
      price: numericPrice,
      isOpenPrice: formData.isOpenPrice,
      isGeneralPreset: isGen,
      vat: parseInt(formData.vat, 10),
      category: formData.category,
      color: formData.color,
      icon: formData.icon || null,
      imageUrl: formData.imageUrl || null,
      barcode: formData.barcode.trim(),
      trackStock: isGen ? false : formData.trackStock,
      stockQuantity: isGen ? 0 : parseInt(formData.stockQuantity || '0', 10),
      minStockAlert: parseInt(formData.minStockAlert || '5', 10),
      showInPresets: formData.showInPresets,
      costPrice: parseFloat(formData.costPrice) || 0.0
    };

    onSave(result);
    onClose();
  };

  const sectionCardStyle = {
    background: 'var(--bg-card)',
    padding: '1rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-color)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '1000px', width: '96vw', maxHeight: '92dvh', display: 'flex', flexDirection: 'column' }}
      >
        <div className="modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1.25rem' }}>
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Tag size={20} style={{ color: 'var(--accent-blue)' }} />
            <span>{mode === 'add' ? t('presets.add_preset_title') : t('presets.edit_preset_title')}</span>
          </div>

          {/* Finishing action buttons on top */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {mode === 'edit' && onDelete && (
              <button
                type="button"
                className="nav-tab"
                style={{
                  background: 'rgba(239, 68, 68, 0.12)',
                  color: 'var(--accent-rose)',
                  borderColor: 'rgba(239, 68, 68, 0.3)',
                  height: '38px',
                  padding: '0 0.85rem',
                  fontSize: '0.82rem',
                  fontWeight: '700'
                }}
                onClick={onDelete}
                title={t('presets.delete')}
              >
                <Trash2 size={16} />
                <span>{t('presets.delete')}</span>
              </button>
            )}

            <button
              type="button"
              className="nav-tab"
              style={{ height: '38px', padding: '0 1rem', fontSize: '0.85rem', fontWeight: '700' }}
              onClick={onClose}
            >
              {t('common.cancel')}
            </button>

            <button
              type="submit"
              form="preset-form"
              className="pay-btn pay-btn-cash"
              style={{
                height: '38px',
                padding: '0 1.25rem',
                fontSize: '0.88rem',
                fontWeight: '800',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
              disabled={!formData.name.trim()}
            >
              <Check size={16} />
              <span>{mode === 'add' ? t('presets.add_preset_title') : t('common.save')}</span>
            </button>
          </div>
        </div>

        <form id="preset-form" onSubmit={handleSubmit} style={{ overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
            gap: '1.25rem',
            alignItems: 'start'
          }}>
            {/* LEFT COLUMN: Data Fields & Controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Preset Pin to Register Switch */}
              <div style={{
                ...sectionCardStyle,
                background: formData.showInPresets ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-card)',
                border: formData.showInPresets ? '1px solid rgba(59, 130, 246, 0.35)' : '1px solid var(--border-color)',
                padding: '0.85rem 1rem'
              }}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <span style={{ fontSize: '0.92rem', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <span>{formData.showInPresets ? '📌' : '🏷️'}</span>
                      <span>{t('presets.show_in_presets') || 'Zobrazit jako rychlou dlaždici na pokladně'}</span>
                    </span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {formData.showInPresets
                        ? (t('presets.show_in_presets_on_desc') || 'Položka bude zobrazena na pokladně jako rychlé dotykové tlačítko.')
                        : (t('presets.show_in_presets_off_desc') || 'Položka bude evidována ve skladu. Na pokladně ji prodáte naskenováním čárového kódu.')}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.showInPresets}
                    onChange={e => setFormData(prev => ({ ...prev, showInPresets: e.target.checked }))}
                    style={{ width: '22px', height: '22px', cursor: 'pointer', accentColor: 'var(--accent-blue)', flexShrink: 0 }}
                  />
                </label>
              </div>

              {/* Basic Info Card */}
              <div style={sectionCardStyle}>
                <div style={{ fontSize: '0.78rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Základní údaje
                </div>

                {/* Item Name */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '700', marginBottom: '0.35rem' }}>
                    {t('presets.preset_name')} *
                  </label>
                  <input
                    type="text"
                    placeholder="..."
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem 0.85rem',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)',
                      fontWeight: '700',
                      fontSize: '1rem'
                    }}
                    autoFocus
                    required
                  />
                </div>

                {/* Category */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '700', marginBottom: '0.35rem' }}>
                    {t('presets.category')}
                  </label>
                  <select
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.8rem',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)',
                      fontWeight: '600'
                    }}
                  >
                    {categories.filter(c => c.id !== 'all').map(cat => (
                      <option key={cat.id} value={cat.id} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Price & VAT Card */}
              <div style={sectionCardStyle}>
                <div style={{ fontSize: '0.78rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Cena a Sazba DPH
                </div>

                {/* Segmented Pricing Mode */}
                <div style={{ display: 'flex', background: 'var(--bg-input)', padding: '3px', borderRadius: 'var(--radius-md)', gap: '4px', border: '1px solid var(--border-color)' }}>
                  <button
                    type="button"
                    className={`nav-tab ${formData.isOpenPrice ? 'active' : ''}`}
                    style={{ flex: 1, padding: '0.45rem', fontSize: '0.82rem', fontWeight: '700', justifyContent: 'center' }}
                    onClick={() => setFormData(prev => ({ ...prev, isOpenPrice: true }))}
                  >
                    {t('presets.open_price_badge') || 'Volná cena'} (Výchozí)
                  </button>
                  <button
                    type="button"
                    className={`nav-tab ${!formData.isOpenPrice ? 'active' : ''}`}
                    style={{ flex: 1, padding: '0.45rem', fontSize: '0.82rem', fontWeight: '700', justifyContent: 'center' }}
                    onClick={() => setFormData(prev => ({ ...prev, isOpenPrice: false }))}
                  >
                    Pevná cena
                  </button>
                </div>

                {/* Open Price Info Banner */}
                {formData.isOpenPrice ? (
                  <div style={{
                    padding: '0.65rem 0.85rem',
                    background: 'rgba(59, 130, 246, 0.08)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid rgba(59, 130, 246, 0.25)',
                    fontSize: '0.82rem',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    lineHeight: 1.4
                  }}>
                    <span style={{ color: 'var(--accent-blue)', fontWeight: '800', fontSize: '1rem' }}>ℹ</span>
                    <span>{t('presets.open_price_label')}</span>
                  </div>
                ) : (
                  /* Fixed Price Input */
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '600', marginBottom: '0.3rem' }}>
                      {t('presets.price')} (Kč) *
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="250"
                        value={formData.price}
                        onChange={e => setFormData({ ...formData, price: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '0.65rem 2.4rem 0.65rem 0.8rem',
                          background: 'var(--bg-input)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-md)',
                          color: 'var(--text-primary)',
                          fontWeight: '800',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '1.05rem'
                        }}
                        required={!formData.isOpenPrice}
                      />
                      <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: '800', color: 'var(--text-muted)' }}>
                        Kč
                      </span>
                    </div>
                  </div>
                )}

                {/* VAT Rate Touch Chips */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '600', marginBottom: '0.35rem' }}>
                    {t('presets.vat_rate')}
                  </label>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    {[
                      { rate: 21, label: '21 % Základní' },
                      { rate: 12, label: '12 % Snížená' },
                      { rate: 0, label: '0 % Osvobozeno' }
                    ].map(({ rate, label }) => (
                      <button
                        key={rate}
                        type="button"
                        className={`nav-tab ${formData.vat === rate ? 'active' : ''}`}
                        style={{
                          flex: 1,
                          padding: '0.45rem 0.2rem',
                          fontSize: '0.78rem',
                          fontWeight: '800',
                          justifyContent: 'center',
                          background: formData.vat === rate ? 'var(--accent-blue)' : 'var(--bg-input)'
                        }}
                        onClick={() => setFormData(prev => ({ ...prev, vat: rate }))}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cost Price (Nákupní cena bez DPH) */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '600', marginBottom: '0.3rem' }}>
                    {t('presets.cost_price') || 'Nákupní cena bez DPH'} ({t('common.optional') || 'volitelné'})
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.costPrice}
                      onChange={e => setFormData({ ...formData, costPrice: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.65rem 2.4rem 0.65rem 0.8rem',
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-primary)',
                        fontWeight: '700',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.95rem'
                      }}
                    />
                    <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: '800', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      Kč
                    </span>
                  </div>
                </div>
              </div>

              {/* Behavior, Stock & Barcode Card */}
              <div style={sectionCardStyle}>
                <div style={{ fontSize: '0.78rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Sklad a Čárový kód
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.isGeneralPreset}
                    onChange={e => {
                      const isGen = e.target.checked;
                      setFormData(prev => ({
                        ...prev,
                        isGeneralPreset: isGen,
                        ...(isGen ? { trackStock: false, stockQuantity: 0 } : {})
                      }));
                    }}
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--accent-blue)' }}
                  />
                  <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                    {t('presets.general_preset_label')}
                  </span>
                </label>

                {!formData.isGeneralPreset && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.trackStock}
                      onChange={e => setFormData({ ...formData, trackStock: e.target.checked })}
                      style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--accent-emerald)' }}
                    />
                    <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                      Sledovat skladovou zásobu
                    </span>
                  </label>
                )}

                {!formData.isGeneralPreset && formData.trackStock && (
                  <PresetStockFields
                    isGeneralPreset={formData.isGeneralPreset}
                    trackStock={formData.trackStock}
                    stockQuantity={formData.stockQuantity}
                    onChangeStockQuantity={val => setFormData(prev => ({ ...prev, stockQuantity: val }))}
                    minStockAlert={formData.minStockAlert}
                    onChangeMinStockAlert={val => setFormData(prev => ({ ...prev, minStockAlert: val }))}
                  />
                )}

                {/* Barcode & EAN with USB Scanner Auto-detection */}
                <div style={{ marginTop: '0.25rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <ScanLine size={15} style={{ color: 'var(--accent-blue)' }} />
                      <span>{t('presets.barcodes_label')}</span>
                    </label>
                    {scannedFeedback && (
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: '800',
                        color: 'var(--accent-emerald)',
                        background: 'rgba(16, 185, 129, 0.15)',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        border: '1px solid var(--accent-emerald)',
                        animation: 'fadeIn 0.2s ease'
                      }}>
                        ✓ {t('presets.barcode_scanned')}
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder={t('presets.barcodes_placeholder')}
                    value={formData.barcode}
                    onChange={e => setFormData({ ...formData, barcode: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.8rem',
                      background: 'var(--bg-input)',
                      border: scannedFeedback ? '1px solid var(--accent-emerald)' : '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.9rem',
                      transition: 'border-color 0.2s ease'
                    }}
                  />
                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                    {t('presets.scan_barcode_hint')}
                  </span>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Visual Appearance OR Warehouse Stock Overview */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {formData.showInPresets ? (
                <>
                  {/* Authentic Live Preset Tile Preview */}
                  <div style={{
                    ...sectionCardStyle,
                    alignItems: 'center',
                    gap: '0.75rem'
                  }}>
                    <div style={{
                      fontSize: '0.75rem',
                      fontWeight: '800',
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      alignSelf: 'flex-start',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}>
                      <Layers size={14} style={{ color: 'var(--accent-blue)' }} />
                      <span>Živý náhled tlačítka na pokladně:</span>
                    </div>
                    <div style={{ width: '160px' }}>
                      <PresetTileCard
                        preset={{
                          id: 'preview',
                          name: formData.name || 'Název položky',
                          price: formData.isOpenPrice ? 0 : (parseFloat(formData.price) || 0),
                          isOpenPrice: formData.isOpenPrice,
                          isGeneralPreset: formData.isGeneralPreset,
                          vat: formData.vat,
                          color: formData.color,
                          icon: formData.icon,
                          imageUrl: formData.imageUrl
                        }}
                        index={0}
                        totalCount={1}
                        isEditMode={false}
                        itemMultiplier={1}
                        onClick={() => {}}
                        storeConfig={storeConfig}
                        buttonStyle={buttonStyle}
                      />
                    </div>
                  </div>

                  {/* Color Palette */}
                  <div style={sectionCardStyle}>
                    <PresetColorPicker
                      selectedColor={formData.color}
                      onSelectColor={c => setFormData(prev => ({ ...prev, color: c }))}
                    />
                  </div>

                  {/* Icon Selection */}
                  <div style={sectionCardStyle}>
                    <PresetIconPicker
                      icon={formData.icon}
                      onSelectIcon={iconKey => setFormData(prev => ({ ...prev, icon: iconKey }))}
                    />
                  </div>
                </>
              ) : (
                /* Warehouse Stock Item Overview Card */
                <div style={{
                  ...sectionCardStyle,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  padding: '1.25rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                    <span style={{ fontSize: '1.4rem' }}>🏷️</span>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                        {t('inventory.barcode_only') || 'Skladová položka (Pouze čárový kód)'}
                      </h4>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Bez dotykového tlačítka na ploše pokladny
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', background: 'var(--bg-input)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Název:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{formData.name || '—'}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Prodejní cena:</span>
                      <strong style={{ color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>
                        {formData.isOpenPrice ? 'Volná cena' : `${parseFloat(formData.price) || 0} Kč`}
                      </strong>
                    </div>
                    {formData.costPrice && parseFloat(formData.costPrice) > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Nákupní cena:</span>
                        <strong style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                          {parseFloat(formData.costPrice).toFixed(2)} Kč
                        </strong>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Čárový kód (EAN):</span>
                      <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                        {formData.barcode || '—'}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Skladová zásoba:</span>
                      <strong style={{ color: formData.trackStock ? (parseInt(formData.stockQuantity, 10) > 0 ? 'var(--accent-emerald)' : 'var(--accent-red)') : 'var(--text-muted)' }}>
                        {formData.trackStock ? `${parseInt(formData.stockQuantity, 10) || 0} ks` : 'Nesledováno'}
                      </strong>
                    </div>
                  </div>

                  <div style={{
                    padding: '0.75rem 0.85rem',
                    background: 'rgba(59, 130, 246, 0.08)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid rgba(59, 130, 246, 0.2)',
                    fontSize: '0.78rem',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.45
                  }}>
                    💡 <strong>Výhoda:</strong> Tato položka nepřekáží v mřížce pokladny. Cashier ji na pokladně prodá naskenováním čárového kódu nebo vyhledáním podle názvu. Kdykoliv ji můžete připnout na pokladnu kliknutím na ikonu 📌 v tabulce skladu.
                  </div>
                </div>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
