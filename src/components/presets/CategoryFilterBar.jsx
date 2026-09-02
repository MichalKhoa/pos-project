import React, { useState, useRef } from 'react';
import { Edit3, FolderPlus, GripVertical } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext.jsx';

export default function CategoryFilterBar({
  categories,
  activeCategory,
  onSelectCategory,
  isEditMode = false,
  onManageCategories,
  onReorderCategories
}) {
  const { t } = useTranslation();
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

    // Keep 'all' category at position 0
    if (dropIndex === 0 && categories[0]?.id === 'all') {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newCats = Array.from(categories);
    const [movedCat] = newCats.splice(draggedIndex, 1);
    newCats.splice(dropIndex, 0, movedCat);

    const reordered = newCats.map((c, idx) => ({ ...c, position: idx }));
    if (onReorderCategories) {
      onReorderCategories(reordered);
    }

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 50);
  };

  const handleChipClick = (catId) => {
    if (isDraggingRef.current) return;
    onSelectCategory(catId);
    if (isEditMode && onManageCategories && catId !== 'all') {
      onManageCategories(catId);
    }
  };

  return (
    <div className="category-bar">
      {categories.map((cat, index) => {
        const isAll = cat.id === 'all';
        const isDraggable = isEditMode && !isAll;
        const isDragging = draggedIndex === index;
        const isDragOver = dragOverIndex === index;

        return (
          <button
            key={cat.id}
            type="button"
            draggable={isDraggable}
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={(e) => handleDragLeave(e, index)}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            className={`category-chip ${activeCategory === cat.id ? 'active' : ''} ${isEditMode && !isAll ? 'edit-mode-chip' : ''} ${isDragOver ? 'drag-over' : ''}`}
            onClick={() => handleChipClick(cat.id)}
            style={{
              opacity: isDragging ? 0.35 : 1,
              cursor: isDraggable ? 'grab' : 'pointer'
            }}
            title={
              isEditMode && !isAll
                ? `Klepnutím upravíte kategorii • Přetažením změníte pořadí`
                : undefined
            }
          >
            {isEditMode && !isAll && (
              <GripVertical size={13} style={{ opacity: 0.6, marginRight: '3px', flexShrink: 0 }} />
            )}
            <span>{isAll ? t('presets.all') : cat.name}</span>
            {isEditMode && !isAll && (
              <Edit3 size={11} style={{ opacity: 0.8, marginLeft: '5px', flexShrink: 0 }} />
            )}
          </button>
        );
      })}

      {isEditMode && onManageCategories && (
        <button
          type="button"
          className="category-chip category-chip-manage"
          onClick={() => onManageCategories()}
          title={t('presets.manage_categories')}
        >
          <FolderPlus size={14} style={{ marginRight: '4px' }} />
          <span>{t('presets.add_category') || 'Správa kategorií'}</span>
        </button>
      )}
    </div>
  );
}
