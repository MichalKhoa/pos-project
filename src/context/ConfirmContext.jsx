import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '../i18n/LanguageContext.jsx';
import { ConfirmContext } from './useConfirm.js';

export function ConfirmProvider({ children }) {
  const { t } = useTranslation();
  const [dialog, setDialog] = useState(null);
  const [typed, setTyped] = useState('');
  const queue = useRef(Promise.resolve());

  // One dialog at a time: a second request waits until the first is answered.
  const open = useCallback((spec) => {
    const run = () =>
      new Promise((resolve) => {
        setTyped('');
        setDialog({ ...spec, resolve });
      });
    const result = queue.current.then(run);
    queue.current = result.catch(() => {});
    return result;
  }, []);

  const api = useMemo(
    () => ({
      askConfirm: (opts) => open({ kind: 'confirm', ...(typeof opts === 'string' ? { message: opts } : opts) }),
      notify: (message) => open({ kind: 'notify', message })
    }),
    [open]
  );

  const answer = useCallback((value) => {
    setDialog((current) => {
      if (current) current.resolve(value);
      return null;
    });
  }, []);

  useEffect(() => {
    if (!dialog) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        answer(dialog.kind === 'confirm' ? false : undefined);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [dialog, answer]);

  const needsWord = dialog?.kind === 'confirm' && dialog.typeWord;
  const wordOk = !needsWord || typed.trim().toLowerCase() === dialog.typeWord.toLowerCase();

  return (
    <ConfirmContext.Provider value={api}>
      {children}
      {dialog && (
        <div className="modal-overlay" style={{ zIndex: 5000 }} onClick={() => answer(dialog.kind === 'confirm' ? false : undefined)}>
          <div
            className="modal-card"
            role="alertdialog"
            aria-modal="true"
            aria-label={dialog.title || t('dialogs.title')}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '480px', padding: '1.5rem' }}
          >
            <h3 style={{ margin: '0 0 0.75rem', fontSize: '1.15rem' }}>{dialog.title || t('dialogs.title')}</h3>
            <p style={{ margin: '0 0 1.25rem', fontSize: '1rem', lineHeight: 1.45 }}>{dialog.message}</p>
            {needsWord && (
              <label style={{ display: 'block', marginBottom: '1.25rem' }}>
                <span style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                  {t('dialogs.type_word_hint', { word: dialog.typeWord })}
                </span>
                <input
                  type="text"
                  value={typed}
                  autoFocus
                  autoComplete="off"
                  onChange={(e) => setTyped(e.target.value)}
                  style={{ width: '100%', minHeight: '48px', fontSize: '1.1rem', padding: '0 0.75rem' }}
                />
              </label>
            )}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              {dialog.kind === 'confirm' && (
                <button type="button" className="btn-secondary" style={{ minHeight: '52px', minWidth: '120px', fontSize: '1rem' }} onClick={() => answer(false)}>
                  {t('common.cancel')}
                </button>
              )}
              <button
                type="button"
                className={dialog.danger ? 'btn-danger' : 'btn-primary'}
                style={{
                  minHeight: '52px',
                  minWidth: '120px',
                  fontSize: '1rem',
                  fontWeight: 800,
                  ...(dialog.danger ? { background: 'var(--accent-red, #ef4444)', color: '#fff', border: 'none' } : {})
                }}
                disabled={!wordOk}
                autoFocus={!needsWord}
                onClick={() => answer(dialog.kind === 'confirm' ? true : undefined)}
              >
                {dialog.confirmLabel || (dialog.kind === 'confirm' ? t('dialogs.confirm') : t('dialogs.ok'))}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
