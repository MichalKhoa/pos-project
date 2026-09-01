import React, { useState } from 'react';
import { Printer, RotateCcw, Maximize2, Receipt } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext.jsx';
import { printReceiptBackend } from '../../api/posApi';
import ReceiptPreviewPaper from '../receipt/ReceiptPreviewPaper';

function parseSaleItems(saleData) {
  if (!saleData) return [];
  let raw = saleData.items || saleData.sale_items || saleData.cart_items || [];
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = [];
    }
  }
  if (!Array.isArray(raw)) return [];
  return raw.map((item, idx) => ({
    id: item.id || item.item_id || `item-${idx}`,
    name: item.name || item.title || item.item_name || 'Položka',
    price: item.price !== undefined ? parseFloat(item.price) : (item.unit_price !== undefined ? parseFloat(item.unit_price) : 0),
    quantity: item.quantity !== undefined ? parseInt(item.quantity, 10) : (item.qty !== undefined ? parseInt(item.qty, 10) : 1),
    vat: item.vat !== undefined ? parseInt(item.vat, 10) : (item.vat_rate !== undefined ? parseInt(item.vat_rate, 10) : 21),
    discountPercent: item.discountPercent !== undefined ? parseFloat(item.discountPercent) : (item.discount_percent !== undefined ? parseFloat(item.discount_percent) : 0)
  }));
}

export default function ReceiptInspectorPanel({
  saleData,
  storeConfig,
  onInitiateRefund,
  onOpenFullModal
}) {
  const { t } = useTranslation();
  const [isPrinting, setIsPrinting] = useState(false);

  if (!saleData) {
    return (
      <div className="receipt-inspector-card empty-state" style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1rem',
        textAlign: 'center',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        minHeight: '380px',
        color: 'var(--text-muted)'
      }}>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: 'var(--radius-full)',
          background: 'var(--bg-input)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '1rem',
          color: 'var(--text-secondary)'
        }}>
          <Receipt size={28} />
        </div>
        <h4 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
          {t('history.no_receipt_selected') || 'Není vybrána žádná účtenka'}
        </h4>
        <p style={{ fontSize: '0.8rem', maxWidth: '240px', lineHeight: 1.4 }}>
          {t('history.select_receipt_prompt') || 'Kliknutím na řádek v seznamu vpravo zobrazíte detail dokladu a možnosti tisku.'}
        </p>
      </div>
    );
  }

  const resolvedItems = parseSaleItems(saleData);
  const safeConfig = storeConfig || {};
  const is58mm = safeConfig.printerPaperWidth === '58' || safeConfig.printerPaperWidth === '48';
  const isRefund = saleData.isRefund || saleData.is_refund || (saleData.totalAmount !== undefined && saleData.totalAmount < 0);
  const isFullyRefunded = saleData.refund_status === 'FULL' || saleData.refundStatus === 'FULL';

  const handlePrint = async () => {
    if (isPrinting || !saleData) return;
    setIsPrinting(true);

    try {
      if (storeConfig?.directHardwarePrint !== false) {
        const res = await printReceiptBackend({ ...saleData, items: resolvedItems }, storeConfig);
        if (res && res.status === 'PRINTED' && res.physical !== false) {
          setTimeout(() => setIsPrinting(false), 500);
          return;
        }
      }
      if (onOpenFullModal) {
        onOpenFullModal(saleData);
      }
    } catch {
      if (onOpenFullModal) {
        onOpenFullModal(saleData);
      }
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="receipt-inspector-card" style={{
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-card)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
      height: '100%',
      minHeight: '440px'
    }}>
      {/* Inspector Header */}
      <div style={{
        padding: '0.55rem 0.85rem',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--bg-main)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <Receipt size={16} style={{ color: 'var(--accent-blue)' }} />
          <span style={{ fontSize: '0.88rem', fontWeight: '800' }}>
            #{saleData.receiptNumber || '0000'}
          </span>
          {isRefund ? (
            <span className="status-badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)', padding: '0.15rem 0.4rem', fontSize: '0.72rem' }}>
              Storno
            </span>
          ) : isFullyRefunded ? (
            <span className="status-badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-amber)', borderColor: 'rgba(245, 158, 11, 0.3)', padding: '0.15rem 0.4rem', fontSize: '0.72rem' }}>
              Vráceno
            </span>
          ) : (
            <span className="status-badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-emerald)', borderColor: 'rgba(16, 185, 129, 0.3)', padding: '0.15rem 0.4rem', fontSize: '0.72rem' }}>
              Platná
            </span>
          )}
        </div>

        {onOpenFullModal && (
          <button
            className="nav-tab"
            style={{ padding: '0.22rem 0.45rem', fontSize: '0.75rem' }}
            onClick={() => onOpenFullModal(saleData)}
            title="Otevřít rozšířený náhled"
          >
            <Maximize2 size={13} />
          </button>
        )}
      </div>

      {/* Quick Action Top Bar */}
      <div style={{
        padding: '0.45rem 0.65rem',
        background: 'rgba(255,255,255,0.02)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        gap: '0.5rem',
        alignItems: 'center'
      }}>
        <button
          className="checkout-btn"
          style={{
            flex: 1,
            minHeight: '36px',
            padding: '0.35rem 0.6rem',
            fontSize: '0.8rem',
            background: 'var(--accent-blue)',
            color: '#ffffff',
            border: '1px solid var(--accent-blue)',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.4rem',
            fontWeight: '700',
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
          onClick={handlePrint}
          disabled={isPrinting}
          title="Vytisknout účtenku na tiskárně"
        >
          <Printer size={15} />
          <span>{isPrinting ? t('receipt.printing') : t('receipt.print')}</span>
        </button>

        {!isRefund && !isFullyRefunded && onInitiateRefund && (
          <button
            className="nav-tab"
            style={{
              flex: 1,
              minHeight: '36px',
              padding: '0.35rem 0.6rem',
              fontSize: '0.8rem',
              background: 'rgba(239, 68, 68, 0.12)',
              color: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: 'var(--radius-sm)',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
            onClick={() => onInitiateRefund(saleData)}
            title="Vystavit storno / vratku položek"
          >
            <RotateCcw size={15} />
            <span>{t('history.refund_short') || 'Storno'}</span>
          </button>
        )}
      </div>

      {/* Scrollable Thermal Paper Canvas */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0.65rem',
        display: 'flex',
        justifyContent: 'center',
        background: 'var(--bg-main)',
        maxHeight: 'calc(100vh - 240px)'
      }}>
        <div style={{
          boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
          borderRadius: '4px',
          overflow: 'hidden',
          alignSelf: 'flex-start'
        }}>
          <ReceiptPreviewPaper
            saleData={saleData}
            storeConfig={storeConfig}
            resolvedItems={resolvedItems}
            is58mm={is58mm}
          />
        </div>
      </div>
    </div>
  );
}
