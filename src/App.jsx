import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Navbar from './components/Navbar';
import QuickPresetGrid from './components/QuickPresetGrid';
import ManualKeypad from './components/ManualKeypad';
import Cart from './components/Cart';
import ShiftStatsWidget from './components/keypad/ShiftStatsWidget';
import AppModals from './components/app/AppModals';
import SyncNotificationBanner from './components/SyncNotificationBanner';
import { useCart } from './hooks/useCart';
import { usePosKeyboardShortcuts } from './hooks/usePosKeyboardShortcuts';
import { useAutoLock } from './hooks/useAutoLock';
import { useOfflineSync } from './hooks/useOfflineSync';
import { useUnsentSales } from './hooks/useUnsentSales';
import { SYNC, sendOutcome, applySendResult, markStranded, isLocalOnly, canRefund } from './utils/saleSync';
import { roundCashTotal } from './utils/tax';
import { buildRefundUpdate, revertRefund, settleRefundUpdate } from './utils/refundSync';
import { usePosCatalog } from './hooks/usePosCatalog';
import { useStoreConfig } from './context/StoreConfigContext';
import { useTranslation } from './i18n/LanguageContext';
import { useConfirm } from './context/useConfirm.js';
import { soundFx } from './utils/audio';
import { buildSalePayload } from './utils/buildSalePayload';
import { getStorageItem, setStorageItem, removeStorageItem } from './utils/storage';
import { DEFAULT_STORE_CONFIG } from './data/initialData';
import {
  createSaleBackend,
  fetchSalesHistoryBackend,
  fetchBackendRoot,
  normalizeSale,
  fetchStoreConfigBackend,
  saveStoreConfigBackend,
  broadcastCustomerDisplay,
  deleteSaleBackend,
  purgeAllSalesBackend,
  openCashDrawerBackend,
  printDailySummaryBackend,
  printReceiptBackend,
  fetchSaleByReceiptNumber,
  getCurrentShift
} from './api/posApi';
import { formatLocalDate } from './utils/dateUtils';
import SalesHistoryView from './components/SalesHistoryView';
import AnalyticsView from './components/AnalyticsView';
import PresetsCatalogView from './components/PresetsCatalogView';
import InventoryView from './components/InventoryView';
import SettingsView from './components/SettingsView';
import CustomerDisplayView from './components/CustomerDisplayView';

