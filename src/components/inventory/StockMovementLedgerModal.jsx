import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { History, X, Filter, Loader2, ArrowDownRight, ArrowUpRight, RefreshCw, Layers } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext';
import { getStockMovements } from '../../api/posApi';

export default function StockMovementLedgerModal({
  isOpen,
  onClose,
  presets = [],
  initialPresetId = null
}) {
  const { t } = useTranslation();
  const [selectedPresetId, setSelectedPresetId] = useState(initialPresetId || '');
  const [movements, setMovements] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (initialPresetId) {
      setSelectedPresetId(initialPresetId);
    }
  }, [initialPresetId]);

  const loadMovements = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getStockMovements(selectedPresetId || null, 200, 0);
      setMovements(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load stock movements:', err);
      setError(err.message || 'Chyba při načítání pohybů zásob.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedPresetId]);

  useEffect(() => {
    if (isOpen) {
      loadMovements();
    }
  }, [isOpen, loadMovements]);

  const presetLookup = useMemo(() => {
    const map = {};
    presets.forEach(p => { map[p.id] = p; });
    return map;
  }, [presets]);

  if (!isOpen) return null;

  const getMovementBadge = (type) => {
    switch (type) {
      case 'RECEIPT':
        return {
          label: t('stock_movements.type_receipt') || 'Příjemka',
          bg: 'rgba(16, 185, 129, 0.12)',
          color: 'var(--accent-emerald)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          icon: <ArrowUpRight size={14} />
        };
      case 'SALE':
        return {
          label: t('stock_movements.type_sale') || 'Prodej',
          bg: 'rgba(59, 130, 246, 0.12)',
          color: 'var(--accent-blue)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          icon: <ArrowDownRight size={14} />
        };
      case 'RETURN':
        return {
          label: t('stock_movements.type_return') || 'Vratka',
          bg: 'rgba(14, 165, 233, 0.12)',
          color: 'var(--accent-cyan, #0ea5e9)',
          border: '1px solid rgba(14, 165, 233, 0.3)',
          icon: <ArrowUpRight size={14} />
        };
      case 'WRITE_OFF':
        return {
          label: t('stock_movements.type_write_off') || 'Odpis',
          bg: 'rgba(239, 68, 68, 0.12)',
          color: 'var(--accent-rose)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          icon: <ArrowDownRight size={14} />
        };
      default:
        return {
          label: t('stock_movements.type_adjustment') || 'Korekce',
          bg: 'rgba(245, 158, 11, 0.12)',
          color: 'var(--accent-amber)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          icon: <Layers size={14} />
        };
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('cs-CZ', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          width: '100%',
          maxWidth: '960px',
          maxHeight: '92dvh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '0.85rem 1.25rem',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-input)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(139, 92, 246, 0.15)',
                color: 'var(--accent-purple, #8b5cf6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <History size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                {t('stock_movements.title') || 'Kniha pohybů zásob (§ 7b ZDP)'}
              </h3>
              <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                Auditorský záznam všech naskladnění, prodejů, vratek a úprav skladu
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '0.4rem',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '40px',
              minHeight: '40px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Toolbar & Filter Bar */}
        <div
          style={{
            padding: '0.75rem 1.25rem',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
            background: 'var(--bg-card)'
          }}
        >
          {/* Preset filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '240px', maxWidth: '400px' }}>
            <Filter size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <select
              value={selectedPresetId}
              onChange={e => setSelectedPresetId(e.target.value)}
              style={{
                width: '100%',
                height: '38px',
                padding: '0 0.75rem',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: '0.84rem',
                fontWeight: '600'
              }}
            >
              <option value="">-- {t('stock_movements.all_products') || 'Všechny položky'} --</option>
              {presets.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.barcode ? `(${p.barcode})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Refresh & Counter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>
              {movements.length} {t('stock_movements.total_records') || 'záznamů'}
            </span>
            <button
              type="button"
              onClick={loadMovements}
              disabled={isLoading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                height: '38px',
                padding: '0 0.85rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={14} className={isLoading ? 'spin-animate' : ''} />
              <span>Aktualizovat</span>
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: '300px' }}>
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', gap: '0.75rem', color: 'var(--text-muted)' }}>
              <Loader2 size={32} className="spin-animate" style={{ color: 'var(--accent-blue)' }} />
              <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>{t('stock_movements.loading') || 'Načítám pohyby zásob...'}</span>
            </div>
          ) : error ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--accent-rose)', fontWeight: '700' }}>
              {error}
            </div>
          ) : movements.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', gap: '0.5rem', color: 'var(--text-muted)' }}>
              <History size={40} style={{ opacity: 0.3 }} />
              <span style={{ fontSize: '0.92rem', fontWeight: '700' }}>{t('stock_movements.empty') || 'Nebyly nalezeny žádné skladové pohyby.'}</span>
              <span style={{ fontSize: '0.78rem' }}>Pohyby se automaticky zaznamenávají při prodeji, vratkách a naskladnění příjemkami.</span>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg-input)' }}>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <th style={{ padding: '0.65rem 0.85rem' }}>{t('stock_movements.col_timestamp') || 'Datum a čas'}</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>{t('stock_movements.col_type') || 'Typ pohybu'}</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>{t('stock_movements.col_product') || 'Položka'}</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>{t('stock_movements.col_delta') || 'Změna'}</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>{t('stock_movements.col_cost') || 'Nákupní cena'}</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>{t('stock_movements.col_doc') || 'Doklad'}</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>{t('stock_movements.col_supplier') || 'Dodavatel / Poznámka'}</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((mov) => {
                  const badge = getMovementBadge(mov.movement_type);
                  const isPositive = mov.quantity_delta > 0;
                  const deltaStr = isPositive ? `+${mov.quantity_delta}` : `${mov.quantity_delta}`;

                  return (
                    <tr key={mov.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      {/* Timestamp */}
                      <td style={{ padding: '0.6rem 0.85rem', whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                        {formatDate(mov.timestamp)}
                      </td>

                      {/* Movement Type Badge */}
                      <td style={{ padding: '0.6rem 0.85rem' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            padding: '0.2rem 0.55rem',
                            borderRadius: 'var(--radius-sm)',
                            background: badge.bg,
                            color: badge.color,
                            border: badge.border,
                            fontSize: '0.76rem',
                            fontWeight: '800'
                          }}
                        >
                          {badge.icon}
                          {badge.label}
                        </span>
                      </td>

                      {/* Preset Name */}
                      <td style={{ padding: '0.6rem 0.85rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                        {mov.preset_name || presetLookup[mov.preset_id]?.name || mov.preset_id}
                      </td>

                      {/* Quantity Delta */}
                      <td
                        style={{
                          padding: '0.6rem 0.85rem',
                          textAlign: 'right',
                          fontWeight: '800',
                          fontSize: '0.92rem',
                          color: isPositive ? 'var(--accent-emerald)' : 'var(--accent-rose)'
                        }}
                      >
                        {deltaStr} ks
                      </td>

                      {/* Unit Cost */}
                      <td style={{ padding: '0.6rem 0.85rem', textAlign: 'right', color: 'var(--text-secondary)' }}>
                        {mov.unit_cost > 0 ? `${mov.unit_cost.toFixed(2)} Kč` : '—'}
                      </td>

                      {/* Document Ref */}
                      <td style={{ padding: '0.6rem 0.85rem', color: 'var(--text-primary)', fontWeight: '600' }}>
                        {mov.document_ref || '—'}
                      </td>

                      {/* Supplier / Note */}
                      <td style={{ padding: '0.6rem 0.85rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                        {mov.supplier_name ? (
                          <span>
                            <strong>{mov.supplier_name}</strong>
                            {mov.supplier_ico && <span style={{ opacity: 0.75 }}> (IČO: {mov.supplier_ico})</span>}
                            {mov.note && <span style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-muted)' }}>{mov.note}</span>}
                          </span>
                        ) : (
                          mov.note || '—'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '0.75rem 1.25rem',
            borderTop: '1px solid var(--border-color)',
            background: 'var(--bg-input)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end'
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              height: '42px',
              padding: '0 1.3rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              fontSize: '0.88rem',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            {t('stock_movements.close') || 'Zavřít'}
          </button>
        </div>
      </div>
    </div>
  );
}
