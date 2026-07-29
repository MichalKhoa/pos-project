import React, { useState } from 'react';
import { Tag, Plus, Search, Edit3, Trash2, Grid, List, Check, Calculator, Settings2 } from 'lucide-react';
import { DEFAULT_CATEGORIES } from '../data/initialData';
import CategoryManagerModal from './CategoryManagerModal';

const COLOR_OPTIONS = [
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#ef4444', // Red
  '#64748b'  // Slate
];

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
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'grid'
  const [activeModal, setActiveModal] = useState(null); // 'add' | 'edit' | 'category' | null
  const [editingPreset, setEditingPreset] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    price: '',
    isOpenPrice: false,
    vat: 21,
    category: 'living',
    color: '#3b82f6'
  });

  const filteredPresets = presets.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (p.price && p.price.toString().includes(searchTerm));
    const matchesCategory = activeCategory === 'all' || p.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const handleOpenAddModal = () => {
    setFormData({
      name: '',
      price: '',
      isOpenPrice: false,
      vat: 21,
      category: activeCategory === 'all' ? 'living' : activeCategory,
      color: '#3b82f6'
    });
    setActiveModal('add');
  };

  const handleOpenEditModal = (preset) => {
    setEditingPreset(preset);
    setFormData({
      name: preset.name,
      price: preset.isOpenPrice ? '' : preset.price.toString(),
      isOpenPrice: !!preset.isOpenPrice,
      vat: preset.vat,
      category: preset.category || 'living',
      color: preset.color || '#3b82f6'
    });
    setActiveModal('edit');
  };

  const handleSubmitForm = (e) => {
    e.preventDefault();
    if (!formData.name) return;

    let numericPrice = parseFloat(formData.price);
    if (formData.isOpenPrice) {
      numericPrice = 0;
    } else if (isNaN(numericPrice)) {
      return;
    }

    if (activeModal === 'add') {
      onAddPreset({
        id: `preset-${Date.now()}`,
        name: formData.name,
        price: numericPrice,
        isOpenPrice: formData.isOpenPrice,
        vat: parseInt(formData.vat, 10),
        category: formData.category,
        color: formData.color
      });
    } else if (activeModal === 'edit' && editingPreset) {
      onUpdatePreset({
        ...editingPreset,
        name: formData.name,
        price: numericPrice,
        isOpenPrice: formData.isOpenPrice,
        vat: parseInt(formData.vat, 10),
        category: formData.category,
        color: formData.color
      });
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
          <span>Katalog Rychlých Tlačítek & Položek</span>
          <span style={{ fontSize: '0.9rem', color: 'var(--accent-emerald)', background: 'rgba(16, 185, 129, 0.1)', padding: '0.2rem 0.6rem', borderRadius: '999px', fontWeight: '700' }}>
            {presets.length} položek celkem
          </span>
        </div>

        <button
          className="pay-btn pay-btn-card"
          style={{ height: '44px', padding: '0 1.25rem', fontSize: '0.9rem' }}
          onClick={handleOpenAddModal}
        >
          <Plus size={18} />
          <span>Přidat Novou Položku</span>
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
              placeholder="Vyhledat podle názvu nebo ceny..."
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
              <span>Tabulka</span>
            </button>
            <button
              className={`nav-tab ${viewMode === 'grid' ? 'active' : ''}`}
              style={{ padding: '0.4rem 0.8rem' }}
              onClick={() => setViewMode('grid')}
            >
              <Grid size={16} />
              <span>Mřížka</span>
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
              {cat.name}
            </button>
          ))}

          <button
            className="category-chip"
            style={{ borderStyle: 'dashed', color: 'var(--accent-blue)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            onClick={() => setActiveModal('category')}
            title="Přidat, upravit nebo smazat kategorie"
          >
            <Settings2 size={14} />
            <span>Spravovat kategorie</span>
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
                  <th>Barva</th>
                  <th>Název položky</th>
                  <th>Cena (s DPH)</th>
                  <th>Typ ceny</th>
                  <th>DPH</th>
                  <th>Kategorie</th>
                  <th style={{ textAlign: 'right' }}>Akce</th>
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
                        <span>Upravit</span>
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
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div className="preset-name">{preset.name}</div>
                <Edit3 size={14} style={{ color: 'var(--text-muted)' }} />
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

      {/* Add / Edit Modal */}
      {activeModal && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <Tag size={20} style={{ color: 'var(--accent-blue)' }} />
                <span>{activeModal === 'add' ? 'Přidat Novou Položku' : `Upravit: ${editingPreset?.name}`}</span>
              </div>
              <button className="close-modal-btn" onClick={() => setActiveModal(null)}>✕</button>
            </div>

            <form onSubmit={handleSubmitForm} className="modal-body">
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '600', marginBottom: '0.4rem' }}>
                  Název položky
                </label>
                <input
                  type="text"
                  placeholder="např. Vánoční svícen nebo Volné zboží"
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
                alignItems: 'center',
                gap: '0.75rem'
              }}>
                <input
                  type="checkbox"
                  id="isOpenPriceCatalog"
                  checked={formData.isOpenPrice}
                  onChange={e => setFormData({ ...formData, isOpenPrice: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--accent-amber)' }}
                />
                <label htmlFor="isOpenPriceCatalog" style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  Otevřená cena (Zadat částku až při prodeji na pokladně)
                </label>
              </div>

              {!formData.isOpenPrice ? (
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '600', marginBottom: '0.4rem' }}>
                      Pevná cena v Kč s DPH
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
                      Sazba DPH
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
                      <option value={21} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>21% (Základní)</option>
                      <option value={12} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>12% (Snížená)</option>
                      <option value={0} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>0% (Osvobozeno)</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div style={{ width: '100%' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '600', marginBottom: '0.4rem' }}>
                    Sazba DPH pro volnou cenu
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
                    <option value={21} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>21% (Základní)</option>
                    <option value={12} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>12% (Snížená)</option>
                    <option value={0} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>0% (Osvobozeno)</option>
                  </select>
                </div>
              )}

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '600' }}>
                    Kategorie
                  </label>
                  <button
                    type="button"
                    style={{ background: 'transparent', color: 'var(--accent-blue)', fontSize: '0.8rem', fontWeight: '700' }}
                    onClick={() => setActiveModal('category')}
                  >
                    + Nová kategorie
                  </button>
                </div>
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
                  {categories.filter(c => c.id !== 'all').map(c => (
                    <option key={c.id} value={c.id} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '600', marginBottom: '0.4rem' }}>
                  Barva tlačítka
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {COLOR_OPTIONS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setFormData({ ...formData, color: c })}
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: c,
                        border: formData.color === c ? '3px solid #ffffff' : 'none',
                        boxShadow: formData.color === c ? '0 0 8px ' + c : 'none'
                      }}
                    />
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                {activeModal === 'edit' ? (
                  <button
                    type="button"
                    className="clear-cart-btn"
                    onClick={() => handleDelete(editingPreset.id)}
                  >
                    <Trash2 size={16} />
                    <span>Smazat</span>
                  </button>
                ) : <div />}

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    type="button"
                    className="nav-tab"
                    onClick={() => setActiveModal(null)}
                  >
                    Zrušit
                  </button>
                  <button
                    type="submit"
                    className="pay-btn pay-btn-card"
                    style={{ height: '44px', padding: '0 1.25rem' }}
                  >
                    <Check size={18} />
                    <span>{activeModal === 'add' ? 'Přidat' : 'Uložit Změny'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Manager Modal */}
      {activeModal === 'category' && (
        <CategoryManagerModal
          categories={categories}
          onAddCategory={onAddCategory}
          onEditCategory={onEditCategory}
          onDeleteCategory={onDeleteCategory}
          onClose={() => setActiveModal(null)}
          onSelectCategory={(id) => setActiveCategory(id)}
        />
      )}
    </div>
  );
}
