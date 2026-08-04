import React, { useState } from 'react';
import { Tag, Plus, Search, Edit3, Trash2, Grid, List, Calculator, Settings2 } from 'lucide-react';
import { DEFAULT_CATEGORIES } from '../data/initialData';
import CategoryManagerModal from './CategoryManagerModal';
import PresetModal from './PresetModal';
import { useTranslation } from '../i18n/LanguageContext.jsx';

export default function PresetsCatalogView({
  presets,
  categories = DEFAULT_CATEGORIES,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
  onAddPreset,
  onUpdatePreset,
  onDeletePreset
}) {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'grid'
  const [activeModal, setActiveModal] = useState(null); // 'add' | 'edit' | null
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState(null);

  const filteredPresets = presets.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (p.price && p.price.toString().includes(searchTerm)) ||
                          (p.barcode && p.barcode.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = activeCategory === 'all' || p.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const handleOpenAddModal = () => {
    setEditingPreset(null);
    setActiveModal('add');
  };

  const handleOpenEditModal = (preset) => {
    setEditingPreset(preset);
    setActiveModal('edit');
  };

  const handleSavePreset = (presetData) => {
    if (activeModal === 'add') {
      onAddPreset(presetData);
    } else if (activeModal === 'edit') {
      onUpdatePreset(presetData);
    }
    setActiveModal(null);
    setEditingPreset(null);
  };

  const handleDelete = (presetId) => {
    if (window.confirm('Opravdu chcete toto tlačítko smazat z katalogu?')) {
      onDeletePreset(presetId);
      if (activeModal === 'edit') {
        setActiveModal(null);
        setEditingPreset(null);
      }
    }
  };

  return (
    <div className="full-view-container">
      <div className="section-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <div className="section-title" style={{ fontSize: '1.4rem' }}>
          <Tag size={24} style={{ color: 'var(--accent-blue)' }} />
          <span>{t('presets.title')}</span>
          <span style={{ fontSize: '0.9rem', color: 'var(--accent-emerald)', background: 'rgba(16, 185, 129, 0.1)', padding: '0.2rem 0.6rem', borderRadius: '999px', fontWeight: '700' }}>
            {presets.length}
          </span>
        </div>

        <button
          className="pay-btn pay-btn-card"
          style={{ height: '44px', padding: '0 1.25rem', fontSize: '0.9rem' }}
          onClick={handleOpenAddModal}
        >
          <Plus size={18} />
          <span>{t('presets.add_preset')}</span>
        </button>
      </div>

      {/* Filter and View Bar */}
      <div className="table-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div className="keypad-input-container" style={{ maxWidth: '380px', flex: 1 }}>
            <Search size={18} style={{ color: 'var(--text-muted)', marginRight: '8px' }} />
            <input
              type="text"
              className="keypad-label-input"
              placeholder={t('presets.search')}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg-main)', padding: '0.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <button
              className={`nav-tab ${viewMode === 'table' ? 'active' : ''}`}
              style={{ padding: '0.4rem 0.8rem' }}
              onClick={() => setViewMode('table')}
            >
              <List size={16} />
              <span>Table</span>
            </button>
            <button
              className={`nav-tab ${viewMode === 'grid' ? 'active' : ''}`}
              style={{ padding: '0.4rem 0.8rem' }}
              onClick={() => setViewMode('grid')}
            >
              <Grid size={16} />
              <span>Grid</span>
            </button>
          </div>
        </div>

        <div className="category-bar">
          {categories.map(cat => (
            <button
              key={cat.id}
              className={`category-chip ${activeCategory === cat.id ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat.id)}
            >
              {cat.id === 'all' ? t('presets.all') : cat.name}
            </button>
          ))}

          <button
            className="category-chip"
            style={{ borderStyle: 'dashed', background: 'transparent' }}
            onClick={() => setIsCategoryModalOpen(true)}
          >
            <Settings2 size={14} />
            <span>{t('presets.add_category')}</span>
          </button>
        </div>
      </div>

      {/* Catalog Display */}
      {viewMode === 'table' ? (
        <div className="table-card">
          {filteredPresets.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Nebyly nalezeny žádné položky odpovídající filtru.
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Color</th>
                  <th>{t('presets.col_name')}</th>
                  <th>{t('presets.col_price')}</th>
                  <th>{t('presets.col_type')}</th>
                  <th>{t('presets.col_vat')}</th>
                  <th>{t('presets.col_category')}</th>
                  <th style={{ textAlign: 'right' }}>{t('presets.col_actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredPresets.map((preset) => (
                  <tr key={preset.id}>
                    <td>
                      <span style={{ display: 'inline-block', width: '16px', height: '16px', borderRadius: '50%', background: preset.color || '#3b82f6', border: '1px solid rgba(255,255,255,0.2)' }} />
                    </td>
                    <td style={{ fontWeight: '700', fontSize: '0.95rem' }}>
                      {preset.name}
                      {preset.isGeneralPreset && (
                        <span style={{ fontSize: '0.68rem', fontWeight: '600', color: 'var(--accent-blue)', background: 'rgba(59, 130, 246, 0.12)', border: '1px solid rgba(59, 130, 246, 0.25)', padding: '1px 6px', borderRadius: '4px', marginLeft: '6px', verticalAlign: 'middle', display: 'inline-block' }}>
                          {t('presets.general_badge') || 'Druh zboží'}
                        </span>
                      )}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: preset.isOpenPrice ? 'var(--accent-amber)' : 'var(--accent-emerald)', fontWeight: '800', fontSize: '1rem' }}>
                      {preset.isOpenPrice ? 'Otevřená' : `${preset.price} Kč`}
                    </td>
                    <td>
                      {preset.isOpenPrice ? (
                        <span className="status-badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-amber)', borderColor: 'rgba(245, 158, 11, 0.3)', padding: '2px 8px', fontSize: '0.75rem' }}>
                          <Calculator size={12} /> Zadá se na pokladně
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pevná cena</span>
                      )}
                    </td>
                    <td>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{preset.vat}%</span>
                    </td>
                    <td>
                      <span style={{ textTransform: 'capitalize', background: 'var(--bg-input)', padding: '3px 10px', borderRadius: '6px', fontSize: '0.8rem', border: '1px solid var(--border-color)' }}>
                        {preset.category}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="nav-tab"
                        style={{ padding: '0.35rem 0.75rem', display: 'inline-flex', marginRight: '0.5rem' }}
                        onClick={() => handleOpenEditModal(preset)}
                      >
                        <Edit3 size={14} />
                        <span>{t('presets.edit')}</span>
                      </button>
                      <button className="delete-item-btn" onClick={() => handleDelete(preset.id)}>
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="preset-grid">
          {filteredPresets.map(preset => (
            <div
              key={preset.id}
              className="preset-card"
              style={{ '--card-accent': preset.color || '#3b82f6', cursor: 'pointer' }}
              onClick={() => handleOpenEditModal(preset)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="preset-name" style={{ flex: 1 }}>
                  {preset.name}
                  {preset.isGeneralPreset && (
                    <span style={{ fontSize: '0.65rem', fontWeight: '600', background: 'rgba(255, 255, 255, 0.18)', color: 'rgba(255, 255, 255, 0.95)', padding: '1px 5px', borderRadius: '4px', marginLeft: '6px', verticalAlign: 'middle', display: 'inline-block' }}>
                      {t('presets.general_badge') || 'Druh zboží'}
                    </span>
                  )}
                </div>
                <Edit3 size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, marginLeft: '4px' }} />
              </div>
              <div className="preset-footer">
                {preset.isOpenPrice ? (
                  <span className="preset-price" style={{ color: 'var(--accent-amber)', fontSize: '0.85rem' }}>Volitelná</span>
                ) : (
                  <span className="preset-price">{preset.price} Kč</span>
                )}
                <span className="preset-vat">DPH {preset.vat}%</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preset Add / Edit Modal */}
      <PresetModal
        isOpen={activeModal === 'add' || activeModal === 'edit'}
        mode={activeModal === 'add' ? 'add' : 'edit'}
        preset={editingPreset}
        categories={categories}
        defaultCategory={activeCategory}
        onClose={() => { setActiveModal(null); setEditingPreset(null); }}
        onSave={handleSavePreset}
        onDelete={editingPreset ? () => {
          if (window.confirm('Opravdu chcete toto tlačítko smazat z katalogu?')) {
            onDeletePreset(editingPreset.id);
            setActiveModal(null);
            setEditingPreset(null);
          }
        } : undefined}
      />

      {/* Category Manager Modal */}
      {isCategoryModalOpen && (
        <CategoryManagerModal
          categories={categories}
          onAddCategory={(name) => {
            const createdId = onAddCategory(name);
            if (createdId) setFormData(prev => ({ ...prev, category: createdId }));
            return createdId;
          }}
          onEditCategory={onEditCategory}
          onDeleteCategory={onDeleteCategory}
          onClose={() => setIsCategoryModalOpen(false)}
          onSelectCategory={(id) => setActiveCategory(id)}
        />
      )}
    </div>
  );
}