export default function App() {
  const { t } = useTranslation();
  const { askConfirm } = useConfirm();
  const [isCustomerDisplayMode, setIsCustomerDisplayMode] = useState(() => window.location.hash === '#/customer-display');

  useEffect(() => {
    const handleHashChange = () => {
      setIsCustomerDisplayMode(window.location.hash === '#/customer-display');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const [activeTab, setActiveTab] = useState('register');
  const [showShutdownModal, setShowShutdownModal] = useState(false);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
  const [discountModalSelectedItem, setDiscountModalSelectedItem] = useState(null);
  const [historyDateFilter, setHistoryDateFilter] = useState(null);
  const [flashBanner, setFlashBanner] = useState(null);
  const storageWarnedRef = useRef(false);
  const [unknownBarcode, setUnknownBarcode] = useState(null);
  const [storeConfig, setStoreConfig] = useState(() => {
    try {
      const saved = getStorageItem('config');
      const parsed = saved ? JSON.parse(saved) : null;
      return parsed && typeof parsed === 'object' ? parsed : DEFAULT_STORE_CONFIG;
    } catch {
      return DEFAULT_STORE_CONFIG;
    }
  });

  // Sync high-legibility density mode to DOM root attribute
  useEffect(() => {
    const isHigh = !!storeConfig?.highLegibilityMode;
    document.documentElement.setAttribute('data-density', isHigh ? 'high' : 'normal');
  }, [storeConfig?.highLegibilityMode]);

  const [salesHistory, setSalesHistory] = useState(() => {
    try {
      const saved = getStorageItem('sales');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.map(normalizeSale);
      }
    } catch (e) {
      console.warn('Failed to load initial sales history:', e);
    }
    return [];
  });

  const {
    categories,
    presets,
    setPresets,
    handleAddCategory,
    handleEditCategory,
    handleDeleteCategory,
    handleReorderCategories,
    handleAddPreset,
    handleUpdatePreset,
    handleDeletePreset,
    handleReorderPresets,
    handleTogglePresetPin
  } = usePosCatalog();

  const {
    pendingSyncCount,
    showSyncModal,
    setShowSyncModal,
    isSyncingQueue,
    syncNotification,
    setSyncNotification,
    handleSnoozeSync,
    handleSyncQueueNow,
    checkPendingOfflineSales
  } = useOfflineSync({ salesHistory, setSalesHistory });

  const [currentShift, setCurrentShift] = useState(null);

  const fetchShiftData = useCallback(async () => {
    try {
      const shift = await getCurrentShift();
      if (shift) setCurrentShift(shift);
    } catch (e) {
      console.warn('Failed to fetch shift data:', e);
    }
  }, []);

  useEffect(() => {
    fetchShiftData();
  }, [fetchShiftData]);

  const [showUnsentModal, setShowUnsentModal] = useState(false);
  const {
    unsentSales,
    unsentCount,
    isFlushing: isFlushingUnsent,
    flush: flushUnsent
  } = useUnsentSales({ salesHistory, setSalesHistory, onSent: fetchShiftData });
  const unsentSummary = useMemo(() => ({
    count: unsentSales.length,
    amount: unsentSales.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0)
  }), [unsentSales]);

  const {
    isAppLocked,
    setIsAppLocked,
    unlockApp
  } = useAutoLock(storeConfig?.lockScreenEnabled ? storeConfig?.autoLockMinutes : 0);

  const {
    cartItems,
    setCartItems,
    cartDiscountPercent,
    setCartDiscountPercent,
    itemMultiplier,
    setItemMultiplier,
    parkedCarts,
    parkCurrentCart,
    restoreParkedCart,
    deleteParkedCart,
    updateParkedCartNote,
    addToCart,
    updateQuantity: handleUpdateQty,
    updateItemDiscount: handleUpdateItemDiscount,
    updateItemDetails: handleUpdateItemDetails,
    applyCartDiscount: handleApplyCartDiscount,
    removeItem: handleRemoveItem,
    clearCart: handleClearCart,
    undoToast,
    undoLastAction,
    dismissUndoToast,
    clearedCartSnapshot,
    restoreClearedCart,
    dismissClearedCartSnapshot
  } = useCart();

  const [isParkedModalOpen, setIsParkedModalOpen] = useState(false);
  const [isCustomItemModalOpen, setIsCustomItemModalOpen] = useState(false);
  const [isCashMovementModalOpen, setIsCashMovementModalOpen] = useState(false);
  const [isZReportModalOpen, setIsZReportModalOpen] = useState(false);
  const [weightModalPreset, setWeightModalPreset] = useState(null);

  const computedTotalAmount = useMemo(() => {
    return cartItems.reduce((sum, item) => {
      const disc = item.discountPercent || 0;
      const effectivePrice = item.price * (1 - disc / 100);
      return sum + (effectivePrice * item.quantity);
    }, 0) * (1 - cartDiscountPercent / 100);
  }, [cartItems, cartDiscountPercent]);

  // Broadcast live cart changes to customer display
  useEffect(() => {
    if (isCustomerDisplayMode) return;
    broadcastCustomerDisplay({
      type: cartItems.length > 0 ? 'CART_UPDATE' : 'CART_CLEAR',
      cart: cartItems.map(i => ({ name: i.name, qty: i.quantity, price: i.price, vatRate: i.vat })),
      totalAmount: Math.round((computedTotalAmount + Number.EPSILON) * 100) / 100
    });
  }, [cartItems, computedTotalAmount, isCustomerDisplayMode]);

  const [keypadAmount, setKeypadAmount] = useState('');
  const {
    isAdminMode,
    toggleAdminMode: handleToggleAdminMode
  } = useStoreConfig();
  const [paymentModalMethod, setPaymentModalMethod] = useState(null); // 'cash' | 'card' | 'split' | null
  const [currentReceiptData, setCurrentReceiptData] = useState(null);
  const [refundTargetSale, setRefundTargetSale] = useState(null);

  // Price Check Mode State (Kontrola ceny / Cenovka)
  const [isPriceCheckActive, setIsPriceCheckActive] = useState(false);
  const [priceCheckItem, setPriceCheckItem] = useState(null);
  const [unknownPriceCheckBarcode, setUnknownPriceCheckBarcode] = useState(null);

  const handleTogglePriceCheck = useCallback(() => {
    setIsPriceCheckActive(prev => {
      const next = !prev;
      soundFx.playScanChime();
      setFlashBanner({
        type: next ? 'info' : 'default',
        message: next ? '🔍 Kontrola ceny (Cenovka) zapnuta' : 'Kontrola ceny vypnuta'
      });
      return next;
    });
  }, []);

  const handleInspectPrice = useCallback((item) => {
    setUnknownPriceCheckBarcode(null);
    setPriceCheckItem(item);
  }, []);

  const handleInspectPriceUnknown = useCallback((barcode) => {
    setPriceCheckItem(null);
    setUnknownPriceCheckBarcode(barcode);
  }, []);

  // Most recent completed sale for Quick Reprint / Storno chip
  const lastSale = useMemo(() => {
    if (!salesHistory || salesHistory.length === 0) return null;
    return salesHistory[0];
  }, [salesHistory]);

  const handleReprintSale = useCallback(async (sale) => {
    if (!sale) return;
    soundFx.playScanChime();
    try {
      const res = await printReceiptBackend(sale, storeConfig);
      if (res && res.status === 'PRINTED' && res.physical !== false) {
        soundFx.playSuccessChime();
        setFlashBanner({
          message: t('payment.receipt_printed', { n: sale.receiptNumber || sale.receipt_number || '' }),
          type: 'success'
        });
      } else {
        setCurrentReceiptData(sale);
        setFlashBanner({
          message: `Účtenka #${sale.receiptNumber || sale.receipt_number || ''} otevřena k tisku`,
          type: 'info'
        });
      }
    } catch {
      setCurrentReceiptData(sale);
    }
  }, [storeConfig, t]);

  // Open Cash Drawer Handler
  const handleOpenCashDrawer = useCallback(async () => {
    soundFx.playCashChime();
    setFlashBanner({
      type: 'info',
      message: 'Otevírání peněžní zásuvky...'
    });
    try {
      const res = await openCashDrawerBackend();
      if (res && res.success) {
        setFlashBanner({
          type: 'success',
          message: res.physical ? 'Peněžní zásuvka byla úspěšně otevřena' : 'Signál otevření peněžní zásuvky odeslán (simulace)'
        });
      } else {
        setFlashBanner({
          type: 'warning',
          message: 'Nepodařilo se uvolnit peněžní zásuvku'
        });
      }
    } catch (err) {
      setFlashBanner({
        type: 'error',
        message: `Chyba při otevírání zásuvky: ${err.message}`
      });
    }
    setTimeout(() => setFlashBanner(null), 3000);
  }, []);

  // Test Sales Management

  const handleDeleteSale = async (saleId) => {
    if (await askConfirm({ message: t('dialogs.delete_sale'), danger: true, confirmLabel: t('dialogs.delete_button') })) {
      setSalesHistory(prev => prev.filter(s => s.id !== saleId));
      await deleteSaleBackend(saleId);
    }
  };

  const handleClearAllTestSales = async () => {
    if (await askConfirm({ message: t('dialogs.purge_sales'), danger: true, typeWord: t('dialogs.type_word_delete'), confirmLabel: t('dialogs.delete_button') })) {
      setSalesHistory([]);
      await purgeAllSalesBackend();
    }
  };

  // Refund / Storno processing handler
  // Every refund entry point (last-receipt chip, ledger, inspector, scanned receipt) ends here
  const handleInitiateRefund = useCallback((sale) => {
    if (sale && !canRefund(sale)) {
      setFlashBanner({ type: 'ERROR', message: t('refund_guard.not_stored') });
      return;
    }
    setRefundTargetSale(sale);
  }, [t]);

  const handleProcessRefund = ({ originalSale, returnedItems, totalRefundAmount, refundTaxSummary, refundReason, paymentMethod, isFullRefund }) => {
    const currentYear = new Date().getFullYear().toString();
    const yearPrefix = `${currentYear}-`;
    let maxSeq = 0;
    for (const s of salesHistory) {
      const rNum = s.receiptNumber || '';
      const cleanNum = rNum.replace('STORNO-', '');
      if (cleanNum.startsWith(yearPrefix)) {
        const num = parseInt(cleanNum.slice(yearPrefix.length), 10);
        if (!isNaN(num) && num > maxSeq) maxSeq = num;
      }
    }
    const nextStornoNum = `STORNO-${currentYear}-${(maxSeq + 1).toString().padStart(6, '0')}`;

    const formattedTaxSummary = Object.entries(refundTaxSummary).reduce((acc, [rate, values]) => {
      acc[rate] = {
        rate: parseInt(rate, 10),
        gross: -values.gross,
        net: -values.net,
        tax: -values.tax
      };
      return acc;
    }, {});

    const isCashRefund = paymentMethod === 'cash';
    const refundCashTotal = roundCashTotal(-totalRefundAmount);

    const stornoSale = normalizeSale({
      id: `sale-storno-${Date.now()}`,
      receiptNumber: nextStornoNum,
      timestamp: new Date().toISOString(),
      items: returnedItems.map(item => ({
        id: item.id || `item-${Date.now()}`,
        name: `STORNO: ${item.name}`,
        price: parseFloat(item.price),
        quantity: -item.quantityToReturn,
        vat: item.vat !== undefined ? parseInt(item.vat, 10) : 21,
        discount_percent: item.discountPercent || 0
      })),
      // Cash goes back in whole koruna like it came in: a 3.50 sale paid as 4 is refunded as 4,
      // and the 0.50 is noted as rounding on the storno
      totalAmount: isCashRefund ? refundCashTotal : -totalRefundAmount,
      cashRounding: isCashRefund ? Math.round((refundCashTotal + totalRefundAmount) * 100) / 100 : 0,
      cartDiscountPercent: originalSale.cartDiscountPercent || 0,
      paymentMethod,
      tenderedAmount: isCashRefund ? refundCashTotal : 0,
      changeDue: 0,
      taxSummary: formattedTaxSummary,
      isRefund: true,
      originalReceiptNumber: originalSale.receiptNumber,
      refundReason
    });

    const newRefundStatus = isFullRefund ? 'FULL' : 'PARTIAL';
    const updatedRefundedAmount = (originalSale.refundedAmount || 0) + totalRefundAmount;

    const updatedOriginalSale = normalizeSale({
      ...originalSale,
      refundStatus: newRefundStatus,
      refund_status: newRefundStatus,
      refundedAmount: updatedRefundedAmount,
      refunded_amount: updatedRefundedAmount
    });

    // The original sale's refund status is sent only after the server stored the storno (F-026);
    // until then it travels with the storno, and a refused storno undoes the change.
    const refundUpdate = buildRefundUpdate(originalSale, newRefundStatus, updatedRefundedAmount);
    const pendingStorno = { ...stornoSale, syncState: SYNC.PENDING, pendingRefundUpdate: refundUpdate };
    createSaleBackend(pendingStorno).then(async backendRes => {
      const outcome = sendOutcome(backendRes);
      if (outcome === 'retry') return; // stays PENDING with its refund update, resent automatically
      const settled = normalizeSale(applySendResult(pendingStorno, backendRes));
      if (outcome === 'rejected') {
        setSalesHistory(prev => revertRefund(
          prev.map(s => s.id === stornoSale.id ? { ...settled, pendingRefundUpdate: null } : s),
          refundUpdate
        ));
        setCurrentReceiptData(prev => prev && prev.id === stornoSale.id ? null : prev);
        setFlashBanner({ type: 'ERROR', message: t('refund_guard.storno_rejected') });
        setShowUnsentModal(true);
        return;
      }
      const statusUpdated = await settleRefundUpdate(pendingStorno);
      const finalStorno = { ...settled, pendingRefundUpdate: statusUpdated ? null : refundUpdate };
      setSalesHistory(prev => prev.map(s => s.id === stornoSale.id ? finalStorno : s));
      setCurrentReceiptData(prev => prev && prev.id === stornoSale.id ? finalStorno : prev);
      if (!statusUpdated) setFlashBanner({ type: 'ERROR', message: t('refund_guard.status_update_failed') });
      fetchShiftData();
    });


    setSalesHistory(prev => [pendingStorno, ...prev.map(s => s.id === originalSale.id ? updatedOriginalSale : s)]);
    setRefundTargetSale(null);
    setCurrentReceiptData(pendingStorno);
  };

  // Sync storeConfig to LocalStorage
  useEffect(() => {
    if (storeConfig) {
      const safeConfig = { ...storeConfig };
      delete safeConfig.cashierPin;
      setStorageItem('config', safeConfig);
    }
  }, [storeConfig]);

  // Sync salesHistory to LocalStorage (sanitized: only persist offline pending + latest 50 completed to prevent QuotaExceededError)
  useEffect(() => {
    // Sales the server does not have (unsent, EET-pending) are never trimmed
    const localOnly = salesHistory.filter(isLocalOnly);
    const recentCompleted = salesHistory.filter(s => !isLocalOnly(s)).slice(0, 50);
    const stored = setStorageItem('sales', [...localOnly, ...recentCompleted]);
    if (!stored && !storageWarnedRef.current) {
      storageWarnedRef.current = true;
      setFlashBanner({ type: 'ERROR', message: t('unsent_sales.storage_full') });
    } else if (stored) {
      storageWarnedRef.current = false;
    }
  }, [salesHistory, t]);

  // Load store config & sales history from SQLite backend on mount
  useEffect(() => {
    let lastFocusReload = 0;

    const reloadBackendData = (isInitial = false) => {
      fetchShiftData();
      fetchStoreConfigBackend().then(data => {
        if (data && typeof data === 'object') {
          setStoreConfig(prev => ({ ...prev, ...data }));
        }
      });
      const pageLimit = isInitial ? 100 : 50;
      fetchSalesHistoryBackend({ limit: pageLimit }).then(backendSales => {
        // F-014 recovery: local sales the server lacks become STRANDED (manual resend) or NEEDS_REVIEW
        if (isInitial && Array.isArray(backendSales)) {
          setSalesHistory(prev => markStranded(prev, backendSales, pageLimit));
        }
        if (Array.isArray(backendSales) && backendSales.length > 0) {
          // Sync highest receipt sequence number to localStorage
          const currentYear = new Date().getFullYear().toString();
          const yearPrefix = `${currentYear}-`;
          let maxSeq = 0;
          for (const bs of backendSales) {
            if (bs.receiptNumber && bs.receiptNumber.startsWith(yearPrefix)) {
              const num = parseInt(bs.receiptNumber.slice(yearPrefix.length), 10);
              if (!isNaN(num) && num > maxSeq) maxSeq = num;
            }
          }
          if (maxSeq > 0) {
            const currentStoredSeq = parseInt(getStorageItem('last_receipt_seq', '0'), 10) || 0;
            if (maxSeq > currentStoredSeq) {
              setStorageItem('last_receipt_seq', String(maxSeq));
            }
          }

          setSalesHistory(prev => {
            const prevSaleMap = new Map(prev.map(s => [s.id, s]));
            const backendIds = new Set(backendSales.map(s => s.id));
            const backendReceipts = new Set(backendSales.map(s => s.receiptNumber).filter(Boolean));
            const pendingLocalSales = prev.filter(s =>
              isLocalOnly(s) &&
              !backendIds.has(s.id) &&
              !backendReceipts.has(s.receiptNumber)
            );

            // Defensive merge: preserve local items if incoming backend sale has empty items but local has items
            const safelyMergedBackend = backendSales.map(bs => {
              const localSale = prevSaleMap.get(bs.id);
              if ((!bs.items || bs.items.length === 0) && localSale && Array.isArray(localSale.items) && localSale.items.length > 0) {
                return { ...bs, items: localSale.items };
              }
              return bs;
            });

            const seenIds = new Set([...pendingLocalSales.map(s => s.id), ...safelyMergedBackend.map(s => s.id)]);
            const remainingLocal = prev.filter(s => !seenIds.has(s.id));

            const merged = [...pendingLocalSales, ...safelyMergedBackend, ...remainingLocal];
            merged.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            return merged;
          });
        }
      });
    };

    reloadBackendData(true);

    // Cold-start readiness polling: probe backend until online to sync sales and config
    let probeAttempts = 0;
    const maxProbeAttempts = 60; // 60 * 350ms = 21s max polling
    let probeTimer = null;

    const probeBackendOnline = () => {
      fetchBackendRoot().then((status) => {
        if (status && status.online) {
          reloadBackendData(true);
        } else if (probeAttempts < maxProbeAttempts) {
          probeAttempts += 1;
          probeTimer = setTimeout(probeBackendOnline, 350);
        }
      }).catch(() => {
        if (probeAttempts < maxProbeAttempts) {
          probeAttempts += 1;
          probeTimer = setTimeout(probeBackendOnline, 350);
        }
      });
    };
    probeTimer = setTimeout(probeBackendOnline, 350);

    const handleBackendOnline = () => {
      reloadBackendData(true);
    };
    window.addEventListener('pos:backend-online', handleBackendOnline);

    const handleStorageChange = (e) => {
      if (!e.key || !e.newValue) return;
      try {
        const data = JSON.parse(e.newValue);
        if ((e.key === 'voltflow_pos_config' || e.key === 'himmel_pos_config') && typeof data === 'object') {
          setStoreConfig(prev => ({ ...prev, ...data }));
        } else if ((e.key === 'voltflow_pos_sales' || e.key === 'himmel_pos_sales') && Array.isArray(data)) {
          setSalesHistory(data);
        }
      } catch (err) {
        console.warn("Multi-tab storage sync error:", err);
      }
    };

    const handleFocus = () => {
      const now = Date.now();
      // Throttle window focus reloads to at most once every 30 seconds
      if (now - lastFocusReload > 30000) {
        lastFocusReload = now;
        reloadBackendData(false);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      if (probeTimer) clearTimeout(probeTimer);
      window.removeEventListener('pos:backend-online', handleBackendOnline);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchShiftData]);

  const handleSaveStoreConfig = async (newConfig) => {
    // The settings form holds an older copy of the lock switches; the live ones win.
    setStoreConfig(prev => ({
      ...newConfig,
      lockScreenEnabled: prev.lockScreenEnabled,
      adminPinEnabled: prev.adminPinEnabled,
      hasPin: prev.hasPin,
      hasAdminPin: prev.hasAdminPin,
      cashierPinLength: prev.cashierPinLength,
      adminPinLength: prev.adminPinLength,
      hasRecoveryCode: prev.hasRecoveryCode
    }));
    await saveStoreConfigBackend(newConfig);
    await checkPendingOfflineSales();
  };

  // Warn before closing window if cart has active items
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (cartItems && cartItems.length > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [cartItems]);

  // Cart operations
  const handleAddToCart = useCallback((item, customQty = null) => {
    soundFx.playScanChime();
    const itemVat = item.vat !== undefined && item.vat !== null ? parseInt(item.vat, 10) : 21;
    const rawPrice = parseFloat(item.price);
    const rawQty = customQty !== null ? customQty : (item.quantity || itemMultiplier || 1);

    const isNegativeMultiplier = rawQty < 0;
    const effectivePrice = isNegativeMultiplier ? -Math.abs(rawPrice) : rawPrice;
    const effectiveQty = isNegativeMultiplier ? Math.abs(rawQty) : (rawQty === 0 ? 1 : rawQty);

    const isReturnItem = effectivePrice < 0;
    const itemName = isReturnItem && !item.name.includes('VRATKA') && !item.name.includes('Vratka') && !item.name.includes('↩️')
      ? `↩️ ${item.name}`
      : item.name;

    addToCart({
      ...item,
      name: itemName,
      price: effectivePrice,
      vat: itemVat,
      discountPercent: item.discountPercent || 0
    }, effectiveQty);

    if (itemMultiplier !== 1) {
      setItemMultiplier(1);
    }
  }, [addToCart, itemMultiplier, setItemMultiplier]);

  const handleSaveAndAddUnknownBarcode = useCallback(async (presetData, qty = 1) => {
    await handleAddPreset(presetData);
    handleAddToCart({
      ...presetData,
      quantity: qty
    });
    setUnknownBarcode(null);
    setFlashBanner({
      message: `✓ ${presetData.name} (${presetData.price} Kč)${qty > 1 ? ` ×${qty}` : ''}`,
      type: 'success'
    });
  }, [handleAddPreset, handleAddToCart]);

  const handleReceiptScanned = useCallback(async (barcode) => {
    soundFx.playScanChime();
    setFlashBanner({
      message: `${t('refund.scanned_receipt_banner', { receiptNumber: barcode })}...`,
      type: 'info'
    });

    try {
      // 1. Check local salesHistory first for immediate responsiveness
      const cleanCode = barcode.trim().toLowerCase();
      let matchedSale = salesHistory.find(s => {
        const rNum = (s.receiptNumber || s.receipt_number || '').toLowerCase();
        return rNum === cleanCode;
      });

      // 2. Fetch from backend with updated refundable item counts
      const backendSale = await fetchSaleByReceiptNumber(barcode);
      if (backendSale) {
        matchedSale = backendSale;
      }

      if (matchedSale) {
        soundFx.playSuccessChime();
        handleInitiateRefund(matchedSale);
        const rNum = matchedSale.receiptNumber || matchedSale.receipt_number;
        const total = (matchedSale.totalAmount !== undefined ? matchedSale.totalAmount : (matchedSale.total_amount || 0)).toFixed(0);
        setFlashBanner({
          message: `✓ ${t('refund.scanned_receipt_banner', { receiptNumber: rNum })} (${total} Kč)`,
          type: 'success'
        });
      } else {
        soundFx.playErrorChime();
        setFlashBanner({
          message: t('refund.receipt_not_found', { receiptNumber: barcode }),
          type: 'error'
        });
      }
    } catch (err) {
      soundFx.playErrorChime();
      setFlashBanner({
        message: `Chyba při načítání účtenky: ${err.message}`,
        type: 'error'
      });
    }
  }, [salesHistory, t, handleInitiateRefund]);

  // Hook for hardware keyboard, numpad and USB barcode scanner listeners
  usePosKeyboardShortcuts({
    isAppLocked,
    activeTab,
    keypadAmount,
    setKeypadAmount,
    setItemMultiplier,
    itemMultiplier,
    cartItems,
    paymentModalMethod,
    setPaymentModalMethod,
    handleAddToCart,
    storeConfig,
    presets,
    onUnknownBarcode: (code) => setUnknownBarcode(code),
    onBarcodeScanned: (preset, qty) => {
      setFlashBanner({
        message: `✓ ${preset.name} (${preset.price} Kč)${qty > 1 ? ` ×${qty}` : ''}`,
        type: 'success'
      });
    },
    onReceiptScanned: handleReceiptScanned,
    isPriceCheckActive,
    onTogglePriceCheck: handleTogglePriceCheck,
    onInspectPrice: handleInspectPrice,
    onPriceCheckUnknown: handleInspectPriceUnknown,
    onOpenWeightModal: (preset) => setWeightModalPreset(preset)
  });

  const handleOpenCustomDiscountModal = useCallback((item = null) => {
    setDiscountModalSelectedItem(item);
    setIsDiscountModalOpen(true);
  }, []);

  const handleApplyCustomDiscount = ({ type, value, scope, targetItem }) => {
    if (scope === 'ITEM' && targetItem) {
      handleUpdateItemDiscount(targetItem.id, value);
    } else if (scope === 'CART') {
      if (type === 'PERCENT') {
        handleApplyCartDiscount(value);
      } else if (type === 'AMOUNT') {
        const rawSubtotal = cartItems.reduce((sum, item) => {
          const disc = item.discountPercent || 0;
          return sum + (item.price * (1 - disc / 100) * item.quantity);
        }, 0);
        if (rawSubtotal > 0) {
          const equivalentPercent = Math.min(100, Math.max(0, (value / rawSubtotal) * 100));
          handleApplyCartDiscount(equivalentPercent);
        }
      }
    }
  };

  const handlePrintDailySummary = useCallback(async () => {
    soundFx.playScanChime();
    const todayStr = formatLocalDate(new Date());
    const todaySales = salesHistory.filter(sale => {
      const saleDate = sale.created_at || sale.timestamp || sale.date;
      return saleDate && formatLocalDate(saleDate) === todayStr;
    });

    let revenue = 0;
    let cash = 0;
    let card = 0;

    for (const s of todaySales) {
      const total = parseFloat(s.total_amount !== undefined ? s.total_amount : s.total) || 0;
      revenue += total;

      if (s.cash_amount !== undefined || s.card_amount !== undefined) {
        cash += parseFloat(s.cash_amount || 0);
        card += parseFloat(s.card_amount || 0);
      } else if (s.payment_method === 'cash') {
        cash += total;
      } else if (s.payment_method === 'card') {
        card += total;
      }
    }

    const summaryData = {
      date: todayStr,
      time: new Date().toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' }),
      totalRevenue: revenue,
      cashAmount: cash,
      cardAmount: card,
      salesCount: todaySales.length
    };

    const res = await printDailySummaryBackend(summaryData, storeConfig || {}, true);
    if (res && res.success) {
      soundFx.playSuccessChime();
      setFlashBanner({
        message: `✓ Denní tržba vytištěna (${revenue.toFixed(0)} Kč)`,
        type: 'success'
      });
    } else {
      soundFx.playErrorChime();
      setFlashBanner({
        message: 'Tisk denního přehledu se nezdařil (tiskárna offline)',
        type: 'error'
      });
    }
  }, [salesHistory, storeConfig]);

  // Checkout flow
  const handleOpenPayment = useCallback((method) => {
    if (cartItems.length === 0) return;
    setPaymentModalMethod(method);
  }, [cartItems.length]);

  const handleCompleteSale = ({
    method,
    paymentMethod,
    splitDetails,
    tendered,
    tenderedAmount,
    change,
    changeDue,
    printReceipt = true,
    isInvoice,
    is_invoice,
    customerIco,
    customer_ico,
    customerDic,
    customer_dic,
    customerName,
    customer_name,
    customerAddress,
    customer_address
  }) => {
    soundFx.playSuccessChime();
    const effectiveMethod = paymentMethod || method || 'cash';
    const effectiveTendered = tenderedAmount !== undefined ? tenderedAmount : (tendered !== undefined ? tendered : 0);
    const effectiveChange = changeDue !== undefined ? changeDue : (change !== undefined ? change : 0);

    const currentYear = new Date().getFullYear().toString();
    const yearPrefix = `${currentYear}-`;
    let maxSeq = parseInt(getStorageItem('last_receipt_seq', '0'), 10) || 0;
    for (const s of salesHistory) {
      if (s.receiptNumber && s.receiptNumber.startsWith(yearPrefix)) {
        const num = parseInt(s.receiptNumber.slice(yearPrefix.length), 10);
        if (!isNaN(num) && num > maxSeq) maxSeq = num;
      }
    }
    const nextSeq = maxSeq + 1;
    setStorageItem('last_receipt_seq', String(nextSeq));
    const nextReceiptNum = `${currentYear}-${nextSeq.toString().padStart(6, '0')}`;

    const { sale: newSale, finalGrandTotal } = buildSalePayload({
      id: `sale-${Date.now()}`,
      receiptNumber: nextReceiptNum,
      timestamp: new Date().toISOString(),
      cartItems,
      cartDiscountPercent,
      method: effectiveMethod,
      tenderedAmount: effectiveTendered,
      changeDue: effectiveChange,
      splitDetails,
      invoice: {
        isInvoice,
        is_invoice,
        customerIco,
        customer_ico,
        customerDic,
        customer_dic,
        customerName,
        customer_name,
        customerAddress,
        customer_address
      }
    });

    // The cashier sees "Zaplaceno!" at once; the server answer below decides what is still owed
    const pendingSale = { ...newSale, syncState: SYNC.PENDING };

    createSaleBackend(pendingSale).then(async backendRes => {
      let finalSaleToPrint = pendingSale;
      const outcome = sendOutcome(backendRes);
      if (outcome === 'ok') {
        const assignedRn = backendRes.receipt_number || newSale.receiptNumber;
        if (assignedRn && assignedRn.startsWith(yearPrefix)) {
          const num = parseInt(assignedRn.slice(yearPrefix.length), 10);
          if (!isNaN(num)) {
            const curSeq = parseInt(getStorageItem('last_receipt_seq', '0'), 10) || 0;
            if (num > curSeq) setStorageItem('last_receipt_seq', String(num));
          }
        }
        const enrichedSale = normalizeSale(applySendResult(pendingSale, backendRes));
        setSalesHistory(prev => prev.map(s => s.id === newSale.id ? enrichedSale : s));
        setCurrentReceiptData(prev => prev && prev.id === newSale.id ? enrichedSale : prev);
        finalSaleToPrint = enrichedSale;
        fetchShiftData();
      } else if (outcome === 'rejected') {
        // Server refused the sale: no receipt for a sale that is not recorded; show the list.
        setSalesHistory(prev => prev.map(s => s.id === newSale.id ? applySendResult(s, backendRes) : s));
        setFlashBanner({ type: 'ERROR', message: t('unsent_sales.banner_rejected'), amount: finalGrandTotal });
        setShowUnsentModal(true);
        return;
      } else {
        // Server unreachable: the sale stays PENDING and is resent automatically
        setFlashBanner({ type: 'WARNING', message: t('unsent_sales.banner_pending'), amount: finalGrandTotal });
      }

      if (printReceipt) {
        try {
          const res = await printReceiptBackend(finalSaleToPrint, storeConfig);
          if (res && res.status === 'PRINTED' && res.physical !== false) {
            // Keep the "waiting for server" warning visible while the sale is still unsaved
            if (outcome === 'ok') {
              setFlashBanner({
                type: 'SUCCESS',
                message: t('payment.receipt_printed', { n: finalSaleToPrint.receiptNumber || '' }),
                amount: finalGrandTotal
              });
            }
          } else {
            // Fallback to preview modal only if hardware direct print could not be executed
            setCurrentReceiptData(finalSaleToPrint);
          }
        } catch (err) {
          console.warn('Background receipt print failed, falling back to modal preview:', err);
          setCurrentReceiptData(finalSaleToPrint);
        }
      }
    }).catch(err => {
      console.warn('Backend sale registration failed:', err);
      if (printReceipt) {
        setCurrentReceiptData(pendingSale);
      }
    });

    setSalesHistory(prev => [pendingSale, ...prev]);
    setPaymentModalMethod(null);
    setCartItems([]);
    setCartDiscountPercent(0);

    setFlashBanner({
      type: 'SUCCESS',
      message: printReceipt ? t('payment.paid') : t('payment.paid_no_print'),
      amount: finalGrandTotal
    });
  };

  const handleResetData = async () => {
    if (await askConfirm({ message: t('dialogs.reset_data'), danger: true, typeWord: t('dialogs.type_word_reset') })) {
      removeStorageItem('presets');
      removeStorageItem('config');
      removeStorageItem('sales');
      setPresets(DEFAULT_PRESETS);
      setStoreConfig(DEFAULT_STORE_CONFIG);
      setSalesHistory([]);
      setCartItems([]);
    }
  };

  const handleSendUnsent = useCallback(async (ids) => {
    const r = await flushUnsent({ ids });
    if (r.sent > 0) fetchShiftData();
    if (r.unreachable) {
      setFlashBanner({ type: 'WARNING', message: t('unsent_sales.banner_still_down') });
    } else if (r.sent > 0) {
      setFlashBanner({ type: 'SUCCESS', message: t('unsent_sales.banner_sent', { n: r.sent }) });
    } else if (r.rejected > 0) {
      setFlashBanner({ type: 'ERROR', message: t('unsent_sales.banner_rejected') });
    }
  }, [flushUnsent, fetchShiftData, t]);
  const handleOpenUnsentModal = useCallback(() => setShowUnsentModal(true), []);
  const handleCloseUnsentModal = useCallback(() => setShowUnsentModal(false), []);
  const handleOpenSyncModal = useCallback(() => setShowSyncModal(true), [setShowSyncModal]);
  const handleOpenShutdownModal = useCallback(() => setShowShutdownModal(true), []);
  const handleOpenCalendarModal = useCallback(() => setIsCalendarModalOpen(true), []);
  // No lock without a PIN to unlock it (Batch G: the lock screen is a switch, off by default).
  const handleLockApp = useCallback(() => {
    if (storeConfig?.lockScreenEnabled) setIsAppLocked(true);
  }, [setIsAppLocked, storeConfig?.lockScreenEnabled]);
  // A recovery code clears both PINs and switches both locks off on the server; follow that here.
  const handlePinsRecovered = useCallback(() => {
    setStoreConfig(prev => ({
      ...prev,
      lockScreenEnabled: false,
      adminPinEnabled: false,
      hasPin: false,
      hasAdminPin: false,
      cashierPinLength: null,
      adminPinLength: null,
      hasRecoveryCode: false
    }));
  }, [setStoreConfig]);
  const handleOpenParkedModal = useCallback(() => setIsParkedModalOpen(true), []);
  const handleClearKeypadAmount = useCallback(() => setKeypadAmount(''), []);

  if (isCustomerDisplayMode) {
    return <CustomerDisplayView storeConfig={storeConfig} />;
  }

  return (
    <div className={`app-container ${activeTab === 'register' ? 'pos-mode' : 'scroll-mode'}`}>
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        storeConfig={storeConfig}
        isAdminMode={isAdminMode}
        onToggleAdminMode={handleToggleAdminMode}
        pendingCount={pendingSyncCount}
        onOpenSyncModal={handleOpenSyncModal}
        unsentCount={unsentCount}
        onOpenUnsentSales={handleOpenUnsentModal}
        onOpenShutdownModal={handleOpenShutdownModal}
        onOpenCalendarModal={handleOpenCalendarModal}
        onLockApp={handleLockApp}
        onOpenCashDrawer={handleOpenCashDrawer}
        onPrintDailySummary={handlePrintDailySummary}
      />

      {syncNotification && (
        <SyncNotificationBanner
          type={syncNotification.type}
          message={syncNotification.message}
          onClose={() => setSyncNotification(null)}
        />
      )}

      <main className="main-content">
        {activeTab === 'register' && (() => {
          const registerLayout = storeConfig?.registerLayout || 'two_column';
          const isTwoColumn = registerLayout === 'two_column';

          return (
            <>
              <div className={`pos-layout ${isTwoColumn ? 'layout-two-column' : 'layout-three-column'} cart-layout-${storeConfig?.cartPosition || (isTwoColumn ? 'right' : 'middle')}`}>
                {/* Left Column: Manual Keypad (Rendered only in 3-column mode) */}
                {!isTwoColumn && (
                  <div className="pos-col-left">
                    <ManualKeypad
                      onAddToCart={handleAddToCart}
                      amountStr={keypadAmount}
                      setAmountStr={setKeypadAmount}
                      itemMultiplier={itemMultiplier}
                      setItemMultiplier={setItemMultiplier}
                      defaultVat={storeConfig?.defaultVat !== undefined ? parseInt(storeConfig.defaultVat, 10) : 21}
                      onOpenCashDrawer={handleOpenCashDrawer}
                      onPrintDailySummary={handlePrintDailySummary}
                      onOpenCashMovement={() => setIsCashMovementModalOpen(true)}
                      onOpenZReport={() => setIsZReportModalOpen(true)}
                      onApplyDiscount={handleApplyCartDiscount}
                      parkedCarts={parkedCarts}
                      onParkCart={parkCurrentCart}
                      onRestoreParkedCart={restoreParkedCart}
                      onDeleteParkedCart={deleteParkedCart}
                      onUpdateParkedCartNote={updateParkedCartNote}
                      isParkedModalOpen={isParkedModalOpen}
                      onParkedModalOpenChange={setIsParkedModalOpen}
                      hasCartItems={cartItems.length > 0}
                      shift={currentShift}
                      unsent={unsentSummary}
                      shiftWidgetPosition={storeConfig?.shiftWidgetPosition || 'keypad'}
                    />
                  </div>
                )}

                {/* Presets Grid Column (pos-col-presets in 2-column mode, pos-col-center in 3-column mode) */}
                <div className={isTwoColumn ? 'pos-col-presets' : 'pos-col-center'}>
                  <div className="pos-card-box pos-presets-box">
                    <div className="pos-presets-scroll-wrapper">
                      <QuickPresetGrid
                        presets={presets}
                        categories={categories}
                        itemMultiplier={itemMultiplier}
                        setItemMultiplier={setItemMultiplier}
                        onAddCategory={handleAddCategory}
                        onEditCategory={handleEditCategory}
                        onDeleteCategory={handleDeleteCategory}
                        onReorderCategories={handleReorderCategories}
                        onAddToCart={handleAddToCart}
                        onAddPreset={handleAddPreset}
                        onUpdatePreset={handleUpdatePreset}
                        onDeletePreset={handleDeletePreset}
                        onReorderPresets={handleReorderPresets}
                        keypadAmount={keypadAmount}
                        onClearKeypadAmount={handleClearKeypadAmount}
                        isAdminMode={isAdminMode}
                        storeConfig={storeConfig}
                        isPriceCheckActive={isPriceCheckActive}
                        onTogglePriceCheck={handleTogglePriceCheck}
                        onInspectPrice={handleInspectPrice}
                        onOpenCustomModal={() => setIsCustomItemModalOpen(true)}
                        onOpenWeightModal={(preset) => setWeightModalPreset(preset)}
                      />
                    </div>
                  </div>
                  {(storeConfig?.shiftWidgetPosition === 'bottom_presets' || (isTwoColumn && storeConfig?.shiftWidgetPosition !== 'under_cart')) && (
                    <ShiftStatsWidget
                      variant="slim"
                      shift={currentShift}
                      unsent={unsentSummary}
                      onPrintDailySummary={handlePrintDailySummary}
                      onOpenZReport={() => setIsZReportModalOpen(true)}
                    />
                  )}
                </div>

                {/* Live Cart Column (pos-col-cart in 2-column mode, pos-col-right in 3-column mode) */}
                <div className={isTwoColumn ? 'pos-col-cart' : 'pos-col-right'}>
                  <Cart
                    cartItems={cartItems}
                    onUpdateQty={handleUpdateQty}
                    onUpdateItemDetails={handleUpdateItemDetails}
                    onRemoveItem={handleRemoveItem}
                    onClearCart={handleClearCart}
                    onOpenPayment={handleOpenPayment}
                    onUpdateItemDiscount={handleUpdateItemDiscount}
                    cartDiscountPercent={cartDiscountPercent}
                    onSetCartDiscountPercent={setCartDiscountPercent}
                    onOpenCustomDiscount={handleOpenCustomDiscountModal}
                    clearedCartSnapshot={clearedCartSnapshot}
                    onRestoreClearedCart={restoreClearedCart}
                    onDismissClearedCart={dismissClearedCartSnapshot}
                    onOpenCashDrawer={handleOpenCashDrawer}
                    parkedCartsCount={parkedCarts.length}
                    onOpenParkedModal={handleOpenParkedModal}
                    onParkCart={parkCurrentCart}
                    cartItemStyle={storeConfig?.cartItemStyle || 'elevated-card'}
                    lastSale={lastSale}
                    onReprintLastReceipt={handleReprintSale}
                    onInitiateRefund={handleInitiateRefund}
                  />
                  {isTwoColumn && storeConfig?.shiftWidgetPosition === 'under_cart' && (
                    <ShiftStatsWidget
                      variant="card"
                      shift={currentShift}
                      unsent={unsentSummary}
                      onPrintDailySummary={handlePrintDailySummary}
                      onOpenZReport={() => setIsZReportModalOpen(true)}
                    />
                  )}
                </div>
              </div>

            </>
          );
        })()}

        {activeTab === 'inventory' && (
          <InventoryView
            presets={presets}
            categories={categories}
            onUpdatePresets={setPresets}
            onAddPreset={handleAddPreset}
            onTogglePin={handleTogglePresetPin}
            storeConfig={storeConfig}
          />
        )}

        {activeTab === 'presets' && (
          <PresetsCatalogView
            presets={presets}
            categories={categories}
            onAddCategory={handleAddCategory}
            onEditCategory={handleEditCategory}
            onDeleteCategory={handleDeleteCategory}
            onAddPreset={handleAddPreset}
            onUpdatePreset={handleUpdatePreset}
            onDeletePreset={handleDeletePreset}
            onReorderPresets={handleReorderPresets}
            storeConfig={storeConfig}
          />
        )}

        {activeTab === 'history' && (
          <SalesHistoryView
            salesHistory={salesHistory}
            storeConfig={storeConfig}
            isAdminMode={isAdminMode}
            onToggleAdminMode={handleToggleAdminMode}
            onDeleteSale={handleDeleteSale}
            onClearAllTestSales={handleClearAllTestSales}
            onInitiateRefund={handleInitiateRefund}
            initialDateFilter={historyDateFilter}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsView
            salesHistory={salesHistory}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            storeConfig={storeConfig}
            onSaveStoreConfig={handleSaveStoreConfig}
            presets={presets}
            onResetData={handleResetData}
            onNavigateToPresets={() => setActiveTab('presets')}
            isAdminMode={isAdminMode}
            onToggleAdminMode={handleToggleAdminMode}
          />
        )}
      </main>

      {/* Centralized Modals Coordinator */}
      <AppModals
        onPinsRecovered={handlePinsRecovered}
        isDiscountModalOpen={isDiscountModalOpen}
        setIsDiscountModalOpen={setIsDiscountModalOpen}
        cartItems={cartItems}
        cartDiscountPercent={cartDiscountPercent}
        discountModalSelectedItem={discountModalSelectedItem}
        onApplyCustomDiscount={handleApplyCustomDiscount}
        paymentModalMethod={paymentModalMethod}
        setPaymentModalMethod={setPaymentModalMethod}
        storeConfig={storeConfig}
        onCompleteSale={handleCompleteSale}
        onOpenCashDrawer={handleOpenCashDrawer}
        refundTargetSale={refundTargetSale}
        setRefundTargetSale={setRefundTargetSale}
        onProcessRefund={handleProcessRefund}
        isCalendarModalOpen={isCalendarModalOpen}
        setIsCalendarModalOpen={setIsCalendarModalOpen}
        salesHistory={salesHistory}
        onNavigateToHistory={(dateStr) => {
          setHistoryDateFilter(dateStr);
          setActiveTab('history');
        }}
        currentReceiptData={currentReceiptData}
        setCurrentReceiptData={setCurrentReceiptData}
        showUnsentModal={showUnsentModal}
        unsentSummary={unsentSummary}
        unsentSales={unsentSales}
        isFlushingUnsent={isFlushingUnsent}
        onSendUnsent={handleSendUnsent}
        onCloseUnsent={handleCloseUnsentModal}
        showSyncModal={showSyncModal}
        pendingSyncCount={pendingSyncCount}
        isSyncingQueue={isSyncingQueue}
        onSyncQueueNow={handleSyncQueueNow}
        onSnoozeSync={handleSnoozeSync}
        showShutdownModal={showShutdownModal}
        setShowShutdownModal={setShowShutdownModal}
        isAppLocked={isAppLocked}
        onUnlockApp={unlockApp}
        unknownBarcode={unknownBarcode}
        onCloseUnknownBarcode={() => setUnknownBarcode(null)}
        categories={categories}
        itemMultiplier={itemMultiplier}
        onSaveAndAddUnknownBarcode={handleSaveAndAddUnknownBarcode}
        undoToast={undoToast}
        onUndoLastAction={undoLastAction}
        onDismissUndoToast={dismissUndoToast}
        flashBanner={flashBanner}
        onDismissFlashBanner={() => setFlashBanner(null)}
        priceCheckItem={priceCheckItem}
        setPriceCheckItem={setPriceCheckItem}
        unknownPriceCheckBarcode={unknownPriceCheckBarcode}
        setUnknownPriceCheckBarcode={setUnknownPriceCheckBarcode}
        onAddToCartFromPriceCheck={handleAddToCart}
        onCreateProductFromPriceCheck={(code) => setUnknownBarcode(code)}
        isCustomItemModalOpen={isCustomItemModalOpen}
        setIsCustomItemModalOpen={setIsCustomItemModalOpen}
        onAddToCartFromCustomItem={handleAddToCart}
        isParkedModalOpen={isParkedModalOpen}
        setIsParkedModalOpen={setIsParkedModalOpen}
        parkedCarts={parkedCarts}
        onParkCart={parkCurrentCart}
        onRestoreParkedCart={restoreParkedCart}
        onDeleteParkedCart={deleteParkedCart}
        onUpdateParkedCartNote={updateParkedCartNote}
        isCashMovementModalOpen={isCashMovementModalOpen}
        setIsCashMovementModalOpen={setIsCashMovementModalOpen}
        isZReportModalOpen={isZReportModalOpen}
        setIsZReportModalOpen={setIsZReportModalOpen}
        currentShift={currentShift}
        onMovementRecorded={(res) => {
          if (res?.shift) setCurrentShift(res.shift);
          else fetchShiftData();
        }}
        onShiftClosed={() => {
          fetchShiftData();
        }}
        weightModalPreset={weightModalPreset}
        setWeightModalPreset={setWeightModalPreset}
        onAddToCartFromWeightModal={handleAddToCart}
      />
    </div>
  );
}
