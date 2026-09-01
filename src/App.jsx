import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Navbar from './components/Navbar';
import QuickPresetGrid from './components/QuickPresetGrid';
import ManualKeypad from './components/ManualKeypad';
import Cart from './components/Cart';
import AppModals from './components/app/AppModals';
import SyncNotificationBanner from './components/SyncNotificationBanner';
import { useCart } from './hooks/useCart';
import { usePosKeyboardShortcuts } from './hooks/usePosKeyboardShortcuts';
import { soundFx } from './utils/audio';
import { calculateCartTotals } from './utils/tax';
import { DEFAULT_CATEGORIES, DEFAULT_PRESETS, DEFAULT_STORE_CONFIG } from './data/initialData';
import {
  createSaleBackend,
  fetchEetStatus,
  processEetQueue,
  fetchSalesHistoryBackend,
  normalizeSale,
  updateSaleRefundStatusBackend,
  fetchCategoriesBackend,
  saveCategoryBackend,
  deleteCategoryBackend,
  fetchPresetsBackend,
  savePresetBackend,
  deletePresetBackend,
  reorderPresetsBackend,
  fetchStoreConfigBackend,
  saveStoreConfigBackend,
  broadcastCustomerDisplay,
  deleteSaleBackend,
  purgeAllSalesBackend,
  openCashDrawerBackend
} from './api/posApi';
import SalesHistoryView from './components/SalesHistoryView';
import PresetsCatalogView from './components/PresetsCatalogView';
import InventoryView from './components/InventoryView';
import SettingsView from './components/SettingsView';
import CustomerDisplayView from './components/CustomerDisplayView';

