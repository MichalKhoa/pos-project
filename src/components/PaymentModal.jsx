import React, { useState, useEffect } from 'react';
import { Banknote, CreditCard, QrCode, Split } from 'lucide-react';
import CashDrawerIcon from './CashDrawerIcon';
import { fetchTerminalConfig, payWithTerminal, broadcastCustomerDisplay } from '../api/posApi';
import { useTranslation } from '../i18n/LanguageContext.jsx';
import { soundFx } from '../utils/audio.js';
import CashPaymentPanel from './payment/CashPaymentPanel.jsx';
import CardPaymentPanel from './payment/CardPaymentPanel.jsx';
import QrPaymentPanel from './payment/QrPaymentPanel.jsx';
import SplitPaymentPanel from './payment/SplitPaymentPanel.jsx';

export default function PaymentModal({
  method,
  initialMethod,
  totalAmount,
  storeConfig,
  onClose,
  onCompleteSale,
  onOpenCashDrawer = null
}) {
  const { t } = useTranslation();
  const [tenderedStr, setTenderedStr] = useState('0');
  const [activeMethod, setActiveMethod] = useState(initialMethod || method || 'cash');

  // Terminal state
  const [termConfig, setTermConfig] = useState(null);
  const [termLoading, setTermLoading] = useState(false);
  const [termResult, setTermResult] = useState(null);

  useEffect(() => {
    fetchTerminalConfig().then(cfg => {
      if (cfg) setTermConfig(cfg);
    });
  }, []);

  // Broadcast PAYMENT_PENDING on mount and method change
  useEffect(() => {
    broadcastCustomerDisplay({
      type: 'PAYMENT_PENDING',
      totalAmount
    });
  }, [totalAmount]);

  useEffect(() => {
    if (activeMethod === 'qr') {
      const vs = `${new Date().getFullYear()}${Math.floor(1000 + Math.random() * 9000)}`;
      const rawIban = (storeConfig?.bankAccountIban || storeConfig?.bank_account_iban || storeConfig?.merchant_iban || '').replace(/\s/g, '').toUpperCase();
      const iban = (rawIban && rawIban !== 'CZ6508000000001234567890') ? rawIban : '';
      broadcastCustomerDisplay({
        type: 'PAYMENT_PENDING',
        totalAmount,
        payment: {
          method: 'QR_CODE',
          vs,
          iban
        }
      });
    }
  }, [activeMethod, totalAmount, storeConfig]);

  // Split payment state
  const [splitCashStr, setSplitCashStr] = useState('0');
  const [splitStep, setSplitStep] = useState(1);

  const isRefund = totalAmount < 0;
  const absTotal = Math.abs(totalAmount);
  const effectiveCashTotal = Math.round(absTotal);

  useEffect(() => {
    setTenderedStr(isRefund ? Math.round(Math.abs(totalAmount)).toString() : '0');
    setSplitCashStr('0');
    setSplitStep(1);
  }, [totalAmount, isRefund]);

  const tenderedVal = parseFloat(tenderedStr) || 0;
  const changeDue = isRefund ? 0 : (activeMethod === 'cash' ? (tenderedVal - effectiveCashTotal) : (tenderedVal - totalAmount));

  const splitCashVal = parseFloat(splitCashStr) || 0;
  const splitCardVal = Math.max(0, absTotal - splitCashVal);

  const handleCashAdd = (val) => {
    if (val === 'exact') {
      setTenderedStr(effectiveCashTotal.toString());
      return;
    }
    if (val === 'clear') {
      setTenderedStr('0');
      return;
    }

    const current = parseFloat(tenderedStr) || 0;
    if (current === 0) {
      setTenderedStr(val.toString());
    } else {
      setTenderedStr((current + val).toString());
    }
  };

  const handleCashSet = (val) => {
    setTenderedStr(val.toString());
  };

  const handleNumpadKey = (digit) => {
    if (digit === 'CLEAR') {
      setTenderedStr('0');
      return;
    }
    if (digit === 'BACK') {
      setTenderedStr(prev => (prev.length > 1 ? prev.slice(0, -1) : '0'));
      return;
    }
    if (digit === '.' || digit === ',') {
      if (tenderedStr.includes('.')) return;
      setTenderedStr(prev => prev + '.');
      return;
    }

    setTenderedStr(prev => (prev === '0' ? digit : prev + digit));
  };

  const handleSplitNumpadKey = (digit) => {
    if (digit === 'CLEAR') {
      setSplitCashStr('0');
      return;
    }
    if (digit === 'BACK') {
      setSplitCashStr(prev => (prev.length > 1 ? prev.slice(0, -1) : '0'));
      return;
    }
    if (digit === '.' || digit === ',') {
      if (splitCashStr.includes('.')) return;
      setSplitCashStr(prev => prev + '.');
      return;
    }

    setSplitCashStr(prev => (prev === '0' || prev === '' ? digit : prev + digit));
  };

  // Keyboard listener for physical numpad
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (activeMethod === 'cash') {
          if (tenderedVal === 0 || changeDue >= 0) handleComplete();
        } else {
          handleComplete();
        }
        return;
      }

      if (activeMethod === 'cash') {
        if (/^[0-9]$/.test(e.key)) handleNumpadKey(e.key);
        else if (e.key === 'Backspace') handleNumpadKey('BACK');
        else if (e.key === 'Escape' || e.key.toLowerCase() === 'c') handleNumpadKey('CLEAR');
      } else if (activeMethod === 'split') {
        if (/^[0-9]$/.test(e.key)) handleSplitNumpadKey(e.key);
        else if (e.key === 'Backspace') handleSplitNumpadKey('BACK');
        else if (e.key === 'Escape' || e.key.toLowerCase() === 'c') handleSplitNumpadKey('CLEAR');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMethod, tenderedStr, tenderedVal, splitCashStr, changeDue, totalAmount, effectiveCashTotal]);

  const handleComplete = () => {
    if (activeMethod === 'cash') {
      if (tenderedVal > 0 && changeDue < 0) return;
      const finalTendered = tenderedVal === 0 ? effectiveCashTotal : tenderedVal;
      const finalChange = tenderedVal === 0 ? 0 : (changeDue > 0 ? changeDue : 0);
      onCompleteSale({
        method: 'cash',
        tendered: finalTendered,
        change: finalChange
      });
      return;
    }

    let payDetails = {
      method: activeMethod,
      tendered: totalAmount,
      change: 0
    };

    if (activeMethod === 'split') {
      payDetails = {
        method: 'split',
        tendered: totalAmount,
        change: 0,
        splitDetails: {
          cash: splitCashVal,
          card: splitCardVal
        }
      };
    }

    if (termResult && termResult.success) {
      payDetails.cardAuthCode = termResult.auth_code;
      payDetails.cardMask = termResult.card_mask;
    }

    onCompleteSale(payDetails);
  };

  const handleTerminalPay = async () => {
    setTermLoading(true);
    setTermResult(null);

    const chargeAmount = activeMethod === 'split' ? splitCardVal : totalAmount;
    const res = await payWithTerminal(chargeAmount);
    setTermLoading(false);
    setTermResult(res);

    if (res?.success) {
      setTimeout(() => {
        let payDetails = {
          method: activeMethod === 'split' ? 'split' : 'card',
          tendered: totalAmount,
          change: 0,
          cardAuthCode: res.auth_code,
          cardMask: res.card_mask
        };
        if (activeMethod === 'split') {
          payDetails.splitDetails = {
            cash: splitCashVal,
            card: splitCardVal
          };
        }
        onCompleteSale(payDetails);
      }, 1000);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card modal-widescreen"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="modal-header" style={{ padding: '0.85rem 1.25rem' }}>
          <div className="modal-title" style={{ fontSize: '1.2rem', fontWeight: '800' }}>
            {isRefund ? t('payment.refund_title') : t('payment.title')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            {onOpenCashDrawer && (
              <button
                type="button"
                className="payment-modal-drawer-btn"
                onClick={() => {
                  soundFx.playCashChime();
                  onOpenCashDrawer();
                }}
                title={t('cart.open_drawer') || 'Otevřít zásuvku'}
              >
                <CashDrawerIcon size={16} />
                <span>{t('cart.open_drawer') || 'Otevřít zásuvku'}</span>
              </button>
            )}
            <button type="button" className="close-modal-btn" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Top Horizontal Segmented Tender Bar */}
        <div className="payment-top-bar">
          <div className="payment-method-nav">
            <button
              type="button"
              className={`payment-nav-tab ${activeMethod === 'cash' ? 'active-cash' : ''}`}
              onClick={() => setActiveMethod('cash')}
            >
              <Banknote size={18} />
              <span>{t('payment.cash')}</span>
            </button>

            <button
              type="button"
              className={`payment-nav-tab ${activeMethod === 'card' ? 'active-card' : ''}`}
              onClick={() => setActiveMethod('card')}
            >
              <CreditCard size={18} />
              <span>{t('payment.card')}</span>
            </button>

            <button
              type="button"
              className={`payment-nav-tab ${activeMethod === 'qr' ? 'active-qr' : ''}`}
              onClick={() => setActiveMethod('qr')}
            >
              <QrCode size={18} />
              <span>{t('payment.qr')}</span>
            </button>

            <button
              type="button"
              className={`payment-nav-tab ${activeMethod === 'split' ? 'active-split' : ''}`}
              onClick={() => setActiveMethod('split')}
            >
              <Split size={18} />
              <span>{t('payment.split')}</span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span className="payment-hero-label">{t('payment.total_due')}:</span>
            <span className="payment-hero-amount" style={{ color: activeMethod === 'cash' ? 'var(--accent-emerald)' : 'var(--accent-blue)' }}>
              {totalAmount.toFixed(2)} Kč
            </span>
          </div>
        </div>

        {/* Modal Main Content Area */}
        <div className="modal-body payment-widescreen-body">
          <div className="payment-main-content">
            {activeMethod === 'cash' && (
              <CashPaymentPanel
                tenderedStr={tenderedStr}
                tenderedVal={tenderedVal}
                effectiveCashTotal={effectiveCashTotal}
                totalAmount={totalAmount}
                changeDue={changeDue}
                onCashAdd={handleCashAdd}
                onCashSet={handleCashSet}
                onNumpadKey={handleNumpadKey}
                onComplete={handleComplete}
              />
            )}

            {activeMethod === 'split' && (
              <SplitPaymentPanel
                splitStep={splitStep}
                setSplitStep={setSplitStep}
                splitCashStr={splitCashStr}
                setSplitCashStr={setSplitCashStr}
                splitCashVal={splitCashVal}
                splitCardVal={splitCardVal}
                totalAmount={totalAmount}
                termConfig={termConfig}
                termLoading={termLoading}
                termResult={termResult}
                onSplitNumpadKey={handleSplitNumpadKey}
                onTerminalPay={handleTerminalPay}
                onComplete={handleComplete}
              />
            )}

            {activeMethod === 'card' && (
              <CardPaymentPanel
                totalAmount={totalAmount}
                termConfig={termConfig}
                termLoading={termLoading}
                termResult={termResult}
                onTerminalPay={handleTerminalPay}
                onComplete={handleComplete}
              />
            )}

            {activeMethod === 'qr' && (
              <QrPaymentPanel
                totalAmount={totalAmount}
                storeConfig={storeConfig}
                onComplete={handleComplete}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
