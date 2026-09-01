import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext.jsx';

export default function CategoryFilterBar({
  categories,
  activeCategory,
  onSelectCategory
}) {
  const { t } = useTranslation();
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

  return (
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
            type="button"
            className={`category-chip ${activeCategory === cat.id ? 'active' : ''}`}
            onClick={() => onSelectCategory(cat.id)}
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
  );
}
