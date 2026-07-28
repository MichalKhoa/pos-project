import React, { useState, useEffect } from 'react';
import { Banknote, CreditCard, QrCode, CheckCircle2, Split } from 'lucide-react';

export default function PaymentModal({
  method,
  totalAmount,
  onClose,
  onCompleteSale
}) {
  const [tenderedStr, setTenderedStr] = useState(totalAmount.toString());
  const [activeMethod, setActiveMethod] = useState(method || 'cash');

  // Split payment state
  const [splitCashStr, setSplitCashStr] = useState(Math.floor(totalAmount / 2).toString());

  useEffect(() => {
    setTenderedStr(totalAmount.toString());
    setSplitCashStr(Math.floor(totalAmount / 2).toString());
  }, [totalAmount]);

  const tenderedVal = parseFloat(tenderedStr) || 0;
  const changeDue = tenderedVal - totalAmount;

  // Split payment amounts
  const splitCashVal = parseFloat(splitCashStr) || 0;
  const splitCardVal = Math.max(0, totalAmount - splitCashVal);

  const handleCashShortcut = (val) => {
    if (val === 'exact') {
      setTenderedStr(totalAmount.toString());
      return;
    }
    const current = parseFloat(tenderedStr) || 0;
    setTenderedStr((current + val).toString());
  };

  const handleComplete = () => {
    if (activeMethod === 'cash' && changeDue < 0) return;

    if (activeMethod === 'split') {
      onCompleteSale({
        paymentMethod: 'split',
        splitDetails: {
          cash: splitCashVal,
          card: splitCardVal
        },
        tenderedAmount: totalAmount,
        changeDue: 0
      });
      return;
    }

    onCompleteSale({
      paymentMethod: activeMethod,
      tenderedAmount: activeMethod === 'cash' ? tenderedVal : totalAmount,
      changeDue: activeMethod === 'cash' ? Math.max(0, changeDue) : 0
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px' }}>
        <div className="modal-header">
          <div className="modal-title">
            {activeMethod === 'cash' ? <Banknote size={22} style={{ color: 'var(--accent-emerald)' }} /> : activeMethod === 'split' ? <Split size={22} style={{ color: 'var(--accent-purple)' }} /> : <CreditCard size={22} style={{ color: 'var(--accent-blue)' }} />}
            <span>Platba Prodeje</span>
          </div>
          <button className="close-modal-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div style={{ display: 'flex', gap: '0.4rem', background: 'var(--bg-input)', padding: '0.3rem', borderRadius: 'var(--radius-md)', flexWrap: 'wrap' }}>
            <button
              className={`nav-tab ${activeMethod === 'cash' ? 'active' : ''}`}
              style={{ flex: 1, justifyContent: 'center', fontSize: '0.8rem', padding: '0.4rem 0.5rem' }}
              onClick={() => setActiveMethod('cash')}
            >
              <Banknote size={14} />
              <span>Hotovost</span>
            </button>

            <button
              className={`nav-tab ${activeMethod === 'card' ? 'active' : ''}`}
              style={{ flex: 1, justifyContent: 'center', fontSize: '0.8rem', padding: '0.4rem 0.5rem' }}
              onClick={() => setActiveMethod('card')}
            >
              <CreditCard size={14} />
              <span>Karta</span>
            </button>

            <button
              className={`nav-tab ${activeMethod === 'qr' ? 'active' : ''}`}
              style={{ flex: 1, justifyContent: 'center', fontSize: '0.8rem', padding: '0.4rem 0.5rem' }}
              onClick={() => setActiveMethod('qr')}
            >
              <QrCode size={14} />
              <span>QR Platba</span>
            </button>

            <button
              className={`nav-tab ${activeMethod === 'split' ? 'active' : ''}`}
              style={{ flex: 1, justifyContent: 'center', fontSize: '0.8rem', padding: '0.4rem 0.5rem' }}
              onClick={() => setActiveMethod('split')}
            >
              <Split size={14} />
              <span>Kombinovaná</span>
            </button>
          </div>

          <div className="tender-display">
            <span className="tender-label">Celková částka k úhradě</span>
            <span className="tender-amount">{totalAmount.toFixed(0)} Kč</span>
          </div>

          {activeMethod === 'cash' && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem', textAlign: 'center' }}>
                  Přijato od zákazníka
                </label>
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '1.8rem',
                  fontWeight: '800',
                  color: 'var(--text-primary)',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.5rem 1rem',
                  textAlign: 'center'
                }}>
                  {tenderedStr} Kč
                </div>
              </div>

              <div className="quick-cash-grid">
                <button className="cash-shortcut-btn" onClick={() => handleCashShortcut('exact')}>Přesně</button>
                <button className="cash-shortcut-btn" onClick={() => handleCashShortcut(100)}>+100 Kč</button>
                <button className="cash-shortcut-btn" onClick={() => handleCashShortcut(200)}>+200 Kč</button>
                <button className="cash-shortcut-btn" onClick={() => handleCashShortcut(500)}>+500 Kč</button>
                <button className="cash-shortcut-btn" onClick={() => handleCashShortcut(1000)}>+1000 Kč</button>
                <button className="cash-shortcut-btn" onClick={() => handleCashShortcut(2000)}>+2000 Kč</button>
              </div>

              <div className="change-due-box" style={{ background: changeDue < 0 ? 'rgba(225, 29, 72, 0.1)' : 'rgba(5, 150, 105, 0.1)', borderColor: changeDue < 0 ? 'rgba(225, 29, 72, 0.3)' : 'rgba(5, 150, 105, 0.3)' }}>
                <span className="change-label" style={{ color: changeDue < 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)' }}>
                  {changeDue < 0 ? 'Chybí doplatit:' : 'Vrátit zákazníkovi:'}
                </span>
                <span className="change-amount" style={{ color: changeDue < 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)' }}>
                  {Math.abs(changeDue).toFixed(0)} Kč
                </span>
              </div>
            </>
          )}

          {activeMethod === 'split' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'var(--bg-input)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--accent-purple)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Split size={16} />
                <span>Rozdělení částky (Hotovost + Karta)</span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                  Částka hrazená HOTOVĚ (Kč)
                </label>
                <input
                  type="number"
                  value={splitCashStr}
                  onChange={e => setSplitCashStr(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 1rem',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '1.25rem',
                    fontWeight: '800',
                    color: 'var(--accent-emerald)'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-secondary)' }}>
                  Zbývá uhradit KARTOU:
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.4rem', fontWeight: '800', color: 'var(--accent-blue)' }}>
                  {splitCardVal.toFixed(0)} Kč
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button type="button" className="vat-btn" onClick={() => setSplitCashStr((totalAmount / 2).toFixed(0))}>50% / 50%</button>
                <button type="button" className="vat-btn" onClick={() => setSplitCashStr('100')}>100 Kč hotově</button>
                <button type="button" className="vat-btn" onClick={() => setSplitCashStr('200')}>200 Kč hotově</button>
                <button type="button" className="vat-btn" onClick={() => setSplitCashStr('500')}>500 Kč hotově</button>
              </div>
            </div>
          )}

          {activeMethod === 'card' && (
            <div style={{ textAlign: 'center', padding: '1.5rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <CreditCard size={48} style={{ color: 'var(--accent-blue)', marginBottom: '0.75rem' }} />
              <div style={{ fontWeight: '700', fontSize: '1.1rem', marginBottom: '0.2rem' }}>Přiložte nebo vložte kartu</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Terminál je připraven k transakci {totalAmount} Kč</div>
            </div>
          )}

          {activeMethod === 'qr' && (
            <div style={{ textAlign: 'center', padding: '1.5rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <QrCode size={48} style={{ color: 'var(--accent-purple)', marginBottom: '0.75rem' }} />
              <div style={{ fontWeight: '700', fontSize: '1.1rem', marginBottom: '0.2rem' }}>Naskenujte QR kód platby</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Platba přes okamžitý bankovní převod</div>
            </div>
          )}

          <button
            className="pay-btn pay-btn-cash"
            style={{ width: '100%', height: '56px', marginTop: '0.5rem' }}
            disabled={activeMethod === 'cash' && changeDue < 0}
            onClick={handleComplete}
          >
            <CheckCircle2 size={22} />
            <span>Dokončit prodej ({totalAmount.toFixed(0)} Kč)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
