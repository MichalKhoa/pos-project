import React from 'react';
import { CheckCircle2 } from 'lucide-react';

export default function QrPaymentPanel({
  totalAmount,
  storeConfig,
  onComplete
}) {
  const rawIban = storeConfig?.bankAccountIban || "CZ6508000000001234567890";
  const merchantIban = rawIban.replace(/\s/g, '').toUpperCase();
  const varSymbol = Date.now().toString().slice(-8);
  const spdString = `SPD*1.0*ACC:${merchantIban}*AM:${totalAmount.toFixed(2)}*CC:CZK*X-VS:${varSymbol}*MSG:Platba Himmel POS`;
  const currentHost = typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? window.location.hostname : (window.location.hostname || 'localhost');
  const qrImageUrl = `http://${currentHost}:8000/api/v1/qr/generate?data=${encodeURIComponent(spdString)}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{
        textAlign: 'center',
        padding: '1.25rem 1rem',
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.65rem'
      }}>
        <div style={{ background: '#ffffff', padding: '10px', borderRadius: '12px', boxShadow: 'var(--shadow-md)' }}>
          <img src={qrImageUrl} alt="QR Platba SPD" style={{ width: '190px', height: '190px', display: 'block' }} />
        </div>
        <div style={{ fontWeight: '800', fontSize: '1.3rem', color: 'var(--text-primary)' }}>
          {totalAmount.toLocaleString('cs-CZ')} Kč
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Naskenujte v mobilním bankovnictví (ČS, ČSOB, KB, AirBank, Fio...)
        </div>
        <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', background: 'var(--bg-input)', padding: '0.35rem 0.65rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)' }}>
          VS: {varSymbol} • IBAN: {merchantIban.slice(0, 4)}...{merchantIban.slice(-4)}
        </div>
      </div>
      <button
        className="pay-btn pay-btn-card"
        style={{ width: '100%', height: '62px', background: 'var(--accent-purple)', fontSize: '1.15rem', fontWeight: '800' }}
        onClick={onComplete}
      >
        <CheckCircle2 size={24} />
        <span>Potvrdit Přijatou QR Platbu ({totalAmount.toFixed(2)} Kč)</span>
      </button>
    </div>
  );
}
