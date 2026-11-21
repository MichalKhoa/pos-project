import React, { useEffect, useRef } from 'react';
import { Tag, X } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext.jsx';
import { soundFx } from '../../utils/audio.js';
import { useOwnKeyboard } from '../../utils/keyboardOwner.js';
import { useRejectFlash } from '../../hooks/useRejectFlash.js';
import { appendDigit, appendDecimal, applyMultiply, stepQty } from '../../utils/keypadInput.js';
import KeypadStepperBar from '../keypad/KeypadStepperBar.jsx';
import KeypadNumberGrid from '../keypad/KeypadNumberGrid.jsx';
import KeypadAmountDisplay from '../keypad/KeypadAmountDisplay.jsx';

// A key within this many ms of the previous one is a barcode scanner, not a hand.
const SCAN_KEY_GAP_MS = 70;
const SCAN_ENTER_GAP_MS = 100;

export default function OpenPriceModal({
  openPriceTarget,
  onClose,
  enteredOpenPrice,
  setEnteredOpenPrice,
  openPriceQty,
  setOpenPriceQty,
  onSubmit
}) {
  const { t } = useTranslation();
  const isOpen = Boolean(openPriceTarget);
  useOwnKeyboard(isOpen);
  const [rejectKey, flashReject] = useRejectFlash();

  // The signed quantity is the single source of the return state (see QuickPresetGrid).
  const isReturn = openPriceQty < 0;
  const hasValidAmount = Boolean(enteredOpenPrice && !isNaN(parseFloat(enteredOpenPrice)) && parseFloat(enteredOpenPrice) > 0);

  const handleKeyPress = (val) => {
    if (val === 'CLEAR') {
      soundFx.playDeleteTone();
      setEnteredOpenPrice('');
      setOpenPriceQty(1);
      return;
    }
    soundFx.playKeypadClick();
    if (val === '±') {
      setOpenPriceQty(prev => (prev < 0 ? Math.abs(prev || 1) : -Math.abs(prev || 1)));
    } else if (val === 'BACK') {
      setEnteredOpenPrice(prev => prev.slice(0, -1));
    } else if (val === '.') {
      setEnteredOpenPrice(prev => appendDecimal(prev));
    } else {
      setEnteredOpenPrice(prev => appendDigit(prev, val));
    }
  };

  const handleMultiply = () => {
    const result = applyMultiply(enteredOpenPrice, openPriceQty);
    if (!result) {
      soundFx.playError();
      flashReject();
      return;
    }
    soundFx.playKeypadClick();
    setEnteredOpenPrice(result.amountStr);
    setOpenPriceQty(result.itemMultiplier);
  };

  const handleSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (hasValidAmount) onSubmit(e);
  };

  // Physical keyboard (USB numpad). Same keys as the register shortcuts; a scanner burst is
  // ignored and can never submit a line.
  const lastKeyAtRef = useRef(0);
  const keyHandlerRef = useRef(null);
  keyHandlerRef.current = (e) => {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const key = e.key;
    if (key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    const now = Date.now();
    const gap = now - lastKeyAtRef.current;
    lastKeyAtRef.current = now;

    if (key === 'Enter') {
      e.preventDefault();
      if (gap > SCAN_ENTER_GAP_MS) handleSubmit();
      return;
    }
    if (key.length === 1 && gap <= SCAN_KEY_GAP_MS) {
      e.preventDefault();
      return;
    }

    if (/^[0-9]$/.test(key)) {
      e.preventDefault();
      handleKeyPress(key);
    } else if (key === '.' || key === ',') {
      e.preventDefault();
      handleKeyPress('.');
    } else if (key === 'Backspace') {
      e.preventDefault();
      handleKeyPress('BACK');
    } else if (key === 'Delete' || key.toLowerCase() === 'c') {
      e.preventDefault();
      handleKeyPress('CLEAR');
    } else if (key === '-' || key === 'Subtract') {
      e.preventDefault();
      handleKeyPress('±');
    } else if (key === '+' || key === 'Add' || key === 'ArrowUp') {
      e.preventDefault();
      soundFx.playKeypadClick();
      setOpenPriceQty(prev => stepQty(prev, 1));
    } else if (key === 'ArrowDown') {
      e.preventDefault();
      soundFx.playKeypadClick();
      setOpenPriceQty(prev => stepQty(prev, -1));
    } else if (key === '*' || key.toLowerCase() === 'x') {
      e.preventDefault();
      handleMultiply();
    }
  };

  useEffect(() => {
    if (!isOpen) return undefined;
    const listener = (e) => keyHandlerRef.current(e);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [isOpen]);

  if (!openPriceTarget) return null;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal-card"
        onClick={e => e.stopPropagation()}
        style={{
          width: '92vw',
          maxWidth: '430px',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-card-elevated)',
          overflowY: 'auto'
        }}
      >
        {/* Modal Header */}
        <div className="modal-header" style={{ padding: '0.75rem 1rem' }}>
          <div className="modal-title" style={{ fontSize: '1rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <Tag size={17} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {openPriceTarget.name}
            </span>
          </div>
          <button type="button" className="close-modal-btn" onClick={onClose} aria-label={t('common.close')}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
          <KeypadAmountDisplay
            isReturn={isReturn}
            hasValidAmount={hasValidAmount}
            multiplier={openPriceQty}
            amountStr={enteredOpenPrice}
            rejected={rejectKey}
          />

          {/* ── Quantity stepper (shared with the main keypad) ── */}
          <KeypadStepperBar
            itemMultiplier={openPriceQty}
            setItemMultiplier={setOpenPriceQty}
            triggerKeyAnimation={() => soundFx.playKeypadClick()}
          />

          {/* ── Number grid with the Add button and its line-total summary ── */}
          <KeypadNumberGrid
            onKeyPress={handleKeyPress}
            itemMultiplier={openPriceQty}
            amountStr={enteredOpenPrice}
            onMultiply={handleMultiply}
            rejectKey={rejectKey}
            hasValidAmount={hasValidAmount}
            onAddCustomItem={handleSubmit}
          />

          {/* ── Cancel ── */}
          <button
            type="button"
            className="nav-tab"
            style={{
              justifyContent: 'center',
              height: '44px',
              minHeight: '44px',
              fontSize: '0.95rem',
              fontWeight: '700',
              borderRadius: 'var(--radius-md)'
            }}
            onClick={onClose}
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
