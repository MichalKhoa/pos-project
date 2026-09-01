import { useState, useRef } from 'react';

export function usePresetDragDrop({ presets, filteredPresets, activeCategory, isEditMode, onReorderPresets }) {
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

    const reordered = newFullPresets.map((p, idx) => ({ ...p, position: idx }));
    if (onReorderPresets) {
      onReorderPresets(reordered);
    }
  };

  return {
    draggedIndex,
    dragOverIndex,
    isDraggingRef,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
    handleMovePosition
  };
}
