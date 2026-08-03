import React, { useState, useRef } from 'react';
import { Plus, Tag, Layers, Check, Edit3, Trash2, Settings2, GripVertical, MoveLeft, MoveRight, Search, X } from 'lucide-react';
import { DEFAULT_CATEGORIES, COLOR_OPTIONS } from '../data/initialData';
import CategoryManagerModal from './CategoryManagerModal';
import { useTranslation } from '../i18n/LanguageContext.jsx';

export default function QuickPresetGrid({
  presets,
  categories = DEFAULT_CATEGORIES,
  itemMultiplier = 1,
  setItemMultiplier,
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
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeModal, setActiveModal] = useState(null); // 'add' | 'edit' | null
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
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
          }, itemMultiplier);
          if (onClearKeypadAmount) onClearKeypadAmount();
        } else {
          // Trigger Open Price prompt modal
          setOpenPriceTarget(preset);
          setEnteredOpenPrice('');
        }
      } else {
        onAddToCart(preset, itemMultiplier);
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
    }, itemMultiplier);

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
          <span>{t('presets.title')}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>
            ({filteredPresets.length})
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* Quick Product Search Bar */}
          <div className="keypad-input-container" style={{ width: '180px', padding: '0.2rem 0.5rem', height: '32px' }}>
            <Search size={14} style={{ color: 'var(--text-muted)', marginRight: '4px' }} />
            <input
              type="text"
              className="keypad-label-input"
              placeholder={t('presets.search')}
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

          {itemMultiplier > 1 && (
            <div
              style={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: '#ffffff',
                padding: '0.35rem 0.65rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.8rem',
                fontWeight: '800',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                boxShadow: '0 2px 6px rgba(245, 158, 11, 0.35)'
              }}
              title="Aktivní násobič množství"
            >
              <span>⚡ {itemMultiplier}×</span>
              <button
                type="button"
                onClick={() => setItemMultiplier && setItemMultiplier(1)}
                style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '1px' }}
              >
                <X size={13} />
              </button>
            </div>
          )}

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
            <span>{isEditMode ? 'OK' : t('presets.edit')}</span>
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
          style={{ borderStyle: 'dashed', color: 'var(--accent-blue)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          onClick={() => setIsCategoryModalOpen(true)}
          title={t('presets.manage_categories')}
        >
          <Settings2 size={14} />
          <span>{t('presets.add_category')}</span>
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
          <span>Edit mode: Drag & drop to reorder. Click item to edit price & name.</span>
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
                position: 'relative',
                outline: isEditMode
                  ? (isDragOverThis ? '2px solid var(--accent-blue)' : '2px dashed var(--accent-amber)')
                  : (itemMultiplier > 1 ? '2px solid var(--accent-amber)' : 'none'),
                boxShadow: itemMultiplier > 1 && !isEditMode ? '0 0 12px rgba(245, 158, 11, 0.3)' : undefined,
                opacity: isDraggingThis ? 0.4 : 1,
                cursor: isEditMode ? 'grab' : 'pointer'
              }}
              onClick={() => handleCardClick(preset)}
            >
              {itemMultiplier > 1 && !isEditMode && (
                <div
                  style={{
                    position: 'absolute',
                    top: '5px',
                    right: '5px',
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    color: '#ffffff',
                    fontSize: '0.75rem',
                    fontWeight: '900',
                    padding: '2px 7px',
                    borderRadius: '8px',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)',
                    pointerEvents: 'none',
                    letterSpacing: '0.02em',
                    border: '1px solid rgba(255, 255, 255, 0.4)',
                    zIndex: 2
                  }}
                >
                  ×{itemMultiplier}
                </div>
              )}
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

              <div className="preset-footer" style={{ marginTop: '0.2rem' }}>
                {!preset.isOpenPrice ? (
                  <>
                    <div className="preset-price">{preset.price} Kč</div>
                    <div className="preset-vat">
                      {preset.trackStock && (
                        <span
                          style={{
                            marginRight: '6px',
                            fontWeight: '800',
                            padding: '1px 5px',
                            borderRadius: '4px',
                            background: (preset.stockQuantity || 0) <= 0 ? 'rgba(239, 68, 68, 0.3)' : (preset.stockQuantity || 0) <= (preset.minStockAlert || 5) ? 'rgba(245, 158, 11, 0.3)' : 'rgba(255,255,255,0.15)',
                            color: (preset.stockQuantity || 0) <= 0 ? 'var(--accent-rose)' : (preset.stockQuantity || 0) <= (preset.minStockAlert || 5) ? 'var(--accent-amber)' : 'inherit'
                          }}
                          title={`Skladová zásoba: ${preset.stockQuantity || 0} ks`}
                        >
                          📦 {preset.stockQuantity || 0} ks
                        </span>
                      )}
                      DPH {preset.vat}%
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    {preset.trackStock && (
                      <span style={{ fontSize: '0.72rem', fontWeight: '800', color: (preset.stockQuantity || 0) <= 0 ? 'var(--accent-rose)' : 'var(--text-muted)' }}>
                        📦 {preset.stockQuantity || 0} ks
                      </span>
                    )}
                    <div className="preset-vat">DPH {preset.vat}%</div>
                  </div>
                )}
              </div>
            </button>
          );
        })}

        <button className="preset-card preset-add-card" onClick={handleOpenAddModal}>
          <Plus size={24} />
          <span style={{ fontSize: '0.8rem', fontWeight: '600' }}>{t('presets.add_preset')}</span>
        </button>
      </div>

      {/* Preset Open Price Prompt Modal */}
      {openPriceTarget && (
        <div className="modal-overlay" onClick={() => setOpenPriceTarget(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <div className="modal-title">
                <Tag size={20} style={{ color: 'var(--accent-amber)' }} />
                <span>{openPriceTarget.name}</span>
              </div>
              <button className="close-modal-btn" onClick={() => setOpenPriceTarget(null)}>✕</button>
            </div>

            <form onSubmit={handleConfirmOpenPrice} className="modal-body">
              <div className="keypad-input-container">
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                  {t('presets.open_price_label')}
                </div>
                <div style={{ fontSize: '2rem', fontWeight: '900', color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)' }}>
                  {enteredOpenPrice ? `${enteredOpenPrice} Kč` : '0 Kč'}
                </div>
              </div>

              {/* Touch Numpad */}
              <div className="keypad-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                {['7', '8', '9'].map(num => (
                  <button key={num} type="button" className="key-btn" style={{ height: '52px' }} onClick={() => setEnteredOpenPrice(prev => {
                    if (prev.includes('.')) {
                      const parts = prev.split('.');
                      if (parts[1] && parts[1].length >= 2) return prev;
                    }
                    return prev.length < 10 ? prev + num : prev;
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
                    return prev.length < 10 ? prev + num : prev;
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
                    return prev.length < 10 ? prev + num : prev;
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
                  return prev.length < 10 ? prev + '0' : prev;
                })}>0</button>

                <button type="button" className="key-btn" style={{ height: '52px', gridColumn: 'span 2' }} onClick={() => setEnteredOpenPrice(prev => {
                  if (prev.includes('.')) {
                    const parts = prev.split('.');
                    if (parts[1] && parts[1].length >= 2) return prev;
                  }
                  return prev.length < 10 ? prev + '00' : prev;
                })}>00</button>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
                <button
                  type="button"
                  className="nav-tab"
                  style={{ flex: 1, justifyContent: 'center', height: '48px' }}
                  onClick={() => setOpenPriceTarget(null)}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="pay-btn pay-btn-cash"
                  style={{ flex: 1.5, height: '48px' }}
                  disabled={!enteredOpenPrice || parseFloat(enteredOpenPrice) <= 0}
                >
                  <Check size={18} />
                  <span>{t('keypad.add_to_cart')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {(activeModal === 'add' || activeModal === 'edit') && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <Tag size={20} style={{ color: 'var(--accent-blue)' }} />
                <span>{activeModal === 'add' ? t('presets.add_preset_title') : t('presets.edit_preset_title')}</span>
              </div>
              <button className="close-modal-btn" onClick={() => setActiveModal(null)}>✕</button>
            </div>

            <form onSubmit={handleSubmitForm} className="modal-body">
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  {t('presets.preset_name')}
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
                  {t('presets.open_price_label')}
                </label>
              </div>

              {!formData.isOpenPrice && (
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                      {t('presets.price')}
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
                        color: '#ffffff'
                      }}
                    >
                      <option value={21}>21%</option>
                      <option value={12}>12%</option>
                      <option value={0}>0%</option>
                    </select>
                  </div>
                </div>
              )}

              {formData.isOpenPrice && (
                <div style={{ width: '100%' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
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
                      color: '#ffffff'
                    }}
                  >
                    <option value={21}>21%</option>
                    <option value={12}>12%</option>
                    <option value={0}>0%</option>
                  </select>
                </div>
              )}

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {t('presets.col_category')}
                  </label>
                  <button
                    type="button"
                    style={{ background: 'transparent', color: 'var(--accent-blue)', fontSize: '0.75rem', fontWeight: '600' }}
                    onClick={() => setIsCategoryModalOpen(true)}
                  >
                    + {t('presets.add_category')}
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
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: '700' }}>
                  {t('presets.color_label')}
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(48px, 1fr))', gap: '0.65rem', maxHeight: '180px', overflowY: 'auto', padding: '4px 2px' }}>
                  {COLOR_OPTIONS.map(c => {
                    const isSelected = formData.color === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setFormData({ ...formData, color: c })}
                        style={{
                          height: '48px',
                          borderRadius: '12px',
                          background: c,
                          border: isSelected ? '3px solid #ffffff' : '2px solid rgba(255,255,255,0.15)',
                          boxShadow: isSelected ? `0 0 14px ${c}, 0 4px 10px rgba(0,0,0,0.5)` : '0 2px 5px rgba(0,0,0,0.2)',
                          transform: isSelected ? 'scale(1.08)' : 'scale(1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          touchAction: 'manipulation',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {isSelected && <Check size={22} style={{ color: '#ffffff', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))' }} />}
                      </button>
                    );
                  })}
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
                    <span>{t('presets.delete')}</span>
                  </button>
                ) : <div />}

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    type="button"
                    className="nav-tab"
                    onClick={() => setActiveModal(null)}
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="pay-btn pay-btn-card"
                    style={{ height: '44px', padding: '0 1.25rem' }}
                  >
                    <Check size={18} />
                    <span>{activeModal === 'add' ? t('presets.add_category_btn') : t('common.save')}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

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
