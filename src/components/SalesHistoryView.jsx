import React, { useState, useEffect, useMemo } from 'react';
import { History, Trash2, Unlock, Lock, ShieldAlert, Download, Receipt } from 'lucide-react';
import ReceiptModal from './ReceiptModal';
import TouchCalendarModal from './TouchCalendarModal.jsx';
import TouchDateRangeModal from './TouchDateRangeModal.jsx';
import { useTranslation } from '../i18n/LanguageContext.jsx';
import { exportSalesToCSV } from '../utils/csvExporter';
import SalesPeriodBar from './history/SalesPeriodBar.jsx';
import SalesLedgerTable from './history/SalesLedgerTable.jsx';
import ReceiptInspectorPanel from './history/ReceiptInspectorPanel.jsx';
import { useSalesPeriodFilter } from '../hooks/useSalesPeriodFilter';
import { fetchSalesHistoryBackend } from '../api/posApi';

export default function SalesHistoryView({
  salesHistory,
  storeConfig,
  isAdminMode,
  onToggleAdminMode,
  onDeleteSale,
  onClearAllTestSales,
  onInitiateRefund,
  initialDateFilter = null
}) {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSale, setActiveSale] = useState(null);
  const [fullModalSale, setFullModalSale] = useState(null);
  const {
    periodFilter,
    setPeriodFilter,
    referenceDate,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    calendarModal,
    setCalendarModal,
    isRangeModalOpen,
    setIsRangeModalOpen,
    handleStepPeriod,
    handleSelectPreset,
    periodBadgeLabel,
    computedDateRange,
    periodFilteredSales
  } = useSalesPeriodFilter({ salesHistory, initialDateFilter });

  // Pagination states (default 15 per page for high density)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [docTypeFilter, setDocTypeFilter] = useState('all'); // 'all' | 'sales' | 'refunds'

  // Server-driven sales state
  const [serverSales, setServerSales] = useState(null);
  const [serverTotalCount, setServerTotalCount] = useState(null);

  // Reset pagination when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, periodFilter, referenceDate, fromDate, toDate, pageSize, docTypeFilter]);

  // Fetch paginated sales from backend with automatic fallback to local salesHistory
  useEffect(() => {
    let isCancelled = false;
    const fromIso = periodFilter !== 'all' ? computedDateRange.start.toISOString() : null;
    const toIso = periodFilter !== 'all' ? computedDateRange.end.toISOString() : null;

    fetchSalesHistoryBackend({
      limit: pageSize,
      offset: (currentPage - 1) * pageSize,
      fromDate: fromIso,
      toDate: toIso,
      docType: docTypeFilter,
      search: searchTerm.trim() || null,
      returnDetails: true
    }).then(res => {
      if (isCancelled) return;
      if (res && Array.isArray(res.sales)) {
        setServerSales(res.sales);
        setServerTotalCount(res.totalCount);
      } else {
        setServerSales(null);
        setServerTotalCount(null);
      }
    }).catch(() => {
      if (!isCancelled) {
        setServerSales(null);
        setServerTotalCount(null);
      }
    });

    return () => { isCancelled = true; };
  }, [currentPage, pageSize, docTypeFilter, searchTerm, periodFilter, computedDateRange, salesHistory]);

  // Apply document type filter and search query for local fallback
  const searchFilteredSales = useMemo(() => {
    return periodFilteredSales.filter(sale => {
      if (!sale) return false;
      if (docTypeFilter === 'sales' && (sale.isRefund || sale.is_refund)) return false;
      if (docTypeFilter === 'refunds' && !(sale.isRefund || sale.is_refund)) return false;

      const term = searchTerm.toLowerCase();
      const rNum = (sale.receiptNumber || sale.receipt_number || '').toString().toLowerCase();
      const origNum = (sale.originalReceiptNumber || sale.original_receipt_number || '').toString().toLowerCase();
      const pMethod = (sale.paymentMethod || sale.payment_method || '').toLowerCase();
      const reason = (sale.refundReason || sale.refund_reason || '').toLowerCase();

      return (
        rNum.includes(term) ||
        origNum.includes(term) ||
        pMethod.includes(term) ||
        reason.includes(term) ||
        (Array.isArray(sale.items) && sale.items.some(i => i.name && i.name.toLowerCase().includes(term)))
      );
    });
  }, [periodFilteredSales, docTypeFilter, searchTerm]);

  // Pagination Math (Server-driven if serverSales available, otherwise client-side fallback)
  const isServerDriven = serverSales !== null;
  const totalItems = isServerDriven ? (serverTotalCount !== null ? serverTotalCount : serverSales.length) : searchFilteredSales.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const endIndex = isServerDriven ? Math.min(startIndex + serverSales.length, totalItems) : Math.min(startIndex + pageSize, totalItems);

  const paginatedSales = useMemo(() => {
    if (isServerDriven) return serverSales;
    return searchFilteredSales.slice(startIndex, endIndex);
  }, [isServerDriven, serverSales, searchFilteredSales, startIndex, endIndex]);

  // High-level summary metrics
  const { totalRevenue, cashRevenue, cardRevenue } = useMemo(() => {
    let rev = 0;
    let cash = 0;
    let card = 0;
    const sourceList = (!isServerDriven && searchFilteredSales.length > 0) ? searchFilteredSales : (serverSales || searchFilteredSales);

    sourceList.forEach(sale => {
      const amount = parseFloat(sale.totalAmount !== undefined ? sale.totalAmount : (sale.total_amount || 0)) || 0;
      rev += amount;
      if (sale.cashAmount !== undefined || sale.cardAmount !== undefined || sale.cash_amount !== undefined || sale.card_amount !== undefined) {
        cash += parseFloat(sale.cashAmount || sale.cash_amount || 0);
        card += parseFloat(sale.cardAmount || sale.card_amount || 0);
      } else if (sale.paymentMethod === 'cash' || sale.payment_method === 'cash') {
        cash += amount;
      } else if (sale.paymentMethod === 'card' || sale.payment_method === 'card') {
        card += amount;
      }
    });

    return { totalRevenue: rev, cashRevenue: cash, cardRevenue: card };
  }, [isServerDriven, searchFilteredSales, serverSales]);

  // Keep activeSale in sync with paginatedSales
  useEffect(() => {
    if (paginatedSales.length > 0) {
      if (!activeSale || !paginatedSales.some(s => (s.id && s.id === activeSale.id) || (s.receiptNumber && s.receiptNumber === activeSale.receiptNumber))) {
        setActiveSale(paginatedSales[0]);
      }
    } else {
      setActiveSale(null);
    }
  }, [paginatedSales, activeSale]);

  const getPeriodLabel = () => {
    return periodBadgeLabel || t('history.all_period');
  };

  return (
    <div className="full-view-container">
      {/* Header */}
      <div className="section-header" style={{ flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0' }}>
        <div className="section-title" style={{ fontSize: '1.2rem' }}>
          <History size={22} style={{ color: 'var(--accent-blue)' }} />
          <span>{t('history.stats_title')}</span>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className="checkout-btn"
            style={{
              padding: '0.35rem 0.75rem',
              fontSize: '0.8rem',
              background: 'var(--accent-emerald)',
              color: '#ffffff',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontWeight: '700'
            }}
            onClick={() => exportSalesToCSV(searchFilteredSales, getPeriodLabel())}
            title={t('history.export_csv_title')}
          >
            <Download size={14} />
            <span>{t('history.export_csv')}</span>
          </button>

          {isAdminMode && (
            <button
              className="clear-cart-btn"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
              onClick={onClearAllTestSales}
              title={t('history.delete_test_sales')}
            >
              <Trash2 size={14} />
              <span>{t('history.delete_test_sales')}</span>
            </button>
          )}

          <button
            className="nav-tab"
            style={{
              padding: '0.35rem 0.75rem',
              fontSize: '0.8rem',
              background: isAdminMode ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.06)',
              color: isAdminMode ? 'var(--accent-amber)' : 'var(--text-secondary)',
              border: isAdminMode ? '1px solid var(--accent-amber)' : '1px solid var(--border-color)',
              fontWeight: '700'
            }}
            onClick={onToggleAdminMode}
          >
            {isAdminMode ? <Unlock size={14} /> : <Lock size={14} />}
            <span>{isAdminMode ? t('history.admin_active') : t('history.admin_activate')}</span>
          </button>
        </div>
      </div>

      {isAdminMode && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: 'var(--radius-md)',
          padding: '0.45rem 0.75rem',
          fontSize: '0.8rem',
          color: 'var(--accent-amber)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <ShieldAlert size={16} />
          <span>{t('history.admin_banner')}</span>
        </div>
      )}

      {/* Time Period Selector Bar */}
      <SalesPeriodBar
        periodFilter={periodFilter}
        onSelectPreset={handleSelectPreset}
        periodBadgeLabel={periodBadgeLabel}
        onStepPeriod={handleStepPeriod}
        fromDate={fromDate}
        toDate={toDate}
        setFromDate={setFromDate}
        setToDate={setToDate}
        onOpenCalendar={(field) => {
          const iso = computedDateRange.start.toISOString().slice(0, 10);
          setCalendarModal({ isOpen: true, field, initialDate: field === 'from' ? fromDate : field === 'to' ? toDate : iso, title: 'Výběr data' });
        }}
        onOpenRangeModal={() => setIsRangeModalOpen(true)}
        totalMatchingSales={searchFilteredSales.length}
      />

      {/* Compact Summary Strip */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        padding: '0.35rem 0.75rem',
        fontSize: '0.82rem',
        fontWeight: '700',
        flexWrap: 'wrap',
        gap: '0.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <span>
            <span style={{ color: 'var(--text-muted)' }}>{t('history.revenue')}: </span>
            <span style={{ color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)', fontWeight: '900', fontSize: '0.92rem' }}>
              {totalRevenue.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kč
            </span>
          </span>
          <span>
            <span style={{ color: 'var(--text-muted)' }}>{t('history.cash_revenue')}: </span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>
              {cashRevenue.toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} Kč
            </span>
          </span>
          <span>
            <span style={{ color: 'var(--text-muted)' }}>{t('history.card_revenue')}: </span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>
              {cardRevenue.toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} Kč
            </span>
          </span>
        </div>

        <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <Receipt size={13} />
          <span>{totalItems} {t('shift_stats.receipts') || 'účtenek celkem'}</span>
        </div>
      </div>

      {/* 2-Pane Master-Detail Layout: Left live thermal preview + Right ledger table */}
      <div className="history-master-detail-grid">
        <ReceiptInspectorPanel
          saleData={activeSale}
          storeConfig={storeConfig}
          onInitiateRefund={onInitiateRefund}
          onOpenFullModal={(sale) => setFullModalSale(sale)}
        />

        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <SalesLedgerTable
            totalItems={totalItems}
            docTypeFilter={docTypeFilter}
            setDocTypeFilter={setDocTypeFilter}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            pageSize={pageSize}
            setPageSize={setPageSize}
            searchFilteredSales={searchFilteredSales}
            paginatedSales={paginatedSales}
            onInitiateRefund={onInitiateRefund}
            onSelectSale={(sale) => setActiveSale(sale)}
            selectedSaleId={activeSale?.id || activeSale?.receiptNumber}
            isAdminMode={isAdminMode}
            onDeleteSale={onDeleteSale}
            startIndex={startIndex}
            endIndex={endIndex}
            validCurrentPage={validCurrentPage}
            totalPages={totalPages}
            setCurrentPage={setCurrentPage}
          />
        </div>
      </div>

      {fullModalSale && (
        <ReceiptModal
          saleData={fullModalSale}
          storeConfig={storeConfig}
          onClose={() => setFullModalSale(null)}
          onNewSale={() => setFullModalSale(null)}
          disableAutoPrint={true}
        />
      )}

      <TouchCalendarModal
        isOpen={calendarModal.isOpen}
        title={calendarModal.title}
        initialDate={calendarModal.initialDate}
        onClose={() => setCalendarModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={(newIsoDate) => {
          if (calendarModal.field === 'from') {
            setFromDate(newIsoDate);
            setPeriodFilter('custom');
          } else if (calendarModal.field === 'to') {
            setToDate(newIsoDate);
            setPeriodFilter('custom');
          }
          setCalendarModal(prev => ({ ...prev, isOpen: false }));
        }}
      />

      <TouchDateRangeModal
        isOpen={isRangeModalOpen}
        initialFromDate={fromDate}
        initialToDate={toDate}
        onClose={() => setIsRangeModalOpen(false)}
        onConfirmRange={(newFrom, newTo) => {
          setFromDate(newFrom);
          setToDate(newTo);
        }}
      />
    </div>
  );
}
