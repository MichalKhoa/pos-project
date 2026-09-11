import React, { useState, useMemo, useEffect, useRef } from 'react';
import { X, Search, Printer, CheckCircle2, AlertCircle, ShieldCheck, ClipboardCheck } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext';

export default function PhysicalInventoryModal({
  isOpen,
  onClose,
  presets = [],
  onAuditCompleted,
  storeConfig = {}
}) {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [counts, setCounts] = useState({}); // { [presetId]: countedQuantity }
  const [responsiblePerson, setResponsiblePerson] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedProtocol, setCompletedProtocol] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printStatus, setPrintStatus] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(false);
  const searchInputRef = useRef(null);

  // Focus search input when modal opens
  useEffect(() => {
    if (isOpen) {
      setCounts({});
      setCompletedProtocol(null);
      setPrintStatus(null);
      setConfirmDialog(false);
      setTimeout(() => {
        if (searchInputRef.current) searchInputRef.current.focus();
      }, 100);
    }
  }, [isOpen]);

  // Barcode / Name lookup & count increment
  const handleItemScanned = (preset) => {
    setCounts(prev => {
      const current = prev[preset.id] !== undefined ? prev[preset.id] : (preset.stockQuantity || 0);
      return { ...prev, [preset.id]: current + 1 };
    });
    setSearchTerm('');
  };

  const handleBarcodeKeyDown = (e) => {
    if (e.key === 'Enter' && searchTerm.trim()) {
      e.preventDefault();
      const term = searchTerm.trim().toLowerCase();
      const match = presets.find(p =>
        (p.barcode && p.barcode.toLowerCase() === term) ||
        p.name.toLowerCase() === term
      );
      if (match) {
        handleItemScanned(match);
      }
    }
  };

  const handleCountChange = (presetId, val) => {
    const num = parseFloat(val);
    setCounts(prev => ({
      ...prev,
      [presetId]: isNaN(num) ? 0 : Math.max(0, num)
    }));
  };

  const handleStepCount = (presetId, step) => {
    const preset = presets.find(p => p.id === presetId);
    const current = counts[presetId] !== undefined ? counts[presetId] : (preset ? preset.stockQuantity || 0 : 0);
    const next = Math.max(0, current + step);
    setCounts(prev => ({ ...prev, [presetId]: next }));
  };

  // Filter presets for search dropdown
  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.trim().toLowerCase();
    return presets.filter(p =>
      p.name.toLowerCase().includes(term) ||
      (p.barcode && p.barcode.toLowerCase().includes(term))
    ).slice(0, 6);
  }, [presets, searchTerm]);

  // Items currently included in the count sheet
  const countedItemsList = useMemo(() => {
    return Object.keys(counts).map(presetId => {
      const preset = presets.find(p => p.id === presetId);
      if (!preset) return null;
      const sysQty = preset.stockQuantity || 0;
      const physQty = counts[presetId];
      const diff = physQty - sysQty;
      const unitCost = preset.costPrice || preset.cost_price || 0;
      const diffVal = diff * unitCost;
      return {
        preset,
        presetId,
        sysQty,
        physQty,
        diff,
        unitCost,
        diffVal
      };
    }).filter(Boolean);
  }, [counts, presets]);

  // Financial totals
  const totals = useMemo(() => {
    let totalSurplus = 0;
    let totalShortage = 0;
    countedItemsList.forEach(item => {
      if (item.diff > 0) totalSurplus += item.diffVal;
      else if (item.diff < 0) totalShortage += Math.abs(item.diffVal);
    });
    return {
      surplus: totalSurplus,
      shortage: totalShortage,
      net: totalSurplus - totalShortage,
      count: countedItemsList.length
    };
  }, [countedItemsList]);

  // Submit Inventory Reconciliation
  const handleSubmitAudit = async () => {
    if (countedItemsList.length === 0) return;
    setIsSubmitting(true);
    try {
      const payload = {
        responsible_person: responsiblePerson.trim() || undefined,
        note: note.trim() || undefined,
        items: countedItemsList.map(it => ({
          preset_id: it.presetId,
          physical_quantity: it.physQty
        }))
      };

      const res = await fetch('/api/v1/inventory/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Chyba při ukládání inventury.');
      }

      const protocol = await res.json();
      setCompletedProtocol(protocol);
      setConfirmDialog(false);
      if (onAuditCompleted) onAuditCompleted(protocol);
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Print Inventory Protocol on ESC/POS thermal printer
  const handlePrintProtocol = async () => {
    if (!completedProtocol) return;
    setIsPrinting(true);
    setPrintStatus(null);
    try {
      const res = await fetch('/api/v1/printer/print-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          protocolData: completedProtocol,
          storeConfig: storeConfig || {}
        })
      });
      const data = await res.json();
      if (data.success) {
        setPrintStatus({ success: true, text: 'Protokol byl odeslán na tiskárnu.' });
      } else {
        setPrintStatus({ success: false, text: 'Tisk se nezdařil.' });
      }
    } catch (err) {
      setPrintStatus({ success: false, text: `Chyba tisku: ${err.message}` });
    } finally {
      setIsPrinting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 1050,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        maxWidth: '100vw',
        maxHeight: '100dvh'
      }}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          color: 'var(--text-primary)',
          borderRadius: 'var(--radius-lg, 12px)',
          border: '1px solid var(--border-color)',
          width: '100%',
          maxWidth: '920px',
          maxHeight: '90dvh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
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
            background: 'var(--bg-card-hover, rgba(255, 255, 255, 0.03))'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <ClipboardCheck size={22} style={{ color: 'var(--accent-blue)' }} />
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
                {t('inventory.physical_audit_title') || 'Fyzická inventura skladu (§ 29, 30 ZoÚ)'}
              </h2>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {t('inventory.physical_audit_subtitle') || 'Skenování regálů čtečkou, vyčíslení mank/přebytků a narovnání skladu'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '0.5rem',
              borderRadius: 'var(--radius-md)',
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

        {/* Content Area */}
        <div style={{ padding: '1.25rem', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {completedProtocol ? (
            /* Completed Success Screen */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '2rem 1rem', gap: '1.25rem' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-emerald)' }}>
                <CheckCircle2 size={36} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>
                  Inventura úspěšně zaúčtována!
                </h3>
                <div style={{ fontSize: '0.92rem', color: 'var(--text-secondary)' }}>
                  Protokol č. <strong style={{ color: 'var(--text-primary)' }}>{completedProtocol.protocol_number}</strong>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1.5rem', background: 'var(--bg-input)', padding: '1rem 1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Zkontrolováno položek</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{completedProtocol.total_items_counted}</div>
                </div>
                <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '1.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Přebytek (+)</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-emerald)' }}>+{completedProtocol.total_surplus_value.toFixed(2)} Kč</div>
                </div>
                <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '1.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Manko (-)</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-rose)' }}>-{completedProtocol.total_shortage_value.toFixed(2)} Kč</div>
                </div>
              </div>

              {printStatus && (
                <div style={{ fontSize: '0.85rem', color: printStatus.success ? 'var(--accent-emerald)' : 'var(--accent-rose)', fontWeight: 600 }}>
                  {printStatus.text}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={handlePrintProtocol}
                  disabled={isPrinting}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem 1.25rem',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--accent-blue)',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 700,
                    cursor: 'pointer',
                    minHeight: '44px'
                  }}
                >
                  <Printer size={18} />
                  <span>{isPrinting ? 'Tiskne se...' : 'Vytisknout inventurní protokol'}</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: '0.75rem 1.25rem',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    minHeight: '44px'
                  }}
                >
                  Zavřít
                </button>
              </div>
            </div>
          ) : (
            /* Active Audit Counting Screen */
            <>
              {/* Scan Bar & Controls Strip */}
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '260px', position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>
                    <Search size={18} />
                  </div>
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={handleBarcodeKeyDown}
                    placeholder="Pípněte čárový kód čtečkou nebo zadejte název..."
                    style={{
                      width: '100%',
                      height: '44px',
                      padding: '0 1rem 0 2.5rem',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)',
                      fontSize: '0.92rem'
                    }}
                  />
                  {/* Search Dropdown */}
                  {searchResults.length > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: '4px',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
                        zIndex: 10,
                        maxHeight: '220px',
                        overflowY: 'auto'
                      }}
                    >
                      {searchResults.map(p => (
                        <div
                          key={p.id}
                          onClick={() => handleItemScanned(p)}
                          style={{
                            padding: '0.65rem 1rem',
                            borderBottom: '1px solid var(--border-color)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            cursor: 'pointer',
                            fontSize: '0.88rem'
                          }}
                        >
                          <div>
                            <strong>{p.name}</strong>
                            {p.barcode && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>EAN: {p.barcode}</span>}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            Evidováno: {p.stockQuantity || 0} {p.unit || 'ks'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <input
                  type="text"
                  value={responsiblePerson}
                  onChange={(e) => setResponsiblePerson(e.target.value)}
                  placeholder="Odpovědná osoba (komise)"
                  style={{
                    height: '44px',
                    padding: '0 0.85rem',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontSize: '0.88rem',
                    width: '180px'
                  }}
                />

                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Poznámka (např. Řádná roční inventura)"
                  style={{
                    height: '44px',
                    padding: '0 0.85rem',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontSize: '0.88rem',
                    width: '240px'
                  }}
                />
              </div>

              {/* Count Sheet Table */}
              <div
                style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <div style={{ overflowY: 'auto', maxHeight: '360px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Položka</th>
                        <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Evidenční stav</th>
                        <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center', width: '160px' }}>Fyzicky zjištěno</th>
                        <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Rozdíl</th>
                        <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Finanční dopad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {countedItemsList.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-secondary)' }}>
                            Zatím jste nenaskenovali žádné položky. Pípněte zboží čtečkou nebo vyhledejte výše.
                          </td>
                        </tr>
                      ) : (
                        countedItemsList.map(row => (
                          <tr key={row.presetId} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '0.65rem 0.85rem' }}>
                              <div style={{ fontWeight: 700 }}>{row.preset.name}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                Nákupní cena: {row.unitCost.toFixed(2)} Kč
                              </div>
                            </td>
                            <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center', fontWeight: 600 }}>
                              {row.sysQty} {row.preset.unit || 'ks'}
                            </td>
                            <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                <button
                                  type="button"
                                  onClick={() => handleStepCount(row.presetId, -1)}
                                  style={{
                                    width: '32px',
                                    height: '32px',
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--bg-input)',
                                    color: 'var(--text-primary)',
                                    borderRadius: 'var(--radius-sm)',
                                    cursor: 'pointer',
                                    fontWeight: 800
                                  }}
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min="0"
                                  value={row.physQty}
                                  onChange={(e) => handleCountChange(row.presetId, e.target.value)}
                                  style={{
                                    width: '60px',
                                    height: '32px',
                                    textAlign: 'center',
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 'var(--radius-sm)',
                                    color: 'var(--text-primary)',
                                    fontWeight: 700
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleStepCount(row.presetId, 1)}
                                  style={{
                                    width: '32px',
                                    height: '32px',
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--bg-input)',
                                    color: 'var(--text-primary)',
                                    borderRadius: 'var(--radius-sm)',
                                    cursor: 'pointer',
                                    fontWeight: 800
                                  }}
                                >
                                  +
                                </button>
                              </div>
                            </td>
                            <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center', fontWeight: 700 }}>
                              <span style={{
                                color: row.diff > 0 ? 'var(--accent-emerald)' : (row.diff < 0 ? 'var(--accent-rose)' : 'var(--text-secondary)')
                              }}>
                                {row.diff > 0 ? `+${row.diff}` : row.diff} {row.preset.unit || 'ks'}
                              </span>
                            </td>
                            <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: 700 }}>
                              <span style={{
                                color: row.diff > 0 ? 'var(--accent-emerald)' : (row.diff < 0 ? 'var(--accent-rose)' : 'var(--text-secondary)')
                              }}>
                                {row.diffVal > 0 ? `+${row.diffVal.toFixed(2)}` : row.diffVal.toFixed(2)} Kč
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals Summary Footer Strip */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.85rem 1.25rem',
                  background: 'var(--bg-input)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  flexWrap: 'wrap',
                  gap: '1rem'
                }}
              >
                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Naskenováno:</span>{' '}
                    <strong>{totals.count} položek</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Přebytky (+):</span>{' '}
                    <strong style={{ color: 'var(--accent-emerald)' }}>+{totals.surplus.toFixed(2)} Kč</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Manka (-):</span>{' '}
                    <strong style={{ color: 'var(--accent-rose)' }}>-{totals.shortage.toFixed(2)} Kč</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Bilance:</span>{' '}
                    <strong style={{ fontSize: '1.05rem', color: totals.net >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                      {totals.net >= 0 ? `+${totals.net.toFixed(2)}` : totals.net.toFixed(2)} Kč
                    </strong>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setConfirmDialog(true)}
                  disabled={countedItemsList.length === 0 || isSubmitting}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.65rem 1.25rem',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--accent-emerald)',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 700,
                    cursor: countedItemsList.length === 0 ? 'not-allowed' : 'pointer',
                    opacity: countedItemsList.length === 0 ? 0.5 : 1,
                    minHeight: '44px'
                  }}
                >
                  <ShieldCheck size={18} />
                  <span>{isSubmitting ? 'Ukládám...' : 'Uzavřít a narovnat sklad'}</span>
                </button>
              </div>

              {/* Confirmation Dialog to Prevent Fat-Finger Errors */}
              {confirmDialog && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 20,
                    padding: '1rem'
                  }}
                >
                  <div
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-lg)',
                      padding: '1.5rem',
                      maxWidth: '460px',
                      width: '100%',
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem'
                    }}
                  >
                    <AlertCircle size={40} style={{ color: 'var(--accent-amber)', margin: '0 auto' }} />
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
                      Potvrdit zúčtování inventury?
                    </h3>
                    <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                      Tímto krokem zapíšete vyrovnávací pohyby (ADJUSTMENT) do knihy zásob pro {totals.count} položek. Stavy skladu se okamžitě aktualizují podle fyzického sčítání.
                    </p>
                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => setConfirmDialog(false)}
                        style={{
                          padding: '0.65rem 1.25rem',
                          borderRadius: 'var(--radius-md)',
                          background: 'var(--bg-input)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border-color)',
                          fontWeight: 700,
                          cursor: 'pointer',
                          minHeight: '44px'
                        }}
                      >
                        Zpět k úpravám
                      </button>
                      <button
                        type="button"
                        onClick={handleSubmitAudit}
                        disabled={isSubmitting}
                        style={{
                          padding: '0.65rem 1.25rem',
                          borderRadius: 'var(--radius-md)',
                          background: 'var(--accent-emerald)',
                          color: '#fff',
                          border: 'none',
                          fontWeight: 700,
                          cursor: 'pointer',
                          minHeight: '44px'
                        }}
                      >
                        {isSubmitting ? 'Ukládám...' : 'Ano, zúčtovat sklad'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
