import React, { useState, useEffect } from 'react';
import { Lock, KeyRound, HelpCircle, RefreshCw } from 'lucide-react';
import { verifyPinBackend, verifyPukBackend } from '../api/posApi';
import voltflowLogo from '../assets/voltflow_logo_icon_nobg.png';

export default function LockScreenModal({ storeConfig, onUnlock }) {
  const [enteredPin, setEnteredPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showPukInput, setShowPukInput] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setLockoutSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setErrorMsg('');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  const handleNumClick = async (num) => {
    if (enteredPin.length >= 8 || isVerifying || showPukInput || lockoutSeconds > 0) return;
    const newPin = enteredPin + num;
    setEnteredPin(newPin);
    setErrorMsg('');

    const targetLength = storeConfig?.cashierPin?.length || 4;
    if (newPin.length === targetLength) {
      const unlocked = await verifyPin(newPin, false);
      if (!unlocked) {
        setIsShaking(true);
        setTimeout(() => {
          setIsShaking(false);
          setEnteredPin('');
        }, 500);
      }
    }
  };

  const handleUnlockSubmit = () => {
    if (enteredPin.length < 4 || isVerifying || showPukInput || lockoutSeconds > 0) return;
    verifyPin(enteredPin, false);
  };

  const handleBackspace = () => {
    if (isVerifying || showPukInput || lockoutSeconds > 0) return;
    setEnteredPin(prev => prev.slice(0, -1));
    setErrorMsg('');
  };

  const handleClear = () => {
    if (isVerifying || showPukInput || lockoutSeconds > 0) return;
    setEnteredPin('');
    setErrorMsg('');
  };

  const verifyPin = async (pinToTest, isQuiet = false) => {
    if (lockoutSeconds > 0) return false;
    setIsVerifying(true);
    try {
      const res = await verifyPinBackend(pinToTest);
      if (res.valid === true) {
        setErrorMsg('');
        setFailedAttempts(0);
        setLockoutSeconds(0);
        onUnlock();
        return true;
      }
      if (res.valid === null) {
        const localPin = storeConfig?.cashierPin || '1234';
        if (pinToTest === localPin) {
          setErrorMsg('');
          setFailedAttempts(0);
          setLockoutSeconds(0);
          onUnlock();
          return true;
        }
      }

      const newFailed = failedAttempts + 1;
      setFailedAttempts(newFailed);
      let penalty = 0;
      if (newFailed >= 8) penalty = 60;
      else if (newFailed >= 5) penalty = 30;

      if (penalty > 0) {
        setLockoutSeconds(penalty);
      } else if (!isQuiet) {
        setErrorMsg(`Nesprávný PIN kód! (${newFailed}/5 pokusů)`);
      }

      setIsShaking(true);
      setTimeout(() => {
        setIsShaking(false);
        setEnteredPin('');
      }, 500);
      return false;
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerifyPuk = async (e) => {
    e.preventDefault();
    if (!pukValue.trim() || isVerifying) return;
    setIsVerifying(true);
    setErrorMsg('');

    try {
      const res = await verifyPukBackend(pukValue.trim());
      if (res.valid) {
        setSuccessMsg('PIN byl úspěšně vyresetován na 1234!');
        setTimeout(() => {
          setShowPukInput(false);
          setSuccessMsg('');
          setEnteredPin('');
        }, 1500);
      } else {
        setErrorMsg('Neplatný záchranný klíč (PUK)!');
      }
    } catch {
      setErrorMsg('Chyba při ověřování záchranného klíče.');
    } finally {
      setIsVerifying(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (showPukInput) return;
      e.stopImmediatePropagation();

      if (/^[0-9]$/.test(e.key)) {
        handleNumClick(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape' || e.key.toLowerCase() === 'c') {
        handleClear();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (enteredPin.length >= 4 && !isVerifying) {
          verifyPin(enteredPin);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enteredPin, isVerifying, showPukInput]);

  return (
    <div className="modal-overlay" style={{ background: 'rgba(9, 13, 25, 0.96)', backdropFilter: 'blur(16px)', zIndex: 99999 }}>
      <div
        className="modal-card"
        style={{
          maxWidth: '400px',
          width: '90%',
          padding: '2rem 1.5rem',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          textAlign: 'center',
          animation: isShaking ? 'shake 0.4s ease-in-out' : 'none'
        }}
      >
        {/* Header Icon & Title */}
        <div style={{ marginBottom: '1.25rem' }}>
          <img src={voltflowLogo} alt="VoltFlow POS" style={{ width: '48px', height: '48px', margin: '0 auto 0.75rem auto', display: 'block' }} />
          <div style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-primary)' }}>
            {storeConfig?.storeName || 'VoltFlow POS'}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
            <Lock size={14} style={{ color: 'var(--accent-amber)' }} />
            <span>Pokladna je uzamčena</span>
          </div>
        </div>

        {!showPukInput ? (
          <>
            {lockoutSeconds > 0 && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '8px',
                padding: '0.75rem',
                margin: '0.75rem 0',
                color: '#ef4444',
                fontSize: '0.85rem',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}>
                <Lock size={16} />
                <span>Přístup pozastaven na {lockoutSeconds} s z důvodu opakovaných pokusů</span>
              </div>
            )}

            {/* PIN Indicator Dots */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.6rem', margin: '1.25rem 0' }}>
              {Array.from({ length: Math.max(4, Math.min(8, enteredPin.length)) }).map((_, idx) => {
                const isFilled = enteredPin.length > idx;
                return (
                  <div
                    key={idx}
                    style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      background: isFilled ? 'var(--accent-emerald)' : 'var(--bg-input)',
                      border: isFilled ? '2px solid var(--accent-emerald)' : '2px solid var(--border-color)',
                      boxShadow: isFilled ? '0 0 10px rgba(16, 185, 129, 0.5)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  />
                );
              })}
            </div>

            {errorMsg && (
              <div style={{ color: '#ef4444', fontSize: '0.82rem', fontWeight: '700', marginBottom: '0.75rem' }}>
                {errorMsg}
              </div>
            )}

            {/* Touch Keypad */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.65rem', margin: '0.5rem 0 0.75rem 0' }}>
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

            <button
              type="button"
              className="btn-primary"
              disabled={enteredPin.length < 4 || isVerifying}
              onClick={handleUnlockSubmit}
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '1rem',
                fontWeight: '800',
                marginBottom: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                justify: 'center',
                gap: '0.5rem'
              }}
            >
              <Lock size={16} />
              <span>Odemknout ↵</span>
            </button>

            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', marginBottom: '0.75rem' }}>
              <KeyRound size={13} />
              <span>Zadejte PIN kód (4–8 číslic) pro odemčení</span>
            </div>

            {/* PUK Recovery Option Toggle */}
            <button
              type="button"
              onClick={() => {
                setShowPukInput(true);
                setErrorMsg('');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '0.78rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                textDecoration: 'underline'
              }}
            >
              <HelpCircle size={13} />
              <span>Zapomněli jste PIN? Obnovit pomocí PUK klíče</span>
            </button>
          </>
        ) : (
          /* PUK Recovery Form */
          <form onSubmit={handleVerifyPuk} style={{ padding: '0.5rem 0' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              Obnova PIN pomocí PUK klíče
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: '1.4' }}>
              Zadejte záchranný klíč (PUK) dodaný s pokladním systémem nebo vygenerovaný z IČO:
            </div>

            <input
              type="text"
              placeholder="VOLTFLOW-12345678-MASTER"
              value={pukValue}
              onChange={e => setPukValue(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '0.95rem',
                fontFamily: 'monospace',
                textAlign: 'center',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                marginBottom: '0.75rem',
                textTransform: 'uppercase'
              }}
            />

            {errorMsg && (
              <div style={{ color: '#ef4444', fontSize: '0.82rem', fontWeight: '700', marginBottom: '0.75rem' }}>
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div style={{ color: 'var(--accent-emerald)', fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                <RefreshCw size={15} className="spin" />
                {successMsg}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setShowPukInput(false);
                  setPukValue('');
                  setErrorMsg('');
                }}
                style={{ flex: 1, padding: '0.65rem' }}
              >
                Zpět
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={!pukValue.trim() || isVerifying}
                style={{ flex: 1, padding: '0.65rem' }}
              >
                Resetovat PIN
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
