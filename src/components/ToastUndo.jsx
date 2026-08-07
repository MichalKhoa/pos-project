import React, { useEffect, useState } from 'react';
import { RotateCcw, X, PlusCircle, Trash2 } from 'lucide-react';

export default function ToastUndo({ undoToast, onUndo, onDismiss }) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!undoToast) return;

    setProgress(100);
    const startTime = Date.now();
    const duration = 4000;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [undoToast]);

  if (!undoToast) return null;

  const isAdd = undoToast.type === 'ADD';

  return (
    <div className="undo-toast-wrapper">
      <div className={`undo-toast-card ${isAdd ? 'toast-add' : 'toast-remove'}`}>
        <div className="toast-icon">
          {isAdd ? <PlusCircle size={20} /> : <Trash2 size={20} />}
        </div>

        <div className="toast-content">
          <span className="toast-action-label">
            {isAdd ? 'Přidáno:' : 'Smazáno:'}
          </span>
          <span className="toast-item-name">{undoToast.itemName}</span>
        </div>

        <button type="button" className="toast-undo-btn" onClick={onUndo}>
          <RotateCcw size={15} />
          <span>ZPĚT</span>
        </button>

        <button type="button" className="toast-dismiss-btn" onClick={onDismiss} title="Zavřít">
          <X size={16} />
        </button>

        {/* Progress Bar */}
        <div className="toast-progress-container">
          <div
            className="toast-progress-bar"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
