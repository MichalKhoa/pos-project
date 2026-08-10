import React, { useState, useEffect } from 'react';
import { Tag, Check, Trash2 } from 'lucide-react';
import { COLOR_OPTIONS } from '../data/initialData';
import { useTranslation } from '../i18n/LanguageContext';

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

          {/* Stock Quantities (when tracking is enabled) */}
          {!formData.isGeneralPreset && formData.trackStock && (
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '600', marginBottom: '0.4rem' }}>
                  Počáteční stav skladu (ks)
                </label>
                <input
                  type="number"
                  placeholder="10"
                  value={formData.stockQuantity}
                  onChange={e => setFormData({ ...formData, stockQuantity: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>

              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '600', marginBottom: '0.4rem' }}>
                  Min. limit varování (ks)
                </label>
                <input
                  type="number"
                  placeholder="5"
                  value={formData.minStockAlert}
                  onChange={e => setFormData({ ...formData, minStockAlert: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>
            </div>
          )}

          {/* Color Palette Selection */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '600', marginBottom: '0.4rem' }}>
              {t('presets.color')}
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {COLOR_OPTIONS.map(c => {
                const isSelected = formData.color === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setFormData({ ...formData, color: c })}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: c,
                      border: isSelected ? '3px solid #ffffff' : '1px solid rgba(0,0,0,0.2)',
                      boxShadow: isSelected ? '0 0 0 2px var(--accent-blue)' : 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0
                    }}
                  >
                    {isSelected && <Check size={16} style={{ color: '#ffffff' }} />}
                  </button>
                );
              })}
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
