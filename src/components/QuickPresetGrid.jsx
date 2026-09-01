import React, { useState, useMemo } from 'react';
import { Plus, Layers, Check, Edit3, Search, X, FolderPlus } from 'lucide-react';
import { DEFAULT_CATEGORIES } from '../data/initialData';
import CategoryManagerModal from './CategoryManagerModal';
import PresetModal from './PresetModal';
import { useTranslation } from '../i18n/LanguageContext.jsx';
import { usePresetDragDrop } from '../hooks/usePresetDragDrop';
import CategoryFilterBar from './presets/CategoryFilterBar.jsx';
import PresetTileCard from './presets/PresetTileCard.jsx';
import OpenPriceModal from './presets/OpenPriceModal.jsx';

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
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState(null);

  // Open Price Prompt Modal State
  const [openPriceTarget, setOpenPriceTarget] = useState(null);
  const [enteredOpenPrice, setEnteredOpenPrice] = useState('');
  const [openPriceQty, setOpenPriceQty] = useState(1);

  const gridColumnsSetting = storeConfig?.presetGridColumns || 'auto';
  const getGridStyle = () => {
    if (gridColumnsSetting === '3') return { gridTemplateColumns: 'repeat(3, 1fr)' };
    if (gridColumnsSetting === '4') return { gridTemplateColumns: 'repeat(4, 1fr)' };
    if (gridColumnsSetting === '5') return { gridTemplateColumns: 'repeat(5, 1fr)' };
    if (gridColumnsSetting === '6') return { gridTemplateColumns: 'repeat(6, 1fr)' };
    return undefined;
  };

  const filteredPresets = useMemo(() => {
    return presets.filter(p => {
      const matchesCategory = activeCategory === 'all' || p.category === activeCategory;
      const matchesSearch = !searchTerm.trim() ||
        (p.name && p.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.price && p.price.toString().includes(searchTerm)) ||
        (p.barcode && p.barcode.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [presets, activeCategory, searchTerm]);

  const {
    draggedIndex,
    dragOverIndex,
    isDraggingRef,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
    handleMovePosition
  } = usePresetDragDrop({
    presets,
    filteredPresets,
    activeCategory,
    isEditMode,
    onReorderPresets
  });

  const handleCardClick = (preset) => {
    if (isDraggingRef.current) return;
    if (isEditMode) {
      setEditingPreset(preset);
      setActiveModal('edit');
      return;
    }

    if (keypadAmount && parseFloat(keypadAmount) > 0) {
      const customPrice = parseFloat(keypadAmount);
      onAddToCart({
        ...preset,
        price: customPrice,
        quantity: itemMultiplier || 1
      });
      if (onClearKeypadAmount) onClearKeypadAmount();
      if (setItemMultiplier && itemMultiplier !== 1) setItemMultiplier(1);
      return;
    }

    if (preset.isGeneralPreset || preset.price === 0 || preset.price === '0' || !preset.price) {
      setOpenPriceTarget(preset);
      setEnteredOpenPrice('');
      setOpenPriceQty(itemMultiplier || 1);
      return;
    }

    onAddToCart({
      ...preset,
      quantity: itemMultiplier || 1
    });

    if (setItemMultiplier && itemMultiplier !== 1) {
      setItemMultiplier(1);
    }
  };

  const handleOpenPriceSubmit = (e) => {
    e.preventDefault();
    const finalPrice = parseFloat(enteredOpenPrice);
    if (isNaN(finalPrice) || finalPrice === 0 || !openPriceTarget) return;

    onAddToCart({
      ...openPriceTarget,
      price: finalPrice,
      quantity: openPriceQty || 1
    });

    setOpenPriceTarget(null);
    setEnteredOpenPrice('');
    if (setItemMultiplier && itemMultiplier !== 1) setItemMultiplier(1);
  };

  const handleOpenEditModal = (preset, e) => {
    if (e) e.stopPropagation();
    setEditingPreset(preset);
    setActiveModal('edit');
  };

  const handleSavePreset = (presetData) => {
    if (activeModal === 'add') {
      onAddPreset(presetData);
    } else if (activeModal === 'edit' && editingPreset) {
      onUpdatePreset({ ...presetData, id: editingPreset.id });
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

          {/* Action Buttons */}
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
      <CategoryFilterBar
        categories={categories}
        activeCategory={activeCategory}
        onSelectCategory={setActiveCategory}
      />

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

      {/* Grid of Preset Cards */}
      <div className="preset-grid" style={getGridStyle()}>
        {filteredPresets.map((preset, index) => (
          <PresetTileCard
            key={preset.id}
            preset={preset}
            index={index}
            totalCount={filteredPresets.length}
            isEditMode={isEditMode}
            itemMultiplier={itemMultiplier}
            isDraggingThis={draggedIndex === index}
            isDragOverThis={dragOverIndex === index}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
            onClick={handleCardClick}
            onMovePosition={handleMovePosition}
            onOpenEditModal={handleOpenEditModal}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {/* Open Price Modal */}
      <OpenPriceModal
        openPriceTarget={openPriceTarget}
        onClose={() => setOpenPriceTarget(null)}
        enteredOpenPrice={enteredOpenPrice}
        setEnteredOpenPrice={setEnteredOpenPrice}
        openPriceQty={openPriceQty}
        setOpenPriceQty={setOpenPriceQty}
        onSubmit={handleOpenPriceSubmit}
      />

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
