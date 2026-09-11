import React, { useState, useEffect } from 'react';
import { X, Wine, Plus, Truck, ArrowDownLeft } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext';

export default function DepositPackagingModal({ isOpen, onClose }) {
  const { t } = useTranslation();
  const [summary, setSummary] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [actionType, setActionType] = useState(null); // 'SUPPLIER_INTAKE' | 'CUSTOMER_RETURN' | 'SUPPLIER_DISPATCH' | 'ADJUSTMENT'
  const [selectedContainer, setSelectedContainer] = useState('BOTTLE_3CZK');
  const [quantity, setQuantity] = useState('');
  const [docRef, setDocRef] = useState('');
  const [supplierIco, setSupplierIco] = useState('');
  const [note, setNote] = useState('');
  const [statusMsg, setStatusMsg] = useState(null);

  const fetchSummary = async () => {
    try {
      const res = await fetch('/api/v1/inventory/deposits/summary');
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      }
    } catch (err) {
      console.error('Error fetching deposit summary:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setActionType(null);
      setQuantity('');
      setDocRef('');
      setNote('');
      setStatusMsg(null);
      fetchSummary();
    }
  }, [isOpen]);

  const handleRecordMovement = async (e) => {
    e.preventDefault();
    const qtyNum = parseFloat(quantity);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      alert('Zadejte kladný počet kusů.');
      return;
    }

    setIsRecording(true);
    try {
      const payload = {
        container_type: selectedContainer,
        movement_type: actionType,
        quantity: qtyNum,
        document_ref: docRef.trim() || undefined,
        supplier_ico: supplierIco.trim() || undefined,
        note: note.trim() || undefined
      };

      const res = await fetch('/api/v1/inventory/deposits/movement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Chyba při zápisu pohybu zálohovaných obalů.');
      }

      setStatusMsg({ type: 'success', text: 'Pohyb zálohovaných obalů byl úspěšně zaevidován.' });
      setActionType(null);
      setQuantity('');
      setDocRef('');
      setNote('');
      fetchSummary();
      setTimeout(() => setStatusMsg(null), 3500);
    } catch (err) {
      alert(err.message);
    } finally {
      setIsRecording(false);
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
          maxWidth: '860px',
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
            <Wine size={22} style={{ color: 'var(--accent-amber)' }} />
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
                {t('inventory.deposit_ledger_title') || 'Kniha zálohovaných vratných obalů (Lahve & Přepravky)'}
              </h2>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {t('inventory.deposit_ledger_subtitle') || 'Evidence stavu vratných lahví (3 Kč) a bas (100 Kč), závozů a vratek pivovarům'}
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
              minWidth: '40px',
              minHeight: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Area */}
        <div style={{ padding: '1.25rem', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {statusMsg && (
            <div style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-emerald)', border: '1px solid var(--accent-emerald)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', fontSize: '0.88rem', fontWeight: 700 }}>
              {statusMsg.text}
            </div>
          )}

          {/* Balance Cards Strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            {summary?.balances?.map(bal => (
              <div
                key={bal.container_type}
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '1rem' }}>{bal.container_name || bal.name || bal.container_type}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Záloha: {bal.deposit_value || bal.deposit_amount || 0} Kč / ks</div>
                  </div>
                  <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-blue)', borderRadius: 'var(--radius-sm)', fontWeight: 700 }}>
                    {bal.container_type}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '0.25rem' }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800 }}>{bal.current_quantity || 0} <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>ks</span></div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--accent-amber)' }}>
                    {((bal.total_deposit_value !== undefined ? bal.total_deposit_value : ((bal.current_quantity || 0) * (bal.deposit_value || bal.deposit_amount || 0))) || 0).toFixed(2)} Kč
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                  <span>Příjem: +{bal.intake_quantity || 0}</span>
                  <span>Výkup: +{bal.customer_returned_quantity || 0}</span>
                  <span>Odvoz: -{bal.supplier_dispatched_quantity || 0}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Total Locked Deposits Banner */}
          <div
            style={{
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: 'var(--radius-md)',
              padding: '0.85rem 1.25rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.5rem'
            }}
          >
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Celková vázaná hodnota záloh na prodejně</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--accent-amber)' }}>
                {((summary?.total_deposit_locked_value !== undefined ? summary.total_deposit_locked_value : summary?.total_locked_deposit_value) || 0).toFixed(2)} Kč
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setActionType('SUPPLIER_INTAKE')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.5rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--accent-blue)',
                  background: 'rgba(59, 130, 246, 0.15)',
                  color: 'var(--accent-blue)',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  minHeight: '40px'
                }}
              >
                <ArrowDownLeft size={16} />
                <span>+ Příjem z pivovaru</span>
              </button>

              <button
                type="button"
                onClick={() => setActionType('SUPPLIER_DISPATCH')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.5rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--accent-rose)',
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: 'var(--accent-rose)',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  minHeight: '40px'
                }}
              >
                <Truck size={16} />
                <span>- Odvoz do pivovaru</span>
              </button>

              <button
                type="button"
                onClick={() => setActionType('CUSTOMER_RETURN')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.5rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--accent-emerald)',
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: 'var(--accent-emerald)',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  minHeight: '40px'
                }}
              >
                <Plus size={16} />
                <span>+ Ruční výkup</span>
              </button>
            </div>
          </div>

          {/* Movement Input Form (when action active) */}
          {actionType && (
            <form
              onSubmit={handleRecordMovement}
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem 1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '0.95rem' }}>
                  {actionType === 'SUPPLIER_INTAKE' && 'Příjem obalů z dodacího listu pivovaru'}
                  {actionType === 'SUPPLIER_DISPATCH' && 'Odvoz prázdných obalů zpět do pivovaru'}
                  {actionType === 'CUSTOMER_RETURN' && 'Ruční výkup vratných obalů na pokladně'}
                  {actionType === 'ADJUSTMENT' && 'Inventurní narovnání vratných obalů'}
                </strong>
                <button
                  type="button"
                  onClick={() => setActionType(null)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                >
                  Zrušit
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Obal</label>
                  <select
                    value={selectedContainer}
                    onChange={(e) => setSelectedContainer(e.target.value)}
                    style={{ width: '100%', height: '40px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', padding: '0 0.5rem', fontWeight: 600 }}
                  >
                    <option value="BOTTLE_3CZK">Pivní lahev 0,5l (3 Kč)</option>
                    <option value="CRATE_100CZK">Pivní přepravka / basa (100 Kč)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Počet kusů</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="Např. 20"
                    style={{ width: '100%', height: '40px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', padding: '0 0.75rem', fontWeight: 700 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Číslo dokladu / dodacího listu</label>
                  <input
                    type="text"
                    value={docRef}
                    onChange={(e) => setDocRef(e.target.value)}
                    placeholder="Např. DL-2026-442"
                    style={{ width: '100%', height: '40px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', padding: '0 0.75rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Poznámka</label>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Volitelná poznámka..."
                    style={{ width: '100%', height: '40px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', padding: '0 0.75rem' }}
                  />
                </div>

                {(actionType === 'SUPPLIER_INTAKE' || actionType === 'SUPPLIER_DISPATCH') && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>IČO dodavatele / pivovaru</label>
                    <input
                      type="text"
                      value={supplierIco}
                      onChange={(e) => setSupplierIco(e.target.value)}
                      placeholder="IČO pivovaru..."
                      style={{ width: '100%', height: '40px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', padding: '0 0.75rem' }}
                    />
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button
                  type="submit"
                  disabled={isRecording}
                  style={{
                    padding: '0.65rem 1.5rem',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--accent-blue)',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 700,
                    cursor: 'pointer',
                    minHeight: '44px'
                  }}
                >
                  {isRecording ? 'Zapisuji...' : 'Uložit pohyb obalů'}
                </button>
              </div>
            </form>
          )}

          {/* Movements History Table */}
          <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            <div style={{ padding: '0.65rem 1rem', background: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)', fontWeight: 700, fontSize: '0.85rem' }}>
              Poslední pohyby zálohovaných obalů
            </div>
            <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-card-hover)', borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Datum</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Obal</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Typ pohybu</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>Změna ks</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Hodnota</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Doklad</th>
                  </tr>
                </thead>
                <tbody>
                  {summary?.recent_movements?.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary)' }}>
                        Zatím nebyly zaevidovány žádné pohyby vratných obalů.
                      </td>
                    </tr>
                  ) : (
                    summary?.recent_movements?.map(m => {
                      const dt = new Date(m.timestamp).toLocaleString('cs-CZ', { dateStyle: 'short', timeStyle: 'short' });
                      return (
                        <tr key={m.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '0.5rem 0.75rem' }}>{dt}</td>
                          <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>{m.container_name}</td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>
                            <span style={{
                              fontSize: '0.75rem',
                              padding: '0.15rem 0.4rem',
                              borderRadius: 'var(--radius-sm)',
                              background: m.quantity_delta > 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                              color: m.quantity_delta > 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                              fontWeight: 700
                            }}>
                              {m.movement_type === 'SUPPLIER_INTAKE' && 'Příjem (Pivovar)'}
                              {m.movement_type === 'CUSTOMER_RETURN' && 'Výkup (Zákazník)'}
                              {m.movement_type === 'SUPPLIER_DISPATCH' && 'Odvoz (Pivovar)'}
                              {m.movement_type === 'ADJUSTMENT' && 'Korekce'}
                            </span>
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 700 }}>
                            <span style={{ color: m.quantity_delta > 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                              {m.quantity_delta > 0 ? `+${m.quantity_delta}` : m.quantity_delta} ks
                            </span>
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 700 }}>
                            {m.total_value > 0 ? `+${m.total_value.toFixed(2)}` : m.total_value.toFixed(2)} Kč
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                            {m.document_ref || '-'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
