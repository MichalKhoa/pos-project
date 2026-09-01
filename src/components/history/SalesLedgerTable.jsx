import React from 'react';
import { Search, Receipt, RotateCcw, Eye, Trash2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext.jsx';
import { normalizeSale } from '../../api/posApi';

export default function SalesLedgerTable({
  totalItems,
  docTypeFilter,
  setDocTypeFilter,
  searchTerm,
  setSearchTerm,
  pageSize,
  setPageSize,
  searchFilteredSales,
  paginatedSales,
  onInitiateRefund,
  onSelectSale,
  isAdminMode,
  onDeleteSale,
  startIndex,
  endIndex,
  validCurrentPage,
  totalPages,
  setCurrentPage
}) {
  const { t } = useTranslation();

  return (
    <div className="table-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ fontSize: '1.1rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Receipt size={20} style={{ color: 'var(--accent-blue)' }} />
          <span>Seznam Vystavených Účtenek ({totalItems})</span>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Filter by document type */}
          <div style={{ display: 'flex', gap: '0.3rem', background: 'var(--bg-input)', padding: '0.2rem', borderRadius: 'var(--radius-md)' }}>
            <button
              className={`nav-tab ${docTypeFilter === 'all' ? 'active' : ''}`}
              style={{ padding: '0.3rem 0.7rem', fontSize: '0.8rem' }}
              onClick={() => setDocTypeFilter('all')}
            >
              {t('history.all_docs')}
            </button>
            <button
              className={`nav-tab ${docTypeFilter === 'sales' ? 'active' : ''}`}
              style={{ padding: '0.3rem 0.7rem', fontSize: '0.8rem' }}
              onClick={() => setDocTypeFilter('sales')}
            >
              {t('history.sales_only')}
            </button>
            <button
              className={`nav-tab ${docTypeFilter === 'refunds' ? 'active' : ''}`}
              style={{ padding: '0.3rem 0.7rem', fontSize: '0.8rem', color: docTypeFilter === 'refunds' ? '#ef4444' : 'var(--text-secondary)' }}
              onClick={() => setDocTypeFilter('refunds')}
            >
              {t('history.refunds_only')}
            </button>
          </div>

          <div className="keypad-input-container" style={{ width: '260px' }}>
            <Search size={16} style={{ color: 'var(--text-muted)', marginRight: '8px' }} />
            <input
              type="text"
              className="keypad-label-input"
              placeholder={t('history.search_placeholder')}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '600' }}>
            <span>{t('history.per_page')}:</span>
            <select
              value={pageSize}
              onChange={e => setPageSize(parseInt(e.target.value, 10))}
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontWeight: '700',
                padding: '0.35rem 0.6rem',
                cursor: 'pointer'
              }}
            >
              <option value={10} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>10 účtenek</option>
              <option value={25} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>25 účtenek</option>
              <option value={50} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>50 účtenek</option>
              <option value={100} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>100 účtenek</option>
            </select>
          </div>
        </div>
      </div>

      {searchFilteredSales.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Nebyly nalezeny žádné transakce ve vybraném období.
        </div>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '150px', whiteSpace: 'nowrap' }}>{t('history.col_receipt')}</th>
                  <th style={{ width: '140px', whiteSpace: 'nowrap' }}>{t('history.col_date')}</th>
                  <th>Položky</th>
                  <th style={{ width: '160px' }}>{t('history.col_method')}</th>
                  <th style={{ width: '120px', textAlign: 'right', whiteSpace: 'nowrap' }}>{t('history.col_total')}</th>
                  <th style={{ width: '220px', textAlign: 'right' }}>{t('history.col_actions')}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedSales.map((sale) => {
                  const isRefund = sale.isRefund || sale.is_refund;
                  const isFullyRefunded = sale.refundStatus === 'FULL' || sale.refund_status === 'FULL';
                  const isPartiallyRefunded = sale.refundStatus === 'PARTIAL' || sale.refund_status === 'PARTIAL';

                  return (
                    <tr key={sale.id} style={{ background: isRefund ? 'rgba(239, 68, 68, 0.04)' : 'transparent' }}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', whiteSpace: 'nowrap' }}>
                        <div>#{sale.receiptNumber}</div>
                        {isRefund && sale.originalReceiptNumber && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                            K účtence: #{sale.originalReceiptNumber}
                          </div>
                        )}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: '0.85rem' }}>
                          {new Date(sale.timestamp).toLocaleString('cs-CZ')}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.85rem', color: isRefund ? '#ef4444' : 'var(--text-secondary)' }}>
                          {sale.items.map(i => `${i.name} (${i.quantity}x)`).join(', ')}
                        </span>
                        {isRefund && sale.refundReason && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '2px' }}>
                            Důvod: {sale.refundReason}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                          {isRefund ? (
                            <span className="status-badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)' }}>
                              STORNO DOKLAD
                            </span>
                          ) : isFullyRefunded ? (
                            <span className="status-badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)' }}>
                              VRÁCENO KOMPLETNĚ
                            </span>
                          ) : isPartiallyRefunded ? (
                            <span className="status-badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-amber)', borderColor: 'rgba(245, 158, 11, 0.4)' }}>
                              ČÁSTEČNĚ VRÁCENO (-{(sale.refundedAmount || 0).toFixed(0)} Kč)
                            </span>
                          ) : null}

                          <span className="status-badge" style={{
                            background: sale.paymentMethod === 'cash' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                            color: sale.paymentMethod === 'cash' ? 'var(--accent-emerald)' : 'var(--accent-blue)',
                            borderColor: sale.paymentMethod === 'cash' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(59, 130, 246, 0.3)'
                          }}>
                            {sale.paymentMethod === 'cash' ? 'Hotovost' : sale.paymentMethod === 'card' ? 'Karta' : 'QR'}
                          </span>

                          {sale.eet_status === 'DISABLED' && (
                            <span className="status-badge" style={{ background: 'rgba(148, 163, 184, 0.15)', color: 'var(--text-secondary)', borderColor: 'rgba(148, 163, 184, 0.3)' }}>
                              Bez EET
                            </span>
                          )}
                          {sale.eet_status === 'OFFLINE_PENDING' && (
                            <span className="status-badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-amber)', borderColor: 'rgba(245, 158, 11, 0.3)' }}>
                              EET Čeká
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '800', textAlign: 'right', color: isRefund ? '#ef4444' : 'var(--accent-emerald)', whiteSpace: 'nowrap' }}>
                        {sale.totalAmount.toFixed(0)} Kč
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem' }}>
                          {!isRefund && !isFullyRefunded && onInitiateRefund && (
                            <button
                              className="nav-tab"
                              style={{
                                padding: '0.35rem 0.65rem',
                                fontSize: '0.8rem',
                                background: 'rgba(239, 68, 68, 0.1)',
                                color: '#ef4444',
                                borderColor: 'rgba(239, 68, 68, 0.3)',
                                whiteSpace: 'nowrap',
                                fontWeight: '700'
                              }}
                              onClick={() => onInitiateRefund(sale)}
                              title="Vystavit vratku / storno účtenky"
                            >
                              <RotateCcw size={14} />
                              <span>Storno / Vratka</span>
                            </button>
                          )}

                          <button
                            className="nav-tab"
                            style={{
                              padding: '0.35rem 0.65rem',
                              fontSize: '0.8rem',
                              whiteSpace: 'nowrap',
                              fontWeight: '700'
                            }}
                            onClick={() => onSelectSale(normalizeSale(sale))}
                          >
                            <Eye size={14} />
                            <span>Detail / Tisk</span>
                          </button>

                          {isAdminMode && (
                            <button
                              className="delete-item-btn"
                              onClick={() => onDeleteSale(sale.id)}
                              title="Smazat testovací prodej"
                              style={{ padding: '0.35rem 0.5rem', whiteSpace: 'nowrap' }}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Full Pagination Controls Footer */}
          <div style={{
            padding: '1rem 1.25rem',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            background: 'var(--bg-main)'
          }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Zobrazeno <strong>{startIndex + 1}–{endIndex}</strong> z <strong>{totalItems}</strong> účtenek
            </div>

            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <button
                className="nav-tab"
                style={{ padding: '0.35rem 0.6rem' }}
                disabled={validCurrentPage === 1}
                onClick={() => setCurrentPage(1)}
                title="První stránka"
              >
                <ChevronsLeft size={16} />
              </button>

              <button
                className="nav-tab"
                style={{ padding: '0.35rem 0.6rem' }}
                disabled={validCurrentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                title="Předchozí stránka"
              >
                <ChevronLeft size={16} />
              </button>

              <span style={{ fontSize: '0.85rem', fontWeight: '700', padding: '0 0.5rem' }}>
                Stránka {validCurrentPage} z {totalPages}
              </span>

              <button
                className="nav-tab"
                style={{ padding: '0.35rem 0.6rem' }}
                disabled={validCurrentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                title="Následující stránka"
              >
                <ChevronRight size={16} />
              </button>

              <button
                className="nav-tab"
                style={{ padding: '0.35rem 0.6rem' }}
                disabled={validCurrentPage === totalPages}
                onClick={() => setCurrentPage(totalPages)}
                title="Poslední stránka"
              >
                <ChevronsRight size={16} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
