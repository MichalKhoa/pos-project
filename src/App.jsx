import React, { useState, useEffect, useCallback, useRef } from 'react';
import Navbar from './components/Navbar';
import QuickPresetGrid from './components/QuickPresetGrid';
import ManualKeypad from './components/ManualKeypad';
import Cart from './components/Cart';
import ToastUndo from './components/ToastUndo';
import { useCart } from './hooks/useCart';
import PaymentModal from './components/PaymentModal';
import ReceiptModal from './components/ReceiptModal';
import SalesHistoryView from './components/SalesHistoryView';
import PresetsCatalogView from './components/PresetsCatalogView';
import InventoryView from './components/InventoryView';
import SettingsView from './components/SettingsView';
import PendingSyncModal from './components/PendingSyncModal';
import SyncNotificationBanner from './components/SyncNotificationBanner';
import CheckoutFlashBanner from './components/CheckoutFlashBanner';
import ShutdownModal from './components/ShutdownModal';
import RefundModal from './components/RefundModal';
import CalendarModal from './components/CalendarModal';
import DiscountModal from './components/DiscountModal';
import LockScreenModal from './components/LockScreenModal';
import CustomerDisplayView from './components/CustomerDisplayView';
import { soundFx } from './utils/audio';
import { DEFAULT_CATEGORIES, DEFAULT_PRESETS, DEFAULT_STORE_CONFIG } from './data/initialData';
import { createSaleBackend, fetchEetStatus, processEetQueue, fetchSalesHistoryBackend, normalizeSale, updateSaleRefundStatusBackend, fetchCategoriesBackend, saveCategoryBackend, deleteCategoryBackend, fetchPresetsBackend, savePresetBackend, deletePresetBackend, reorderPresetsBackend, fetchStoreConfigBackend, saveStoreConfigBackend, broadcastCustomerDisplay, deleteSaleBackend, purgeAllSalesBackend, openCashDrawerBackend } from './api/posApi';

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

  const sanitizePresets = (list) => {
    if (!Array.isArray(list)) return list;
    return list.map(p => {
      if (p && p.isGeneralPreset) {
        return { ...p, trackStock: false, stockQuantity: 0 };
      }
      return p;
    });
  };

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
    addToCart,
    addItem: handleAddItem,
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

  const computedTotalAmount = cartItems.reduce((sum, item) => {
    const disc = item.discountPercent || 0;
    const effectivePrice = item.price * (1 - disc / 100);
    return sum + (effectivePrice * item.quantity);
  }, 0) * (1 - cartDiscountPercent / 100);

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

    // Send storno transaction to backend
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

    // Send refund status update for original sale to backend
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

  // Load categories, presets & store config from SQLite backend on mount (overrides localStorage)
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
            // Keep local offline pending sales that aren't yet in backend DB
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

    // Multi-tab storage sync: listen to changes originating from other browser tabs
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

    // Re-fetch backend DB state when window receives focus
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

  // Check pending offline receipts from backend EET status
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

  // Check on mount, on window 'online' event (internet regained), and periodically every 30s
  useEffect(() => {
    checkPendingOfflineSales(true);

    const handleOnline = () => {
      console.log('Internet connectivity restored! Checking pending EET queue...');
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

  // Intercept window close button (X) -> prompt user on close & trigger backend shutdown on exit
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
    // Snooze modal for 5 minutes
    setSnoozedUntil(Date.now() + 5 * 60 * 1000);
    setShowSyncModal(false);
  };

  const handleSyncQueueNow = async () => {
    // Instantly close modal for zero UI delay
    setShowSyncModal(false);
    setIsSyncingQueue(true);
    setSnoozedUntil(Date.now() + 5 * 60 * 1000);

    try {
      // 1. Process backend SQLite queue
      const res = await processEetQueue();
      let processed = res?.processed_count || 0;

      // 2. Process any local offline sales stored in localStorage
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

      // 3. Refresh sales history from backend
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
    const itemPrice = parseFloat(item.price);
    const qtyToAdd = customQty !== null ? customQty : (item.quantity || itemMultiplier || 1);

    addToCart({
      ...item,
      price: itemPrice,
      vat: itemVat,
      discountPercent: item.discountPercent || 0
    }, qtyToAdd);

    if (itemMultiplier !== 1) {
      setItemMultiplier(1);
    }
  }, [addToCart, itemMultiplier, setItemMultiplier]);

  // Global Numpad & Physical Keyboard Listener for POS Register
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't process keypad input while lock screen is active
      if (isAppLocked) return;
      // Only process when in POS register tab and no payment modal is open
      if (activeTab !== 'register') return;

      // Ignore if user is currently typing in an input or select field
      const targetTag = e.target?.tagName?.toLowerCase();
      if (targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select') {
        return;
      }

      const key = e.key;

      // Digits 0-9 from main keyboard or Numpad
      if (/^[0-9]$/.test(key)) {
        e.preventDefault();
        setKeypadAmount(prev => {
          if (prev.includes('.')) {
            const parts = prev.split('.');
            if (parts[1] && parts[1].length >= 2) return prev;
          }
          return prev.length < 8 ? prev + key : prev;
        });
      }
      // Decimal point or comma
      else if (key === '.' || key === ',') {
        e.preventDefault();
        setKeypadAmount(prev => {
          if (prev.includes('.')) return prev;
          return prev ? prev + '.' : '0.';
        });
      }
      // Backspace -> delete last digit
      else if (key === 'Backspace') {
        e.preventDefault();
        setKeypadAmount(prev => prev.slice(0, -1));
      }
      // Escape or Delete -> Clear keypad amount & reset multiplier
      else if (key === 'Escape' || key === 'Delete') {
        e.preventDefault();
        setKeypadAmount('');
        setItemMultiplier(1);
      }
      // Multiplicator key (*, x, X)
      else if (key === '*' || key.toLowerCase() === 'x') {
        e.preventDefault();
        setKeypadAmount(prev => {
          if (prev && !prev.includes('.')) {
            const parsedQty = parseInt(prev, 10);
            if (!isNaN(parsedQty) && parsedQty >= 1 && parsedQty <= 99) {
              setItemMultiplier(parsedQty);
              return '';
            }
          }
          if (itemMultiplier > 1) {
            setItemMultiplier(1);
          }
          return prev;
        });
      }
      // Enter or Numpad Enter -> Add typed amount or open cash payment
      else if (key === 'Enter') {
        e.preventDefault();
        if (keypadAmount && parseFloat(keypadAmount) > 0) {
          handleAddToCart({
            id: `custom-${Date.now()}`,
            name: 'Volný prodej',
            price: parseFloat(keypadAmount),
            vat: storeConfig?.defaultVat !== undefined ? parseInt(storeConfig.defaultVat, 10) : 21,
            isCustom: true
          });
          setKeypadAmount('');
        } else if (cartItems.length > 0 && !paymentModalMethod) {
          setPaymentModalMethod('cash');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, keypadAmount, cartItems, paymentModalMethod, storeConfig, isAppLocked, handleAddToCart, itemMultiplier]);

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
    // Reassign items from deleted category so no presets are orphaned
    const fallbackCategory = categories.find(c => c.id !== 'all' && c.id !== catId)?.id || 'all';
    setPresets(prev => prev.map(p => {
      if (p.category !== catId) return p;
      const updated = { ...p, category: fallbackCategory };
      savePresetBackend(updated);
      return updated;
    }));
  };



  const roundCZK = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

  const handleOpenCustomDiscountModal = (item = null) => {
    setDiscountModalSelectedItem(item);
    setIsDiscountModalOpen(true);
  };

  const handleApplyCustomDiscount = ({ type, value, scope, itemId }) => {
    if (scope === 'item' && itemId) {
      setCartItems(prev => prev.map(item => {
        if (item.id !== itemId) return item;
        if (type === 'percent') {
          return { ...item, discountPercent: Math.min(100, value) };
        } else {
          const itemGross = item.price * item.quantity;
          const pct = itemGross > 0 ? (value / itemGross) * 100 : 0;
          return { ...item, discountPercent: Math.min(100, Math.round(pct * 10) / 10) };
        }
      }));
    } else {
      // Scope === 'cart'
      if (type === 'percent') {
        setCartDiscountPercent(Math.min(100, value));
      } else {
        const rawSubtotal = cartItems.reduce((sum, item) => {
          const disc = item.discountPercent || 0;
          const effectivePrice = item.price * (1 - disc / 100);
          return sum + (effectivePrice * item.quantity);
        }, 0);

        const pct = rawSubtotal > 0 ? (value / rawSubtotal) * 100 : 0;
        setCartDiscountPercent(Math.min(100, Math.round(pct * 10) / 10));
      }
    }
  };

  // Preset operations
  const handleAddPreset = (newPreset) => {
    const withPosition = { ...newPreset, position: 0 };
    setPresets(prev => [withPosition, ...prev]);
    savePresetBackend(withPosition);
  };

  const handleUpdatePreset = (updatedPreset) => {
    setPresets(prev => prev.map(p => p.id === updatedPreset.id ? updatedPreset : p));
    savePresetBackend(updatedPreset);
  };

  const handleDeletePreset = (presetId) => {
    setPresets(prev => prev.filter(p => p.id !== presetId));
    deletePresetBackend(presetId);
  };

  const handleReorderPresets = (reorderedPresets) => {
    setPresets(reorderedPresets);
    reorderPresetsBackend(reorderedPresets);
  };

  // Checkout flow
  const handleOpenPayment = (method) => {
    if (cartItems.length === 0) return;
    setPaymentModalMethod(method);
  };

  const handleCompleteSale = ({ paymentMethod, splitDetails, tenderedAmount, changeDue }) => {
    soundFx.playSuccessChime();
    const rawSubtotal = roundCZK(cartItems.reduce((sum, item) => {
      const disc = item.discountPercent || 0;
      const effectivePrice = item.price * (1 - disc / 100);
      return sum + (effectivePrice * item.quantity);
    }, 0));

    const cartDiscountAmount = roundCZK(rawSubtotal * (cartDiscountPercent / 100));
    const finalGrandTotal = Math.max(0, roundCZK(rawSubtotal - cartDiscountAmount));
    const cartDiscountFactor = rawSubtotal > 0 ? finalGrandTotal / rawSubtotal : 1;

    // Calculate tax summary
    const taxSummary = cartItems.reduce((acc, item) => {
      const rate = item.vat !== undefined && item.vat !== null ? parseInt(item.vat, 10) : 21;
      const itemDisc = item.discountPercent || 0;
      const itemEffectivePrice = item.price * (1 - itemDisc / 100);
      const itemGrossBeforeCartDisc = itemEffectivePrice * item.quantity;
      const itemFinalGross = roundCZK(itemGrossBeforeCartDisc * cartDiscountFactor);

      let netPrice = itemFinalGross;
      let taxAmount = 0;

      if (rate > 0) {
        netPrice = roundCZK(itemFinalGross / (1 + rate / 100));
        taxAmount = roundCZK(itemFinalGross - netPrice);
      }

      if (!acc[rate]) {
        acc[rate] = { rate, gross: 0, net: 0, tax: 0 };
      }
      acc[rate].gross = roundCZK(acc[rate].gross + itemFinalGross);
      acc[rate].net = roundCZK(acc[rate].net + netPrice);
      acc[rate].tax = roundCZK(acc[rate].tax + taxAmount);
      return acc;
    }, {});

    // Robust receipt numbering: YYYY-XXXXXX (dynamic year, 6-digit counter up to 999,999/yr, duplicate-safe)
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

    // Asynchronously send to Python FastAPI backend for EET fiscalization and atomic receipt numbering
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
            <div className={`pos-layout ${(storeConfig?.cartPosition || 'left') === 'left' ? 'cart-layout-left' : 'cart-layout-right'}`}>
              <div className={`pos-col-left${isMobile && mobilePosTab !== 'keypad' ? ' mobile-hidden' : ''}`}>
                <ManualKeypad
                  onAddToCart={handleAddToCart}
                  amountStr={keypadAmount}
                  setAmountStr={setKeypadAmount}
                  itemMultiplier={itemMultiplier}
                  setItemMultiplier={setItemMultiplier}
                  defaultVat={storeConfig?.defaultVat !== undefined ? parseInt(storeConfig.defaultVat, 10) : 21}
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

      {/* Custom Discount Modal */}
      <DiscountModal
        isOpen={isDiscountModalOpen}
        onClose={() => setIsDiscountModalOpen(false)}
        totalAmount={cartItems.reduce((sum, item) => {
          const disc = item.discountPercent || 0;
          return sum + (item.price * (1 - disc / 100) * item.quantity);
        }, 0)}
        cartItems={cartItems}
        selectedItem={discountModalSelectedItem}
        onApplyDiscount={handleApplyCustomDiscount}
      />

      {/* Payment Modal */}
      {paymentModalMethod && (
        <PaymentModal
          method={paymentModalMethod}
          storeConfig={storeConfig}
          totalAmount={Math.round((cartItems.reduce((sum, item) => {
            const disc = item.discountPercent || 0;
            return sum + (item.price * (1 - disc / 100) * item.quantity);
          }, 0) * (1 - cartDiscountPercent / 100) + Number.EPSILON) * 100) / 100}
          onClose={() => setPaymentModalMethod(null)}
          onCompleteSale={handleCompleteSale}
          onOpenCashDrawer={handleOpenCashDrawer}
        />
      )}

      {/* Refund / Storno Modal */}
      {refundTargetSale && (
        <RefundModal
          sale={refundTargetSale}
          onClose={() => setRefundTargetSale(null)}
          onConfirmRefund={handleProcessRefund}
        />
      )}

      {/* Calendar & Shift Overview Modal */}
      {isCalendarModalOpen && (
        <CalendarModal
          salesHistory={salesHistory}
          onClose={() => setIsCalendarModalOpen(false)}
          onNavigateToHistory={(dateStr) => {
            setHistoryDateFilter(dateStr);
            setActiveTab('history');
          }}
        />
      )}

      {/* Printable Receipt Modal */}
      {currentReceiptData && (
        <ReceiptModal
          saleData={currentReceiptData}
          storeConfig={storeConfig}
          onClose={() => setCurrentReceiptData(null)}
          onNewSale={() => setCurrentReceiptData(null)}
        />
      )}

      {/* Pending Offline Sales Sync Modal */}
      {showSyncModal && pendingSyncCount > 0 && (
        <PendingSyncModal
          pendingCount={pendingSyncCount}
          isLoading={isSyncingQueue}
          onSync={handleSyncQueueNow}
          onSnooze={handleSnoozeSync}
        />
      )}

      {/* End-of-Shift Shutdown Modal */}
      {showShutdownModal && (
        <ShutdownModal
          pendingCount={pendingSyncCount}
          onClose={() => setShowShutdownModal(false)}
        />
      )}

      {/* Cashier Lock Screen Modal Overlay */}
      {isAppLocked && (
        <LockScreenModal
          storeConfig={storeConfig}
          onUnlock={() => {
            setIsAppLocked(false);
            lastActivityRef.current = Date.now();
          }}
        />
      )}
      {/* Toast Undo Notification Overlay */}
      <ToastUndo
        undoToast={undoToast}
        onUndo={undoLastAction}
        onDismiss={dismissUndoToast}
      />

      {/* Visual Scan & Checkout Flash Banner */}
      <CheckoutFlashBanner
        flashBanner={flashBanner}
        onDismiss={() => setFlashBanner(null)}
      />
    </div>
  );
}
