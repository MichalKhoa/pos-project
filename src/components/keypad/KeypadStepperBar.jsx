import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

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
      {/* Step Down Button (−1) */}
      <button
        type="button"
        className={`key-btn ${activeKey === 'STEP_DOWN' ? 'active-press' : ''}`}
        onClick={handleStepDown}
        aria-label="Snížit množství (-1)"
        title="Snížit množství (−1 / Vratka)"
        style={{
          flex: 1.3,
          height: '42px',
          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
          color: '#ffffff',
          border: 'none',
          fontSize: '0.95rem',
          fontWeight: '900',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.35rem',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 2px 6px rgba(239, 68, 68, 0.35)',
          cursor: 'pointer'
        }}
      >
        <ChevronDown size={20} strokeWidth={2.5} />
        <span>-1</span>
      </button>

      {/* Center Static Multiplier Display Badge */}
      <div
        className={`multiplier-badge ${isReturn ? 'has-return' : (itemMultiplier > 1 ? 'has-multiplier' : '')}`}
        style={{
          flex: 0.8,
          height: '42px',
          fontSize: '1rem',
          letterSpacing: '0.02em',
          padding: '0 0.25rem'
        }}
      >
        {isReturn ? `↩️ ${itemMultiplier}×` : `${itemMultiplier}×`}
      </div>

      {/* Step Up Button (+1) */}
      <button
        type="button"
        className={`key-btn ${activeKey === 'STEP_UP' ? 'active-press' : ''}`}
        onClick={handleStepUp}
        aria-label="Zvýšit množství (+1)"
        title="Zvýšit množství (+1)"
        style={{
          flex: 1.3,
          height: '42px',
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          color: '#ffffff',
          border: 'none',
          fontSize: '0.95rem',
          fontWeight: '900',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.35rem',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 2px 6px rgba(16, 185, 129, 0.35)',
          cursor: 'pointer'
        }}
      >
        <ChevronUp size={20} strokeWidth={2.5} />
        <span>+1</span>
      </button>
    </div>
  );
}
