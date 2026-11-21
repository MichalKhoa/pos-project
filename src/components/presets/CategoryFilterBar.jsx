import React, { useState, useRef, useEffect } from 'react';
import { Edit3, GripVertical } from 'lucide-react';
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
  const barRef = useRef(null);

  // Keep the selected chip visible in the scrolling row.
  useEffect(() => {
    const bar = barRef.current;
    const chip = bar?.querySelector('.category-chip.active');
    if (!chip) return;
    // Scroll only the bar itself; scrollIntoView could also move ancestor panels.
    const left = chip.offsetLeft - bar.offsetLeft;
    if (left < bar.scrollLeft) bar.scrollLeft = left - 8;
    else if (left + chip.offsetWidth > bar.scrollLeft + bar.clientWidth - 28) bar.scrollLeft = left + chip.offsetWidth - bar.clientWidth + 36;
  }, [activeCategory]);

  // Mouse wheel scrolls the row sideways.
  const handleWheel = (e) => {
    if (e.deltaY && !e.deltaX) barRef.current.scrollLeft += e.deltaY;
  };

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
    <div className="category-bar is-scroll" ref={barRef} onWheel={handleWheel}>
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
                ? t('presets.edit_mode_hint')
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
    </div>
  );
}
