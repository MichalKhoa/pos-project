import React, { useState, useEffect, useRef } from 'react';
import { ShoppingBag, CheckCircle2, Wifi, WifiOff, Sparkles } from 'lucide-react';
import { generateQrDataUrl } from '../utils/qrCode.js';

export default function CustomerDisplayView({ storeConfig }) {
  const [displayState, setDisplayState] = useState({
    type: 'CART_CLEAR',
    cart: [],
    totalAmount: 0,
    payment: null
  });
  const [isConnected, setIsConnected] = useState(false);
  const [isStandbyBlackout, setIsStandbyBlackout] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const wsRef = useRef(null);
  const wakeLockRef = useRef(null);
  const standbyTimerRef = useRef(null);
  const storeConfigRef = useRef(storeConfig);

  useEffect(() => {
    storeConfigRef.current = storeConfig;
  }, [storeConfig]);

  // Request Screen WakeLock to keep display awake when connected
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator && !wakeLockRef.current) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        console.log('[CustomerDisplay] Screen WakeLock acquired');
      }
    } catch (err) {
      console.warn('[CustomerDisplay] WakeLock request failed:', err);
    }
    // Fully Kiosk JS API integration for native hardware screen wake
    try {
      if (window.fully && typeof window.fully.turnScreenOn === 'function') {
        window.fully.turnScreenOn();
      }
    } catch {
      // Ignored if not running inside Fully Kiosk
    }
  };

  // Release Screen WakeLock on disconnect so phone screen can power off
  const releaseWakeLock = () => {
    try {
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
        console.log('[CustomerDisplay] Screen WakeLock released');
      }
    } catch (err) {
      console.warn('[CustomerDisplay] WakeLock release failed:', err);
    }
    // Fully Kiosk JS API integration for native hardware screen off
    try {
      if (window.fully && typeof window.fully.turnScreenOff === 'function') {
        window.fully.turnScreenOff();
      }
    } catch {
      // Ignored if not running inside Fully Kiosk
    }
  };

  // Determine WebSocket URL based on current browser host
  const getWsUrl = () => {
    const host = window.location.hostname || 'localhost';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${host}:8000/api/v1/ws/customer-display`;
  };

  useEffect(() => {
    let reconnectTimer = null;

    const connectWebSocket = () => {
      try {
        const ws = new WebSocket(getWsUrl());
        wsRef.current = ws;

        ws.onopen = () => {
          setIsConnected(true);
          setIsStandbyBlackout(false);
          if (standbyTimerRef.current) clearTimeout(standbyTimerRef.current);
          requestWakeLock();
          console.log('[CustomerDisplay] WebSocket connected to backend');
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data && typeof data === 'object' && typeof data.type === 'string') {
              // Sanitize cart items and prevent oversized payloads
              const sanitizedCart = Array.isArray(data.cart)
                ? data.cart.slice(0, 100).map(item => ({
                    name: String(item.name || 'Položka').slice(0, 80),
                    qty: Math.max(1, Math.min(999, parseInt(item.qty, 10) || 1)),
                    price: Math.max(0, Math.min(999999, parseFloat(item.price) || 0)),
                    vatRate: item.vatRate !== undefined ? parseInt(item.vatRate, 10) : 21
                  }))
                : [];

              const sanitizedTotal = Math.max(0, Math.min(9999999, parseFloat(data.totalAmount) || 0));

              setDisplayState({
                type: data.type,
                cart: sanitizedCart,
                totalAmount: sanitizedTotal,
                payment: data.payment && typeof data.payment === 'object' ? data.payment : null
              });
            }
          } catch (err) {
            console.error('[CustomerDisplay] Error parsing WS message:', err);
          }
        };

        ws.onerror = (err) => {
          console.warn('[CustomerDisplay] WebSocket error:', err);
        };

        ws.onclose = () => {
          setIsConnected(false);
          releaseWakeLock();
          const cfg = storeConfigRef.current;
          const autoSleepEnabled = cfg?.customerDisplayAutoSleep !== false && cfg?.customer_display_auto_sleep !== false;
          const delayMs = (cfg?.customerDisplayStandbyDelay || cfg?.customer_display_standby_delay || 10) * 1000;

          if (autoSleepEnabled) {
            console.log(`[CustomerDisplay] WebSocket closed. Starting ${delayMs / 1000}s standby blackout timer...`);
            if (!standbyTimerRef.current) {
              standbyTimerRef.current = setTimeout(() => {
                setIsStandbyBlackout(true);
              }, delayMs);
            }
          }

          reconnectTimer = setTimeout(connectWebSocket, 3000);
        };
      } catch {
        setIsConnected(false);
        releaseWakeLock();
        reconnectTimer = setTimeout(connectWebSocket, 3000);
      }
    };

    connectWebSocket();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (standbyTimerRef.current) clearTimeout(standbyTimerRef.current);
      releaseWakeLock();
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Handle countdown on PAYMENT_SUCCESS
  useEffect(() => {
    if (displayState.type === 'PAYMENT_SUCCESS') {
      setCountdown(5);
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    } else {
      setCountdown(null);
    }
  }, [displayState.type]);

  const storeName = storeConfig?.store_name || storeConfig?.storeName || 'Himmel POS Store';
  const displayTitle = storeConfig?.customerDisplayTitle || storeConfig?.customer_display_title || 'Vítejte u nás';
  const cartItems = Array.isArray(displayState.cart) ? displayState.cart : [];
  const itemsSum = cartItems.reduce((acc, i) => acc + ((i.price || 0) * (i.qty || 1)), 0);
  const totalAmount = (typeof displayState.totalAmount === 'number' && displayState.totalAmount > 0)
    ? displayState.totalAmount
    : itemsSum;
  const isQrMode = displayState.type === 'PAYMENT_PENDING' && displayState.payment?.method === 'QR_CODE';
  const isSuccessMode = displayState.type === 'PAYMENT_SUCCESS';

  // If backend is shut down / disconnected for >10s, enter 100% pitch black standby mode
  if (isStandbyBlackout && !isConnected) {
    return (
      <div className="cd-standby-blackout" onClick={() => setIsStandbyBlackout(false)}>
        <div className="cd-standby-content">
          <WifiOff size={32} className="cd-standby-icon" />
          <p>Displej v režimu spánku (Pokladna vypnuta)</p>
          <span>Displej se automaticky probudí po zapnutí pokladny</span>
        </div>
      </div>
    );
  }

  return (
    <div className="customer-display-root">
      {/* Top Header Bar */}
      <header className="cd-header">
        <div className="cd-brand">
          <ShoppingBag className="cd-brand-icon" size={26} />
          <div>
            <h1 className="cd-store-name">{displayTitle}</h1>
            <span className="cd-subtitle">Zákaznický displej</span>
          </div>
        </div>

        {/* Connectivity Status Pill */}
        <div className={`cd-status-pill ${isConnected ? 'online' : 'offline'}`}>
          {isConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
          <span>{isConnected ? 'Živý přenos' : 'Odpojeno'}</span>
        </div>
      </header>

      {/* Main Dynamic Viewport */}
      <main className="cd-main">
        {/* MODE 1: PAYMENT SUCCESS FULLSCREEN BANNER */}
        {isSuccessMode ? (
          <div className="cd-success-container">
            <div className="cd-success-icon-wrap">
              <CheckCircle2 size={80} className="cd-success-icon" />
            </div>
            <h2 className="cd-success-title">Platba Byla Úspěšná!</h2>
            <p className="cd-success-sub">Děkujeme za nákup a těšíme se na vaši příští návštěvu.</p>

            <div className="cd-success-card">
              <div className="cd-success-row">
                <span>Zaplacená částka:</span>
                <strong>{totalAmount.toFixed(0)} Kč</strong>
              </div>
              {displayState.payment?.receiptNo && (
                <div className="cd-success-row">
                  <span>Číslo účtenky:</span>
                  <span>{displayState.payment.receiptNo}</span>
                </div>
              )}
              <div className="cd-success-row">
                <span>Způsob platby:</span>
                <span className="cd-badge-green">
                  {displayState.payment?.method === 'QR_CODE' ? 'QR Platba' : displayState.payment?.method === 'card' ? 'Karta' : 'Hotovost'}
                </span>
              </div>
            </div>

            {countdown !== null && (
              <div className="cd-countdown-text">
                Displej se obnoví za <strong>{countdown}s</strong>...
              </div>
            )}
          </div>
        ) : isQrMode ? (
          /* MODE 2: QR PAYMENT DISPLAY */
          <div className="cd-qr-container">
            <div className="cd-qr-header">
              <Sparkles className="cd-sparkle" size={24} />
              <h2>Zaplaťte Bankovní Aplikací</h2>
            </div>
            <p className="cd-qr-instruction">
              Naskenujte tento QR kód ve své mobilní bance pro okamžitý převod:
            </p>

            {/* Robust offline QR code URL resolver */}
            {(() => {
              const currentIban = storeConfig?.bankAccountIban || storeConfig?.bank_account_iban || storeConfig?.merchant_iban || 'CZ6508000000001234567890';
              const cleanIban = currentIban.replace(/\s/g, '').toUpperCase();
              const vs = displayState.payment?.vs || '20260001';
              const spdPayload = `SPD*1.0*ACC:${cleanIban}*AM:${Math.max(0, totalAmount).toFixed(2)}*CC:CZK*X-VS:${vs}*MSG:${encodeURIComponent('Platba ' + storeName)}`;
              const rawUrl = displayState.payment?.qrImageUrl;
              let finalQrUrl = generateQrDataUrl(spdPayload, 260);

              if (rawUrl && typeof rawUrl === 'string' && rawUrl.startsWith('data:image/')) {
                finalQrUrl = rawUrl;
              }

              const formattedIban = cleanIban.match(/.{1,4}/g)?.join(' ') || cleanIban;

              return (
                <>
                  <div className="cd-qr-frame">
                    <img
                      src={finalQrUrl}
                      alt="QR Kód pro platbu"
                      className="cd-qr-image"
                    />
                  </div>

                  <div className="cd-qr-details-grid">
                    <div className="cd-qr-detail-box">
                      <span className="cd-detail-lbl">Částka k úhradě</span>
                      <strong className="cd-detail-val amount">{totalAmount.toFixed(0)} Kč</strong>
                    </div>
                    <div className="cd-qr-detail-box">
                      <span className="cd-detail-lbl">Variabilní symbol</span>
                      <strong className="cd-detail-val">{displayState.payment?.vs || '---'}</strong>
                    </div>
                    <div className="cd-qr-detail-box wide">
                      <span className="cd-detail-lbl">Příjemce / Číslo účtu (IBAN)</span>
                      <strong className="cd-detail-val iban">{formattedIban}</strong>
                    </div>
                  </div>
                </>
              );
            })()}

            <div className="cd-qr-pulse-bar">
              <div className="cd-pulse-dot" />
              <span>Čekám na potvrzení od pokladny...</span>
            </div>
          </div>
        ) : (
          /* MODE 3: ACTIVE CART VIEW */
          <div className="cd-cart-container">
            {cartItems.length === 0 ? (
              <div className="cd-empty-cart">
                <ShoppingBag size={64} className="cd-empty-icon" />
                <h2>{displayTitle}</h2>
                <p>Zboží přidané pokladním se zobrazí zde</p>
              </div>
            ) : (
              <div className="cd-cart-layout">
                {/* Prominent Eye-Level Top Total Bar */}
                <div className="cd-total-dock cd-total-top">
                  <div className="cd-dock-left">
                    <span className="cd-dock-count-badge">
                      {cartItems.reduce((acc, i) => acc + (i.qty || 1), 0)} položek
                    </span>
                  </div>

                  <div className="cd-dock-right">
                    <span className="cd-dock-total-label">Celkem k úhradě</span>
                    <strong className="cd-dock-grand-total">{totalAmount.toFixed(0)} Kč</strong>
                  </div>
                </div>

                {/* Scrollable Items List Below Total Bar */}
                <div className="cd-items-list">
                  <div className="cd-list-header">
                    <span>Položka</span>
                    <span>Množství</span>
                    <span>Cena</span>
                  </div>
                  <div className="cd-list-body">
                    {cartItems.map((item, idx) => (
                      <div key={item.id || idx} className="cd-cart-item">
                        <div className="cd-item-info">
                          <span className="cd-item-name">{item.name}</span>
                          {item.vatRate !== undefined && (
                            <span className="cd-item-vat">DPH {item.vatRate}%</span>
                          )}
                        </div>
                        <div className="cd-item-qty">
                          <span className="cd-qty-pill">{item.qty}×</span>
                        </div>
                        <div className="cd-item-price">
                          {(item.price * item.qty).toFixed(0)} Kč
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
