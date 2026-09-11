import React, { useState, useMemo } from 'react';
import { PackagePlus, Search, Plus, Trash2, X, Check, AlertCircle, Building2, FileText, Loader2 } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext';
import { lookupAres, submitStockIntake } from '../../api/posApi';
import BarcodeLabelModal from './BarcodeLabelModal';
import SupplierPriceHistoryModal from './SupplierPriceHistoryModal';

export default function StockIntakeModal({
  isOpen,
  onClose,
  presets = [],
  onIntakeCompleted,
  storeConfig = {}
}) {
  const { t } = useTranslation();

  // Supplier state
  const [supplierIco, setSupplierIco] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierDic, setSupplierDic] = useState('');
  const [supplierAddress, setSupplierAddress] = useState('');
  const [documentRef, setDocumentRef] = useState('');
  const [note, setNote] = useState('');

  // ARES state
  const [isSearchingAres, setIsSearchingAres] = useState(false);
  const [aresStatus, setAresStatus] = useState(null); // { type: 'success'|'error', text: '' }

  // Items rows state: [{ id, preset_id, quantity, cost_price, new_selling_price }]
  const [items, setItems] = useState([
    { id: 'row-1', preset_id: '', quantity: 1, cost_price: 0, new_selling_price: '' }
  ]);

  // Submission & Post-Intake state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [intakeSuccessData, setIntakeSuccessData] = useState(null);
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  const [historyModalPreset, setHistoryModalPreset] = useState(null);

  // Available individual presets for selection
  const selectablePresets = useMemo(() => {
    return presets.filter(p => !p.isGeneralPreset && !p.is_general);
  }, [presets]);

  const presetLookup = useMemo(() => {
    const map = {};
    presets.forEach(p => { map[p.id] = p; });
    return map;
  }, [presets]);

  if (!isOpen) return null;

  const handleLookupAres = async () => {
    const cleanIco = supplierIco.trim();
    if (!cleanIco || cleanIco.length !== 8 || !/^\d+$/.test(cleanIco)) {
      setAresStatus({
        type: 'error',
        text: 'Zadejte platné 8místné IČO složené pouze z číslic.'
      });
      return;
    }

    setIsSearchingAres(true);
    setAresStatus(null);

    try {
      const data = await lookupAres(cleanIco);
      setSupplierName(data.name || '');
      setSupplierDic(data.dic || '');
      setSupplierAddress(data.formattedAddress || '');
      setAresStatus({
        type: 'success',
        text: t('stock_intake.ares_success') || 'Subjekt ověřen v registru ARES'
      });
    } catch (err) {
      setAresStatus({
        type: 'error',
        text: err.message || 'IČO nebylo v registru ARES nalezeno.'
      });
    } finally {
      setIsSearchingAres(false);
    }
  };

  const handleAddItemRow = () => {
    const newId = `row-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    setItems(prev => [
      ...prev,
      { id: newId, preset_id: '', quantity: 1, cost_price: 0, new_selling_price: '' }
    ]);
  };

  const handleRemoveItemRow = (rowId) => {
    if (items.length <= 1) {
      setItems([{ id: `row-${Date.now()}`, preset_id: '', quantity: 1, cost_price: 0, new_selling_price: '' }]);
      return;
    }
    setItems(prev => prev.filter(r => r.id !== rowId));
  };

  const handleRowChange = (rowId, field, value) => {
    setItems(prev => prev.map(row => {
      if (row.id !== rowId) return row;

      const updated = { ...row, [field]: value };
      // When product is selected, auto-fill default cost price if available
      if (field === 'preset_id') {
        const selected = presetLookup[value];
        if (selected) {
          const defaultCost = selected.costPrice !== undefined ? selected.costPrice : (selected.cost_price || 0);
          if (defaultCost > 0) {
            updated.cost_price = defaultCost;
          }
        }
      }
      return updated;
    }));
  };

  // Summary calculations
  const totalItemsCount = items.filter(i => i.preset_id && parseFloat(i.quantity) > 0).length;
  const totalPurchaseValue = items.reduce((sum, item) => {
    const qty = parseFloat(item.quantity) || 0;
    const cost = parseFloat(item.cost_price) || 0;
    return sum + (qty * cost);
  }, 0);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setSubmitError(null);

    // Validate rows
    const validItems = items.filter(i => i.preset_id);
    if (validItems.length === 0) {
      setSubmitError('Vyberte prosím alespoň jeden produkt do příjemky.');
      return;
    }

    for (const item of validItems) {
      const q = parseFloat(item.quantity);
      const c = parseFloat(item.cost_price);
      if (isNaN(q) || q <= 0) {
        setSubmitError(t('stock_intake.validation_error') || 'Zadejte kladné množství pro všechny položky.');
        return;
      }
      if (isNaN(c) || c < 0) {
        setSubmitError(t('stock_intake.validation_error') || 'Zadejte platnou nákupní cenu bez DPH.');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const payload = {
        supplier_ico: supplierIco.trim() || null,
        supplier_name: supplierName.trim() || null,
        document_ref: documentRef.trim() || null,
        note: note.trim() || null,
        items: validItems.map(i => ({
          preset_id: i.preset_id,
          quantity: parseFloat(i.quantity),
          cost_price: parseFloat(i.cost_price),
          new_selling_price: i.new_selling_price ? parseFloat(i.new_selling_price) : null
        }))
      };

      await submitStockIntake(payload);
      if (onIntakeCompleted) {
        await onIntakeCompleted(validItems.length);
      }
      const intakePresets = validItems.map(i => presetLookup[i.preset_id]).filter(Boolean);
      setIntakeSuccessData({
        count: validItems.length,
        presets: intakePresets
      });
    } catch (err) {
      console.error('Stock intake failed:', err);
      setSubmitError(err.message || 'Chyba při naskladnění příjemky.');
    } finally {
      setIsSubmitting(false);
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
          maxWidth: '850px',
          maxHeight: '90dvh',
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
                background: 'rgba(59, 130, 246, 0.15)',
                color: 'var(--accent-blue)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <PackagePlus size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                {t('stock_intake.title') || 'Příjemka zboží (Příjem na sklad)'}
              </h3>
              <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                § 7b ZDP • Evidence naskladnění zásob a aktualizace nákupních cen
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

        {/* Scrollable Content Body */}
        <div style={{ overflowY: 'auto', padding: '1.15rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Supplier Section Card */}
          <div
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '0.9rem 1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-primary)' }}>
              <Building2 size={16} style={{ color: 'var(--accent-blue)' }} />
              <span>{t('stock_intake.supplier_section') || 'Dodavatel & Doklad'}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
              {/* IČO Input with ARES Button */}
              <div style={{ minWidth: 0 }}>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                  {t('stock_intake.ico_label') || 'IČO Dodavatele:'}
                </label>
                <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                  <input
                    type="text"
                    maxLength={8}
                    placeholder={t('stock_intake.ico_placeholder') || 'Zadejte 8místné IČO...'}
                    value={supplierIco}
                    onChange={e => setSupplierIco(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={e => { if (e.key === 'Enter') handleLookupAres(); }}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      height: '42px',
                      padding: '0 0.75rem',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-primary)',
                      fontSize: '0.88rem',
                      fontWeight: '700',
                      letterSpacing: '0.5px',
                      boxSizing: 'border-box'
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleLookupAres}
                    disabled={isSearchingAres || supplierIco.trim().length !== 8}
                    style={{
                      flexShrink: 0,
                      height: '42px',
                      padding: '0 0.85rem',
                      borderRadius: 'var(--radius-sm)',
                      border: 'none',
                      background: 'var(--accent-blue)',
                      color: '#fff',
                      fontSize: '0.82rem',
                      fontWeight: '800',
                      cursor: supplierIco.trim().length === 8 ? 'pointer' : 'not-allowed',
                      opacity: supplierIco.trim().length === 8 ? 1 : 0.6,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.35rem',
                      whiteSpace: 'nowrap',
                      boxSizing: 'border-box'
                    }}
                    title="Ověřit a načíst firmu ze státního registru ARES"
                  >
                    {isSearchingAres ? <Loader2 size={16} className="spin-animate" /> : <Search size={15} />}
                    <span>{t('stock_intake.ares_btn') || 'ARES'}</span>
                  </button>
                </div>
              </div>

              {/* Supplier Name */}
              <div style={{ minWidth: 0 }}>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                  {t('stock_intake.supplier_name_label') || 'Název dodavatele:'}
                </label>
                <input
                  type="text"
                  placeholder={t('stock_intake.supplier_name_placeholder') || 'Název firmy nebo živnostníka'}
                  value={supplierName}
                  onChange={e => setSupplierName(e.target.value)}
                  style={{
                    width: '100%',
                    height: '42px',
                    padding: '0 0.75rem',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontSize: '0.88rem',
                    fontWeight: '600',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Invoice / Document Reference */}
              <div style={{ minWidth: 0 }}>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                  {t('stock_intake.document_ref_label') || 'Číslo dokladu / Faktury:'}
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder={t('stock_intake.document_ref_placeholder') || 'např. FP-2026-0042'}
                    value={documentRef}
                    onChange={e => setDocumentRef(e.target.value)}
                    style={{
                      width: '100%',
                      height: '42px',
                      padding: '0 0.75rem',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-primary)',
                      fontSize: '0.88rem',
                      fontWeight: '600',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* Optional Note */}
              <div style={{ minWidth: 0 }}>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                  {t('stock_intake.note_label') || 'Poznámka:'}
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder={t('stock_intake.note_placeholder') || 'např. Pravidelný závoz'}
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    style={{
                      width: '100%',
                      height: '42px',
                      padding: '0 0.75rem',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-primary)',
                      fontSize: '0.88rem',
                      fontWeight: '600',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>
            </div>

            {/* ARES Feedback Banner */}
            {aresStatus && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.55rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  background: aresStatus.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                  color: aresStatus.type === 'success' ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                  border: `1px solid ${aresStatus.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                }}
              >
                {aresStatus.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
                <span style={{ flex: 1 }}>{aresStatus.text}</span>
                {aresStatus.type === 'success' && supplierAddress && (
                  <span style={{ fontSize: '0.74rem', opacity: 0.85, fontWeight: '600' }}>
                    ({supplierAddress}{supplierDic ? `, DIČ: ${supplierDic}` : ''})
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Items Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.88rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                <FileText size={16} style={{ color: 'var(--accent-emerald)' }} />
                <span>{t('stock_intake.items_section') || 'Položky na příjemce'}</span>
              </div>
              <button
                type="button"
                onClick={handleAddItemRow}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  height: '38px',
                  padding: '0 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--accent-blue)',
                  background: 'rgba(59, 130, 246, 0.1)',
                  color: 'var(--accent-blue)',
                  fontSize: '0.82rem',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                <Plus size={16} />
                <span>{t('stock_intake.add_item_btn') || '+ Přidat položku do příjemky'}</span>
              </button>
            </div>

            {/* Items Table Container */}
            <div
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden'
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    <th style={{ padding: '0.65rem 0.85rem' }}>{t('stock_intake.col_product') || 'Produkt / Položka'}</th>
                    <th style={{ padding: '0.65rem 0.85rem', width: '110px' }}>{t('stock_intake.col_quantity') || 'Množství'}</th>
                    <th style={{ padding: '0.65rem 0.85rem', width: '140px' }}>{t('stock_intake.col_cost') || 'Nákupní cena bez DPH'}</th>
                    <th style={{ padding: '0.65rem 0.85rem', width: '120px', textAlign: 'right' }}>{t('stock_intake.col_total') || 'Celkem bez DPH'}</th>
                    <th style={{ padding: '0.65rem 0.85rem', width: '150px' }}>{t('stock_intake.col_new_selling_price') || 'Nová prodejní cena'}</th>
                    <th style={{ padding: '0.65rem 0.5rem', width: '48px', textAlign: 'center' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => {
                    const lineTotal = (parseFloat(row.quantity) || 0) * (parseFloat(row.cost_price) || 0);
                    const selectedPreset = presetLookup[row.preset_id];
                    const cost = parseFloat(row.cost_price) || 0;
                    const k = selectedPreset?.marginCoefficient || selectedPreset?.margin_coefficient || storeConfig?.defaultMarginCoefficient || 1.30;
                    const vat = selectedPreset?.vat !== undefined ? selectedPreset.vat : 21;
                    const recPrice = Math.round(cost * k * (1 + vat / 100));
                    const currentSellingPrice = selectedPreset ? Number(selectedPreset.price || 0) : 0;
                    const minCostWithVat = cost * (1 + vat / 100);
                    const isLowMargin = Boolean(selectedPreset && cost > 0 && (currentSellingPrice < recPrice || currentSellingPrice <= minCostWithVat));

                    return (
                      <React.Fragment key={row.id}>
                        <tr style={{ borderBottom: isLowMargin ? 'none' : '1px solid var(--border-color)' }}>
                          {/* Product Picker & History Button */}
                          <td style={{ padding: '0.5rem 0.85rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <select
                                value={row.preset_id}
                                onChange={e => handleRowChange(row.id, 'preset_id', e.target.value)}
                                style={{
                                  flex: 1,
                                  minWidth: 0,
                                  height: '40px',
                                  padding: '0 0.65rem',
                                  background: 'var(--bg-card)',
                                  border: '1px solid var(--border-color)',
                                  borderRadius: 'var(--radius-sm)',
                                  color: 'var(--text-primary)',
                                  fontSize: '0.86rem',
                                  fontWeight: '600'
                                }}
                              >
                                <option value="">-- {t('stock_intake.select_product') || 'Vyberte produkt ze skladu...'} --</option>
                                {selectablePresets.map(p => (
                                  <option key={p.id} value={p.id}>
                                    {p.name} {p.barcode ? `(${p.barcode})` : ''} — sklad: {p.stockQuantity !== undefined ? p.stockQuantity : (p.stock_quantity || 0)} {p.unit || 'ks'}
                                  </option>
                                ))}
                              </select>

                              {selectedPreset && (
                                <button
                                  type="button"
                                  data-testid={`history-btn-${row.id}`}
                                  onClick={() => setHistoryModalPreset(selectedPreset)}
                                  style={{
                                    flexShrink: 0,
                                    height: '40px',
                                    padding: '0 0.65rem',
                                    borderRadius: 'var(--radius-sm)',
                                    border: '1px solid rgba(59, 130, 246, 0.3)',
                                    background: 'rgba(59, 130, 246, 0.1)',
                                    color: 'var(--accent-blue)',
                                    fontSize: '0.78rem',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                    whiteSpace: 'nowrap'
                                  }}
                                  title={t('stock_intake.history_tooltip') || 'Historie nákupních cen od dodavatelů'}
                                >
                                  <span>📈</span>
                                  <span>{t('stock_intake.history_btn') || 'Historie'}</span>
                                </button>
                              )}
                            </div>
                          </td>

                          {/* Quantity Input */}
                          <td style={{ padding: '0.5rem 0.85rem' }}>
                            <input
                              type="number"
                              step="any"
                              min="0.001"
                              value={row.quantity}
                              onChange={e => handleRowChange(row.id, 'quantity', e.target.value)}
                              style={{
                                width: '100%',
                                height: '40px',
                                padding: '0 0.65rem',
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-sm)',
                                color: 'var(--text-primary)',
                                fontSize: '0.9rem',
                                fontWeight: '700',
                                textAlign: 'right'
                              }}
                            />
                          </td>

                          {/* Cost Price Input */}
                          <td style={{ padding: '0.5rem 0.85rem' }}>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={row.cost_price}
                                onChange={e => handleRowChange(row.id, 'cost_price', e.target.value)}
                                style={{
                                  width: '100%',
                                  height: '40px',
                                  padding: '0 1.8rem 0 0.65rem',
                                  background: 'var(--bg-card)',
                                  border: '1px solid var(--border-color)',
                                  borderRadius: 'var(--radius-sm)',
                                  color: 'var(--text-primary)',
                                  fontSize: '0.9rem',
                                  fontWeight: '700',
                                  textAlign: 'right'
                                }}
                              />
                              <span style={{ position: 'absolute', right: '0.65rem', fontSize: '0.78rem', color: 'var(--text-muted)', pointerEvents: 'none' }}>
                                Kč
                              </span>
                            </div>
                          </td>

                          {/* Line Total */}
                          <td style={{ padding: '0.5rem 0.85rem', textAlign: 'right', fontWeight: '800', color: 'var(--text-primary)' }}>
                            {Math.round(lineTotal).toLocaleString('cs-CZ')} Kč
                          </td>

                          {/* Custom New Selling Price Input */}
                          <td style={{ padding: '0.5rem 0.85rem' }}>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                data-testid={`new-selling-price-input-${row.id}`}
                                placeholder={selectedPreset ? `${selectedPreset.price} Kč` : '—'}
                                value={row.new_selling_price !== undefined && row.new_selling_price !== null ? row.new_selling_price : ''}
                                onChange={e => handleRowChange(row.id, 'new_selling_price', e.target.value)}
                                style={{
                                  width: '100%',
                                  height: '40px',
                                  padding: '0 1.8rem 0 0.65rem',
                                  background: 'var(--bg-card)',
                                  border: row.new_selling_price ? '1px solid var(--accent-emerald)' : '1px solid var(--border-color)',
                                  borderRadius: 'var(--radius-sm)',
                                  color: row.new_selling_price ? 'var(--accent-emerald)' : 'var(--text-primary)',
                                  fontSize: '0.88rem',
                                  fontWeight: '700',
                                  textAlign: 'right'
                                }}
                                title={selectedPreset ? `Aktuální cena: ${selectedPreset.price} Kč s DPH` : ''}
                              />
                              <span style={{ position: 'absolute', right: '0.55rem', fontSize: '0.72rem', color: 'var(--text-muted)', pointerEvents: 'none' }}>
                                s DPH
                              </span>
                            </div>
                          </td>

                          {/* Delete Row Action */}
                          <td style={{ padding: '0.5rem 0.5rem', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleRemoveItemRow(row.id)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                padding: '0.35rem',
                                borderRadius: 'var(--radius-sm)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                minWidth: '36px',
                                minHeight: '36px'
                              }}
                              title="Odebrat položku z příjemky"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>

                        {/* Margin Alert Badge */}
                        {isLowMargin && (
                          <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(245, 158, 11, 0.05)' }}>
                            <td colSpan={6} style={{ padding: '0.35rem 0.85rem 0.65rem 0.85rem' }}>
                              <div
                                data-testid="margin-warning-badge"
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  flexWrap: 'wrap',
                                  gap: '0.5rem',
                                  padding: '0.45rem 0.75rem',
                                  borderRadius: 'var(--radius-sm)',
                                  background: 'rgba(245, 158, 11, 0.15)',
                                  border: '1px solid rgba(245, 158, 11, 0.35)',
                                  color: 'var(--accent-amber)',
                                  fontSize: '0.8rem',
                                  fontWeight: '700'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                  <span>⚠️</span>
                                  <span>
                                    Nízká marže: Nákup {cost.toFixed(2)} Kč × koef. {k} = doporučeno {recPrice} Kč s DPH (aktuální: {currentSellingPrice.toFixed(2)} Kč)
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  data-testid="set-rec-price-btn"
                                  onClick={() => handleRowChange(row.id, 'new_selling_price', recPrice)}
                                  style={{
                                    height: '30px',
                                    padding: '0 0.75rem',
                                    borderRadius: 'var(--radius-sm)',
                                    border: '1px solid var(--accent-amber)',
                                    background: 'var(--accent-amber)',
                                    color: '#000000',
                                    fontSize: '0.78rem',
                                    fontWeight: '800',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  <span>{t('stock_intake.set_recommended_price') || 'Nastavit doporučenou cenu'}</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Submission Error Alert */}
          {submitError && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(239, 68, 68, 0.15)',
                color: 'var(--accent-rose)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                fontSize: '0.86rem',
                fontWeight: '700'
              }}
            >
              <AlertCircle size={18} />
              <span>{submitError}</span>
            </div>
          )}
        </div>

        {/* Footer Summary & Action Dock */}
        {intakeSuccessData ? (
          <div
            style={{
              padding: '1.5rem 1.25rem',
              borderTop: '1px solid var(--border-color)',
              background: 'var(--bg-input)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: '1rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-emerald)', fontWeight: '800', fontSize: '1.05rem' }}>
              <Check size={22} />
              <span>{t('stock_intake.intake_completed_title') || 'Příjemka byla úspěšně naskladněna!'}</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-muted)' }}>
              Naskladněno {intakeSuccessData.count} položek do skladové evidence (§ 7b ZDP).
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button
                type="button"
                data-testid="print-intake-shelf-labels-btn"
                onClick={() => setIsLabelModalOpen(true)}
                style={{
                  height: '44px',
                  padding: '0 1.25rem',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  background: 'var(--accent-blue)',
                  color: '#ffffff',
                  fontSize: '0.9rem',
                  fontWeight: '800',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)'
                }}
              >
                <span>🏷️</span>
                <span>{t('stock_intake.print_shelf_tags_btn') || 'Vytisknout cenovky pro naskladněné zboží'}</span>
              </button>
              <button
                type="button"
                data-testid="close-intake-success-btn"
                onClick={() => {
                  setIntakeSuccessData(null);
                  onClose();
                }}
                style={{
                  height: '44px',
                  padding: '0 1.25rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  fontSize: '0.88rem',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                {t('common.close') || 'Zavřít'}
              </button>
            </div>
          </div>
        ) : (
          <div
            style={{
              padding: '0.9rem 1.25rem',
              borderTop: '1px solid var(--border-color)',
              background: 'var(--bg-input)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem'
            }}
          >
            {/* Summary values */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
              <div>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'block' }}>
                  {t('stock_intake.summary_items_count') || 'Položek celkem:'}
                </span>
                <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>
                  {totalItemsCount}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'block' }}>
                  {t('stock_intake.summary_total_value') || 'Celková nákupní hodnota:'}
                </span>
                <strong style={{ fontSize: '1.15rem', color: 'var(--accent-emerald)' }}>
                  {Math.round(totalPurchaseValue).toLocaleString('cs-CZ')} Kč <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>bez DPH</span>
                </strong>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                style={{
                  height: '44px',
                  padding: '0 1.2rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  fontSize: '0.88rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  minWidth: '90px'
                }}
              >
                {t('stock_intake.cancel') || 'Zrušit'}
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || totalItemsCount === 0}
                style={{
                  height: '44px',
                  padding: '0 1.4rem',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  background: 'var(--accent-emerald)',
                  color: '#fff',
                  fontSize: '0.92rem',
                  fontWeight: '800',
                  cursor: totalItemsCount > 0 && !isSubmitting ? 'pointer' : 'not-allowed',
                  opacity: totalItemsCount > 0 && !isSubmitting ? 1 : 0.6,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  boxShadow: '0 2px 4px rgba(16, 185, 129, 0.25)'
                }}
              >
                {isSubmitting ? <Loader2 size={18} className="spin-animate" /> : <Check size={18} />}
                <span>{isSubmitting ? (t('stock_intake.saving') || 'Ukládám...') : (t('stock_intake.save_and_intake') || 'Uložit a naskladnit')}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Barcode / Shelf Label Modal for Intake Items */}
      <BarcodeLabelModal
        isOpen={isLabelModalOpen}
        onClose={() => {
          setIsLabelModalOpen(false);
          setIntakeSuccessData(null);
          onClose();
        }}
        presets={intakeSuccessData?.presets || []}
        storeConfig={storeConfig}
      />

      {/* Supplier Price History Modal */}
      <SupplierPriceHistoryModal
        isOpen={!!historyModalPreset}
        onClose={() => setHistoryModalPreset(null)}
        preset={historyModalPreset}
      />
    </div>
  );
}
