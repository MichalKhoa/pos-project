import React, { useState, useMemo } from 'react';
import { Trash2, Plus, X, AlertCircle, Printer, ShieldAlert, CheckCircle2, Loader2 } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext';
import { submitStockWriteOff, printWriteOffProtocol } from '../../api/posApi';

export default function StockWriteOffModal({
  isOpen,
  onClose,
  presets = [],
  categories = [],
  onWriteOffCompleted,
  storeConfig = {},
  initialPresetId = null
}) {
  const { t } = useTranslation();

  const [reason, setReason] = useState('EXSPIRACE');
  const [responsiblePerson, setResponsiblePerson] = useState('');
  const [note, setNote] = useState('');

  // Rows: [{ id, preset_id, quantity, is_norm_loss }]
  const [items, setItems] = useState([
    {
      id: 'row-1',
      preset_id: initialPresetId || '',
      quantity: 1,
      is_norm_loss: null
    }
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [successProtocol, setSuccessProtocol] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printStatus, setPrintStatus] = useState(null);

  const categoryNormMap = useMemo(() => {
    const map = {};
    categories.forEach(c => {
      map[c.id] = c.naturalLossNorm !== undefined ? c.naturalLossNorm : (c.natural_loss_norm || 0);
    });
    return map;
  }, [categories]);

  const selectablePresets = useMemo(() => {
    return presets.filter(p => !p.isGeneralPreset && !p.is_general);
  }, [presets]);

  const presetLookup = useMemo(() => {
    const map = {};
    presets.forEach(p => { map[p.id] = p; });
    return map;
  }, [presets]);

  if (!isOpen) return null;

  const handleAddItemRow = () => {
    const newId = `row-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    setItems(prev => [
      ...prev,
      { id: newId, preset_id: '', quantity: 1, is_norm_loss: null }
    ]);
  };

  const handleRemoveItemRow = (rowId) => {
    if (items.length <= 1) {
      setItems([{ id: `row-${Date.now()}`, preset_id: '', quantity: 1, is_norm_loss: null }]);
      return;
    }
    setItems(prev => prev.filter(r => r.id !== rowId));
  };

  const handleRowChange = (rowId, field, value) => {
    setItems(prev => prev.map(row => {
      if (row.id !== rowId) return row;
      return { ...row, [field]: value };
    }));
  };

  // Evaluate line item norm & deductibility
  const rowsEvaluated = items.map(row => {
    const p = presetLookup[row.preset_id];
    const qty = parseFloat(row.quantity) || 0;
    const cost = p ? (p.costPrice !== undefined ? p.costPrice : (p.cost_price || 0)) : 0;
    const price = p ? (p.price || 0) : 0;
    const lineCost = Math.round(qty * cost * 100) / 100;
    const lineRetail = Math.round(qty * price * 100) / 100;

    let isNorm = false;
    if (reason === 'KRADEZ') {
      isNorm = false;
    } else if (row.is_norm_loss !== null && row.is_norm_loss !== undefined) {
      isNorm = !!row.is_norm_loss;
    } else if (p) {
      const catNorm = categoryNormMap[p.category] || 0;
      isNorm = catNorm > 0 && (reason === 'EXSPIRACE' || reason === 'ZKAZA');
    }

    return {
      ...row,
      preset: p,
      cost,
      price,
      lineCost,
      lineRetail,
      isNorm
    };
  });

  const totalCostSum = rowsEvaluated.reduce((sum, r) => sum + r.lineCost, 0);
  const totalRetailSum = rowsEvaluated.reduce((sum, r) => sum + r.lineRetail, 0);
  const isAllWithinNorm = reason !== 'KRADEZ' && rowsEvaluated.length > 0 && rowsEvaluated.every(r => r.isNorm);
  const _isVatAdjustmentRequired = !isAllWithinNorm;

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setSubmitError(null);

    const validRows = rowsEvaluated.filter(r => r.preset_id);
    if (validRows.length === 0) {
      setSubmitError(t('stock_write_off.validation_select_item') || 'Vyberte prosím produkt pro všechny řádky.');
      return;
    }

    for (const row of validRows) {
      if (isNaN(row.quantity) || row.quantity <= 0) {
        setSubmitError(t('stock_write_off.validation_positive_qty') || 'Zadejte kladné množství k odpisu.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload = {
        reason,
        responsible_person: responsiblePerson.trim() || null,
        note: note.trim() || null,
        items: validRows.map(r => ({
          preset_id: r.preset_id,
          quantity: parseFloat(r.quantity),
          is_norm_loss: r.is_norm_loss !== null ? r.is_norm_loss : undefined
        }))
      };

      const result = await submitStockWriteOff(payload);
      setSuccessProtocol(result);

      if (onWriteOffCompleted) {
        await onWriteOffCompleted(result);
      }
    } catch (err) {
      console.error('Stock write-off failed:', err);
      setSubmitError(err.message || 'Chyba při zápisu skladového odpisu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintSlip = async () => {
    if (!successProtocol) return;
    setIsPrinting(true);
    setPrintStatus(null);
    try {
      const res = await printWriteOffProtocol(successProtocol, storeConfig);
      setPrintStatus({
        type: 'success',
        text: res.physical ? 'Protokol byl vytištěn na termotiskárně.' : 'Tisk byl simulován (tiskárna offline).'
      });
    } catch (err) {
      console.error('Failed to print protocol:', err);
      setPrintStatus({
        type: 'error',
        text: err.message || 'Chyba při tisku protokolu.'
      });
    } finally {
      setIsPrinting(false);
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
      onClick={e => { if (e.target === e.currentTarget && !isSubmitting) onClose(); }}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          width: '100%',
          maxWidth: '860px',
          maxHeight: '90dvh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
          overflow: 'hidden'
        }}
      >
        {/* Modal Header */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(239, 68, 68, 0.15)',
                color: 'var(--accent-rose)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Trash2 size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                {t('stock_write_off.title') || 'Skladový Odpis a Likvidační Protokol'}
              </h3>
              <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                {t('stock_write_off.subtitle') || 'Formální vyřazení zásob (§ 25 ZoÚ) a posouzení DPH'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
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

        {/* Modal Body */}
        <div style={{ padding: '1.25rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {successProtocol ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', padding: '1rem 0' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: 'var(--accent-emerald)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <CheckCircle2 size={36} />
              </div>

              <div style={{ textAlign: 'center' }}>
                <h3 style={{ margin: '0 0 0.4rem 0', fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                  {t('stock_write_off.success_title') || 'Odpis byl úspěšně zaevidován'}
                </h3>
                <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--text-secondary)' }}>
                  Protokol: <strong style={{ color: 'var(--accent-blue)', fontFamily: 'var(--font-mono)' }}>{successProtocol.protocol_number}</strong>
                </p>
                <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                  Hodnota odpisu: {successProtocol.total_cost_value.toFixed(2)} Kč bez DPH ({successProtocol.total_retail_value.toFixed(2)} Kč s DPH)
                </p>
              </div>

              {/* Deductibility Badge Banner */}
              <div
                style={{
                  width: '100%',
                  maxWidth: '520px',
                  padding: '0.85rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  background: successProtocol.is_tax_deductible ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  border: `1px solid ${successProtocol.is_tax_deductible ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem'
                }}
              >
                {successProtocol.is_tax_deductible ? (
                  <CheckCircle2 size={20} style={{ color: 'var(--accent-emerald)', flexShrink: 0, marginTop: '2px' }} />
                ) : (
                  <ShieldAlert size={20} style={{ color: 'var(--accent-rose)', flexShrink: 0, marginTop: '2px' }} />
                )}
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: '800', color: successProtocol.is_tax_deductible ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                    {successProtocol.is_tax_deductible
                      ? (t('stock_write_off.tax_deductible_title') || 'Daňově uznatelný náklad (§ 25 odst. 2 ZoÚ)')
                      : (t('stock_write_off.tax_non_deductible_title') || 'Nedaňový výdaj / Zaviněné manko')}
                  </h4>
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {successProtocol.is_tax_deductible
                      ? (t('stock_write_off.tax_deductible_desc') || 'Přirozený úbytek v rámci normy. Nevyžaduje dodanění DPH.')
                      : (t('stock_write_off.tax_non_deductible_desc') || 'Vyžaduje korekci odpočtu DPH dle § 77/78 ZDPH!')}
                  </p>
                </div>
              </div>

              {printStatus && (
                <div
                  style={{
                    padding: '0.5rem 0.85rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.84rem',
                    fontWeight: '700',
                    background: printStatus.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: printStatus.type === 'success' ? 'var(--accent-emerald)' : 'var(--accent-rose)'
                  }}
                >
                  {printStatus.text}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={handlePrintSlip}
                  disabled={isPrinting}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    height: '42px',
                    padding: '0 1.25rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--accent-blue)',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: '700',
                    fontSize: '0.88rem',
                    cursor: 'pointer'
                  }}
                >
                  {isPrinting ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
                  <span>{t('stock_write_off.print_protocol_btn') || 'Vytisknout likvidační protokol'}</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    height: '42px',
                    padding: '0 1.25rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                    fontWeight: '700',
                    fontSize: '0.88rem',
                    cursor: 'pointer'
                  }}
                >
                  {t('common.close') || 'Zavřít'}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {submitError && (
                <div
                  style={{
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid var(--accent-rose)',
                    color: 'var(--accent-rose)',
                    fontSize: '0.84rem',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <AlertCircle size={16} />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Protocol Parameters Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', background: 'var(--bg-input)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                    {t('stock_write_off.reason_label') || 'Důvod odpisu / likvidace'} *
                  </label>
                  <select
                    data-testid="write-off-reason-select"
                    aria-label={t('stock_write_off.reason_label') || 'Důvod odpisu / likvidace'}
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    style={{
                      width: '100%',
                      height: '38px',
                      padding: '0 0.65rem',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-primary)',
                      fontSize: '0.84rem',
                      fontWeight: '700'
                    }}
                  >
                    <option value="EXSPIRACE">{t('stock_write_off.reason_expiration') || 'Exspirace (Projité zboží)'}</option>
                    <option value="ZKAZA">{t('stock_write_off.reason_spoilage') || 'Zkáza / Poškození zboží'}</option>
                    <option value="ROZBITI">{t('stock_write_off.reason_breakage') || 'Rozbití při manipulaci'}</option>
                    <option value="KRADEZ">{t('stock_write_off.reason_theft') || 'Krádež / Nezjištěné manko (Vždy nedaňové)'}</option>
                    <option value="OTHER">{t('stock_write_off.reason_other') || 'Jiný důvod'}</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                    {t('stock_write_off.person_label') || 'Odpovědná osoba / Pokladní'}
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder={t('stock_write_off.person_placeholder') || 'Jméno pokladního...'}
                    value={responsiblePerson}
                    onChange={e => setResponsiblePerson(e.target.value)}
                    style={{ height: '38px', fontSize: '0.84rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                    {t('stock_write_off.note_label') || 'Doplňující poznámka'}
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder={t('stock_write_off.note_placeholder') || 'Např. Poškozeno při vykládce...'}
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    style={{ height: '38px', fontSize: '0.84rem' }}
                  />
                </div>
              </div>

              {/* Items Table */}
              <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.72rem' }}>
                      <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left' }}>{t('stock_write_off.col_product') || 'Produkt'}</th>
                      <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right', width: '90px' }}>{t('stock_write_off.col_stock') || 'Sklad'}</th>
                      <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right', width: '100px' }}>{t('stock_write_off.col_quantity') || 'Odpis mn.'}</th>
                      <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right', width: '100px' }}>{t('stock_write_off.col_unit_cost') || 'Nákup'}</th>
                      <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right', width: '110px' }}>{t('stock_write_off.col_total_cost') || 'Celkem nákup'}</th>
                      <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center', width: '110px' }}>{t('stock_write_off.col_norm') || 'Režim'}</th>
                      <th style={{ padding: '0.6rem 0.5rem', width: '40px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rowsEvaluated.map((row, idx) => {
                      const curStock = row.preset ? (row.preset.stockQuantity !== undefined ? row.preset.stockQuantity : (row.preset.stock_quantity || 0)) : 0;
                      const unit = row.preset?.unit || 'ks';

                      return (
                        <tr key={row.id} style={{ borderBottom: '1px solid var(--border-color)', background: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)' }}>
                          {/* Product Select */}
                          <td style={{ padding: '0.5rem 0.75rem' }}>
                            <select
                              value={row.preset_id}
                              onChange={e => handleRowChange(row.id, 'preset_id', e.target.value)}
                              style={{
                                width: '100%',
                                height: '36px',
                                padding: '0 0.5rem',
                                background: 'var(--bg-input)',
                                border: '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-sm)',
                                color: 'var(--text-primary)',
                                fontSize: '0.82rem',
                                fontWeight: '600'
                              }}
                            >
                              <option value="">-- Vyberte produkt --</option>
                              {selectablePresets.map(p => (
                                <option key={p.id} value={p.id}>
                                  {p.name} {p.barcode ? `(${p.barcode})` : ''}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Current Stock */}
                          <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700', color: curStock <= 0 ? 'var(--accent-rose)' : 'var(--text-secondary)' }}>
                            {curStock} {unit}
                          </td>

                          {/* Write-off Quantity Input */}
                          <td style={{ padding: '0.5rem' }}>
                            <input
                              type="number"
                              step="any"
                              min="0.001"
                              className="input-field"
                              value={row.quantity}
                              onChange={e => handleRowChange(row.id, 'quantity', e.target.value)}
                              style={{ height: '36px', textAlign: 'right', fontWeight: '700', fontSize: '0.85rem' }}
                            />
                          </td>

                          {/* Purchase Cost (VAP) */}
                          <td style={{ padding: '0.5rem', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: '600' }}>
                            {row.cost > 0 ? `${row.cost.toFixed(2)} Kč` : '0.00 Kč'}
                          </td>

                          {/* Total Cost */}
                          <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '800', color: 'var(--accent-rose)' }}>
                            {row.lineCost > 0 ? `${row.lineCost.toFixed(2)} Kč` : '0.00 Kč'}
                          </td>

                          {/* Norm Badge */}
                          <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '0.15rem 0.45rem',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: '0.7rem',
                                fontWeight: '800',
                                background: row.isNorm ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                                color: row.isNorm ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                                border: `1px solid ${row.isNorm ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                              }}
                            >
                              {row.isNorm ? (t('stock_write_off.norm_within') || 'V normě') : (t('stock_write_off.norm_above') || 'Nad normu')}
                            </span>
                          </td>

                          {/* Delete row */}
                          <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleRemoveItemRow(row.id)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                padding: '0.3rem',
                                borderRadius: 'var(--radius-sm)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Add Row Button */}
              <div>
                <button
                  type="button"
                  onClick={handleAddItemRow}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    height: '34px',
                    padding: '0 0.85rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px dashed var(--border-color)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    fontSize: '0.8rem',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  <Plus size={14} />
                  <span>{t('stock_write_off.add_row') || 'Přidat další položku'}</span>
                </button>
              </div>

              {/* Tax & Financial Summary Footer */}
              <div
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.85rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '1rem'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {t('stock_write_off.summary_items_count') || 'Položek k likvidaci:'} <strong>{rowsEvaluated.filter(r => r.preset_id).length}</strong>
                  </div>
                  <div style={{ fontSize: '0.88rem', fontWeight: '800', color: 'var(--text-primary)', marginTop: '0.15rem' }}>
                    {t('stock_write_off.summary_cost_total') || 'Nákup celkem:'} <span style={{ color: 'var(--accent-rose)' }}>{totalCostSum.toFixed(2)} Kč</span>
                    <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                      (prodej: {totalRetailSum.toFixed(2)} Kč s DPH)
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.45rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    background: isAllWithinNorm ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    border: `1px solid ${isAllWithinNorm ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                  }}
                >
                  {isAllWithinNorm ? (
                    <CheckCircle2 size={16} style={{ color: 'var(--accent-emerald)' }} />
                  ) : (
                    <ShieldAlert size={16} style={{ color: 'var(--accent-rose)' }} />
                  )}
                  <span style={{ fontSize: '0.78rem', fontWeight: '700', color: isAllWithinNorm ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                    {isAllWithinNorm
                      ? 'Režim: Daňově uznatelný (§ 25)'
                      : 'Režim: Nedaňové manko (nutná korekce DPH)'}
                  </span>
                </div>
              </div>

              {/* Submit & Cancel Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  style={{
                    height: '42px',
                    padding: '0 1.25rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                    fontWeight: '700',
                    fontSize: '0.88rem',
                    cursor: 'pointer'
                  }}
                >
                  {t('common.cancel') || 'Zrušit'}
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    height: '42px',
                    padding: '0 1.5rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--accent-rose)',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: '800',
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem'
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>{t('stock_write_off.submitting') || 'Zapisuji odpis...'}</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      <span>{t('stock_write_off.submit_btn') || 'Potvrdit a provést odpis'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
