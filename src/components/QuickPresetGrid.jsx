import React, { useState, useRef } from 'react';
import { Plus, Tag, Layers, Check, Edit3, Trash2, Settings2, Calculator, GripVertical, MoveLeft, MoveRight, Search, X } from 'lucide-react';
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

export default function QuickPresetGrid({
  presets,
  categories = DEFAULT_CATEGORIES,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
  onAddToCart,
  onAddPreset,
  onUpdatePreset,
  onDeletePreset,
  onReorderPresets,
  keypadAmount = '',
  onClearKeypadAmount
}) {
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeModal, setActiveModal] = useState(null); // 'add' | 'edit' | 'category' | null
  const [editingPreset, setEditingPreset] = useState(null);

  // Open Price Prompt Modal State
  const [openPriceTarget, setOpenPriceTarget] = useState(null);
  const [enteredOpenPrice, setEnteredOpenPrice] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    price: '',
    isOpenPrice: false,
    vat: 21,
    category: 'living',
    color: '#3b82f6'
  });

  const filteredPresets = presets.filter(p => {
    const matchesCategory = activeCategory === 'all' || p.category === activeCategory;
    const matchesSearch = !searchTerm.trim() ||
      (p.name && p.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.price && p.price.toString().includes(searchTerm));
    return matchesCategory && matchesSearch;
  });

  // Drag and Drop state
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const isDraggingRef = useRef(false);

  const handleDragStart = (e, index) => {
    if (!isEditMode) return;
    isDraggingRef.current = true;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e, index) => {
    if (!isEditMode || draggedIndex === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = (e, index) => {
    if (dragOverIndex === index) {
      setDragOverIndex(null);
    }
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (!isEditMode || draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newFiltered = Array.from(filteredPresets);
    const [movedItem] = newFiltered.splice(draggedIndex, 1);
    newFiltered.splice(dropIndex, 0, movedItem);

    let newFullPresets;
    if (activeCategory === 'all') {
      newFullPresets = newFiltered;
    } else {
      let subIdx = 0;
      newFullPresets = presets.map(p => {
        if (p.category === activeCategory) {
          const replacement = newFiltered[subIdx];
          subIdx++;
          return replacement;
        }
        return p;
      });
    }

    if (onReorderPresets) {
      onReorderPresets(newFullPresets);
    }

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 120);
  };

  const handleMovePosition = (index, direction, e) => {
    if (e) e.stopPropagation();
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= filteredPresets.length) return;

    const newFiltered = Array.from(filteredPresets);
    const [movedItem] = newFiltered.splice(index, 1);
    newFiltered.splice(targetIndex, 0, movedItem);

    let newFullPresets;
    if (activeCategory === 'all') {
      newFullPresets = newFiltered;
    } else {
      let subIdx = 0;
      newFullPresets = presets.map(p => {
        if (p.category === activeCategory) {
          const replacement = newFiltered[subIdx];
          subIdx++;
          return replacement;
        }
        return p;
      });
    }

    if (onReorderPresets) {
      onReorderPresets(newFullPresets);
    }
  };

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

  const handleOpenEditModal = (preset, e) => {
    if (e) e.stopPropagation();
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

  const handleCardClick = (preset) => {
    if (isDraggingRef.current) return;
    if (isEditMode) {
      handleOpenEditModal(preset);
    } else {
      if (preset.isOpenPrice) {
        const numericKeypad = parseFloat(keypadAmount);
        if (!isNaN(numericKeypad) && numericKeypad > 0) {
          // Auto-pickup pre-typed amount from manual keypad!
          onAddToCart({
            ...preset,
            price: numericKeypad
          });
          if (onClearKeypadAmount) onClearKeypadAmount();
        } else {
          // Trigger Open Price prompt modal
          setOpenPriceTarget(preset);
          setEnteredOpenPrice('');
        }
      } else {
        onAddToCart(preset);
      }
    }
  };

  const handleConfirmOpenPrice = (e) => {
    e.preventDefault();
    const priceVal = parseFloat(enteredOpenPrice);
    if (isNaN(priceVal) || priceVal <= 0 || !openPriceTarget) return;

    onAddToCart({
      ...openPriceTarget,
      price: priceVal
    });

    setOpenPriceTarget(null);
    setEnteredOpenPrice('');
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

  const handleDelete = (presetId, e) => {
    if (e) e.stopPropagation();
    if (window.confirm('Opravdu chcete toto tlačítko smazat?')) {
      onDeletePreset(presetId);
      if (activeModal === 'edit') {
        setActiveModal(null);
        setEditingPreset(null);
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div className="section-header">
        <div className="section-title">
          <Layers size={18} style={{ color: 'var(--accent-blue)' }} />
          <span>Rychlá Volba Položek</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>
            ({filteredPresets.length} položek)
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* Quick Product Search Bar */}
          <div className="keypad-input-container" style={{ width: '180px', padding: '0.2rem 0.5rem', height: '32px' }}>
            <Search size={14} style={{ color: 'var(--text-muted)', marginRight: '4px' }} />
            <input
              type="text"
              className="keypad-label-input"
              placeholder="Hledat položku..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', padding: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          <button
            className={`nav-tab ${isEditMode ? 'active' : ''}`}
            style={{
              padding: '0.35rem 0.75rem',
              fontSize: '0.8rem',
              background: isEditMode ? 'var(--accent-amber)' : 'rgba(255,255,255,0.06)',
              color: isEditMode ? '#000000' : 'var(--text-secondary)',
              fontWeight: '700'
            }}
            onClick={() => setIsEditMode(!isEditMode)}
          >
            {isEditMode ? <Check size={14} /> : <Settings2 size={14} />}
            <span>{isEditMode ? 'Hotovo' : 'Upravit tlačítka'}</span>
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

      {isEditMode && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: 'var(--radius-md)',
          padding: '0.5rem 0.85rem',
          fontSize: '0.8rem',
          color: 'var(--accent-amber)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <Edit3 size={14} />
          <span>Režim úprav: Přetáhněte tlačítko (Drag & Drop) nebo použijte šipky pro změnu pozice. Kliknutím upravíte cenu a název.</span>
        </div>
      )}

      <div className="preset-grid">
        {filteredPresets.map((preset, index) => {
          const isDraggingThis = draggedIndex === index;
          const isDragOverThis = dragOverIndex === index;

          return (
            <button
              key={preset.id}
              draggable={isEditMode}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={(e) => handleDragLeave(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={`preset-card ${isEditMode ? 'edit-mode' : ''} ${isDraggingThis ? 'dragging' : ''} ${isDragOverThis ? 'drag-over' : ''}`}
              style={{
                '--card-accent': preset.color || '#3b82f6',
                outline: isEditMode
                  ? (isDragOverThis ? '2px solid var(--accent-blue)' : '2px dashed var(--accent-amber)')
                  : 'none',
                opacity: isDraggingThis ? 0.4 : 1,
                cursor: isEditMode ? 'grab' : 'pointer'
              }}
              onClick={() => handleCardClick(preset)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flex: 1, width: '100%' }}>
                {isEditMode && (
                  <div
                    className="drag-handle"
                    title="Chytit a přetáhnout"
                    style={{ marginRight: '6px', display: 'inline-flex', alignItems: 'center', cursor: 'grab' }}
                  >
                    <GripVertical size={16} />
                  </div>
                )}
                <div className="preset-name" style={{ flex: 1 }}>{preset.name}</div>
                {isEditMode && (
                  <div style={{ display: 'flex', gap: '2px', flexShrink: 0, marginLeft: '4px', alignItems: 'center' }}>
                    <span
                      type="button"
                      style={{
                        background: 'rgba(255,255,255,0.1)',
                        color: index === 0 ? 'var(--text-muted)' : '#fff',
                        borderRadius: '4px',
                        padding: '2px 4px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        opacity: index === 0 ? 0.35 : 1,
                        cursor: index === 0 ? 'default' : 'pointer'
                      }}
                      onClick={(e) => handleMovePosition(index, -1, e)}
                      title="Posunout vlevo"
                    >
                      <MoveLeft size={12} />
                    </span>
                    <span
                      type="button"
                      style={{
                        background: 'rgba(255,255,255,0.1)',
                        color: index === filteredPresets.length - 1 ? 'var(--text-muted)' : '#fff',
                        borderRadius: '4px',
                        padding: '2px 4px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        opacity: index === filteredPresets.length - 1 ? 0.35 : 1,
                        cursor: index === filteredPresets.length - 1 ? 'default' : 'pointer'
                      }}
                      onClick={(e) => handleMovePosition(index, 1, e)}
                      title="Posunout vpravo"
                    >
                      <MoveRight size={12} />
                    </span>
                    <span
                      style={{ background: 'var(--accent-amber)', color: '#000', borderRadius: '4px', padding: '3px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
                      onClick={(e) => handleOpenEditModal(preset, e)}
                      title="Upravit"
                    >
                      <Edit3 size={14} />
                    </span>
                    <span
                      style={{ background: 'var(--accent-rose)', color: '#fff', borderRadius: '4px', padding: '3px', marginLeft: '2px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
                      onClick={(e) => handleDelete(preset.id, e)}
                      title="Smazat"
                    >
                      <Trash2 size={14} />
                    </span>
                  </div>
                )}
              </div>

              <div className="preset-footer" style={{ marginTop: 'auto', paddingTop: '0.4rem' }}>
                {!preset.isOpenPrice ? (
                  <>
                    <div className="preset-price">{preset.price} Kč</div>
                    <div className="preset-vat">DPH {preset.vat}%</div>
                  </>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
                    <div className="preset-vat">DPH {preset.vat}%</div>
                  </div>
                )}
              </div>
            </button>
          );
        })}

        <button className="preset-card preset-add-card" onClick={handleOpenAddModal}>
          <Plus size={24} />
          <span style={{ fontSize: '0.8rem', fontWeight: '600' }}>Přidat tlačítko</span>
        </button>
      </div>

      {/* Open Price Prompt Modal with Touch Keypad */}
      {openPriceTarget && (
        <div className="modal-overlay" onClick={() => setOpenPriceTarget(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <div className="modal-title">
                <Calculator size={20} style={{ color: 'var(--accent-amber)' }} />
                <span>Zadejte cenu: {openPriceTarget.name}</span>
              </div>
              <button className="close-modal-btn" onClick={() => setOpenPriceTarget(null)}>✕</button>
            </div>

            <form onSubmit={handleConfirmOpenPrice} className="modal-body">
              <div className="tender-display" style={{ padding: '0.75rem', marginBottom: '0.5rem' }}>
                <span className="tender-label">Částka v Kč s DPH ({openPriceTarget.vat}% DPH)</span>
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '2.2rem',
                  fontWeight: '800',
                  color: 'var(--accent-emerald)',
                  marginTop: '4px'
                }}>
                  {enteredOpenPrice ? `${enteredOpenPrice} Kč` : '0 Kč'}
                </div>
              </div>

              {/* Touch Keypad with Decimal Point */}
              <div className="keypad-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                {['7', '8', '9'].map(num => (
                  <button key={num} type="button" className="key-btn" style={{ height: '52px' }} onClick={() => setEnteredOpenPrice(prev => {
                    if (prev.includes('.')) {
                      const parts = prev.split('.');
                      if (parts[1] && parts[1].length >= 2) return prev;
                    }
                    return prev.length < 8 ? prev + num : prev;
                  })}>{num}</button>
                ))}
                <button
                  type="button"
                  className="key-btn key-action"
                  style={{ height: '52px' }}
                  onClick={() => setEnteredOpenPrice(prev => prev.length > 1 ? prev.slice(0, -1) : '')}
                >
                  ⌫
                </button>

                {['4', '5', '6'].map(num => (
                  <button key={num} type="button" className="key-btn" style={{ height: '52px' }} onClick={() => setEnteredOpenPrice(prev => {
                    if (prev.includes('.')) {
                      const parts = prev.split('.');
                      if (parts[1] && parts[1].length >= 2) return prev;
                    }
                    return prev.length < 8 ? prev + num : prev;
                  })}>{num}</button>
                ))}
                <button
                  type="button"
                  className="key-btn key-action"
                  style={{ height: '52px', fontSize: '0.9rem', fontWeight: '700' }}
                  onClick={() => setEnteredOpenPrice('')}
                >
                  C
                </button>

                {['1', '2', '3'].map(num => (
                  <button key={num} type="button" className="key-btn" style={{ height: '52px' }} onClick={() => setEnteredOpenPrice(prev => {
                    if (prev.includes('.')) {
                      const parts = prev.split('.');
                      if (parts[1] && parts[1].length >= 2) return prev;
                    }
                    return prev.length < 8 ? prev + num : prev;
                  })}>{num}</button>
                ))}
                <button
                  type="button"
                  className="key-btn"
                  style={{ height: '52px', fontSize: '1.4rem', fontWeight: '700', color: 'var(--accent-blue)' }}
                  onClick={() => {
                    if (enteredOpenPrice.includes('.')) return;
                    setEnteredOpenPrice(prev => prev ? prev + '.' : '0.');
                  }}
                >
                  ,
                </button>

                <button type="button" className="key-btn" style={{ height: '52px', gridColumn: 'span 2' }} onClick={() => setEnteredOpenPrice(prev => {
                  if (prev.includes('.')) {
                    const parts = prev.split('.');
                    if (parts[1] && parts[1].length >= 2) return prev;
                  }
                  return prev.length < 8 ? prev + '0' : prev;
                })}>0</button>

                <button type="button" className="key-btn" style={{ height: '52px', gridColumn: 'span 2' }} onClick={() => setEnteredOpenPrice(prev => {
                  if (prev.includes('.')) {
                    const parts = prev.split('.');
                    if (parts[1] && parts[1].length >= 2) return prev;
                  }
                  return prev.length < 8 ? prev + '00' : prev;
                })}>00</button>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
                <button
                  type="button"
                  className="nav-tab"
                  style={{ flex: 1, justifyContent: 'center', height: '48px' }}
                  onClick={() => setOpenPriceTarget(null)}
                >
                  Zrušit
                </button>
                <button
                  type="submit"
                  className="pay-btn pay-btn-cash"
                  style={{ flex: 1.5, height: '48px' }}
                  disabled={!enteredOpenPrice || parseFloat(enteredOpenPrice) <= 0}
                >
                  <Check size={18} />
                  <span>Vložit do košíku</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {activeModal && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <Tag size={20} style={{ color: 'var(--accent-blue)' }} />
                <span>{activeModal === 'add' ? 'Nové Rychlé Tlačítko' : `Upravit: ${editingPreset?.name}`}</span>
              </div>
              <button className="close-modal-btn" onClick={() => setActiveModal(null)}>✕</button>
            </div>

            <form onSubmit={handleSubmitForm} className="modal-body">
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  Název položky
                </label>
                <input
                  type="text"
                  placeholder="např. Keramická váza nebo Volné zboží"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    color: '#ffffff'
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
                  id="isOpenPrice"
                  checked={formData.isOpenPrice}
                  onChange={e => setFormData({ ...formData, isOpenPrice: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--accent-amber)' }}
                />
                <label htmlFor="isOpenPrice" style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  Otevřená cena (Zadat částku až při prodeji na pokladně)
                </label>
              </div>

              {!formData.isOpenPrice && (
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
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
                        color: '#ffffff',
                        fontFamily: 'var(--font-mono)'
                      }}
                      required={!formData.isOpenPrice}
                    />
                  </div>

                  <div style={{ width: '130px' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
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
                        color: '#ffffff'
                      }}
                    >
                      <option value={21}>21% (Základní)</option>
                      <option value={12}>12% (Snížená)</option>
                      <option value={0}>0% (Osvobozeno)</option>
                    </select>
                  </div>
                </div>
              )}

              {formData.isOpenPrice && (
                <div style={{ width: '100%' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
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
                      color: '#ffffff'
                    }}
                  >
                    <option value={21}>21% (Základní)</option>
                    <option value={12}>12% (Snížená)</option>
                    <option value={0}>0% (Osvobozeno)</option>
                  </select>
                </div>
              )}

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Kategorie
                  </label>
                  <button
                    type="button"
                    style={{ background: 'transparent', color: 'var(--accent-blue)', fontSize: '0.75rem', fontWeight: '600' }}
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
                    color: '#ffffff'
                  }}
                >
                  {categories.filter(c => c.id !== 'all').map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
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
