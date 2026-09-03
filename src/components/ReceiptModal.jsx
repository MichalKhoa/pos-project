import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CheckCircle } from 'lucide-react';
import { printReceiptBackend } from '../api/posApi';
import ReceiptPreviewPaper from './receipt/ReceiptPreviewPaper';
import ReceiptActionButtons from './receipt/ReceiptActionButtons';
import { generateReceiptHtml } from '../utils/receiptHtmlGenerator';

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

export default function ReceiptModal({ saleData, storeConfig, onClose, onNewSale, disableAutoPrint = false }) {
  const [isPrinting, setIsPrinting] = useState(false);
  const autoPrintTriggeredRef = useRef(false);

  const resolvedItems = parseSaleItems(saleData);
  const safeConfig = storeConfig || {};
  const paperWidth = (safeConfig.printerPaperWidth || '80').toString().toUpperCase();
  const isA4 = paperWidth === 'A4';
  const is58mm = !isA4 && (paperWidth === '58' || paperWidth === '48');

  const handlePrint = useCallback(async (forceDebugWindow = false) => {
    if (isPrinting || !saleData) return;
    setIsPrinting(true);

    const isDirectPrint = storeConfig?.directHardwarePrint !== false && !forceDebugWindow;

    // 1. Attempt hardware direct print silently if directHardwarePrint is enabled
    if (isDirectPrint) {
      const res = await printReceiptBackend({ ...saleData, items: resolvedItems }, storeConfig);
      if (res && res.status === 'PRINTED' && res.physical !== false) {
        setTimeout(() => setIsPrinting(false), 600);
        return;
      }
      console.warn('Physical thermal printer hardware not detected or simulated. Falling back to system print window...');
    }

    // 2. Fallback mode: Open dedicated print preview window
    const printWin = window.open('', '_blank', 'width=450,height=700');
    if (!printWin) {
      window.print();
      setIsPrinting(false);
      return;
    }

    const markup = generateReceiptHtml({
      saleData,
      items: resolvedItems,
      storeConfig,
      paperWidth
    });

    printWin.document.write(markup);
    printWin.document.close();
    setTimeout(() => setIsPrinting(false), 1500);
  }, [isPrinting, saleData, storeConfig, resolvedItems, paperWidth]);

  useEffect(() => {
    if (!disableAutoPrint && storeConfig?.autoPrintReceipt && saleData && !autoPrintTriggeredRef.current) {
      autoPrintTriggeredRef.current = true;
      handlePrint(false);
    }
  }, [disableAutoPrint, storeConfig?.autoPrintReceipt, saleData, handlePrint]);

  if (!saleData) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: isA4 ? '680px' : (is58mm ? '360px' : '440px') }}>
        <div className="modal-header" style={{ background: (saleData.isRefund || saleData.is_refund) ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 'var(--bg-input)' }}>
          <div className="modal-title">
            <CheckCircle size={20} style={{ color: (saleData.isRefund || saleData.is_refund) ? '#fff' : 'var(--accent-emerald)' }} />
            <span>{(saleData.isRefund || saleData.is_refund) ? 'STORNO DOKLAD / DOBROPIS' : 'Prodej Dokončen'}</span>
          </div>
          <button className="close-modal-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ alignItems: 'center' }}>
          {/* Top Streamlined Action Buttons */}
          <ReceiptActionButtons
            isPrinting={isPrinting}
            storeConfig={storeConfig}
            onPrint={handlePrint}
            onNewSale={onNewSale}
          />

          {/* Printable Thermal Receipt Area */}
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
