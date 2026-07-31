import React, { useState } from 'react';
import { Tag, Plus, Edit3, Trash2, Check, X, Layers } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext.jsx';

export default function CategoryManagerModal({
  categories,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
  onClose,
  onSelectCategory
}) {
  const { t } = useTranslation();
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCatId, setEditingCatId] = useState(null);
  const [editingName, setEditingName] = useState('');

  const handleCreate = (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    const createdId = onAddCategory(newCategoryName.trim());
    setNewCategoryName('');
    if (createdId && onSelectCategory) {
      onSelectCategory(createdId);
    }
  };

  const handleStartEdit = (cat) => {
    setEditingCatId(cat.id);
    setEditingName(cat.name);
  };

  const handleSaveEdit = (catId) => {
    if (!editingName.trim()) return;
    if (onEditCategory) {
      onEditCategory(catId, editingName.trim());
    }
    setEditingCatId(null);
    setEditingName('');
  };

  const handleCancelEdit = () => {
    setEditingCatId(null);
    setEditingName('');
  };

  const handleDelete = (catId, catName) => {
    if (catId === 'all') return;
    if (window.confirm(`Opravdu chcete smazat kategorii "${catName}"? Položky v ní obsažené nebudou smazány.`)) {
      onDeleteCategory(catId);
    }
  };

  // Filter out system 'all' category from management list if needed, or present cleanly
  const editableCategories = categories.filter(c => c.id !== 'all');

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <div className="modal-header">
          <div className="modal-title">
            <Layers size={20} style={{ color: 'var(--accent-blue)' }} />
            <span>{t('presets.manage_categories')}</span>
          </div>
          <button className="close-modal-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ gap: '1.2rem' }}>
          {/* Add New Category Form */}
          <form onSubmit={handleCreate} style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              placeholder={t('presets.new_category_placeholder')}
              value={newCategoryName}
              onChange={e => setNewCategoryName(e.target.value)}
              style={{
                flex: 1,
                padding: '0.65rem 0.85rem',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontWeight: '600'
              }}
              required
            />
            <button
              type="submit"
              className="pay-btn pay-btn-card"
              style={{ height: '42px', padding: '0 1rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
            >
              <Plus size={16} />
              <span>{t('presets.add_category_btn')}</span>
            </button>
          </form>

          {/* List of Existing Categories */}
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              {t('presets.existing_categories')} ({editableCategories.length}):
            </div>

            <div style={{
              maxHeight: '280px',
              overflowY: 'auto',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-card)'
            }}>
              {editableCategories.length === 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No categories defined.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {editableCategories.map((cat) => {
                    const isEditingThis = editingCatId === cat.id;

                    return (
                      <div
                        key={cat.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justify: 'space-between',
                          padding: '0.65rem 0.85rem',
                          borderBottom: '1px solid var(--border-color)',
                          gap: '0.5rem',
                          background: isEditingThis ? 'rgba(59, 130, 246, 0.05)' : 'transparent'
                        }}
                      >
                        {isEditingThis ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1 }}>
                            <input
                              type="text"
                              value={editingName}
                              onChange={e => setEditingName(e.target.value)}
                              style={{
                                flex: 1,
                                padding: '0.4rem 0.6rem',
                                background: 'var(--bg-input)',
                                border: '1px solid var(--border-focus)',
                                borderRadius: 'var(--radius-sm)',
                                color: 'var(--text-primary)',
                                fontWeight: '700'
                              }}
                              autoFocus
                            />
                            <button
                              type="button"
                              className="nav-tab"
                              style={{ padding: '0.35rem 0.6rem', background: 'var(--accent-emerald)', color: '#fff', borderColor: 'var(--accent-emerald)' }}
                              onClick={() => handleSaveEdit(cat.id)}
                              title={t('common.save')}
                            >
                              <Check size={16} />
                            </button>
                            <button
                              type="button"
                              className="nav-tab"
                              style={{ padding: '0.35rem 0.6rem' }}
                              onClick={handleCancelEdit}
                              title={t('common.cancel')}
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <Tag size={14} style={{ color: 'var(--accent-blue)' }} />
                              <span>{cat.name}</span>
                            </div>

                            <div style={{ display: 'flex', gap: '0.35rem' }}>
                              <button
                                type="button"
                                className="nav-tab"
                                style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
                                onClick={() => handleStartEdit(cat)}
                                title={t('presets.edit')}
                              >
                                <Edit3 size={14} />
                                <span>{t('presets.edit')}</span>
                              </button>

                              <button
                                type="button"
                                className="delete-item-btn"
                                style={{ padding: '0.35rem 0.5rem' }}
                                onClick={() => handleDelete(cat.id, cat.name)}
                                title={t('presets.delete')}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button type="button" className="btn btn-outline" onClick={onClose} style={{ height: '42px', padding: '0 1.25rem' }}>
              {t('common.close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
