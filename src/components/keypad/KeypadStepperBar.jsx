import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext.jsx';

export default function KeypadStepperBar({
  itemMultiplier = 1,
  setItemMultiplier,
  triggerKeyAnimation,
  activeKey
}) {
  const { t } = useTranslation();
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
        aria-label={t('keypad.step_down_label')}
        title={t('keypad.step_down_title')}
        style={{
          flex: 1,
          height: '42px',
          minHeight: '42px',
          aspectRatio: 'auto',
          fontSize: '1.08rem',
          fontWeight: '700',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.35rem',
          borderRadius: 'var(--radius-md)',
          cursor: 'pointer'
        }}
      >
        <ChevronDown size={19} strokeWidth={2.5} />
        <span>-1</span>
      </button>

      {/* Center Static Multiplier Display Badge */}
      <div
        className={`multiplier-badge ${isReturn ? 'has-return' : (itemMultiplier > 1 ? 'has-multiplier' : '')}`}
        style={{
          flex: 1,
          height: '42px',
          minHeight: '42px',
          aspectRatio: 'auto',
          fontSize: '1.18rem',
          letterSpacing: '0.02em',
          padding: '0 0.5rem',
          borderRadius: 'var(--radius-md)'
        }}
      >
        {isReturn ? `↩️ ${itemMultiplier}×` : `${itemMultiplier}×`}
      </div>

      {/* Step Up Button (+1) */}
      <button
        type="button"
        className={`key-btn ${activeKey === 'STEP_UP' ? 'active-press' : ''}`}
        onClick={handleStepUp}
        aria-label={t('keypad.step_up_label')}
        title={t('keypad.step_up_label')}
        style={{
          flex: 1,
          height: '42px',
          minHeight: '42px',
          aspectRatio: 'auto',
          fontSize: '1.08rem',
          fontWeight: '700',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.35rem',
          borderRadius: 'var(--radius-md)',
          cursor: 'pointer'
        }}
      >
        <ChevronUp size={19} strokeWidth={2.5} />
        <span>+1</span>
      </button>
    </div>
  );
}
