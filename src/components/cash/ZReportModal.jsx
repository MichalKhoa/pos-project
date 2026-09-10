import React, { useState, useEffect, useId } from 'react';
import { FileSpreadsheet, CheckCircle2, AlertTriangle, AlertOctagon, Printer, X, Delete } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext.jsx';
import { soundFx } from '../../utils/audio.js';
import { getCurrentShift, closeShift, printZReport } from '../../api/posApi.js';
import { roundCZK } from '../../utils/tax.js';

export default function ZReportModal({
  isOpen = true,
  onClose,
  onShiftClosed,
  storeConfig = null
}) {
  const { t } = useTranslation();
  const notesInputId = useId();

  const [shiftData, setShiftData] = useState(null);
  const [actualCashStr, setActualCashStr] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [closedReport, setClosedReport] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setActualCashStr('');
    setNotes('');
    setErrorMsg(null);
    setClosedReport(null);
    setIsSubmitting(false);

    getCurrentShift()
      .then((data) => {
        setShiftData(data);
        if (data && data.expected_cash !== undefined) {
          // Pre-populate actual cash with expected cash for quick 1-tap confirmation if drawer is balanced
          setActualCashStr(parseFloat(data.expected_cash || 0).toString());
        }
      })
      .catch((err) => {
        setErrorMsg(err.message || 'Chyba při načítání směny');
      });
  }, [isOpen]);

  // Keyboard accessibility: Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isSubmitting) {
        e.preventDefault();
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const expectedCash = shiftData ? parseFloat(shiftData.expected_cash || 0) : 0;
  const actualCash = actualCashStr !== '' ? parseFloat(actualCashStr) : 0;
  const discrepancy = roundCZK(actualCash - expectedCash);

  const isDiscrepancyZero = Math.abs(discrepancy) < 0.01;
  const isSurplus = discrepancy > 0.01;
  const isShortage = discrepancy < -0.01;

  const handleKeypadPress = (val) => {
    soundFx.playKeypadClick();
    if (val === 'CLEAR') {
      setActualCashStr('');
      return;
    }
    if (val === 'BACK') {
      setActualCashStr(prev => prev.slice(0, -1));
      return;
    }
    if (val === '.' || val === ',') {
      if (actualCashStr.includes('.')) return;
      setActualCashStr(prev => (prev ? prev + '.' : '0.'));
      return;
    }
    if (actualCashStr.includes('.')) {
      const parts = actualCashStr.split('.');
      if (parts[1] && parts[1].length >= 2) return;
    }
    if (actualCashStr.length >= 8) return;
    setActualCashStr(prev => prev + val);
  };

  const handleExecuteCloseShift = async () => {
    if (actualCashStr === '' || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      soundFx.playSuccess();
      const zReportRes = await closeShift({
        actual_cash: actualCash,
        notes: notes.trim()
      });

      // Automatically print thermal closing slip
      await printZReport(zReportRes, storeConfig || {}, true);

      setClosedReport(zReportRes);
      onShiftClosed?.(zReportRes);
    } catch (err) {
      setErrorMsg(err.message || 'Chyba při uzavírání směny');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReprintSlip = async () => {
    if (!closedReport) return;
    try {
      soundFx.playKeypadClick();
      await printZReport(closedReport, storeConfig || {}, false);
    } catch (err) {
      setErrorMsg(err.message || 'Chyba při tisku');
    }
  };

  return (
    <div
      className="modal-overlay pos-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose?.();
      }}
    >
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        style={{
          width: '100%',
          maxWidth: '540px',
          maxHeight: '90dvh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-md)',
              background: 'color-mix(in srgb, var(--accent-blue) 12%, transparent)',
              border: '1px solid color-mix(in srgb, var(--accent-blue) 35%, transparent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-blue)',
              flexShrink: 0
            }}>
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h2 className="modal-title" style={{ margin: 0, fontSize: '1.18rem' }}>
                {t('z_report.title') || 'Denní Z-Uzávěrka pokladny'}
              </h2>
              {shiftData && (
                <div style={{ fontSize: '0.80rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  Směna #{shiftData.shift_number} (Z-Report #{shiftData.z_seq})
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            className="close-modal-btn"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label={t('common.close') || 'Zavřít'}
          >
            <X size={20} />
          </button>
        </div>

        {/* Closed Success Confirmation View */}
        {closedReport ? (
          <>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', textAlign: 'center', padding: '1.25rem' }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'color-mix(in srgb, var(--accent-emerald) 15%, transparent)',
                border: '2px solid color-mix(in srgb, var(--accent-emerald) 40%, transparent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-emerald)'
              }}>
                <CheckCircle2 size={36} />
              </div>

              <div>
                <h3 style={{ fontSize: '1.24rem', fontWeight: '800', color: 'var(--text-primary)', margin: '0 0 0.4rem 0' }}>
                  {t('z_report.closed_success') || 'Z-Uzávěrka byla úspěšně provedena.'}
                </h3>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', margin: 0 }}>
                  Směna #{closedReport.shift_number} byla uzavřena a doklad byl odeslán na tiskárnu.
                </p>
              </div>

              <div style={{
                width: '100%',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '0.85rem 1rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '0.5rem',
                textAlign: 'left',
                fontFamily: 'var(--font-mono)'
              }}>
                <div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Očekáváno:</div>
                  <div style={{ fontSize: '0.98rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                    {closedReport.shift.expected_cash.toLocaleString('cs-CZ')} Kč
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Skutečnost:</div>
                  <div style={{ fontSize: '0.98rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                    {closedReport.shift.actual_cash.toLocaleString('cs-CZ')} Kč
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Rozdíl:</div>
                  <div style={{
                    fontSize: '0.98rem',
                    fontWeight: '800',
                    color: closedReport.shift.discrepancy === 0
                      ? 'var(--accent-emerald)'
                      : (closedReport.shift.discrepancy > 0 ? 'var(--accent-amber)' : 'var(--accent-rose)')
                  }}>
                    {closedReport.shift.discrepancy > 0 ? '+' : ''}{closedReport.shift.discrepancy.toLocaleString('cs-CZ')} Kč
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer footer-split">
              <button
                type="button"
                onClick={handleReprintSlip}
                className="key-btn"
                style={{
                  flex: 1,
                  minHeight: '48px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-card-hover)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-key)'
                }}
              >
                <Printer size={16} />
                <span>{t('z_report.print_only') || 'Vytisknout znovu'}</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1,
                  minHeight: '48px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--accent-blue)',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: '800',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)'
                }}
              >
                {t('z_report.close') || 'Hotovo'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="modal-body" style={{ gap: '0.85rem', padding: '1.25rem' }}>
              {/* Shift Breakdown Ledger Summary */}
              <div style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '0.75rem 0.95rem'
              }}>
                <div style={{
                  fontSize: '0.76rem',
                  fontWeight: '800',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '0.45rem'
                }}>
                  {t('z_report.summary_title') || 'Bilance směny'}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.86rem', fontFamily: 'var(--font-mono)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{t('z_report.opening_cash') || 'Počáteční hotovost:'}</span>
                    <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{(shiftData?.opening_cash || 0).toLocaleString('cs-CZ')} Kč</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--accent-emerald)' }}>
                    <span>{t('z_report.cash_sales') || 'Tržba v hotovosti (+):'}</span>
                    <span style={{ fontWeight: '700' }}>+{(shiftData?.total_cash_sales || 0).toLocaleString('cs-CZ')} Kč</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--accent-rose)' }}>
                    <span>{t('z_report.cash_refunds') || 'Vratky hotovost (-):'}</span>
                    <span style={{ fontWeight: '700' }}>-{(shiftData?.total_cash_refunds || 0).toLocaleString('cs-CZ')} Kč</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--accent-blue)' }}>
                    <span>{t('z_report.movements') || 'Pohyby (Vklady - Výběry):'}</span>
                    <span style={{ fontWeight: '700' }}>
                      {(shiftData?.net_movements || 0) >= 0 ? '+' : ''}{(shiftData?.net_movements || 0).toLocaleString('cs-CZ')} Kč
                    </span>
                  </div>
                  <div style={{
                    borderTop: '1px dashed var(--border-color)',
                    paddingTop: '0.4rem',
                    marginTop: '0.2rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontWeight: '900',
                    fontSize: '0.98rem'
                  }}>
                    <span style={{ color: 'var(--text-primary)' }}>{t('z_report.expected_cash') || 'Očekáváno v pokladně:'}</span>
                    <span style={{ color: 'var(--accent-blue)' }}>{expectedCash.toLocaleString('cs-CZ')} Kč</span>
                  </div>
                </div>
              </div>

              {/* Actual Counted Cash Input & Discrepancy Status */}
              <div>
                <label
                  style={{
                    fontSize: '0.76rem',
                    fontWeight: '800',
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    marginBottom: '0.35rem',
                    display: 'block'
                  }}
                >
                  {t('z_report.actual_cash_label') || 'Zadaná hotovost v pokladně (Fyzický stav):'}
                </label>

                <div style={{
                  background: 'var(--bg-input)',
                  border: '1.5px solid var(--border-focus)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.55rem 0.95rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '0.45rem',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem', fontWeight: '600' }}>
                    Fyzicky spočteno:
                  </span>
                  <span style={{
                    fontSize: '1.65rem',
                    fontWeight: '900',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-primary)'
                  }}>
                    {actualCashStr ? parseFloat(actualCashStr).toLocaleString('cs-CZ') : '0'} Kč
                  </span>
                </div>

                {/* Real-Time Discrepancy Indicator Banner */}
                <div style={{
                  borderRadius: 'var(--radius-md)',
                  padding: '0.55rem 0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.88rem',
                  fontWeight: '800',
                  background: isDiscrepancyZero
                    ? 'color-mix(in srgb, var(--accent-emerald) 12%, var(--bg-card))'
                    : (isSurplus
                        ? 'color-mix(in srgb, var(--accent-amber) 12%, var(--bg-card))'
                        : 'color-mix(in srgb, var(--accent-rose) 12%, var(--bg-card))'),
                  border: `1.5px solid ${isDiscrepancyZero ? 'var(--accent-emerald)' : (isSurplus ? 'var(--accent-amber)' : 'var(--accent-rose)')}`,
                  color: isDiscrepancyZero
                    ? 'var(--accent-emerald)'
                    : (isSurplus ? 'var(--accent-amber)' : 'var(--accent-rose)')
                }}>
                  {isDiscrepancyZero && <CheckCircle2 size={18} />}
                  {isSurplus && <AlertTriangle size={18} />}
                  {isShortage && <AlertOctagon size={18} />}

                  <span>
                    {isDiscrepancyZero && (t('z_report.ok') || 'V pořádku (0 Kč)')}
                    {isSurplus && `${t('z_report.surplus', { amount: discrepancy.toLocaleString('cs-CZ') }) || `Přebytek (+${discrepancy.toLocaleString('cs-CZ')} Kč)`}`}
                    {isShortage && `${t('z_report.shortage', { amount: Math.abs(discrepancy).toLocaleString('cs-CZ') }) || `Manko (-${Math.abs(discrepancy).toLocaleString('cs-CZ')} Kč)`}`}
                  </span>
                </div>
              </div>

              {/* Tactile Keypad Number Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '0.4rem'
              }}>
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'BACK'].map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => handleKeypadPress(k === 'C' ? 'CLEAR' : k)}
                    className="key-btn"
                    style={{
                      minHeight: '44px',
                      borderRadius: 'var(--radius-md)',
                      background: k === 'C'
                        ? 'color-mix(in srgb, var(--accent-rose) 12%, var(--bg-card-hover))'
                        : (k === 'BACK'
                            ? 'color-mix(in srgb, var(--accent-amber) 12%, var(--bg-card-hover))'
                            : 'var(--bg-card)'),
                      border: `1px solid ${k === 'C' ? 'color-mix(in srgb, var(--accent-rose) 40%, var(--border-color))' : (k === 'BACK' ? 'color-mix(in srgb, var(--accent-amber) 40%, var(--border-color))' : 'var(--border-color)')}`,
                      color: k === 'C'
                        ? 'var(--accent-rose)'
                        : (k === 'BACK' ? 'var(--accent-amber)' : 'var(--text-primary)'),
                      fontSize: k === 'BACK' ? '0.88rem' : '1.14rem',
                      fontWeight: '800',
                      fontFamily: 'var(--font-mono)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: 'var(--shadow-key)',
                      touchAction: 'manipulation'
                    }}
                  >
                    {k === 'BACK' ? <Delete size={18} /> : k}
                  </button>
                ))}
              </div>

              {/* Optional Notes */}
              <div>
                <input
                  id={notesInputId}
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('z_report.notes') || 'Poznámka k uzávěrce (volitelné)...'}
                  style={{
                    width: '100%',
                    minHeight: '40px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    padding: '0.45rem 0.75rem',
                    fontSize: '0.88rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {errorMsg && (
                <div style={{
                  background: 'color-mix(in srgb, var(--accent-rose) 14%, var(--bg-card))',
                  border: '1px solid var(--accent-rose)',
                  color: 'var(--accent-rose)',
                  padding: '0.5rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.84rem',
                  fontWeight: '700'
                }}>
                  {errorMsg}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="modal-footer footer-split">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="key-btn"
                style={{
                  flex: 1,
                  minHeight: '48px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-card-hover)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-secondary)',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-key)'
                }}
              >
                {t('common.cancel') || 'Zrušit'}
              </button>

              <button
                type="button"
                onClick={handleExecuteCloseShift}
                disabled={actualCashStr === '' || isSubmitting}
                style={{
                  flex: 2,
                  minHeight: '48px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--accent-blue)',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: '800',
                  fontSize: '0.96rem',
                  cursor: actualCashStr !== '' && !isSubmitting ? 'pointer' : 'not-allowed',
                  opacity: actualCashStr !== '' && !isSubmitting ? 1 : 0.6,
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem'
                }}
              >
                <Printer size={18} />
                <span>
                  {isSubmitting
                    ? (t('z_report.closing') || 'Uzavírám směnu...')
                    : (t('z_report.confirm_and_print') || 'Provést Z-Uzávěrku a vytisknout')}
                </span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

