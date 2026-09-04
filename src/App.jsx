import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { usePosCatalog } from './hooks/usePosCatalog';
import { soundFx } from './utils/audio';
import { calculateCartTotals } from './utils/tax';
import { getStorageItem, setStorageItem, removeStorageItem } from './utils/storage';
import { DEFAULT_STORE_CONFIG } from './data/initialData';
import {
  createSaleBackend,
  fetchSalesHistoryBackend,
  normalizeSale,
  updateSaleRefundStatusBackend,
  fetchStoreConfigBackend,
  saveStoreConfigBackend,
  broadcastCustomerDisplay,
  deleteSaleBackend,
  purgeAllSalesBackend,
  openCashDrawerBackend,
  printDailySummaryBackend
} from './api/posApi';
import { formatLocalDate } from './utils/dateUtils';
import SalesHistoryView from './components/SalesHistoryView';
import AnalyticsView from './components/AnalyticsView';
import PresetsCatalogView from './components/PresetsCatalogView';
import InventoryView from './components/InventoryView';
import SettingsView from './components/SettingsView';
import CustomerDisplayView from './components/CustomerDisplayView';

export default function App() {
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
  const [unknownBarcode, setUnknownBarcode] = useState(null);
  const [mobilePosTab, setMobilePosTab] = useState('keypad');
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

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

  const {
    isAppLocked,
    setIsAppLocked,
    unlockApp
  } = useAutoLock(storeConfig?.autoLockMinutes);

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
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [paymentModalMethod, setPaymentModalMethod] = useState(null); // 'cash' | 'card' | 'split' | null
  const [currentReceiptData, setCurrentReceiptData] = useState(null);
  const [refundTargetSale, setRefundTargetSale] = useState(null);

  // Open Cash Drawer Handler
  const handleOpenCashDrawer = async () => {
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
  };

  // Admin Mode & Test Sales Management
  const handleToggleAdminMode = () => {
    setIsAdminMode(!isAdminMode);
  };

  const handleDeleteSale = async (saleId) => {
    if (window.confirm('Opravdu chcete smazat tento testovací prodej? Tržby se okamžitě přepočítají.')) {
      setSalesHistory(prev => prev.filter(s => s.id !== saleId));
      await deleteSaleBackend(saleId);
    }
  };

  const handleClearAllTestSales = async () => {
    if (window.confirm('Opravdu chcete smazat VŠECHNY testovací prodeje? Všechny rozpracované účtenky budou vymazány.')) {
      setSalesHistory([]);
      await purgeAllSalesBackend();
    }
  };

  // Refund / Storno processing handler
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
      totalAmount: -totalRefundAmount,
      cartDiscountPercent: originalSale.cartDiscountPercent || 0,
      paymentMethod,
      tenderedAmount: paymentMethod === 'cash' ? -totalRefundAmount : 0,
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

    createSaleBackend(stornoSale).then(backendRes => {
      if (backendRes && backendRes.status === 'SUCCESS') {
        const enrichedStorno = normalizeSale({
          ...stornoSale,
          fik: backendRes.fik,
          pok: backendRes.fik,
          bkp: backendRes.bkp,
          pkp: backendRes.pkp,
          eet_status: backendRes.eet_status || 'EVD_OK'
        });
        setSalesHistory(prev => prev.map(s => s.id === stornoSale.id ? enrichedStorno : s));
        setCurrentReceiptData(prev => prev && prev.id === stornoSale.id ? enrichedStorno : prev);
      }
    });

    updateSaleRefundStatusBackend(originalSale.id, newRefundStatus, updatedRefundedAmount);

    setSalesHistory(prev => [stornoSale, ...prev.map(s => s.id === originalSale.id ? updatedOriginalSale : s)]);
    setRefundTargetSale(null);
    setCurrentReceiptData(stornoSale);
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
    const offlinePending = salesHistory.filter(s => s.eet_status === 'OFFLINE_PENDING' || s.eetStatus === 'OFFLINE_PENDING' || s.is_sent_to_eet === false);
    const recentCompleted = salesHistory.filter(s => s.eet_status !== 'OFFLINE_PENDING' && s.eetStatus !== 'OFFLINE_PENDING' && s.is_sent_to_eet !== false).slice(0, 50);
    setStorageItem('sales', [...offlinePending, ...recentCompleted]);
  }, [salesHistory]);

  // Load store config & sales history from SQLite backend on mount
  useEffect(() => {
    let lastFocusReload = 0;

    const reloadBackendData = (isInitial = false) => {
      fetchStoreConfigBackend().then(data => {
        if (data && typeof data === 'object') {
          setStoreConfig(prev => ({ ...prev, ...data }));
        }
      });
      fetchSalesHistoryBackend({ limit: isInitial ? 100 : 50 }).then(backendSales => {
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
              (s.eet_status === 'OFFLINE_PENDING' || s.eetStatus === 'OFFLINE_PENDING' || s.is_sent_to_eet === false) &&
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
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const handleSaveStoreConfig = async (newConfig) => {
    setStoreConfig(newConfig);
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
    }
  });

  const handleOpenCustomDiscountModal = (item = null) => {
    setDiscountModalSelectedItem(item);
    setIsDiscountModalOpen(true);
  };

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
  const handleOpenPayment = (method) => {
    if (cartItems.length === 0) return;
    setPaymentModalMethod(method);
  };

  const handleCompleteSale = ({ paymentMethod, splitDetails, tenderedAmount, changeDue }) => {
    soundFx.playSuccessChime();
    const {
      finalGrandTotal,
      taxSummary
    } = calculateCartTotals(cartItems, cartDiscountPercent);

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

    const newSale = normalizeSale({
      id: `sale-${Date.now()}`,
      receiptNumber: nextReceiptNum,
      timestamp: new Date().toISOString(),
      items: cartItems.map(item => ({
        id: item.id || `item-${Date.now()}`,
        name: item.name,
        price: parseFloat(item.price),
        quantity: item.quantity,
        vat: item.vat !== undefined ? parseInt(item.vat, 10) : 21,
        discount_percent: item.discountPercent || 0
      })),
      totalAmount: paymentMethod === 'cash' ? Math.round(finalGrandTotal) : finalGrandTotal,
      cashRounding: paymentMethod === 'cash' ? Math.round((Math.round(finalGrandTotal) - finalGrandTotal + Number.EPSILON) * 100) / 100 : 0,
      cartDiscountPercent,
      paymentMethod,
      splitDetails: splitDetails || null,
      tenderedAmount: paymentMethod === 'cash' ? tenderedAmount : finalGrandTotal,
      changeDue: paymentMethod === 'cash' ? changeDue : 0,
      taxSummary
    });

    createSaleBackend(newSale).then(backendRes => {
      if (backendRes && (backendRes.status === 'SUCCESS' || backendRes.status === 'ALREADY_EXISTS')) {
        const assignedRn = backendRes.receipt_number || newSale.receiptNumber;
        if (assignedRn && assignedRn.startsWith(yearPrefix)) {
          const num = parseInt(assignedRn.slice(yearPrefix.length), 10);
          if (!isNaN(num)) {
            const curSeq = parseInt(getStorageItem('last_receipt_seq', '0'), 10) || 0;
            if (num > curSeq) setStorageItem('last_receipt_seq', String(num));
          }
        }
        const enrichedSale = normalizeSale({
          ...newSale,
          receiptNumber: assignedRn,
          fik: backendRes.fik,
          pok: backendRes.fik,
          bkp: backendRes.bkp,
          pkp: backendRes.pkp,
          eet_status: backendRes.eet_status || 'EVD_OK'
        });
        setSalesHistory(prev => prev.map(s => s.id === newSale.id ? enrichedSale : s));
        setCurrentReceiptData(prev => prev && prev.id === newSale.id ? enrichedSale : prev);
      }
    });

    setSalesHistory(prev => [newSale, ...prev]);
    setCurrentReceiptData(newSale);
    setPaymentModalMethod(null);
    setCartItems([]);
    setCartDiscountPercent(0);

    setFlashBanner({
      type: 'SUCCESS',
      message: 'Zaplaceno!',
      amount: finalGrandTotal
    });
  };

  const handleResetData = () => {
    if (window.confirm('Opravdu chcete resetovat zálohy a vrátit výchozí nastavení?')) {
      removeStorageItem('presets');
      removeStorageItem('config');
      removeStorageItem('sales');
      setPresets(DEFAULT_PRESETS);
      setStoreConfig(DEFAULT_STORE_CONFIG);
      setSalesHistory([]);
      setCartItems([]);
    }
  };

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
        onOpenSyncModal={() => setShowSyncModal(true)}
        onOpenShutdownModal={() => setShowShutdownModal(true)}
        onOpenCalendarModal={() => setIsCalendarModalOpen(true)}
        onLockApp={() => setIsAppLocked(true)}
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
        {activeTab === 'register' && (
          <>
            <div className={`pos-layout cart-layout-${storeConfig?.cartPosition || 'middle'}`}>
              <div className={`pos-col-left${isMobile && mobilePosTab !== 'keypad' ? ' mobile-hidden' : ''}`}>
                <ManualKeypad
                  onAddToCart={handleAddToCart}
                  amountStr={keypadAmount}
                  setAmountStr={setKeypadAmount}
                  itemMultiplier={itemMultiplier}
                  setItemMultiplier={setItemMultiplier}
                  defaultVat={storeConfig?.defaultVat !== undefined ? parseInt(storeConfig.defaultVat, 10) : 21}
                  onOpenCashDrawer={handleOpenCashDrawer}
                  onPrintDailySummary={handlePrintDailySummary}
                  onApplyDiscount={handleApplyCartDiscount}
                  parkedCarts={parkedCarts}
                  onParkCart={parkCurrentCart}
                  onRestoreParkedCart={restoreParkedCart}
                  onDeleteParkedCart={deleteParkedCart}
                  onUpdateParkedCartNote={updateParkedCartNote}
                  isParkedModalOpen={isParkedModalOpen}
                  onParkedModalOpenChange={setIsParkedModalOpen}
                  hasCartItems={cartItems.length > 0}
                  salesHistory={salesHistory}
                  shiftWidgetPosition={storeConfig?.shiftWidgetPosition || 'keypad'}
                />
              </div>

              <div className={`pos-col-center${isMobile && mobilePosTab !== 'products' ? ' mobile-hidden' : ''}`}>
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
                      onClearKeypadAmount={() => setKeypadAmount('')}
                      isAdminMode={isAdminMode}
                      storeConfig={storeConfig}
                    />
                  </div>
                </div>
                {storeConfig?.shiftWidgetPosition === 'bottom_presets' && (
                  <ShiftStatsWidget
                    variant="slim"
                    salesHistory={salesHistory}
                    onPrintDailySummary={handlePrintDailySummary}
                  />
                )}
              </div>

              <div className={`pos-col-right${isMobile && mobilePosTab !== 'cart' ? ' mobile-hidden' : ''}`}>
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
                  onOpenParkedModal={() => setIsParkedModalOpen(true)}
                  cartItemStyle={storeConfig?.cartItemStyle || 'elevated-card'}
                />
              </div>
            </div>

            {isMobile && (
              <div className="mobile-pos-tabs">
                <button
                  className={`mobile-pos-tab ${mobilePosTab === 'keypad' ? 'active' : ''}`}
                  onClick={() => setMobilePosTab('keypad')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="10" x2="8" y2="10"/><line x1="12" y1="10" x2="12" y2="10"/><line x1="16" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="8" y2="14"/><line x1="12" y1="14" x2="12" y2="14"/><line x1="16" y1="14" x2="16" y2="14"/><line x1="12" y1="18" x2="12" y2="18"/></svg>
                  Klávesy
                </button>
                <button
                  className={`mobile-pos-tab ${mobilePosTab === 'products' ? 'active' : ''}`}
                  onClick={() => setMobilePosTab('products')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="18" rx="2"/><path d="M2 8h20"/><path d="M9 3v5"/></svg>
                  Produkty
                </button>
                <button
                  className={`mobile-pos-tab ${mobilePosTab === 'cart' ? 'active' : ''}`}
                  onClick={() => setMobilePosTab('cart')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                  Košík
                  {cartItems.length > 0 && (
                    <span className="mobile-cart-badge">{cartItems.length}</span>
                  )}
                </button>
              </div>
            )}
          </>
        )}

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
            onInitiateRefund={setRefundTargetSale}
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
      />
    </div>
  );
}
