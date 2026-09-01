import React from 'react';
import { ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';

export default function KeypadStepperBar({
  itemMultiplier = 1,
  setItemMultiplier,
  triggerKeyAnimation,
  activeKey
}) {
  const isReturn = itemMultiplier < 0;

  const handleStepDown = () => {
    if (triggerKeyAnimation) triggerKeyAnimation('STEP_DOWN');
    if (!setItemMultiplier) return;
    setItemMultiplier(prev => {
      const current = prev || 1;
      if (current === 1) return -1; // 1 -> -1 (activate return)
      if (current > 1) return current - 1; // 3 -> 2 -> 1
      return current - 1; // -1 -> -2 -> -3
    });
  };

  const handleStepUp = () => {
    if (triggerKeyAnimation) triggerKeyAnimation('STEP_UP');
    if (!setItemMultiplier) return;
    setItemMultiplier(prev => {
      const current = prev || 1;
      if (current === -1) return 1; // -1 -> 1 (exit return)
      if (current < -1) return current + 1; // -3 -> -2 -> -1
      return current + 1; // 1 -> 2 -> 3
    });
  };

  const handleReset = () => {
    if (triggerKeyAnimation) triggerKeyAnimation('STEP_RESET');
    if (setItemMultiplier) setItemMultiplier(1);
  };

  return (
    <div
      className="keypad-stepper-bar"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        width: '100%',
        boxSizing: 'border-box'
      }}
    >
      {/* Step Down Button (-1 ks / Vratka) */}
      <button
        type="button"
        className={`key-btn ${activeKey === 'STEP_DOWN' ? 'active-press' : ''}`}
        onClick={handleStepDown}
        style={{
          flex: 1,
          height: '42px',
          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
          color: '#ffffff',
          border: 'none',
          fontSize: '0.88rem',
          fontWeight: '900',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.3rem',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 2px 6px rgba(239, 68, 68, 0.35)',
          cursor: 'pointer'
        }}
        title="Snížit množství (-1 ks / Vratka)"
      >
        <ChevronDown size={18} strokeWidth={2.5} />
        <span>-1 ks</span>
      </button>

      {/* Center Multiplier Display / Reset Pill */}
      <button
        type="button"
        className={`key-btn ${activeKey === 'STEP_RESET' ? 'active-press' : ''}`}
        onClick={handleReset}
        style={{
          flex: 1.2,
          height: '42px',
          background: isReturn
            ? 'rgba(239, 68, 68, 0.15)'
            : (itemMultiplier > 1 ? 'rgba(245, 158, 11, 0.15)' : 'var(--bg-input)'),
          border: isReturn
            ? '1.5px solid rgba(239, 68, 68, 0.5)'
            : (itemMultiplier > 1 ? '1.5px solid rgba(245, 158, 11, 0.5)' : '1px solid var(--border-color)'),
          color: isReturn
            ? 'var(--accent-rose)'
            : (itemMultiplier > 1 ? 'var(--accent-amber)' : 'var(--text-primary)'),
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.35rem',
          fontSize: '0.85rem',
          fontWeight: '900',
          cursor: 'pointer'
        }}
        title="Kliknutím resetujete na 1 ks"
      >
        {isReturn ? (
          <>
            <span style={{ fontSize: '0.78rem' }}>↩️ VRATKA</span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>{itemMultiplier}×</span>
          </>
        ) : (
          <>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Množství:</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.95rem' }}>{itemMultiplier}×</span>
            {itemMultiplier !== 1 && <RotateCcw size={12} style={{ opacity: 0.7 }} />}
          </>
        )}
      </button>

      {/* Step Up Button (+1 ks) */}
      <button
        type="button"
        className={`key-btn ${activeKey === 'STEP_UP' ? 'active-press' : ''}`}
        onClick={handleStepUp}
        style={{
          flex: 1,
          height: '42px',
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          color: '#ffffff',
          border: 'none',
          fontSize: '0.88rem',
          fontWeight: '900',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.3rem',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 2px 6px rgba(16, 185, 129, 0.35)',
          cursor: 'pointer'
        }}
        title="Zvýšit množství (+1 ks)"
      >
        <ChevronUp size={18} strokeWidth={2.5} />
        <span>+1 ks</span>
      </button>
    </div>
  );
}
