import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import QuickPresetGrid from './components/QuickPresetGrid';
import ManualKeypad from './components/ManualKeypad';
import Cart from './components/Cart';
import PaymentModal from './components/PaymentModal';
import ReceiptModal from './components/ReceiptModal';
import SalesHistoryView from './components/SalesHistoryView';
import PresetsCatalogView from './components/PresetsCatalogView';
import SettingsView from './components/SettingsView';
import PendingSyncModal from './components/PendingSyncModal';
import SyncNotificationBanner from './components/SyncNotificationBanner';
import ShutdownModal from './components/ShutdownModal';
import { DEFAULT_CATEGORIES, DEFAULT_PRESETS, DEFAULT_STORE_CONFIG } from './data/initialData';
import { createSaleBackend, fetchEetStatus, processEetQueue, fetchSalesHistoryBackend, normalizeSale } from './api/posApi';

export default function App() {
  const [activeTab, setActiveTab] = useState('register');
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showShutdownModal, setShowShutdownModal] = useState(false);
  const [isSyncingQueue, setIsSyncingQueue] = useState(false);
  const [snoozedUntil, setSnoozedUntil] = useState(0);
  const [syncNotification, setSyncNotification] = useState(null);

  // LocalStorage state initialization with safe fallbacks
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
      return Array.isArray(parsed) ? parsed : DEFAULT_PRESETS;
    } catch {
      return DEFAULT_PRESETS;
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
    // Initial sample transaction for demonstration
    return [
      normalizeSale({
        id: 'sale-1',
        receiptNumber: '2026-0001',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        items: [
          { name: 'Svíčka Vonná Premium', price: 249, quantity: 2, vat: 21 },
          { name: 'Hrnek Keramický 350ml', price: 149, quantity: 1, vat: 21 }
        ],
        totalAmount: 647,
        paymentMethod: 'cash',
        tenderedAmount: 1000,
        changeDue: 353,
        taxSummary: {
          21: { rate: 21, gross: 647, net: 534.71, tax: 112.29 }
        }
      })
    ];
  });

  const [cartItems, setCartItems] = useState([]);
  const [keypadAmount, setKeypadAmount] = useState('');
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [cartDiscountPercent, setCartDiscountPercent] = useState(0);
  const [paymentModalMethod, setPaymentModalMethod] = useState(null); // 'cash' | 'card' | 'split' | null
  const [currentReceiptData, setCurrentReceiptData] = useState(null);

  // Admin Mode & Test Sales Management
  const handleToggleAdminMode = () => {
    setIsAdminMode(!isAdminMode);
  };

  const handleDeleteSale = (saleId) => {
    if (window.confirm('Opravdu chcete smazat tento testovací prodej? Tržby se okamžitě přepočítají.')) {
      setSalesHistory(prev => prev.filter(s => s.id !== saleId));
    }
  };

  const handleClearAllTestSales = () => {
    if (window.confirm('Opravdu chcete smazat VŠECHNY testovací prodeje? Všechny rozpracované účtenky budou vymazány.')) {
      setSalesHistory([]);
    }
  };

  // Sync to LocalStorage
  useEffect(() => {
    localStorage.setItem('himmel_pos_categories', JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem('himmel_pos_presets', JSON.stringify(presets));
  }, [presets]);

  useEffect(() => {
    localStorage.setItem('himmel_pos_config', JSON.stringify(storeConfig));
  }, [storeConfig]);

  useEffect(() => {
    localStorage.setItem('himmel_pos_sales', JSON.stringify(salesHistory));
  }, [salesHistory]);

  // Check pending offline receipts from backend EET status
  const checkPendingOfflineSales = useCallback(async (forceOpen = false) => {
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

      setSyncNotification({
        type: 'success',
        message: processed > 0
          ? `✅ Úspěšně odesláno ${processed} neodeslaných účtenek na EET (Finanční správa ČR).`
          : 'Všechny tržby jsou již řádně evidovány na EET.'
      });

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

  // Global Numpad & Physical Keyboard Listener for POS Register
  useEffect(() => {
    const handleKeyDown = (e) => {
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
      // Escape or Delete -> Clear keypad amount
      else if (key === 'Escape' || key === 'Delete') {
        e.preventDefault();
        setKeypadAmount('');
      }
      // Enter or Numpad Enter -> Add typed amount or open cash payment
      else if (key === 'Enter') {
        e.preventDefault();
        if (keypadAmount && parseFloat(keypadAmount) > 0) {
          handleAddToCart({
            id: `custom-${Date.now()}`,
            name: 'Volný prodej',
            price: parseFloat(keypadAmount),
            vat: storeConfig?.defaultVat || 21,
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
  }, [activeTab, keypadAmount, cartItems, paymentModalMethod, storeConfig]);

  // Category handlers
  const handleAddCategory = (name) => {
    if (!name.trim()) return;
    const newCat = {
      id: `cat-${Date.now()}`,
      name: name.trim()
    };
    setCategories(prev => [...prev, newCat]);
    return newCat.id;
  };

  const handleDeleteCategory = (catId) => {
    if (catId === 'all') return;
    setCategories(prev => prev.filter(c => c.id !== catId));
  };

  // Cart operations
  const handleAddToCart = (item) => {
    const itemVat = item.vat !== undefined && item.vat !== null ? parseInt(item.vat, 10) : 21;
    const itemPrice = parseFloat(item.price);

    setCartItems(prevItems => {
      const existingIdx = prevItems.findIndex(i =>
        i.id === item.id &&
        Math.abs(parseFloat(i.price) - itemPrice) < 0.001 &&
        parseInt(i.vat ?? 21, 10) === itemVat &&
        (i.discountPercent || 0) === (item.discountPercent || 0)
      );

      if (existingIdx > -1) {
        const updated = [...prevItems];
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: updated[existingIdx].quantity + 1
        };
        return updated;
      } else {
        return [...prevItems, { ...item, price: itemPrice, vat: itemVat, quantity: 1, discountPercent: item.discountPercent || 0 }];
      }
    });
  };

  const handleUpdateQty = (itemId, newQty) => {
    if (newQty <= 0) {
      handleRemoveItem(itemId);
      return;
    }
    setCartItems(prev => prev.map(item => item.id === itemId ? { ...item, quantity: newQty } : item));
  };

  const handleUpdateItemDiscount = (itemId, discountPercent) => {
    setCartItems(prev => prev.map(item => item.id === itemId ? { ...item, discountPercent } : item));
  };

  const handleRemoveItem = (itemId) => {
    setCartItems(prev => prev.filter(item => item.id !== itemId));
  };

  const handleClearCart = () => {
    setCartItems([]);
    setCartDiscountPercent(0);
  };

  // Preset operations
  const handleAddPreset = (newPreset) => {
    setPresets(prev => [newPreset, ...prev]);
  };

  const handleUpdatePreset = (updatedPreset) => {
    setPresets(prev => prev.map(p => p.id === updatedPreset.id ? updatedPreset : p));
  };

  const handleDeletePreset = (presetId) => {
    setPresets(prev => prev.filter(p => p.id !== presetId));
  };

  const handleReorderPresets = (reorderedPresets) => {
    setPresets(reorderedPresets);
  };

  // Checkout flow
  const handleOpenPayment = (method) => {
    if (cartItems.length === 0) return;
    setPaymentModalMethod(method);
  };

  const handleCompleteSale = ({ paymentMethod, splitDetails, tenderedAmount, changeDue }) => {
    const rawSubtotal = cartItems.reduce((sum, item) => {
      const disc = item.discountPercent || 0;
      const effectivePrice = item.price * (1 - disc / 100);
      return sum + (effectivePrice * item.quantity);
    }, 0);

    const cartDiscountAmount = rawSubtotal * (cartDiscountPercent / 100);
    const finalGrandTotal = Math.max(0, rawSubtotal - cartDiscountAmount);
    const cartDiscountFactor = rawSubtotal > 0 ? finalGrandTotal / rawSubtotal : 1;

    // Calculate tax summary
    const taxSummary = cartItems.reduce((acc, item) => {
      const rate = item.vat !== undefined && item.vat !== null ? parseInt(item.vat, 10) : 21;
      const itemDisc = item.discountPercent || 0;
      const itemEffectivePrice = item.price * (1 - itemDisc / 100);
      const itemGrossBeforeCartDisc = itemEffectivePrice * item.quantity;
      const itemFinalGross = itemGrossBeforeCartDisc * cartDiscountFactor;

      let netPrice = itemFinalGross;
      let taxAmount = 0;

      if (rate > 0) {
        netPrice = itemFinalGross / (1 + rate / 100);
        taxAmount = itemFinalGross - netPrice;
      }

      if (!acc[rate]) {
        acc[rate] = { rate, gross: 0, net: 0, tax: 0 };
      }
      acc[rate].gross += itemFinalGross;
      acc[rate].net += netPrice;
      acc[rate].tax += taxAmount;
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
      totalAmount: finalGrandTotal,
      cartDiscountPercent,
      paymentMethod,
      splitDetails: splitDetails || null,
      tenderedAmount: paymentMethod === 'cash' ? tenderedAmount : finalGrandTotal,
      changeDue: paymentMethod === 'cash' ? changeDue : 0,
      taxSummary
    });

    // Asynchronously send to Python FastAPI backend for EET fiscalization
    createSaleBackend(newSale).then(backendRes => {
      if (backendRes && backendRes.status === 'SUCCESS') {
        const enrichedSale = normalizeSale({
          ...newSale,
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
          <div className="pos-layout">
            <div className="pos-col-left">
              <ManualKeypad
                onAddToCart={handleAddToCart}
                amountStr={keypadAmount}
                setAmountStr={setKeypadAmount}
                defaultVat={storeConfig?.defaultVat || 21}
              />
            </div>

            <div className="pos-col-center">
              <QuickPresetGrid
                presets={presets}
                categories={categories}
                onAddCategory={handleAddCategory}
                onDeleteCategory={handleDeleteCategory}
                onAddToCart={handleAddToCart}
                onAddPreset={handleAddPreset}
                onUpdatePreset={handleUpdatePreset}
                onDeletePreset={handleDeletePreset}
                onReorderPresets={handleReorderPresets}
                keypadAmount={keypadAmount}
                onClearKeypadAmount={() => setKeypadAmount('')}
              />
            </div>

            <div className="pos-col-right">
              <Cart
                cartItems={cartItems}
                onUpdateQty={handleUpdateQty}
                onRemoveItem={handleRemoveItem}
                onClearCart={handleClearCart}
                onOpenPayment={handleOpenPayment}
                onUpdateItemDiscount={handleUpdateItemDiscount}
                cartDiscountPercent={cartDiscountPercent}
                onSetCartDiscountPercent={setCartDiscountPercent}
              />
            </div>
          </div>
        )}

        {activeTab === 'presets' && (
          <PresetsCatalogView
            presets={presets}
            categories={categories}
            onAddCategory={handleAddCategory}
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
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            storeConfig={storeConfig}
            onSaveStoreConfig={setStoreConfig}
            presets={presets}
            onResetData={handleResetData}
            onNavigateToPresets={() => setActiveTab('presets')}
          />
        )}
      </main>

      {/* Payment Modal */}
      {paymentModalMethod && (
        <PaymentModal
          method={paymentModalMethod}
          totalAmount={cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)}
          onClose={() => setPaymentModalMethod(null)}
          onCompleteSale={handleCompleteSale}
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
    </div>
  );
}
