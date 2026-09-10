import React, { useState, useEffect, useId } from 'react';
import { Banknote, ArrowDownLeft, ArrowUpRight, ShieldCheck, Printer, X, Delete } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext.jsx';
import { soundFx } from '../../utils/audio.js';
import { recordCashMovement, printCashMovementSlip } from '../../api/posApi.js';

export default function CashDrawerMovementModal({
  isOpen = true,
  onClose,
  onMovementRecorded,
  currentShift = null,
  storeConfig = null
}) {
  const { t } = useTranslation();
  const reasonInputId = useId();

  const [movementType, setMovementType] = useState('FLOAT_IN'); // 'FLOAT_IN', 'PAYOUT', 'SAFE_DROP'
  const [amountStr, setAmountStr] = useState('');
  const [reason, setReason] = useState('');
  const [printSlip, setPrintSlip] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setAmountStr('');
    setReason('');
    setErrorMsg(null);
    setIsSubmitting(false);
  }, [isOpen]);

  // Keyboard accessibility: Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const numAmount = parseFloat(amountStr) || 0;
  const isValid = numAmount > 0;

  const handleQuickAddAmount = (addValue) => {
    soundFx.playKeypadClick();
    const current = parseFloat(amountStr) || 0;
    setAmountStr((current + addValue).toString());
  };

  const handleKeypadPress = (val) => {
    soundFx.playKeypadClick();
    if (val === 'CLEAR') {
      setAmountStr('');
      return;
    }
    if (val === 'BACK') {
      setAmountStr(prev => prev.slice(0, -1));
      return;
    }
    if (val === '.' || val === ',') {
      if (amountStr.includes('.')) return;
      setAmountStr(prev => (prev ? prev + '.' : '0.'));
      return;
    }
    if (amountStr.includes('.')) {
      const parts = amountStr.split('.');
      if (parts[1] && parts[1].length >= 2) return;
    }
    if (amountStr.length >= 8) return;
    setAmountStr(prev => prev + val);
  };

  const handlePresetReason = (presetText) => {
    soundFx.playKeypadClick();
    setReason(presetText);
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      soundFx.playBeep();
      const res = await recordCashMovement({
        movement_type: movementType,
        amount: numAmount,
        reason: reason.trim(),
        print_slip: printSlip
      });

      if (printSlip) {
        await printCashMovementSlip(
          {
            movement_type: movementType,
            amount: numAmount,
            reason: reason.trim(),
            shift_number: res?.shift?.shift_number || currentShift?.shift_number || 1
          },
          storeConfig || {}
        );
      }

      onMovementRecorded?.(res);
      onClose?.();
    } catch (err) {
      setErrorMsg(err.message || 'Chyba při ukládání pohybu');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Preset reason buttons based on active type
  const presetsForType = movementType === 'FLOAT_IN'
    ? [
        t('cash.presets.morning_float') || 'Ranní vklad',
        t('cash.presets.supplies') || 'Kancelář / Provoz'
      ]
    : movementType === 'PAYOUT'
    ? [
        t('cash.presets.bakery') || 'Pekárna / Pečivo',
        t('cash.presets.produce') || 'Zelenina / Velkoobchod',
        t('cash.presets.owner_draw') || 'Výběr majitele',
        t('cash.presets.supplies') || 'Kancelář / Provoz'
      ]
    : [
        t('cash.presets.safe_drop') || 'Odvod do trezoru'
      ];

  const typeConfig = {
    FLOAT_IN: {
      label: t('cash.float_in') || 'Vklad (Float)',
      color: 'var(--accent-emerald)',
      bg: 'rgba(16, 185, 129, 0.12)',
      border: 'rgba(16, 185, 129, 0.4)',
      icon: ArrowDownLeft,
      sign: '+'
    },
    PAYOUT: {
      label: t('cash.payout') || 'Výběr / Dodavatel',
      color: 'var(--accent-amber)',
      bg: 'rgba(245, 158, 11, 0.12)',
      border: 'rgba(245, 158, 11, 0.4)',
      icon: ArrowUpRight,
      sign: '-'
    },
    SAFE_DROP: {
      label: t('cash.safe_drop') || 'Odvod do trezoru',
      color: 'var(--accent-blue)',
      bg: 'rgba(59, 130, 246, 0.12)',
      border: 'rgba(59, 130, 246, 0.4)',
      icon: ShieldCheck,
      sign: '-'
    }
  };

  const activeCfg = typeConfig[movementType];

  return (
    <div
      className="pos-modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0.75rem'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className="pos-card-box"
        role="dialog"
        aria-modal="true"
        style={{
          width: '100%',
          maxWidth: '520px',
          maxHeight: '90dvh',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.25rem',
          borderRadius: 'var(--radius-lg, 16px)',
          background: 'var(--bg-surface, #1e293b)',
          border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          overflowY: 'auto'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-md, 10px)',
              background: activeCfg.bg,
              border: `1px solid ${activeCfg.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: activeCfg.color
            }}>
              <Banknote size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.18rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                {t('cash.drawer_movement') || 'Pohyby hotovosti (Vklad / Výběr)'}
              </h2>
              {currentShift && (
                <div style={{ fontSize: '0.80rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  Směna #{currentShift.shift_number} • {t('cash.current_balance') || 'Očekáváno'}: {parseFloat(currentShift.expected_cash || 0).toLocaleString('cs-CZ')} Kč
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              width: '40px',
              height: '40px',
              minWidth: '40px',
              minHeight: '40px',
              borderRadius: 'var(--radius-md, 10px)',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Movement Type Switcher (3 Pills) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '0.45rem',
          marginBottom: '1rem'
        }}>
          {(['FLOAT_IN', 'PAYOUT', 'SAFE_DROP']).map((typeKey) => {
            const cfg = typeConfig[typeKey];
            const isSelected = movementType === typeKey;
            const Icon = cfg.icon;
            return (
              <button
                key={typeKey}
                type="button"
                onClick={() => {
                  soundFx.playKeypadClick();
                  setMovementType(typeKey);
                }}
                style={{
                  minHeight: '44px',
                  borderRadius: 'var(--radius-md, 10px)',
                  border: isSelected ? `2px solid ${cfg.color}` : '1px solid var(--border-color)',
                  background: isSelected ? cfg.bg : 'rgba(255,255,255,0.03)',
                  color: isSelected ? cfg.color : 'var(--text-muted)',
                  fontWeight: isSelected ? '800' : '600',
                  fontSize: '0.84rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  padding: '0.4rem 0.25rem'
                }}
              >
                <Icon size={16} />
                <span>{cfg.label}</span>
              </button>
            );
          })}
        </div>

        {/* Preset Reasons Chips */}
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
            {t('cash.reason') || 'Důvod / Účel'}:
          </div>
          <div style={{
            display: 'flex',
            gap: '0.4rem',
            overflowX: 'auto',
            whiteSpace: 'nowrap',
            paddingBottom: '4px',
            flexShrink: 0
          }}>
            {presetsForType.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => handlePresetReason(chip)}
                style={{
                  minHeight: '36px',
                  padding: '0 0.75rem',
                  borderRadius: '999px',
                  border: reason === chip ? `1px solid ${activeCfg.color}` : '1px solid var(--border-color)',
                  background: reason === chip ? activeCfg.bg : 'rgba(255,255,255,0.04)',
                  color: reason === chip ? activeCfg.color : 'var(--text-secondary)',
                  fontSize: '0.82rem',
                  fontWeight: reason === chip ? '800' : '600',
                  cursor: 'pointer',
                  flexShrink: 0,
                  whiteSpace: 'nowrap'
                }}
              >
                {chip}
              </button>
            ))}
          </div>
        </div>

        {/* Reason Custom Input */}
        <div style={{ marginBottom: '0.85rem' }}>
          <input
            id={reasonInputId}
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('cash.reason_placeholder') || 'Zadejte důvod (např. Pekárna hotovost)...'}
            style={{
              width: '100%',
              minHeight: '40px',
              borderRadius: 'var(--radius-md, 8px)',
              background: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              padding: '0.45rem 0.75rem',
              fontSize: '0.88rem',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Amount Big Display */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.35)',
          border: `1px solid ${isValid ? activeCfg.color : 'var(--border-color)'}`,
          borderRadius: 'var(--radius-md, 10px)',
          padding: '0.65rem 0.95rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.65rem'
        }}>
          <span style={{ fontSize: '0.84rem', fontWeight: '700', color: 'var(--text-muted)' }}>
            {t('cash.amount') || 'Částka'}:
          </span>
          <div style={{
            fontSize: '1.65rem',
            fontWeight: '900',
            fontFamily: 'var(--font-mono)',
            color: isValid ? activeCfg.color : 'var(--text-muted)'
          }}>
            {activeCfg.sign} {amountStr ? parseFloat(amountStr).toLocaleString('cs-CZ') : '0'} Kč
          </div>
        </div>

        {/* Quick Amount Chips */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '0.35rem',
          marginBottom: '0.75rem'
        }}>
          {[100, 200, 500, 1000, 2000].map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => handleQuickAddAmount(val)}
              style={{
                minHeight: '38px',
                borderRadius: 'var(--radius-sm, 8px)',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                fontWeight: '700',
                fontSize: '0.82rem',
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)'
              }}
            >
              +{val}
            </button>
          ))}
        </div>

        {/* Compact Keypad Number Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '0.35rem',
          marginBottom: '0.85rem'
        }}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'BACK'].map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => handleKeypadPress(k === 'C' ? 'CLEAR' : k)}
              style={{
                minHeight: '44px',
                borderRadius: 'var(--radius-md, 8px)',
                background: k === 'C' || k === 'BACK' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255,255,255,0.06)',
                border: '1px solid var(--border-color)',
                color: k === 'C' ? 'var(--accent-rose, #ef4444)' : 'var(--text-primary)',
                fontSize: k === 'BACK' ? '0.88rem' : '1.12rem',
                fontWeight: '800',
                fontFamily: 'var(--font-mono)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              {k === 'BACK' ? <Delete size={18} /> : k}
            </button>
          ))}
        </div>

        {/* Print Receipt Slip Option */}
        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          marginBottom: '1rem',
          cursor: 'pointer',
          userSelect: 'none'
        }}>
          <input
            type="checkbox"
            checked={printSlip}
            onChange={(e) => setPrintSlip(e.target.checked)}
            style={{ width: '18px', height: '18px', accentColor: activeCfg.color }}
          />
          <span style={{ fontSize: '0.88rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Printer size={15} style={{ color: 'var(--text-muted)' }} />
            {t('cash.print_slip') || 'Vytisknout pokladní doklad'}
          </span>
        </label>

        {errorMsg && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid var(--accent-rose, #ef4444)',
            color: 'var(--accent-rose, #ef4444)',
            padding: '0.5rem 0.75rem',
            borderRadius: 'var(--radius-sm, 8px)',
            fontSize: '0.84rem',
            marginBottom: '0.75rem'
          }}>
            {errorMsg}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.5rem', marginTop: 'auto' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              minHeight: '48px',
              borderRadius: 'var(--radius-md, 10px)',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-muted)',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            {t('common.cancel') || 'Zrušit'}
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid || isSubmitting}
            style={{
              minHeight: '48px',
              borderRadius: 'var(--radius-md, 10px)',
              background: isValid && !isSubmitting ? activeCfg.color : 'rgba(255,255,255,0.1)',
              border: 'none',
              color: '#fff',
              fontWeight: '800',
              fontSize: '1rem',
              cursor: isValid && !isSubmitting ? 'pointer' : 'not-allowed',
              opacity: isValid && !isSubmitting ? 1 : 0.6,
              boxShadow: isValid ? `0 4px 12px ${activeCfg.color}40` : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
          >
            <Banknote size={18} />
            <span>{isSubmitting ? 'Ukládám...' : (t('cash.submit_movement') || 'Zaznamenat pohyb')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
