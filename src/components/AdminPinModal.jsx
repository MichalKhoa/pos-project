import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, X, Check } from 'lucide-react';
import { verifyPinBackend, verifyAdminPinBackend } from '../api/posApi';
import voltflowLogo from '../assets/voltflow_logo_icon_nobg.png';

export default function AdminPinModal({
  mode = 'VERIFY', // 'VERIFY' | 'CHANGE_PIN'
  storeConfig,
  onSuccess,
  onClose
}) {
  const [step, setStep] = useState(mode === 'CHANGE_PIN' ? 'CURRENT_PIN' : 'VERIFY_PIN');
  const [enteredPin, setEnteredPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const activePin = step === 'CONFIRM_PIN' ? confirmPin : step === 'NEW_PIN' ? newPin : enteredPin;

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
  };

  const verifyEnteredPin = useCallback(async (pinToTest) => {
    setIsVerifying(true);
    try {
      let isValid = false;
      // Try admin pin endpoint first
      try {
        const adminRes = await verifyAdminPinBackend(pinToTest);
        if (adminRes?.valid === true) {
          isValid = true;
        }
      } catch {
        // continue to standard check
      }

      if (!isValid) {
        const res = await verifyPinBackend(pinToTest);
        if (res?.valid === true) {
          isValid = true;
        } else if (res?.valid === null) {
          const localPin = storeConfig?.adminPin || storeConfig?.cashierPin || '1234';
          isValid = pinToTest === localPin;
        }
      }

      if (isValid) {
        setErrorMsg('');
        if (step === 'CURRENT_PIN') {
          setStep('NEW_PIN');
        } else {
          if (onSuccess) onSuccess(pinToTest);
        }
      } else {
        setErrorMsg('Nesprávný Admin PIN kód!');
        triggerShake();
        setEnteredPin('');
      }
    } catch {
      setErrorMsg('Chyba při ověřování PIN kódu.');
      triggerShake();
      setEnteredPin('');
    } finally {
      setIsVerifying(false);
    }
  }, [step, storeConfig?.adminPin, storeConfig?.cashierPin, onSuccess]);

  const finalizePinChange = useCallback((confirmed) => {
    if (confirmed !== newPin) {
      setErrorMsg('PIN kódy se neshodují!');
      triggerShake();
      setConfirmPin('');
      return;
    }
    setSuccessMsg('Admin PIN kód byl úspěšně změněn!');
    setTimeout(() => {
      if (onSuccess) onSuccess(newPin);
    }, 1200);
  }, [newPin, onSuccess]);

  const handleNumClick = useCallback((num) => {
    if (activePin.length >= 8 || isVerifying) return;
    setErrorMsg('');

    if (step === 'VERIFY_PIN' || step === 'CURRENT_PIN') {
      const next = enteredPin + num;
      setEnteredPin(next);
      const targetLen = storeConfig?.cashierPin?.length || 4;
      if (next.length === targetLen) {
        verifyEnteredPin(next);
      }
    } else if (step === 'NEW_PIN') {
      setNewPin(prev => prev + num);
    } else if (step === 'CONFIRM_PIN') {
      const next = confirmPin + num;
      setConfirmPin(next);
      if (next.length === newPin.length) {
        finalizePinChange(next);
      }
    }
  }, [activePin.length, isVerifying, step, enteredPin, storeConfig?.cashierPin, verifyEnteredPin, confirmPin, newPin.length, finalizePinChange]);

  const handleBackspace = useCallback(() => {
    if (isVerifying) return;
    setErrorMsg('');
    if (step === 'VERIFY_PIN' || step === 'CURRENT_PIN') {
      setEnteredPin(prev => prev.slice(0, -1));
    } else if (step === 'NEW_PIN') {
      setNewPin(prev => prev.slice(0, -1));
    } else if (step === 'CONFIRM_PIN') {
      setConfirmPin(prev => prev.slice(0, -1));
    }
  }, [isVerifying, step]);

  const handleClear = useCallback(() => {
    if (isVerifying) return;
    setErrorMsg('');
    if (step === 'VERIFY_PIN' || step === 'CURRENT_PIN') {
      setEnteredPin('');
    } else if (step === 'NEW_PIN') {
      setNewPin('');
    } else if (step === 'CONFIRM_PIN') {
      setConfirmPin('');
    }
  }, [isVerifying, step]);

  const handleNextStep = useCallback(() => {
    if (step === 'NEW_PIN') {
      if (newPin.length < 4 || newPin.length > 8) {
        setErrorMsg('PIN musí mít 4 až 8 číslic.');
        triggerShake();
        return;
      }
      setStep('CONFIRM_PIN');
    } else if (step === 'CONFIRM_PIN') {
      finalizePinChange(confirmPin);
    } else {
      verifyEnteredPin(enteredPin);
    }
  }, [step, newPin.length, finalizePinChange, confirmPin, verifyEnteredPin, enteredPin]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      e.stopImmediatePropagation();
      if (/^[0-9]$/.test(e.key)) {
        handleNumClick(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape' || e.key.toLowerCase() === 'c') {
        handleClear();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleNextStep();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [handleNumClick, handleBackspace, handleClear, handleNextStep]);

  const getStepTitle = () => {
    if (step === 'VERIFY_PIN') return 'Ověření Admin PIN';
    if (step === 'CURRENT_PIN') return 'Zadejte současný Admin PIN';
    if (step === 'NEW_PIN') return 'Zadejte nový Admin PIN (4–8 číslic)';
    if (step === 'CONFIRM_PIN') return 'Potvrďte nový Admin PIN';
    return 'Admin PIN';
  };

  return (
    <div className="modal-overlay" style={{ background: 'rgba(9, 13, 25, 0.94)', backdropFilter: 'blur(12px)', zIndex: 99999 }}>
      <div
        className="modal-card"
        style={{
          maxWidth: '400px',
          width: '92%',
          padding: '1.75rem 1.5rem',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          textAlign: 'center',
          animation: isShaking ? 'shake 0.4s ease-in-out' : 'none',
          position: 'relative'
        }}
      >
        <button
          type="button"
          className="toast-dismiss-btn"
          onClick={onClose}
          style={{ position: 'absolute', top: '1rem', right: '1rem' }}
        >
          <X size={20} />
        </button>

        <div style={{ marginBottom: '1.25rem' }}>
          <img src={voltflowLogo} alt="VoltFlow POS" style={{ width: '44px', height: '44px', margin: '0 auto 0.5rem auto', display: 'block' }} />
          <div style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-primary)' }}>
            {getStepTitle()}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
            <ShieldCheck size={14} style={{ color: 'var(--accent-amber)' }} />
            <span>Bezpečnostní štít Správce</span>
          </div>
        </div>

        {/* PIN Indicator Dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.6rem', margin: '1.25rem 0' }}>
          {Array.from({ length: Math.max(4, activePin.length) }).map((_, idx) => {
            const isFilled = activePin.length > idx;
            return (
              <div
                key={idx}
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: isFilled ? 'var(--accent-blue)' : 'var(--bg-input)',
                  border: isFilled ? '2px solid var(--accent-blue)' : '2px solid var(--border-color)',
                  boxShadow: isFilled ? '0 0 10px rgba(37, 99, 235, 0.5)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              />
            );
          })}
        </div>

        {errorMsg && (
          <div style={{ color: 'var(--accent-rose)', fontSize: '0.84rem', fontWeight: '700', marginBottom: '0.75rem' }}>
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div style={{ color: 'var(--accent-emerald)', fontSize: '0.88rem', fontWeight: '800', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
            <Check size={16} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Touch Keypad */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.65rem', margin: '0.5rem 0 1rem 0' }}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
            <button
              key={num}
              type="button"
              className="key-btn"
              style={{ height: '66px', fontSize: '1.5rem', fontWeight: '900' }}
              onClick={() => handleNumClick(num)}
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            className="key-btn key-action"
            style={{ height: '66px', fontSize: '1.15rem', fontWeight: '800' }}
            onClick={handleClear}
          >
            C
          </button>
          <button
            type="button"
            className="key-btn"
            style={{ height: '66px', fontSize: '1.5rem', fontWeight: '900' }}
            onClick={() => handleNumClick('0')}
          >
            0
          </button>
          <button
            type="button"
            className="key-btn key-action"
            style={{ height: '66px', fontSize: '1.3rem', fontWeight: '800' }}
            onClick={handleBackspace}
          >
            ⌫
          </button>
        </div>

        {step === 'NEW_PIN' && (
          <button
            type="button"
            className="btn-primary"
            disabled={newPin.length < 4}
            onClick={handleNextStep}
            style={{ width: '100%', padding: '0.75rem', fontSize: '0.95rem', fontWeight: '800' }}
          >
            Pokračovat na potvrdit ↵
          </button>
        )}
      </div>
    </div>
  );
}
