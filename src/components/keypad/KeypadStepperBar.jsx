import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext.jsx';
import { stepQty } from '../../utils/keypadInput.js';

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
    setItemMultiplier(prev => stepQty(prev, -1));
  };

  const handleStepUp = () => {
    if (triggerKeyAnimation) triggerKeyAnimation('STEP_UP');
    if (!setItemMultiplier) return;
    setItemMultiplier(prev => stepQty(prev, 1));
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
        className={`key-btn key-step-down ${activeKey === 'STEP_DOWN' ? 'active-press' : ''}`}
        onClick={handleStepDown}
        aria-label={t('keypad.step_down_label')}
        title={t('keypad.step_down_title')}
        style={{
          flex: 1,
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
          fontSize: '1.18rem',
          letterSpacing: '0.02em',
          padding: '0 0.5rem',
          borderRadius: 'var(--radius-md)'
        }}
      >
        {itemMultiplier}×
      </div>

      {/* Step Up Button (+1) */}
      <button
        type="button"
        className={`key-btn key-step-up ${activeKey === 'STEP_UP' ? 'active-press' : ''}`}
        onClick={handleStepUp}
        aria-label={t('keypad.step_up_label')}
        title={t('keypad.step_up_label')}
        style={{
          flex: 1,
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
