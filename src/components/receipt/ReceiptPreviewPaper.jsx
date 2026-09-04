import React, { useMemo } from 'react';
import { Scissors } from 'lucide-react';
import { generateQrDataUrl } from '../../utils/qrCode.js';

export default function ReceiptPreviewPaper({
  saleData,
  storeConfig,
  resolvedItems,
  is58mm,
  width,
  style
}) {
  const isRefund = saleData.isRefund || saleData.is_refund;
  const fik = saleData.fik || saleData.pok || saleData.fik_code;
  const bkp = saleData.bkp || saleData.bkp_code;
  const pkp = saleData.pkp || saleData.pkp_code;

  const stripDiacritics = Boolean(storeConfig?.stripDiacritics);
  const clean = (str) => {
    if (!str || !stripDiacritics) return str;
    return String(str).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  };

  const topMargin = parseInt(storeConfig?.receiptTopMargin ?? 1, 10);
  const bottomMargin = parseInt(storeConfig?.receiptBottomMargin ?? 3, 10);
  const sepStyle = storeConfig?.receiptSeparatorStyle || 'dashed';
  const sepSpacing = storeConfig?.receiptSeparatorSpacing || 'standard';
  const titleStyle = storeConfig?.receiptTitleStyle || 'banner';

  const boldStore = storeConfig?.receiptBoldStoreName !== false;
  const boldItems = storeConfig?.receiptBoldItemNames !== false;
  const boldPrices = storeConfig?.receiptBoldPrices !== false;
  const boldTotal = storeConfig?.receiptBoldTotal !== false;
  const boldFooter = Boolean(storeConfig?.receiptBoldFooter);

  const showContacts = storeConfig?.receiptShowStoreContact !== false;
  const itemDensity = storeConfig?.receiptItemDensity || 'standard';
  const showSku = Boolean(storeConfig?.receiptShowItemSku);
  const showVat = storeConfig?.receiptShowItemVat !== false;
  const showDisc = storeConfig?.receiptShowItemDiscount !== false;
  const taxMatrixStyle = storeConfig?.receiptTaxMatrixStyle || 'detailed';
  const qrType = storeConfig?.receiptQrCodeType || 'spayd';
  const showBranding = storeConfig?.receiptShowBranding !== false;
  const showCashier = storeConfig?.receiptShowCashier !== false;

  const customHeader = clean(storeConfig?.receiptCustomHeader || '');
  const vatStatus = storeConfig?.receiptVatPayerStatus || 'payer';
  const vatBadge = vatStatus === 'payer' ? 'Plátce DPH' : 'Neplátce DPH';
  const phone = storeConfig?.receiptStorePhone || '';
  const email = storeConfig?.receiptStoreEmail || '';
  const cashierName = clean(saleData.cashier || saleData.cashierName || 'Pokladní');

  const sepMargin = sepSpacing === 'compact' ? '4px 0' : (sepSpacing === 'spacious' ? '12px 0' : '7px 0');

  const renderSeparator = (key) => {
    if (sepStyle === 'double') {
      return <div key={key} style={{ borderTop: '3px double #000', margin: sepMargin }} />;
    } else if (sepStyle === 'dotted') {
      return <div key={key} style={{ borderTop: '1.5px dotted #000', margin: sepMargin }} />;
    } else if (sepStyle === 'solid') {
      return <div key={key} style={{ borderTop: '1.5px solid #000', margin: sepMargin }} />;
    } else if (sepStyle === 'stars') {
      return <div key={key} style={{ textAlign: 'center', fontSize: '8px', letterSpacing: '4px', margin: sepMargin }}>★ ★ ★ ★ ★ ★ ★</div>;
    } else if (sepStyle === 'wavy') {
      return <div key={key} style={{ textAlign: 'center', fontSize: '10px', letterSpacing: '2px', margin: sepMargin }}>~ ~ ~ ~ ~ ~ ~ ~ ~</div>;
    }
    return <div key={key} style={{ borderTop: '1px dashed #000', margin: sepMargin }} />;
  };

  // Live QR Code Generation
  const qrCodeDataUrl = useMemo(() => {
    if (qrType === 'spayd') {
      const cleanIban = (storeConfig?.bankAccountIban || '').replace(/\s/g, '').toUpperCase();
      if (!cleanIban || cleanIban === 'CZ6508000000001234567890') return null;
      const storeMsg = (storeConfig?.storeName || 'VoltFlow POS').slice(0, 30);
      const spaydPayload = `SPD*1.0*ACC:${cleanIban}*AM:${(saleData.totalAmount || 0).toFixed(2)}*CC:CZK*X-VS:${saleData.receiptNumber || '1'}*MSG:${storeMsg}`;
      return generateQrDataUrl(spaydPayload, 140);
    } else if (qrType === 'url' && storeConfig?.receiptQrCodeUrl) {
      return generateQrDataUrl(storeConfig.receiptQrCodeUrl, 140);
    }
    return null;
  }, [qrType, storeConfig?.bankAccountIban, storeConfig?.receiptQrCodeUrl, storeConfig?.storeName, saleData.totalAmount, saleData.receiptNumber]);

  // Multi-line footer
  const footerRaw = storeConfig?.receiptFooterLines || storeConfig?.receiptFooter || 'Děkujeme za váš nákup!';
  const footerLines = footerRaw.split('\n').filter(l => l.trim());

  const rawTitle = isRefund ? `↩️ STORNO DOKLAD č. ${saleData.receiptNumber}` : `DAŇOVÝ DOKLAD č. ${saleData.receiptNumber}`;

  const paperWidth = width || (is58mm ? '280px' : '380px');
  const topFeedPadding = Math.max(8, topMargin * 16 + 8);
  const bottomFeedPadding = Math.max(12, bottomMargin * 18 + 14);

  return (
    <div
      className={`receipt-paper printable-receipt ${is58mm ? 'paper-58mm' : 'paper-80mm'}`}
      style={{
        width: paperWidth,
        maxWidth: '100%',
        padding: `${topFeedPadding}px ${is58mm ? '12px' : '18px'} ${bottomFeedPadding}px ${is58mm ? '12px' : '18px'}`,
        fontSize: is58mm ? '12.48px' : '15.04px',
        lineHeight: is58mm ? '1.28' : '1.38',
        boxSizing: 'border-box',
        transition: 'all 0.2s ease-in-out',
        ...style
      }}
    >
      {/* 2-Copy Indicator */}
      {storeConfig?.receiptCopies == 2 && (
        <div style={{
          textAlign: 'center',
          fontSize: is58mm ? '10.4px' : '11.84px',
          fontWeight: '900',
          letterSpacing: '1px',
          marginBottom: '6px',
          color: '#475569',
          borderBottom: '1px dashed #cbd5e1',
          paddingBottom: '4px'
        }}>
          *** ÚČTENKA PRO ZÁKAZNÍKA (Kopie 1/2) ***
        </div>
      )}

      <div className="receipt-header" style={{ textAlign: 'center' }}>
        <div
          className="receipt-store-name"
          style={{
            fontSize: is58mm ? '18.4px' : '22.4px',
            fontWeight: boldStore ? '900' : '600'
          }}
        >
          {clean(storeConfig?.storeName || 'VoltFlow POS')}
        </div>
        <div style={{ fontSize: is58mm ? '11.84px' : '13.44px', color: '#444' }}>{clean(storeConfig?.street)}</div>
        <div style={{ fontSize: is58mm ? '11.84px' : '13.44px', color: '#444' }}>{clean(storeConfig?.city)}</div>
        <div style={{ marginTop: '2px', fontSize: is58mm ? '11.2px' : '12.8px', fontWeight: '700' }}>
          IČO: {clean(storeConfig?.ico)} | DIČ: {clean(storeConfig?.dic)} ({vatBadge})
        </div>
        {showContacts && (phone || email) && (
          <div style={{ fontSize: is58mm ? '10.88px' : '12.16px', color: '#555', marginTop: '1px' }}>
            {[phone && `Tel: ${phone}`, email && `Email: ${email}`].filter(Boolean).join(' • ')}
          </div>
        )}
        <div style={{ fontSize: is58mm ? '10.88px' : '12.16px', color: '#666', marginTop: '2px' }}>
          Provozovna: {storeConfig?.idProvozovny || '11'} | {clean(storeConfig?.registerNo || 'Pokladna #01')}
        </div>

        {/* Custom Header Note if Configured */}
        {customHeader && (
          <div style={{
            margin: '6px 0 4px 0',
            padding: '4px 8px',
            fontSize: is58mm ? '11.52px' : '13.12px',
            fontWeight: '700',
            textAlign: 'center',
            border: '1px dashed #64748b',
            borderRadius: '2px',
            background: 'rgba(0, 0, 0, 0.03)'
          }}>
            {customHeader}
          </div>
        )}

        {/* Title rendering */}
        {titleStyle === 'framed' ? (
          <div style={{ border: '1.5px solid #000', padding: '4px 6px', margin: '6px 0', fontSize: is58mm ? '11.84px' : '14.08px', fontWeight: '900', color: isRefund ? '#dc2626' : '#000' }}>
            {clean(rawTitle)}
          </div>
        ) : titleStyle === 'banner' ? (
          <div
            className="receipt-divider-title"
            style={{
              fontSize: is58mm ? '12.48px' : '14.4px',
              color: isRefund ? '#dc2626' : '#000000',
              borderColor: isRefund ? '#dc2626' : '#222222',
              margin: '6px 0',
              padding: '3px 0'
            }}
          >
            ══ {clean(rawTitle)} ══
          </div>
        ) : titleStyle === 'classic' ? (
          <div style={{ borderTop: '1px solid #000', borderBottom: '1px solid #000', padding: '3px 0', margin: '6px 0', fontSize: is58mm ? '11.84px' : '14.08px', fontWeight: '900' }}>
            {clean(rawTitle)}
          </div>
        ) : (
          <div style={{ padding: '3px 0', margin: '4px 0', fontSize: is58mm ? '11.84px' : '14.08px', fontWeight: '900' }}>
            {clean(rawTitle)}
          </div>
        )}

        {isRefund && (saleData.originalReceiptNumber || saleData.original_receipt_number) && (
          <div style={{ fontSize: '11.2px', fontWeight: '800', color: '#dc2626', marginTop: '2px' }}>
            Původní doklad: #{saleData.originalReceiptNumber || saleData.original_receipt_number}
          </div>
        )}
        {isRefund && (saleData.refundReason || saleData.refund_reason) && (
          <div style={{ fontSize: '11.2px', color: '#444', fontStyle: 'italic', marginTop: '2px' }}>
            Důvod vrácení: <em>{saleData.refundReason || saleData.refund_reason}</em>
          </div>
        )}
        <div style={{ fontSize: is58mm ? '10.88px' : '12px', marginTop: '2px', color: '#555' }}>
          Datum & čas: <b>{new Date(saleData.timestamp).toLocaleString('cs-CZ')}</b>
        </div>
        {showCashier && (
          <div style={{ fontSize: is58mm ? '10.4px' : '11.52px', color: '#555' }}>
            Obsluha: {cashierName}
          </div>
        )}
      </div>

      {renderSeparator('sep-head')}

      <table className="receipt-table" style={{ tableLayout: 'fixed', width: '100%' }}>
        <thead>
          <tr style={{ fontSize: is58mm ? '10.88px' : '12.48px' }}>
            <th style={{ width: '52%', textAlign: 'left' }}>Položka</th>
            <th style={{ width: '14%', textAlign: 'center' }}>Ks</th>
            <th style={{ width: '34%', textAlign: 'right' }}>Cena</th>
          </tr>
        </thead>
        <tbody>
          {resolvedItems.map((item, idx) => {
            const itemDisc = item.discountPercent || 0;
            const unitPrice = item.price * (1 - itemDisc / 100);
            return (
              <tr key={idx}>
                <td style={{ wordBreak: 'break-word', padding: itemDensity === 'compact' ? '3.2px 0' : '5.6px 0' }}>
                  <div className="receipt-item-title" style={{ fontWeight: boldItems ? '800' : '500' }}>
                    {clean(item.name)} {showDisc && itemDisc > 0 ? <span style={{ color: '#dc2626', fontStyle: 'italic' }}>(-{itemDisc}%)</span> : ''}
                  </div>
                  {showSku && (item.barcode || item.sku) && (
                    <div style={{ fontSize: '9.92px', color: '#777' }}>Kód: {item.barcode || item.sku}</div>
                  )}
                  {itemDensity === 'standard' && showVat && (
                    <div className="receipt-item-sub">DPH {item.vat}%</div>
                  )}
                </td>
                <td style={{ textAlign: 'center', fontWeight: '700', padding: itemDensity === 'compact' ? '3.2px 0' : '5.6px 0' }}>{item.quantity}</td>
                <td style={{ textAlign: 'right', fontWeight: boldPrices ? '900' : '500', whiteSpace: 'nowrap', fontFamily: 'monospace', padding: itemDensity === 'compact' ? '3.2px 0' : '5.6px 0' }}>
                  {(unitPrice * item.quantity).toFixed(0)}&nbsp;Kč
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* High-Contrast Thermal Total Banner */}
      <div
        className="receipt-total-row"
        style={{
          color: isRefund ? '#dc2626' : '#000000',
          fontWeight: boldTotal ? '900' : '700'
        }}
      >
        <span>CELKEM K {isRefund ? 'VRÁCENÍ' : 'ÚHRADĚ'}</span>
        <span className="receipt-total-amount">{(saleData.totalAmount || 0).toFixed(0)} Kč</span>
      </div>

      <div style={{ fontSize: is58mm ? '11.52px' : '12.8px', margin: '6.4px 0', display: 'flex', flexDirection: 'column', gap: '3.2px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Způsob úhrady:</span>
          <span style={{ fontWeight: '900', letterSpacing: '0.5px' }}>
            {saleData.paymentMethod === 'cash' ? 'HOTOVOST' : saleData.paymentMethod === 'card' ? 'KARTA' : saleData.paymentMethod === 'split' ? 'KOMBINOVANÁ' : 'QR PLATBA'}
          </span>
        </div>

        {saleData.paymentMethod === 'split' && saleData.splitDetails && (
          <div style={{ background: '#f8f9fa', border: '1px solid #e9ecef', padding: '5.6px 9.6px', borderRadius: '4px', marginTop: '3.2px', fontSize: '11.52px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>- Uhrazeno Hotově:</span>
              <span style={{ fontWeight: '800', fontFamily: 'monospace' }}>{(saleData.splitDetails.cash || 0).toFixed(0)} Kč</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>- Uhrazeno Kartou:</span>
              <span style={{ fontWeight: '800', fontFamily: 'monospace' }}>{(saleData.splitDetails.card || 0).toFixed(0)} Kč</span>
            </div>
          </div>
        )}

        {saleData.paymentMethod === 'cash' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Přijatá hotovost:</span>
              <span style={{ fontWeight: '700', fontFamily: 'monospace' }}>{(saleData.tenderedAmount || 0).toFixed(0)} Kč</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Vrácená hotovost:</span>
              <span style={{ fontWeight: '800', fontFamily: 'monospace', color: '#059669' }}>{(saleData.changeDue || 0).toFixed(0)} Kč</span>
            </div>
          </>
        )}
      </div>

      {/* DPH Tax Matrix */}
      {taxMatrixStyle !== 'none' && saleData.taxSummary && (
        <>
          {renderSeparator('sep-tax')}
          <div style={{ fontSize: is58mm ? '10.88px' : '12px' }}>
            <div style={{ fontWeight: '900', textTransform: 'uppercase', marginBottom: '3px', letterSpacing: '0.4px' }}>Rekapitulace DPH:</div>
            {taxMatrixStyle === 'compact' || is58mm ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.4px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px dashed #666', textAlign: 'left', fontWeight: '800' }}>
                    <th style={{ textAlign: 'left' }}>Sazba</th>
                    <th style={{ textAlign: 'right' }}>Základ</th>
                    <th style={{ textAlign: 'right' }}>Daň</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(saleData.taxSummary).map(t => (
                    <tr key={t.rate}>
                      <td style={{ fontWeight: '700' }}>{t.rate}%</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{t.net.toFixed(2)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{t.tax.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.52px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px dashed #666', textAlign: 'left', fontWeight: '800' }}>
                    <th style={{ textAlign: 'left' }}>Sazba</th>
                    <th style={{ textAlign: 'right' }}>Základ</th>
                    <th style={{ textAlign: 'right' }}>Daň</th>
                    <th style={{ textAlign: 'right' }}>Brutto</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(saleData.taxSummary).map(t => (
                    <tr key={t.rate}>
                      <td style={{ fontWeight: '700' }}>{t.rate}%</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{t.net.toFixed(2)} Kč</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{t.tax.toFixed(2)} Kč</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: '800' }}>{t.gross.toFixed(2)} Kč</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* Fiscal EET Block (only render when EET is enabled and signed) */}
      {storeConfig?.eetEnabled && (fik || bkp || pkp) && (
        <>
          {renderSeparator('sep-eet')}
          <div className="receipt-eet-box" style={{ wordBreak: 'break-all', fontSize: is58mm ? '9.92px' : '10.88px' }}>
            <div style={{ fontWeight: '900', textTransform: 'uppercase', marginBottom: '3px' }}>
              EET 2.0 ({fik ? 'Běžný online režim' : 'Zjednodušený neonline režim'})
            </div>
            {fik && (
              <div><strong>FIK:</strong> {fik}</div>
            )}
            {bkp && (
              <div><strong>BKP:</strong> {bkp}</div>
            )}
            {pkp && !fik && (
              <div style={{ marginTop: '2px' }}><strong>PKP:</strong> {pkp.slice(0, 32)}...</div>
            )}
            {!fik && (pkp || saleData.eet_status === 'OFFLINE_PENDING') && (
              <div style={{ fontWeight: '800', marginTop: '4px', color: '#b45309' }}>
                Vystaveno ve zjednodušeném (neonline) režimu EET
              </div>
            )}
          </div>
        </>
      )}

      {/* QR Code */}
      {qrCodeDataUrl && (
        <div style={{ textAlign: 'center', marginTop: '8px' }}>
          {renderSeparator('sep-qr')}
          <div style={{ fontSize: is58mm ? '10.4px' : '11.84px', fontWeight: '800', marginBottom: '2px' }}>
            {qrType === 'spayd' ? 'QR PLATBA (PŘEVOD NA ÚČET)' : 'ELEKTRONICKÁ ÚČTENKA'}
          </div>
          <img
            src={qrCodeDataUrl}
            alt="QR Kód"
            style={{ width: is58mm ? '90px' : '115px', height: is58mm ? '90px' : '115px', display: 'block', margin: '0 auto' }}
          />
        </div>
      )}

      {/* Custom Footer */}
      {renderSeparator('sep-foot')}
      <div style={{ textAlign: 'center', marginTop: '6.4px', paddingBottom: '3.2px' }}>
        <div style={{ fontSize: is58mm ? '11.52px' : '13.12px', fontWeight: boldFooter ? '800' : '600', fontStyle: 'italic' }}>
          {footerLines.map((l, i) => (
            <div key={i}>{clean(l)}</div>
          ))}
        </div>
        {showBranding && (
          <div style={{ fontSize: '10.24px', color: '#777', marginTop: '5.6px' }}>
            Vystaveno v pokladním systému VoltFlow POS
          </div>
        )}
      </div>

      {/* Paper Cutter Indicator & Margin Feed */}
      <div
        className="receipt-cut-line"
        style={{
          marginTop: `${Math.max(8, bottomMargin * 16)}px`,
          borderTop: '2px dashed #94a3b8',
          paddingTop: '6px',
          textAlign: 'center',
          fontSize: is58mm ? '9.92px' : '11.52px',
          fontWeight: '700',
          color: '#64748b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          userSelect: 'none'
        }}
      >
        <Scissors size={13} style={{ transform: 'rotate(-90deg)' }} />
        <span>Odstřih papíru / Cutter ({bottomMargin} {bottomMargin === 1 ? 'řádek' : bottomMargin < 5 ? 'řádky' : 'řádků'})</span>
      </div>
    </div>
  );
}

