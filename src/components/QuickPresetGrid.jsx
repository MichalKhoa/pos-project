import React, { useState, useRef, useEffect } from 'react';
import { Plus, Tag, Layers, Check, Edit3, Trash2, Settings2, GripVertical, MoveLeft, MoveRight, Search, X, ChevronLeft, ChevronRight, FolderPlus, ChevronUp, ChevronDown } from 'lucide-react';
import { DEFAULT_CATEGORIES } from '../data/initialData';
import CategoryManagerModal from './CategoryManagerModal';
import PresetModal from './PresetModal';
import { useTranslation } from '../i18n/LanguageContext.jsx';
import { getPresetIconComponent } from '../utils/presetIcons';

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
  onClearKeypadAmount,
  isAdminMode = false,
  storeConfig = null
}) {
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeModal, setActiveModal] = useState(null); // 'add' | 'edit' | null

  const gridColumnsSetting = storeConfig?.presetGridColumns || 'auto';
  const getGridStyle = () => {
    if (gridColumnsSetting === '3') return { gridTemplateColumns: 'repeat(3, 1fr)' };
    if (gridColumnsSetting === '4') return { gridTemplateColumns: 'repeat(4, 1fr)' };
    if (gridColumnsSetting === '5') return { gridTemplateColumns: 'repeat(5, 1fr)' };
    if (gridColumnsSetting === '6') return { gridTemplateColumns: 'repeat(6, 1fr)' };
    return undefined; // default CSS auto-fill minmax(130px, 1fr)
  };
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState(null);

  // Category Bar Scroll State
  const categoryBarRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkCategoryScroll = () => {
    if (categoryBarRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = categoryBarRef.current;
      setCanScrollLeft(scrollLeft > 2);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 2);
    }
  };

  useEffect(() => {
    checkCategoryScroll();
    window.addEventListener('resize', checkCategoryScroll);
    return () => window.removeEventListener('resize', checkCategoryScroll);
  }, [categories]);

  const handleScrollCategories = (direction) => {
    if (categoryBarRef.current) {
      const scrollAmount = direction === 'left' ? -180 : 180;
      categoryBarRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      setTimeout(checkCategoryScroll, 300);
    }
  };

  // Open Price Prompt Modal State
  const [openPriceTarget, setOpenPriceTarget] = useState(null);
  const [enteredOpenPrice, setEnteredOpenPrice] = useState('');
  const [openPriceQty, setOpenPriceQty] = useState(1);

  const filteredPresets = presets.filter(p => {
    const matchesCategory = activeCategory === 'all' || p.category === activeCategory;
    const matchesSearch = !searchTerm.trim() ||
      (p.name && p.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.price && p.price.toString().includes(searchTerm)) ||
      (p.barcode && p.barcode.toLowerCase().includes(searchTerm.toLowerCase()));
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

    // Re-assign positions
    const reordered = newFullPresets.map((p, idx) => ({ ...p, position: idx }));

    setDraggedIndex(null);
    setDragOverIndex(null);

    if (onReorderPresets) {
      onReorderPresets(reordered);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 50);
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

  const handleCardClick = (preset) => {
    if (isDraggingRef.current) return;
    if (isEditMode) {
      handleOpenEditModal(preset);
    } else {
      if (preset.isOpenPrice) {
        const numericKeypad = parseFloat(keypadAmount);
        if (!isNaN(numericKeypad) && numericKeypad !== 0) {
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
          setOpenPriceQty(itemMultiplier !== 1 ? itemMultiplier : 1);
        }
      } else {
        onAddToCart(preset, itemMultiplier);
      }
    }
  };

  const handleConfirmOpenPrice = (e) => {
    e.preventDefault();
    const priceVal = parseFloat(enteredOpenPrice);
    if (isNaN(priceVal) || priceVal === 0 || !openPriceTarget) return;

    onAddToCart({
      ...openPriceTarget,
      price: priceVal
    }, openPriceQty);

    setOpenPriceTarget(null);
    setEnteredOpenPrice('');
    setOpenPriceQty(1);
  };

  const handleOpenAddModal = () => {
    setEditingPreset(null);
    setActiveModal('add');
  };

  const handleOpenEditModal = (preset, e) => {
    if (e) e.stopPropagation();
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
          <div className="keypad-input-container" style={{ minWidth: '160px', flex: '1 1 180px', maxWidth: '240px', padding: '0 0.6rem', height: '36px', boxSizing: 'border-box' }}>
            <Search size={14} style={{ color: 'var(--text-muted)', marginRight: '6px', flexShrink: 0 }} />
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

          {/* Category & Catalog Edit Action Buttons */}
          <button
            type="button"
            className="nav-tab"
            style={{
              padding: '0.35rem 0.65rem',
              fontSize: '0.8rem',
              background: 'rgba(255,255,255,0.06)',
              color: 'var(--accent-blue)',
              fontWeight: '700',
              gap: '0.35rem'
            }}
            onClick={() => {
              setEditingPreset(null);
              setActiveModal('add');
            }}
            title={t('presets.add_preset')}
          >
            <Plus size={14} />
            <span>{t('presets.add_preset') || 'Přidat'}</span>
          </button>

          <button
            type="button"
            className={`nav-tab ${isEditMode ? 'active' : ''}`}
            style={{
              padding: '0.35rem 0.75rem',
              fontSize: '0.8rem',
              background: isEditMode ? 'var(--accent-amber)' : 'rgba(255,255,255,0.06)',
              color: isEditMode ? '#000000' : 'var(--text-primary)',
              fontWeight: '700',
              gap: '0.35rem'
            }}
            onClick={() => setIsEditMode(!isEditMode)}
            title="Zapnout/Vypnout režim úprav tlačítek pokladny"
          >
            {isEditMode ? <Check size={14} /> : <Edit3 size={14} />}
            <span>{isEditMode ? 'Hotovo' : t('presets.edit') || 'Upravit'}</span>
          </button>

          {isAdminMode && (
            <button
              type="button"
              className="nav-tab"
              style={{
                padding: '0.35rem 0.65rem',
                fontSize: '0.8rem',
                background: 'rgba(255,255,255,0.06)',
                color: 'var(--accent-purple)',
                fontWeight: '700',
                gap: '0.35rem'
              }}
              onClick={() => setIsCategoryModalOpen(true)}
              title={t('presets.manage_categories')}
            >
              <FolderPlus size={14} />
              <span>{t('presets.add_category')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Category Filter Bar */}
      <div className="category-bar-wrapper">
        {canScrollLeft && (
          <button
            type="button"
            className="category-scroll-btn scroll-btn-left"
            onClick={() => handleScrollCategories('left')}
            title="Posunout kategorie vlevo"
          >
            <ChevronLeft size={16} />
          </button>
        )}

        <div
          ref={categoryBarRef}
          className="category-bar"
          onScroll={checkCategoryScroll}
        >
          {categories.map(cat => (
            <button
              key={cat.id}
              className={`category-chip ${activeCategory === cat.id ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat.id)}
            >
              {cat.id === 'all' ? t('presets.all') : cat.name}
            </button>
          ))}
        </div>

        {canScrollRight && (
          <button
            type="button"
            className="category-scroll-btn scroll-btn-right"
            onClick={() => handleScrollCategories('right')}
            title="Posunout kategorie vpravo"
          >
            <ChevronRight size={16} />
          </button>
        )}
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

      <div className="preset-grid" style={getGridStyle()}>
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
                <div className="preset-name" style={{ flex: 1 }}>
                  <span>{preset.name}</span>
                  {preset.isGeneralPreset && (
                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: '600',
                      background: 'rgba(255, 255, 255, 0.18)',
                      color: 'rgba(255, 255, 255, 0.95)',
                      padding: '1px 5px',
                      borderRadius: '4px',
                      marginLeft: '6px',
                      verticalAlign: 'middle',
                      display: 'inline-block',
                      letterSpacing: '0.01em'
                    }}>
                      {t('presets.general_badge') || 'Druh zboží'}
                    </span>
                  )}
                </div>

                {/* Bottom-Right Corner Visual Icon / Photo Badge */}
                {preset.imageUrl ? (
                  <img
                    src={preset.imageUrl}
                    alt=""
                    style={{
                      position: 'absolute',
                      bottom: '6px',
                      right: '6px',
                      width: '26px',
                      height: '26px',
                      objectFit: 'cover',
                      borderRadius: '5px',
                      border: '1px solid rgba(255,255,255,0.25)',
                      boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
                      pointerEvents: 'none',
                      zIndex: 1
                    }}
                  />
                ) : (() => {
                  const IconComponent = getPresetIconComponent(preset.icon);
                  return IconComponent ? (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '5px',
                        right: '6px',
                        opacity: 0.32,
                        color: 'var(--text-primary)',
                        pointerEvents: 'none',
                        zIndex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <IconComponent size={28} />
                    </div>
                  ) : null;
                })()}
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
                      title={t('presets.edit')}
                    >
                      <Edit3 size={14} />
                    </span>
                    <span
                      style={{ background: 'var(--accent-rose)', color: '#fff', borderRadius: '4px', padding: '3px', marginLeft: '2px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
                      onClick={(e) => handleDelete(preset.id, e)}
                      title={t('presets.delete')}
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
                      {!preset.isGeneralPreset && preset.trackStock && (
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
                    {!preset.isGeneralPreset && preset.trackStock && (
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
              {/* Amount display */}
              <div style={{
                background: 'var(--bg-input)', borderRadius: '10px',
                border: (openPriceQty < 0 || (enteredOpenPrice && parseFloat(enteredOpenPrice) < 0)) ? '2px solid var(--accent-rose)' : (openPriceQty > 1 ? '2px solid var(--accent-amber)' : '1px solid var(--border-color)'),
                boxShadow: (openPriceQty < 0 || (enteredOpenPrice && parseFloat(enteredOpenPrice) < 0)) ? '0 0 12px rgba(239, 68, 68, 0.3)' : (openPriceQty > 1 ? '0 0 12px rgba(245,158,11,0.2)' : 'none'),
                padding: '0.5rem 0.85rem', textAlign: 'right', transition: 'all 0.2s ease'
              }}>
                <div style={{ fontSize: '0.65rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.06em', color: (openPriceQty < 0 || (enteredOpenPrice && parseFloat(enteredOpenPrice) < 0)) ? 'var(--accent-rose)' : (openPriceQty > 1 ? 'var(--accent-amber)' : 'var(--text-muted)'), textAlign: 'left' }}>
                  {(openPriceQty < 0 || (enteredOpenPrice && parseFloat(enteredOpenPrice) < 0)) ? '↩️ VRATKA ZBOŽÍ (Zadána záporná částka)' : t('presets.open_price_label')}
                </div>
                <div style={{ fontSize: openPriceQty !== 1 ? '1.55rem' : '2rem', fontWeight: '900', color: (openPriceQty < 0 || (enteredOpenPrice && parseFloat(enteredOpenPrice) < 0)) ? 'var(--accent-rose)' : (openPriceQty > 1 ? 'var(--accent-amber)' : 'var(--accent-emerald)'), fontFamily: 'var(--font-mono)', lineHeight: 1.2 }}>
                  {openPriceQty !== 1
                    ? `${openPriceQty} × ${enteredOpenPrice ? `${enteredOpenPrice} Kč` : '___ Kč'}`
                    : (enteredOpenPrice ? `${enteredOpenPrice} Kč` : '0 Kč')}
                </div>
                {openPriceQty !== 1 && enteredOpenPrice && parseFloat(enteredOpenPrice) !== 0 && (
                  <div style={{ fontSize: '0.84rem', fontWeight: '800', fontFamily: 'var(--font-mono)', color: (openPriceQty * parseFloat(enteredOpenPrice)) < 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)', borderTop: '1px dashed rgba(245,158,11,0.35)', paddingTop: '2px', marginTop: '2px' }}>
                    = Celkem {(openPriceQty * parseFloat(enteredOpenPrice)).toLocaleString('cs-CZ')} Kč
                  </div>
                )}
              </div>

              {/* Qty arrow stepper — directly below price */}
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    if (enteredOpenPrice && !enteredOpenPrice.startsWith('-') && openPriceQty === 1) {
                      setEnteredOpenPrice('-' + enteredOpenPrice);
                      return;
                    }
                    setOpenPriceQty(prev => {
                      if (prev === 1) return -1;
                      if (prev < 0) return prev - 1;
                      return prev - 1;
                    });
                  }}
                  style={{
                    flex: 1, height: '36px', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', gap: '0.3rem', borderRadius: '8px',
                    background: (openPriceQty < 0 || (enteredOpenPrice && enteredOpenPrice.startsWith('-'))) ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : (openPriceQty > 1 ? 'var(--accent-amber)' : 'var(--bg-input)'),
                    border: (openPriceQty < 0 || (enteredOpenPrice && enteredOpenPrice.startsWith('-'))) ? 'none' : '1.5px solid var(--border-color)',
                    fontWeight: '900', fontSize: '0.85rem',
                    color: (openPriceQty < 0 || openPriceQty > 1 || (enteredOpenPrice && enteredOpenPrice.startsWith('-'))) ? '#fff' : 'var(--text-primary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  title="Snížit množství / Vratka (-1)"
                >
                  <ChevronDown size={16} /><span>-1</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (enteredOpenPrice && enteredOpenPrice.startsWith('-') && openPriceQty === 1) {
                      setEnteredOpenPrice(enteredOpenPrice.slice(1));
                      return;
                    }
                    setOpenPriceQty(prev => {
                      if (prev === -1) return 1;
                      if (prev < -1) return prev + 1;
                      return prev + 1;
                    });
                  }}
                  style={{
                    flex: 1, height: '36px', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', gap: '0.3rem', borderRadius: '8px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    border: 'none', fontWeight: '900', fontSize: '0.85rem', color: '#fff',
                    cursor: 'pointer', boxShadow: '0 2px 6px rgba(16,185,129,0.35)',
                    transition: 'all 0.15s ease'
                  }}
                  title="Zvýšit množství (+1)"
                >
                  <ChevronUp size={16} /><span>+1</span>
                </button>
              </div>

              {/* Touch Numpad */}
              <div className="keypad-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                {['7', '8', '9'].map(num => (
                  <button key={num} type="button" className="key-btn" style={{ height: '52px', aspectRatio: 'auto' }} onClick={() => setEnteredOpenPrice(prev => {
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
                  style={{ height: '52px', aspectRatio: 'auto' }}
                  onClick={() => setEnteredOpenPrice(prev => prev.length > 1 ? prev.slice(0, -1) : '')}
                >
                  ⌫
                </button>

                {['4', '5', '6'].map(num => (
                  <button key={num} type="button" className="key-btn" style={{ height: '52px', aspectRatio: 'auto' }} onClick={() => setEnteredOpenPrice(prev => {
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
                  style={{ height: '52px', fontSize: '0.9rem', fontWeight: '700', aspectRatio: 'auto' }}
                  onClick={() => setEnteredOpenPrice('')}
                >
                  C
                </button>

                {['1', '2', '3'].map(num => (
                  <button key={num} type="button" className="key-btn" style={{ height: '52px', aspectRatio: 'auto' }} onClick={() => setEnteredOpenPrice(prev => {
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
                  style={{ height: '52px', fontSize: '1.4rem', fontWeight: '700', color: 'var(--accent-blue)', aspectRatio: 'auto' }}
                  onClick={() => {
                    if (enteredOpenPrice.includes('.')) return;
                    setEnteredOpenPrice(prev => prev ? prev + '.' : '0.');
                  }}
                >
                  ,
                </button>

                <button type="button" className="key-btn" style={{ height: '52px', aspectRatio: 'auto' }} onClick={() => setEnteredOpenPrice(prev => {
                  if (prev.includes('.')) {
                    const parts = prev.split('.');
                    if (parts[1] && parts[1].length >= 2) return prev;
                  }
                  return prev.length < 10 ? prev + '0' : prev;
                })}>0</button>

                <button
                  type="button"
                  className="key-btn"
                  style={{
                    height: '52px',
                    fontSize: '0.85rem',
                    fontWeight: '900',
                    background: enteredOpenPrice.startsWith('-') ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 'rgba(239, 68, 68, 0.15)',
                    color: enteredOpenPrice.startsWith('-') ? '#ffffff' : 'var(--accent-rose)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    gridColumn: 'span 3',
                    aspectRatio: 'auto'
                  }}
                  onClick={() => setEnteredOpenPrice(prev => {
                    if (!prev) return '-';
                    if (prev.startsWith('-')) return prev.slice(1);
                    return '-' + prev;
                  })}
                  title="Změnit znaménko / Vratka"
                >
                  ± Vratka
                </button>
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
                  style={{
                    flex: 1.5, height: '48px',
                    background: (openPriceQty < 0 || (enteredOpenPrice && parseFloat(enteredOpenPrice) < 0)) ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : undefined
                  }}
                  disabled={!enteredOpenPrice || isNaN(parseFloat(enteredOpenPrice)) || parseFloat(enteredOpenPrice) === 0}
                >
                  <Check size={18} />
                  <span>{(openPriceQty < 0 || (enteredOpenPrice && parseFloat(enteredOpenPrice) < 0)) ? 'Vrátit zboží (Vratka)' : t('keypad.add_to_cart')}</span>
                </button>
              </div>
            </form>
          </div>
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
          if (window.confirm('Opravdu chcete toto tlačítko smazat?')) {
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
