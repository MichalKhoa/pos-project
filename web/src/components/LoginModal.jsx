import React, { useState } from 'react';
import { Lock, User, KeyRound, ShieldCheck, AlertCircle, Loader2, X, Play } from 'lucide-react';
import { cloudApi } from '../api/cloudApi';

/**
 * LoginModal - Management credentials modal for VoltFlow POS Cloud Dashboard.
 * Supports Username, Password, and optional TOTP 2FA code.
 *
 * @param {Object} props
 * @param {boolean} [props.isOpen=true] - Visibility toggle
 * @param {() => void} [props.onSuccess] - Callback fired on successful login
 */
export default function LoginModal({ isOpen = true, onSuccess, onClose }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [totpCode, setTotpCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please provide both username and password.');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const res = await cloudApi.login({
        username: username.trim(),
        password,
        totp_code: totpCode.trim() || undefined,
      });

      if (onSuccess) {
        onSuccess(res);
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setUsername('admin');
    setPassword('admin123');
    setError('');
    setIsLoading(true);

    try {
      const res = await cloudApi.login({
        username: 'admin',
        password: 'admin123',
      });
      if (onSuccess) {
        onSuccess(res);
      }
    } catch (err) {
      setError(err.message || 'Demo login failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBypass = () => {
    cloudApi.bypassAuth();
    if (onSuccess) {
      onSuccess({ access_token: 'bypass', token_type: 'bearer' });
    }
    if (onClose) {
      onClose();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--color-surface, #ffffff)',
          borderRadius: '16px',
          padding: '2rem',
          width: '100%',
          maxWidth: '400px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          border: '1px solid var(--color-border, #e2e8f0)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                backgroundColor: 'rgba(0, 82, 204, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-primary, #0052cc)',
                flexShrink: 0,
              }}
            >
              <ShieldCheck size={26} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--color-text, #0f172a)' }}>
                VoltFlow Cloud
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary, #64748b)', margin: 0 }}>
                Management Sign-in
              </p>
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Zavřít"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#64748b',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '6px',
              }}
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Error Notification */}
        {error && (
          <div
            style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Username */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label
              htmlFor="voltflow-login-username"
              style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text, #334155)' }}
            >
              Username
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <User
                size={18}
                style={{
                  position: 'absolute',
                  left: '12px',
                  color: 'var(--color-text-secondary, #94a3b8)',
                  pointerEvents: 'none',
                }}
              />
              <input
                id="voltflow-login-username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                disabled={isLoading}
                style={{
                  width: '100%',
                  minHeight: '44px',
                  padding: '0.65rem 1rem 0.65rem 2.5rem',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border, #cbd5e1)',
                  fontSize: '0.95rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  backgroundColor: isLoading ? '#f8fafc' : '#ffffff',
                }}
              />
            </div>
          </div>

          {/* Password */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label
              htmlFor="voltflow-login-password"
              style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text, #334155)' }}
            >
              Password
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Lock
                size={18}
                style={{
                  position: 'absolute',
                  left: '12px',
                  color: 'var(--color-text-secondary, #94a3b8)',
                  pointerEvents: 'none',
                }}
              />
              <input
                id="voltflow-login-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isLoading}
                style={{
                  width: '100%',
                  minHeight: '44px',
                  padding: '0.65rem 1rem 0.65rem 2.5rem',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border, #cbd5e1)',
                  fontSize: '0.95rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  backgroundColor: isLoading ? '#f8fafc' : '#ffffff',
                }}
              />
            </div>
          </div>

          {/* TOTP 2FA Code */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label
              htmlFor="voltflow-login-totp"
              style={{
                fontSize: '0.85rem',
                fontWeight: 600,
                color: 'var(--color-text, #334155)',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>TOTP Code</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--color-text-secondary, #64748b)' }}>
                Optional
              </span>
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <KeyRound
                size={18}
                style={{
                  position: 'absolute',
                  left: '12px',
                  color: 'var(--color-text-secondary, #94a3b8)',
                  pointerEvents: 'none',
                }}
              />
              <input
                id="voltflow-login-totp"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                placeholder="6-digit code"
                disabled={isLoading}
                style={{
                  width: '100%',
                  minHeight: '44px',
                  padding: '0.65rem 1rem 0.65rem 2.5rem',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border, #cbd5e1)',
                  fontSize: '0.95rem',
                  letterSpacing: '0.15em',
                  fontFamily: 'monospace',
                  outline: 'none',
                  boxSizing: 'border-box',
                  backgroundColor: isLoading ? '#f8fafc' : '#ffffff',
                }}
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            style={{
              marginTop: '0.5rem',
              minHeight: '44px',
              backgroundColor: 'var(--color-primary, #0052cc)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.95rem',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.75 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              transition: 'background-color 0.15s ease',
            }}
          >
            {isLoading ? (
              <>
                <Loader2
                  size={18}
                  style={{
                    animation: 'spin 1s linear infinite',
                  }}
                />
                <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                <span>Signing in...</span>
              </>
            ) : (
              <span>Sign In</span>
            )}
          </button>

          {/* Quick Demo Login */}
          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={isLoading}
            style={{
              minHeight: '40px',
              backgroundColor: '#eff6ff',
              color: '#1d4ed8',
              border: '1px solid #bfdbfe',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
            }}
          >
            <Play size={16} />
            <span>Rychlé přihlášení (admin / admin123)</span>
          </button>

          {/* Bypass Button */}
          <button
            type="button"
            onClick={handleBypass}
            disabled={isLoading}
            style={{
              minHeight: '38px',
              backgroundColor: 'transparent',
              color: '#64748b',
              border: '1px dashed #cbd5e1',
              borderRadius: '8px',
              fontWeight: 500,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
            }}
          >
            <span>Pokračovat bez přihlášení (Režim prohlížení)</span>
          </button>
        </form>
      </div>
    </div>
  );
}
