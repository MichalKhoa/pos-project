import React, { useState, useEffect } from 'react';
import { Tag, Check, Trash2, Layers } from 'lucide-react';
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
  onClose,
  onSave,
  onDelete,
  storeConfig = null,
  buttonStyle = null
}) {
  const { t } = useTranslation();

  const [formData, setFormData] = useState({
    name: '',
    price: '',
    isOpenPrice: false,
    isGeneralPreset: false,
    vat: 21,
    category: 'all',
    color: '#3b82f6',
    icon: '',
    imageUrl: '',
    barcode: '',
    trackStock: true,
    stockQuantity: 10,
    minStockAlert: 5
  });

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && preset) {
        const isGen = !!preset.isGeneralPreset;
        setFormData({
          name: preset.name || '',
          price: preset.isOpenPrice ? '' : (preset.price !== undefined ? preset.price.toString() : ''),
          isOpenPrice: !!preset.isOpenPrice,
          isGeneralPreset: isGen,
          vat: preset.vat !== undefined ? preset.vat : 21,
          category: preset.category || 'all',
          color: preset.color || '#3b82f6',
          icon: preset.icon || '',
          imageUrl: preset.imageUrl || '',
          barcode: preset.barcode || '',
          trackStock: isGen ? false : (preset.trackStock !== undefined ? preset.trackStock : true),
          stockQuantity: isGen ? 0 : (preset.stockQuantity !== undefined ? preset.stockQuantity : 10),
          minStockAlert: preset.minStockAlert !== undefined ? preset.minStockAlert : 5
        });
      } else {
        setFormData({
          name: '',
          price: '',
          isOpenPrice: false,
          isGeneralPreset: false,
          vat: 21,
          category: defaultCategory === 'all' ? (categories[1]?.id || categories[0]?.id || 'all') : defaultCategory,
          color: '#3b82f6',
          icon: '',
          imageUrl: '',
          barcode: '',
          trackStock: true,
          stockQuantity: 10,
          minStockAlert: 5
        });
      }
    }
  }, [isOpen, mode, preset, defaultCategory, categories]);

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
      minStockAlert: parseInt(formData.minStockAlert || '5', 10)
    };

    onSave(result);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '820px', width: '96vw', maxHeight: '92dvh', display: 'flex', flexDirection: 'column' }}
      >
        <div className="modal-header">
          <div className="modal-title">
            <Tag size={20} style={{ color: 'var(--accent-blue)' }} />
            <span>{mode === 'add' ? t('presets.add_preset_title') : t('presets.edit_preset_title')}</span>
          </div>
          <button className="close-modal-btn" onClick={onClose} type="button">✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '1.25rem',
            alignItems: 'start'
          }}>
            {/* LEFT COLUMN: Data Fields & Controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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

              {/* Price & VAT Box */}
              <div style={{
                background: 'rgba(0, 0, 0, 0.2)',
                padding: '0.85rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
              }}>
                <div style={{ fontSize: '0.78rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Cena a Sazba DPH
                </div>

                {/* Segmented Pricing Mode */}
                <div style={{ display: 'flex', background: 'var(--bg-input)', padding: '3px', borderRadius: 'var(--radius-md)', gap: '4px' }}>
                  <button
                    type="button"
                    className={`nav-tab ${!formData.isOpenPrice ? 'active' : ''}`}
                    style={{ flex: 1, padding: '0.45rem', fontSize: '0.82rem', fontWeight: '700', justifyContent: 'center' }}
                    onClick={() => setFormData(prev => ({ ...prev, isOpenPrice: false }))}
                  >
                    Pevná cena
                  </button>
                  <button
                    type="button"
                    className={`nav-tab ${formData.isOpenPrice ? 'active' : ''}`}
                    style={{ flex: 1, padding: '0.45rem', fontSize: '0.82rem', fontWeight: '700', justifyContent: 'center' }}
                    onClick={() => setFormData(prev => ({ ...prev, isOpenPrice: true }))}
                  >
                    {t('presets.open_price_badge') || 'Volná cena'}
                  </button>
                </div>

                {/* Fixed Price Input */}
                {!formData.isOpenPrice && (
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
              </div>

              {/* Behavior & Stock */}
              <div style={{
                background: 'rgba(0, 0, 0, 0.2)',
                padding: '0.85rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem'
              }}>
                <div style={{ fontSize: '0.78rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Chování a Sklad
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
              </div>

              {/* Barcode */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '700', marginBottom: '0.35rem' }}>
                  {t('presets.barcodes_label')}
                </label>
                <input
                  type="text"
                  placeholder={t('presets.barcodes_placeholder')}
                  value={formData.barcode}
                  onChange={e => setFormData({ ...formData, barcode: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.8rem',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.9rem'
                  }}
                />
              </div>
            </div>

            {/* RIGHT COLUMN: Visual Appearance & Authentic Live Preview */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Authentic Live Preset Tile Preview */}
              <div style={{
                background: 'var(--bg-input)',
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
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
              <div style={{
                background: 'rgba(0, 0, 0, 0.2)',
                padding: '0.85rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)'
              }}>
                <PresetColorPicker
                  selectedColor={formData.color}
                  onSelectColor={c => setFormData(prev => ({ ...prev, color: c }))}
                />
              </div>

              {/* Icon & Photo Selection */}
              <div style={{
                background: 'rgba(0, 0, 0, 0.2)',
                padding: '0.85rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)'
              }}>
                <PresetIconPicker
                  icon={formData.icon}
                  onSelectIcon={iconKey => setFormData(prev => ({ ...prev, icon: iconKey }))}
                  imageUrl={formData.imageUrl}
                  onSelectImageUrl={url => setFormData(prev => ({ ...prev, imageUrl: url }))}
                />
              </div>
            </div>
          </div>

          {/* Modal Action Buttons */}
          <div style={{
            display: 'flex',
            gap: '0.75rem',
            marginTop: '0.5rem',
            paddingTop: '1rem',
            borderTop: '1px solid var(--border-color)'
          }}>
            <button
              type="button"
              className="nav-tab"
              style={{ flex: 1, justifyContent: 'center', height: '48px', fontSize: '0.92rem', fontWeight: '700' }}
              onClick={onClose}
            >
              {t('common.cancel')}
            </button>
            {mode === 'edit' && onDelete && (
              <button
                type="button"
                className="nav-tab"
                style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--accent-rose)', border: '1px solid var(--accent-rose)', padding: '0 1rem', height: '48px' }}
                onClick={onDelete}
                title={t('presets.delete')}
              >
                <Trash2 size={18} />
              </button>
            )}
            <button
              type="submit"
              className="pay-btn pay-btn-cash"
              style={{ flex: 1.5, height: '48px', fontSize: '0.95rem', fontWeight: '800' }}
              disabled={!formData.name}
            >
              <Check size={18} />
              <span>{mode === 'add' ? t('presets.add_preset_title') : t('common.save')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
