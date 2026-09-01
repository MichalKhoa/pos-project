import React, { useState, useEffect } from 'react';
import { Tag, Check, Trash2 } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext';
import { getPresetIconComponent } from '../utils/presetIcons';
import PresetColorPicker from './preset-modal/PresetColorPicker';
import PresetIconPicker from './preset-modal/PresetIconPicker';
import PresetStockFields from './preset-modal/PresetStockFields';

export default function PresetModal({
  isOpen,
  mode = 'add', // 'add' | 'edit'
  preset = null,
  categories = [],
  defaultCategory = 'all',
  onClose,
  onSave,
  onDelete
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
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <div className="modal-header">
          <div className="modal-title">
            <Tag size={20} style={{ color: 'var(--accent-blue)' }} />
            <span>{mode === 'add' ? t('presets.add_preset_title') : t('presets.edit_preset_title')}</span>
          </div>
          <button className="close-modal-btn" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '600', marginBottom: '0.4rem' }}>
              {t('presets.preset_name')} *
            </label>
            <input
              type="text"
              placeholder="..."
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontWeight: '600'
              }}
              required
            />
          </div>

          <div style={{
            background: 'var(--bg-input)',
            padding: '0.75rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <input
                type="checkbox"
                id="isOpenPriceModal"
                checked={formData.isOpenPrice}
                onChange={e => setFormData({ ...formData, isOpenPrice: e.target.checked })}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--accent-amber)' }}
              />
              <label htmlFor="isOpenPriceModal" style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-primary)', cursor: 'pointer' }}>
                {t('presets.open_price_label')}
              </label>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', paddingTop: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <input
                type="checkbox"
                id="isGeneralPresetModal"
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
              <label htmlFor="isGeneralPresetModal" style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)', cursor: 'pointer' }}>
                {t('presets.general_preset_label')}
              </label>
            </div>

            {!formData.isGeneralPreset && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', paddingTop: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <input
                  type="checkbox"
                  id="trackStockModal"
                  checked={formData.trackStock}
                  onChange={e => setFormData({ ...formData, trackStock: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--accent-emerald)' }}
                />
                <label htmlFor="trackStockModal" style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  Sledovat skladovou zásobu
                </label>
              </div>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '600', marginBottom: '0.4rem' }}>
              {t('presets.barcodes_label')}
            </label>
            <input
              type="text"
              placeholder={t('presets.barcodes_placeholder')}
              value={formData.barcode}
              onChange={e => setFormData({ ...formData, barcode: e.target.value })}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)'
              }}
            />
          </div>

          {!formData.isOpenPrice && (
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '600', marginBottom: '0.4rem' }}>
                  {t('presets.price')} *
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="250"
                  value={formData.price}
                  onChange={e => setFormData({ ...formData, price: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontWeight: '700',
                    fontFamily: 'var(--font-mono)'
                  }}
                  required={!formData.isOpenPrice}
                />
              </div>

              <div style={{ width: '140px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '600', marginBottom: '0.4rem' }}>
                  {t('presets.vat_rate')}
                </label>
                <select
                  value={formData.vat}
                  onChange={e => setFormData({ ...formData, vat: parseInt(e.target.value, 10) })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontWeight: '600'
                  }}
                >
                  <option value={21} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>{t('presets.vat_standard')}</option>
                  <option value={12} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>{t('presets.vat_reduced')}</option>
                  <option value={0} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>{t('presets.vat_zero')}</option>
                </select>
              </div>
            </div>
          )}

          {formData.isOpenPrice && (
            <div style={{ width: '100%' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '600', marginBottom: '0.4rem' }}>
                {t('presets.vat_rate')}
              </label>
              <select
                value={formData.vat}
                onChange={e => setFormData({ ...formData, vat: parseInt(e.target.value, 10) })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  fontWeight: '600'
                }}
              >
                <option value={21} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>{t('presets.vat_standard')}</option>
                <option value={12} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>{t('presets.vat_reduced')}</option>
                <option value={0} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>{t('presets.vat_zero')}</option>
              </select>
            </div>
          )}

          {/* Category Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '600', marginBottom: '0.4rem' }}>
              {t('presets.category')}
            </label>
            <select
              value={formData.category}
              onChange={e => setFormData({ ...formData, category: e.target.value })}
              style={{
                width: '100%',
                padding: '0.75rem',
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

          {/* Stock Fields (Subcomponent) */}
          <PresetStockFields
            isGeneralPreset={formData.isGeneralPreset}
            trackStock={formData.trackStock}
            stockQuantity={formData.stockQuantity}
            onChangeStockQuantity={val => setFormData(prev => ({ ...prev, stockQuantity: val }))}
            minStockAlert={formData.minStockAlert}
            onChangeMinStockAlert={val => setFormData(prev => ({ ...prev, minStockAlert: val }))}
          />

          {/* Icon & Photo Pickers (Subcomponent) */}
          <PresetIconPicker
            icon={formData.icon}
            onSelectIcon={iconKey => setFormData(prev => ({ ...prev, icon: iconKey }))}
            imageUrl={formData.imageUrl}
            onSelectImageUrl={url => setFormData(prev => ({ ...prev, imageUrl: url }))}
          />

          {/* Color Palette (Subcomponent) */}
          <PresetColorPicker
            selectedColor={formData.color}
            onSelectColor={c => setFormData(prev => ({ ...prev, color: c }))}
          />

          {/* Real-time Preset Tile Preview */}
          <div style={{ background: 'var(--bg-input)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-color)', marginTop: '0.2rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
              Živý Náhled Tlačítka Pokladny:
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div
                style={{
                  width: '160px',
                  height: '90px',
                  borderRadius: 'var(--radius-md)',
                  background: formData.color || '#3b82f6',
                  color: '#ffffff',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  padding: '0.6rem 0.75rem',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                  position: 'relative',
                  overflow: 'hidden',
                  textAlign: 'left'
                }}
              >
                <div style={{ fontWeight: '800', fontSize: '0.88rem', lineHeight: '1.2', textShadow: '0 1px 3px rgba(0,0,0,0.5)', zIndex: 2 }}>
                  {formData.name || 'Název položky'}
                </div>

                <div style={{ fontSize: '0.8rem', fontWeight: '800', opacity: 0.95, zIndex: 2 }}>
                  {formData.isOpenPrice ? 'Volitelná' : `${formData.price || '0'} Kč`}
                </div>

                {/* Bottom-Right Icon / Photo Preview */}
                {formData.imageUrl ? (
                  <img
                    src={formData.imageUrl}
                    alt="Preview"
                    style={{
                      position: 'absolute',
                      bottom: '6px',
                      right: '6px',
                      width: '30px',
                      height: '30px',
                      objectFit: 'cover',
                      borderRadius: '5px',
                      border: '1px solid rgba(255,255,255,0.3)',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                      zIndex: 1
                    }}
                  />
                ) : (() => {
                  const PreviewIcon = getPresetIconComponent(formData.icon);
                  return PreviewIcon ? (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '4px',
                        right: '6px',
                        opacity: 0.35,
                        color: '#ffffff',
                        zIndex: 1
                      }}
                    >
                      <PreviewIcon size={32} />
                    </div>
                  ) : null;
                })()}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            <button
              type="button"
              className="nav-tab"
              style={{ flex: 1, justifyContent: 'center', height: '48px' }}
              onClick={onClose}
            >
              {t('common.cancel')}
            </button>
            {mode === 'edit' && onDelete && (
              <button
                type="button"
                className="nav-tab"
                style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--accent-rose)', border: '1px solid var(--accent-rose)', padding: '0 0.8rem', height: '48px' }}
                onClick={onDelete}
              >
                <Trash2 size={18} />
              </button>
            )}
            <button
              type="submit"
              className="pay-btn pay-btn-cash"
              style={{ flex: 1.5, height: '48px' }}
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