const sanitizePresets = (list) => {
  if (!Array.isArray(list)) return list;
  return list.map(p => {
    if (p && p.isGeneralPreset) {
      return { ...p, trackStock: false, stockQuantity: 0 };
    }
    return p;
  });
};

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
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showShutdownModal, setShowShutdownModal] = useState(false);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
  const [discountModalSelectedItem, setDiscountModalSelectedItem] = useState(null);
  const [historyDateFilter, setHistoryDateFilter] = useState(null);
  const [isSyncingQueue, setIsSyncingQueue] = useState(false);
  const [snoozedUntil, setSnoozedUntil] = useState(0);
  const [syncNotification, setSyncNotification] = useState(null);
  const [flashBanner, setFlashBanner] = useState(null);
  const [isAppLocked, setIsAppLocked] = useState(false);
  const [mobilePosTab, setMobilePosTab] = useState('keypad');
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);

  const lastActivityRef = useRef(Date.now());

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // State — start from localStorage fallback, backend load will overwrite on mount
  const [categories, setCategories] = useState(() => {
    try {
      const saved = localStorage.getItem('himmel_pos_categories');
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_CATEGORIES;
    } catch {
      return DEFAULT_CATEGORIES;
    }
  });

  const [presets, setPresets] = useState(() => {
    try {
      const saved = localStorage.getItem('himmel_pos_presets');
      const parsed = saved ? JSON.parse(saved) : null;
      const initial = Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_PRESETS;
      return sanitizePresets(initial);
    } catch {
      return sanitizePresets(DEFAULT_PRESETS);
    }
  });

  const [storeConfig, setStoreConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('himmel_pos_config');
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
      const saved = localStorage.getItem('himmel_pos_sales');
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
    addToCart,
    updateQuantity: handleUpdateQty,
    updateItemDiscount: handleUpdateItemDiscount,
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

  // Sync to LocalStorage (offline fallback)
  useEffect(() => {
    localStorage.setItem('himmel_pos_categories', JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem('himmel_pos_presets', JSON.stringify(presets));
  }, [presets]);

  useEffect(() => {
    if (storeConfig) {
      const safeConfig = { ...storeConfig };
      delete safeConfig.cashierPin;
      localStorage.setItem('himmel_pos_config', JSON.stringify(safeConfig));
    }
  }, [storeConfig]);

  useEffect(() => {
    localStorage.setItem('himmel_pos_sales', JSON.stringify(salesHistory));
  }, [salesHistory]);

  // Load categories, presets & store config from SQLite backend on mount
  useEffect(() => {
    const reloadBackendData = () => {
      fetchCategoriesBackend().then(data => {
        if (Array.isArray(data) && data.length > 0) setCategories(data);
      });
      fetchPresetsBackend().then(data => {
        if (Array.isArray(data) && data.length > 0) setPresets(sanitizePresets(data));
      });
      fetchStoreConfigBackend().then(data => {
        if (data && typeof data === 'object') {
          setStoreConfig(prev => ({ ...prev, ...data }));
        }
      });
      fetchSalesHistoryBackend().then(backendSales => {
        if (Array.isArray(backendSales) && backendSales.length > 0) {
          setSalesHistory(prev => {
            const backendIds = new Set(backendSales.map(s => s.id));
            const backendReceipts = new Set(backendSales.map(s => s.receiptNumber).filter(Boolean));
            const pendingLocalSales = prev.filter(s => 
              (s.eet_status === 'OFFLINE_PENDING' || s.eetStatus === 'OFFLINE_PENDING' || s.is_sent_to_eet === false) &&
              !backendIds.has(s.id) &&
              !backendReceipts.has(s.receiptNumber)
            );
            const merged = [...pendingLocalSales, ...backendSales];
            merged.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            return merged;
          });
        }
      });
    };

    reloadBackendData();

    const handleStorageChange = (e) => {
      if (!e.key || !e.newValue) return;
      try {
        const data = JSON.parse(e.newValue);
        if (e.key === 'himmel_pos_categories' && Array.isArray(data)) {
          setCategories(data);
        } else if (e.key === 'himmel_pos_presets' && Array.isArray(data)) {
          setPresets(sanitizePresets(data));
        } else if (e.key === 'himmel_pos_config' && typeof data === 'object') {
          setStoreConfig(prev => ({ ...prev, ...data }));
        } else if (e.key === 'himmel_pos_sales' && Array.isArray(data)) {
          setSalesHistory(data);
        }
      } catch (err) {
        console.warn("Multi-tab storage sync error:", err);
      }
    };

    const handleFocus = () => {
      reloadBackendData();
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

  const checkPendingOfflineSales = useCallback(async () => {
    try {
      const eetStatus = await fetchEetStatus();
      if (eetStatus && typeof eetStatus.pending_offline_sales === 'number') {
        const count = eetStatus.pending_offline_sales;
        setPendingSyncCount(count);

        if (count > 0) {
          const now = Date.now();
          if (now >= snoozedUntil) {
            setShowSyncModal(true);
          }
        } else {
          setShowSyncModal(false);
        }
      }
    } catch (err) {
      console.warn('EET status check error:', err);
    }
  }, [snoozedUntil]);

  useEffect(() => {
    checkPendingOfflineSales(true);

    const handleOnline = () => {
      checkPendingOfflineSales(true);
    };

    window.addEventListener('online', handleOnline);
    const interval = setInterval(() => {
      checkPendingOfflineSales(false);
    }, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      clearInterval(interval);
    };
  }, [checkPendingOfflineSales]);

  // Auto-lock cashier app on 15 minutes of inactivity
  useEffect(() => {
    const handleUserActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach(evt => window.addEventListener(evt, handleUserActivity));

    const checkInterval = setInterval(() => {
      const minutesLimit = storeConfig?.autoLockMinutes !== undefined ? storeConfig.autoLockMinutes : 15;
      if (minutesLimit > 0 && !isAppLocked) {
        const elapsedMs = Date.now() - lastActivityRef.current;
        if (elapsedMs >= minutesLimit * 60 * 1000) {
          setIsAppLocked(true);
        }
      }
    }, 10000);

    return () => {
      events.forEach(evt => window.removeEventListener(evt, handleUserActivity));
      clearInterval(checkInterval);
    };
  }, [storeConfig?.autoLockMinutes, isAppLocked]);

  // Intercept window close button (X)
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };

    const handleUnload = () => {
      const host = window.location.hostname || 'localhost';
      const shutdownUrl = `http://${host}:8000/api/v1/system/shutdown`;
      if (navigator.sendBeacon) {
        navigator.sendBeacon(shutdownUrl);
      } else {
        fetch(shutdownUrl, { method: 'POST', keepalive: true }).catch(() => {});
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleUnload);
    };
  }, []);

  const handleSnoozeSync = () => {
    setSnoozedUntil(Date.now() + 5 * 60 * 1000);
    setShowSyncModal(false);
  };

  const handleSyncQueueNow = async () => {
    setShowSyncModal(false);
    setIsSyncingQueue(true);
    setSnoozedUntil(Date.now() + 5 * 60 * 1000);

    try {
      const res = await processEetQueue();
      let processed = res?.processed_count || 0;

      const offlineLocalSales = salesHistory.filter(s => s.eet_status === 'OFFLINE_PENDING' || s.is_sent_to_eet === false);
      for (const localSale of offlineLocalSales) {
        const backendRes = await createSaleBackend(localSale);
        if (backendRes && (backendRes.status === 'SUCCESS' || backendRes.status === 'ALREADY_EXISTS')) {
          processed += 1;
        }
      }

      if (res?.status === 'EET_DISABLED') {
        setSyncNotification({
          type: 'info',
          message: 'EET evidování je v nastavení vypnuto.'
        });
      } else if (processed > 0) {
        setSyncNotification({
          type: 'success',
          message: `✅ Úspěšně odesláno ${processed} neodeslaných účtenek na EET (Finanční správa ČR).`
        });
      } else if (offlineLocalSales.length > 0 || (res?.processed_count === 0 && res?.status === 'SUCCESS')) {
        setSyncNotification({
          type: 'error',
          message: '⚠️ Nepodařilo se odeslat neodeslané účtenky na EET (server je nedostupný nebo vypršel časový limit).'
        });
      } else {
        setSyncNotification({
          type: 'success',
          message: 'Všechny tržby jsou již řádně evidovány na EET.'
        });
      }

      const updatedHistory = await fetchSalesHistoryBackend();
      if (Array.isArray(updatedHistory) && updatedHistory.length > 0) {
        setSalesHistory(updatedHistory);
      }
    } catch (err) {
      setSyncNotification({
        type: 'error',
        message: `Chyba při komunikaci s EET serverem: ${err.message}`
      });
    } finally {
      setIsSyncingQueue(false);
      const eetStatus = await fetchEetStatus();
      if (eetStatus && typeof eetStatus.pending_offline_sales === 'number') {
        setPendingSyncCount(eetStatus.pending_offline_sales);
      }
    }
  };

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

  // Hook for hardware keyboard and numpad listeners
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
    storeConfig
  });

  // Category handlers
  const handleAddCategory = (name) => {
    if (!name.trim()) return;
    const newCat = {
      id: `cat-${Date.now()}`,
      name: name.trim(),
      position: categories.length
    };
    setCategories(prev => [...prev, newCat]);
    saveCategoryBackend(newCat);
    return newCat.id;
  };

  const handleEditCategory = (catId, newName) => {
    if (!newName.trim() || catId === 'all') return;
    setCategories(prev => prev.map(c => {
      if (c.id !== catId) return c;
      const updated = { ...c, name: newName.trim() };
      saveCategoryBackend(updated);
      return updated;
    }));
  };

  const handleDeleteCategory = (catId) => {
    if (catId === 'all') return;
    setCategories(prev => prev.filter(c => c.id !== catId));
    deleteCategoryBackend(catId);
    const fallbackCategory = categories.find(c => c.id !== 'all' && c.id !== catId)?.id || 'all';
    setPresets(prev => prev.map(p => {
      if (p.category !== catId) return p;
      const updated = { ...p, category: fallbackCategory };
      savePresetBackend(updated);
      return updated;
    }));
  };

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

  // Preset handlers
  const handleAddPreset = async (presetData) => {
    const newPreset = {
      ...presetData,
      id: `preset-${Date.now()}`
    };
    setPresets(prev => sanitizePresets([...prev, newPreset]));
    await savePresetBackend(newPreset);
  };

  const handleUpdatePreset = async (updated) => {
    setPresets(prev => sanitizePresets(prev.map(p => p.id === updated.id ? updated : p)));
    await savePresetBackend(updated);
  };

  const handleDeletePreset = async (presetId) => {
    setPresets(prev => prev.filter(p => p.id !== presetId));
    await deletePresetBackend(presetId);
  };

  const handleReorderPresets = async (reordered) => {
    setPresets(sanitizePresets(reordered));
    await reorderPresetsBackend(reordered);
  };

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
    let maxSeq = 0;
    for (const s of salesHistory) {
      if (s.receiptNumber && s.receiptNumber.startsWith(yearPrefix)) {
        const num = parseInt(s.receiptNumber.slice(yearPrefix.length), 10);
        if (!isNaN(num) && num > maxSeq) maxSeq = num;
      }
    }
    const nextReceiptNum = `${currentYear}-${(maxSeq + 1).toString().padStart(6, '0')}`;

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
        const enrichedSale = normalizeSale({
          ...newSale,
          receiptNumber: backendRes.receipt_number || newSale.receiptNumber,
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
      localStorage.removeItem('himmel_pos_presets');
      localStorage.removeItem('himmel_pos_config');
      localStorage.removeItem('himmel_pos_sales');
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
                  onApplyDiscount={handleApplyCartDiscount}
                  parkedCarts={parkedCarts}
                  onParkCart={parkCurrentCart}
                  onRestoreParkedCart={restoreParkedCart}
                  onDeleteParkedCart={deleteParkedCart}
                  hasCartItems={cartItems.length > 0}
                />
              </div>

              <div className={`pos-col-center${isMobile && mobilePosTab !== 'products' ? ' mobile-hidden' : ''}`}>
                <QuickPresetGrid
                  presets={presets}
                  categories={categories}
                  itemMultiplier={itemMultiplier}
                  setItemMultiplier={setItemMultiplier}
                  onAddCategory={handleAddCategory}
                  onEditCategory={handleEditCategory}
                  onDeleteCategory={handleDeleteCategory}
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

              <div className={`pos-col-right${isMobile && mobilePosTab !== 'cart' ? ' mobile-hidden' : ''}`}>
                <Cart
                  cartItems={cartItems}
                  onUpdateQty={handleUpdateQty}
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
        onUnlockApp={() => {
          setIsAppLocked(false);
          lastActivityRef.current = Date.now();
        }}
        undoToast={undoToast}
        onUndoLastAction={undoLastAction}
        onDismissUndoToast={dismissUndoToast}
        flashBanner={flashBanner}
        onDismissFlashBanner={() => setFlashBanner(null)}
      />
    </div>
  );
}
