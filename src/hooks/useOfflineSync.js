import { useState, useEffect, useCallback } from 'react';
import {
  fetchEetStatus,
  processEetQueue,
  createSaleBackend,
  fetchSalesHistoryBackend
} from '../api/posApi';

export function useOfflineSync({ salesHistory = [], setSalesHistory } = {}) {
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [isSyncingQueue, setIsSyncingQueue] = useState(false);
  const [snoozedUntil, setSnoozedUntil] = useState(0);
  const [syncNotification, setSyncNotification] = useState(null);

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
    checkPendingOfflineSales();

    const handleOnline = () => {
      checkPendingOfflineSales();
    };

    window.addEventListener('online', handleOnline);
    const interval = setInterval(() => {
      checkPendingOfflineSales();
    }, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      clearInterval(interval);
    };
  }, [checkPendingOfflineSales]);

  const handleSnoozeSync = useCallback(() => {
    setSnoozedUntil(Date.now() + 5 * 60 * 1000);
    setShowSyncModal(false);
  }, []);

  const handleSyncQueueNow = useCallback(async () => {
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

      if (setSalesHistory) {
        const updatedHistory = await fetchSalesHistoryBackend({ limit: 50 });
        if (Array.isArray(updatedHistory) && updatedHistory.length > 0) {
          setSalesHistory(prev => {
            const updatedMap = new Map(updatedHistory.map(s => [s.id, s]));
            return prev.map(s => updatedMap.get(s.id) || s);
          });
        }
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
  }, [salesHistory, setSalesHistory]);

  return {
    pendingSyncCount,
    setPendingSyncCount,
    showSyncModal,
    setShowSyncModal,
    isSyncingQueue,
    syncNotification,
    setSyncNotification,
    handleSnoozeSync,
    handleSyncQueueNow,
    checkPendingOfflineSales
  };
}
