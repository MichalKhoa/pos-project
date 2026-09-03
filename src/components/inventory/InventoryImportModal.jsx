import React from 'react';
import { Upload, Check, X, AlertTriangle, PackagePlus, RefreshCw } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext';

export default function InventoryImportModal({
  isOpen,
  onClose,
  onConfirm,
  importData,
  isImporting = false
}) {
  const { t } = useTranslation();

  if (!isOpen || !importData) return null;

  const { toUpdate = [], toCreate = [], errors = [] } = importData;
  const totalCount = toUpdate.length + toCreate.length;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}
      onClick={e => { if (e.target === e.currentTarget && !isImporting) onClose(); }}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90dvh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-input)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(59, 130, 246, 0.15)',
                color: 'var(--accent-blue)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Upload size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                {t('inventory.import_preview_title') || 'Import skladových položek z CSV'}
              </h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {t('inventory.import_preview_desc') || 'Zkontrolujte souhrn před zápisem do databáze'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isImporting}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '0.25rem',
              borderRadius: 'var(--radius-sm)'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {errors.length > 0 && (
            <div
              style={{
                padding: '0.75rem',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--accent-rose)',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              <div>{errors.join(', ')}</div>
            </div>
          )}

          {/* Stat Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div
              style={{
                padding: '0.85rem',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem'
              }}
            >
              <RefreshCw size={22} style={{ color: 'var(--accent-blue)' }} />
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '700' }}>
                  {t('inventory.import_to_update') || 'K aktualizaci'}
                </div>
                <div style={{ fontSize: '1.3rem', fontWeight: '900', color: 'var(--accent-blue)' }}>
                  {toUpdate.length} položek
                </div>
              </div>
            </div>

            <div
              style={{
                padding: '0.85rem',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem'
              }}
            >
              <PackagePlus size={22} style={{ color: 'var(--accent-emerald)' }} />
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '700' }}>
                  {t('inventory.import_to_create') || 'Nových k vytvoření'}
                </div>
                <div style={{ fontSize: '1.3rem', fontWeight: '900', color: 'var(--accent-emerald)' }}>
                  {toCreate.length} položek
                </div>
              </div>
            </div>
          </div>

          {/* Item sample list preview */}
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: '800', color: 'var(--text-secondary)', marginBottom: '0.45rem' }}>
              Náhled položek ({Math.min(5, totalCount)} z {totalCount}):
            </div>
            <div
              style={{
                background: 'var(--bg-input)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                overflow: 'hidden'
              }}
            >
              {[...toUpdate, ...toCreate].slice(0, 5).map((p, idx) => (
                <div
                  key={p.id || idx}
                  style={{
                    padding: '0.55rem 0.85rem',
                    borderBottom: idx < 4 && idx < totalCount - 1 ? '1px solid var(--border-color)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.82rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: '800', color: 'var(--text-primary)' }}>{p.name}</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {p.showInPresets ? '📌 Na pokladně' : '🏷️ Pouze sklad'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontWeight: '700', color: 'var(--accent-emerald)' }}>{p.price} Kč</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Skladem: <strong>{p.stockQuantity} ks</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '0.85rem 1.25rem',
            borderTop: '1px solid var(--border-color)',
            background: 'var(--bg-input)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '0.65rem'
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isImporting}
            style={{
              height: '42px',
              padding: '0 1.1rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            {t('common.cancel') || 'Zrušit'}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isImporting || totalCount === 0}
            style={{
              height: '42px',
              padding: '0 1.25rem',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: 'var(--accent-emerald)',
              color: '#ffffff',
              fontSize: '0.88rem',
              fontWeight: '800',
              cursor: isImporting ? 'default' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              opacity: isImporting || totalCount === 0 ? 0.5 : 1
            }}
          >
            <Check size={18} />
            <span>
              {isImporting
                ? (t('common.saving') || 'Importuji...')
                : `${t('inventory.confirm_import') || 'Potvrdit import'} (${totalCount})`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
