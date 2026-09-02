import React from 'react';
import { ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';

export default function KeypadStepperBar({
  itemMultiplier = 1,
  setItemMultiplier,
  triggerKeyAnimation,
  activeKey
}) {
  const isAtMin = itemMultiplier <= 1;

  const handleStepDown = () => {
    if (isAtMin) return;
    if (triggerKeyAnimation) triggerKeyAnimation('STEP_DOWN');
    if (!setItemMultiplier) return;
    setItemMultiplier(prev => Math.max(1, (prev || 1) - 1));
  };

  const handleStepUp = () => {
    if (triggerKeyAnimation) triggerKeyAnimation('STEP_UP');
    if (!setItemMultiplier) return;
    setItemMultiplier(prev => Math.min(999, (prev || 1) + 1));
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
      {/* Step Down Button (-1 ks) */}
      <button
        type="button"
        className={`key-btn ${activeKey === 'STEP_DOWN' ? 'active-press' : ''}`}
        onClick={handleStepDown}
        disabled={isAtMin}
        style={{
          flex: 1,
          height: '42px',
          background: isAtMin ? 'var(--bg-card-hover, rgba(255,255,255,0.05))' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
          color: isAtMin ? 'var(--text-muted)' : '#ffffff',
          border: isAtMin ? '1px solid var(--border-color)' : 'none',
          fontSize: '0.88rem',
          fontWeight: '900',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.3rem',
          borderRadius: 'var(--radius-md)',
          boxShadow: isAtMin ? 'none' : '0 2px 6px rgba(239, 68, 68, 0.35)',
          cursor: isAtMin ? 'not-allowed' : 'pointer',
          opacity: isAtMin ? 0.6 : 1
        }}
        title="Snížit množství (-1 ks)"
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
          background: itemMultiplier > 1 ? 'rgba(245, 158, 11, 0.15)' : 'var(--bg-input)',
          border: itemMultiplier > 1 ? '1.5px solid rgba(245, 158, 11, 0.5)' : '1px solid var(--border-color)',
          color: itemMultiplier > 1 ? 'var(--accent-amber)' : 'var(--text-primary)',
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
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Množství:</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.95rem' }}>{itemMultiplier}×</span>
        {itemMultiplier !== 1 && <RotateCcw size={12} style={{ opacity: 0.7 }} />}
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
