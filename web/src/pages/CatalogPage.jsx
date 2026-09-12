import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Search, 
  Package, 
  Edit2, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  X, 
  Tag, 
  TrendingUp,
  Check,
  Plus,
  Sparkles
} from 'lucide-react';
import cloudApi from '../api/cloudApi';

function generateEAN13() {
  // Generate internal barcode prefix 200 (in-store retail use)
  const prefix = '200';
  let body = '';
  for (let i = 0; i < 9; i++) {
    body += Math.floor(Math.random() * 10);
  }
  const code12 = prefix + body;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(code12[i], 10);
    sum += (i % 2 === 0) ? digit : digit * 3;
  }
  const checksum = (10 - (sum % 10)) % 10;
  return code12 + checksum;
}

function formatCZK(val) {
  if (val === undefined || val === null || val === '') return '0,00 CZK';
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num)) return '0,00 CZK';
  return `${num.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CZK`;
}

export default function CatalogPage() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Search state & debounce
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Price adjustment modal
  const [editingItem, setEditingItem] = useState(null);
  const [newRetailPrice, setNewRetailPrice] = useState('');
  const [savingPrice, setSavingPrice] = useState(false);
  const [modalError, setModalError] = useState(null);

  // Notification Toast
  const [toast, setToast] = useState(null);
  const toastTimeoutRef = useRef(null);

  // Debounce search input by 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const fetchCatalog = useCallback(async (query = '', isManual = false) => {
    if (isManual) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const data = await cloudApi.getCatalog({
        search: query.trim() || undefined,
        limit: 100,
      });
      setItems(data?.items || []);
      setTotal(data?.total || 0);
    } catch (err) {
      console.error('Error fetching catalog:', err);
      setError(err.message || 'Nepodařilo se načíst katalog produktů');
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fetch when debouncedSearch changes
  useEffect(() => {
    fetchCatalog(debouncedSearch, false);
  }, [debouncedSearch, fetchCatalog]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchCatalog(searchTerm, false);
  };

  const showToast = (text, type = 'success') => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToast({ text, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  const handleOpenEditModal = (item) => {
    setEditingItem(item);
    setNewRetailPrice(item.price ? String(item.price) : '');
    setModalError(null);
  };

  const handleCloseModal = () => {
    if (savingPrice) return;
    setEditingItem(null);
    setNewRetailPrice('');
    setModalError(null);
  };

  const handleSavePrice = async (e) => {
    e.preventDefault();
    if (!editingItem) return;

    const parsedNewPrice = parseFloat(newRetailPrice);
    if (isNaN(parsedNewPrice) || parsedNewPrice < 0) {
      setModalError('Zadejte platnou nezápornou prodejní cenu.');
      return;
    }

    setSavingPrice(true);
    setModalError(null);

    try {
      await cloudApi.stagePriceChange({
        ean: editingItem.barcode || editingItem.id,
        product_name: editingItem.name,
        old_retail_price: parseFloat(editingItem.price) || 0,
        new_retail_price: parsedNewPrice,
      });

      showToast('Cena zařazena do fronty pro pokladnu', 'success');
      handleCloseModal();
      // Refetch catalog to reflect any updates
      fetchCatalog(debouncedSearch, false);
    } catch (err) {
      console.error('Error staging price change:', err);
      setModalError(err.message || 'Chyba při ukládání změny ceny do fronty.');
    } finally {
      setSavingPrice(false);
    }
  };

  // Live margin preview for modal
  let calculatedMargin = null;
  if (editingItem && newRetailPrice !== '') {
    const cost = parseFloat(editingItem.cost_price) || 0;
    const np = parseFloat(newRetailPrice) || 0;
    const vat = editingItem.vat || 21;
    const vatDivisor = vat === 21 ? 1.21 : vat === 12 ? 1.12 : 1.0;
    const netSelling = np / vatDivisor;
    if (netSelling > 0) {
      calculatedMargin = ((netSelling - cost) / netSelling) * 100;
    }
  }

  // Add Product modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: '',
    barcode: '',
    retailPrice: '',
    costPrice: '',
    vat: 21,
    category: 'Potraviny',
    stockQuantity: '0',
    trackStock: true,
    unit: 'ks',
  });
  const [savingNewProduct, setSavingNewProduct] = useState(false);
  const [addModalError, setAddModalError] = useState(null);

  const handleOpenAddModal = () => {
    setNewProduct({
      name: '',
      barcode: '',
      retailPrice: '',
      costPrice: '',
      vat: 21,
      category: 'Potraviny',
      stockQuantity: '0',
      trackStock: true,
      unit: 'ks',
    });
    setAddModalError(null);
    setShowAddModal(true);
  };

  const handleCloseAddModal = () => {
    if (savingNewProduct) return;
    setShowAddModal(false);
    setAddModalError(null);
  };

  const handleGenerateBarcode = () => {
    setNewProduct((prev) => ({
      ...prev,
      barcode: generateEAN13(),
    }));
  };

  const handleSaveNewProduct = async (e) => {
    e.preventDefault();
    if (!newProduct.name.trim()) {
      setAddModalError('Zadejte název produktu.');
      return;
    }
    const rp = parseFloat(newProduct.retailPrice);
    if (isNaN(rp) || rp < 0) {
      setAddModalError('Zadejte platnou nezápornou prodejní cenu.');
      return;
    }

    setSavingNewProduct(true);
    setAddModalError(null);

    try {
      await cloudApi.stageNewProduct({
        name: newProduct.name.trim(),
        barcode: newProduct.barcode.trim() || undefined,
        retail_price: rp,
        cost_price: parseFloat(newProduct.costPrice) || 0,
        vat: parseInt(newProduct.vat, 10) || 21,
        category: newProduct.category || 'custom',
        stock_quantity: parseFloat(newProduct.stockQuantity) || 0,
        track_stock: Boolean(newProduct.trackStock),
        unit: newProduct.unit || 'ks',
      });

      showToast(`Produkt '${newProduct.name.trim()}' byl zařazen do fronty pro pokladnu`, 'success');
      setShowAddModal(false);
      fetchCatalog(debouncedSearch, true);
    } catch (err) {
      console.error('Error creating product:', err);
      setAddModalError(err.message || 'Chyba při vytváření produktu.');
    } finally {
      setSavingNewProduct(false);
    }
  };

  // Live margin preview for new product modal
  let addProductMargin = null;
  if (newProduct.retailPrice !== '') {
    const cost = parseFloat(newProduct.costPrice) || 0;
    const np = parseFloat(newProduct.retailPrice) || 0;
    const vat = parseInt(newProduct.vat, 10) || 21;
    const vatDivisor = vat === 21 ? 1.21 : vat === 12 ? 1.12 : 1.0;
    const netSelling = np / vatDivisor;
    if (netSelling > 0) {
      addProductMargin = ((netSelling - cost) / netSelling) * 100;
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%', paddingBottom: '2rem' }}>
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '1.5rem',
          right: '1.5rem',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          backgroundColor: toast.type === 'error' ? '#fee2e2' : '#dcfce7',
          color: toast.type === 'error' ? '#991b1b' : '#15803d',
          border: `1px solid ${toast.type === 'error' ? '#fca5a5' : '#86efac'}`,
          padding: '0.85rem 1.25rem',
          borderRadius: '10px',
          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
          fontWeight: 600,
          fontSize: '0.95rem',
          animation: 'fadeIn 0.2s ease-in-out',
        }}>
          {toast.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
          <span>{toast.text}</span>
          <button 
            onClick={() => setToast(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: '2px', marginLeft: '0.5rem' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: 0 }}>Product Catalog</h1>
          <p style={{ color: 'var(--color-text-secondary, #64748b)', margin: '0.25rem 0 0 0', fontSize: '0.95rem' }}>
            Živý přehled ceníku a skladových zásob z pokladny ({total} položek).
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button 
            onClick={handleOpenAddModal}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem', 
              backgroundColor: 'var(--color-primary, #0052cc)', 
              color: '#ffffff', 
              border: 'none',
              padding: '0.6rem 1.15rem',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
              minHeight: '40px',
            }}
          >
            <Plus size={16} />
            Přidat produkt
          </button>
          <button 
            onClick={() => fetchCatalog(debouncedSearch, true)}
            disabled={refreshing || loading}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem', 
              backgroundColor: 'var(--color-surface, #ffffff)', 
              color: 'var(--color-text, #0f172a)', 
              border: '1px solid var(--color-border, #cbd5e1)',
              padding: '0.6rem 1rem',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: (refreshing || loading) ? 'not-allowed' : 'pointer',
              opacity: (refreshing || loading) ? 0.7 : 1,
              minHeight: '40px',
            }}
          >
            <RefreshCw size={16} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            {refreshing ? 'Načítám...' : 'Obnovit'}
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div style={{ 
        backgroundColor: 'var(--color-surface, #ffffff)', 
        borderRadius: '12px', 
        border: '1px solid var(--color-border, #e2e8f0)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        {/* Toolbar & Search */}
        <form onSubmit={handleSearchSubmit} style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--color-border, #e2e8f0)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ 
            flex: 1, 
            display: 'flex', 
            gap: '0.5rem', 
            alignItems: 'center', 
            backgroundColor: 'var(--color-background, #f8fafc)', 
            padding: '0.65rem 1rem', 
            borderRadius: '8px', 
            border: '1px solid var(--color-border, #cbd5e1)' 
          }}>
            <Search size={18} color="var(--color-text-secondary, #64748b)" />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Vyhledat podle názvu, čárového kódu (EAN) nebo kategorie..." 
              style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '0.95rem' }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px' }}
              >
                <X size={16} />
              </button>
            )}
          </div>
        </form>

        {/* Error message */}
        {error && (
          <div style={{ padding: '1rem 1.5rem', backgroundColor: '#fee2e2', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}
        
        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ backgroundColor: 'var(--color-background, #f8fafc)' }}>
              <tr>
                <th style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--color-border, #e2e8f0)', fontWeight: 600, color: 'var(--color-text-secondary, #475569)' }}>Název produktu</th>
                <th style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--color-border, #e2e8f0)', fontWeight: 600, color: 'var(--color-text-secondary, #475569)' }}>Čárový kód (EAN)</th>
                <th style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--color-border, #e2e8f0)', fontWeight: 600, color: 'var(--color-text-secondary, #475569)' }}>Prodejní cena (s DPH)</th>
                <th style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--color-border, #e2e8f0)', fontWeight: 600, color: 'var(--color-text-secondary, #475569)' }}>Nákupní cena (bez DPH)</th>
                <th style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--color-border, #e2e8f0)', fontWeight: 600, color: 'var(--color-text-secondary, #475569)' }}>Sazba DPH</th>
                <th style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--color-border, #e2e8f0)', fontWeight: 600, color: 'var(--color-text-secondary, #475569)' }}>Sklad</th>
                <th style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--color-border, #e2e8f0)', fontWeight: 600, color: 'var(--color-text-secondary, #475569)', textAlign: 'right' }}>Akce</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                    <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: '0.5rem' }} />
                    <div>Načítání produktů z katalogu...</div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                    Nebyly nalezeny žádné produkty odpovídající filtru.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const stockDisplay = item.track_stock
                    ? `${item.stock_quantity ?? 0} ${item.unit || 'ks'}`
                    : 'Nesledováno';

                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--color-border, #e2e8f0)', transition: 'background-color 0.15s' }}>
                      <td style={{ padding: '1rem 1.5rem', fontWeight: 500 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '6px', backgroundColor: 'var(--color-background, #f8fafc)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary, #64748b)', flexShrink: 0 }}>
                            <Package size={16} />
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <span style={{ color: '#0f172a' }}>{item.name}</span>
                              {item.is_staged && (
                                <span style={{
                                  backgroundColor: '#fef3c7',
                                  color: '#b45309',
                                  border: '1px solid #fcd34d',
                                  padding: '0.15rem 0.45rem',
                                  borderRadius: '4px',
                                  fontSize: '0.72rem',
                                  fontWeight: 600,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  flexShrink: 0
                                }}>
                                  Čeká na pokladnu
                                </span>
                              )}
                            </div>
                            {item.category && item.category !== 'custom' && (
                              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{item.category}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '1rem 1.5rem', color: 'var(--color-text-secondary, #475569)', fontFamily: 'monospace', fontSize: '0.9rem' }}>
                        {item.barcode || '-'}
                      </td>
                      <td style={{ padding: '1rem 1.5rem', fontWeight: 600, color: '#0f172a' }}>
                        {formatCZK(item.price)}
                      </td>
                      <td style={{ padding: '1rem 1.5rem', color: 'var(--color-text-secondary, #475569)' }}>
                        {formatCZK(item.cost_price)}
                      </td>
                      <td style={{ padding: '1rem 1.5rem', color: 'var(--color-text-secondary, #475569)' }}>
                        <span style={{ backgroundColor: 'var(--color-background, #f1f5f9)', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 500 }}>
                          {item.vat !== undefined ? `${item.vat}%` : '21%'}
                        </span>
                      </td>
                      <td style={{ padding: '1rem 1.5rem', color: item.track_stock && item.stock_quantity <= 0 ? '#ef4444' : 'var(--color-text-secondary, #475569)', fontWeight: item.track_stock ? 600 : 400 }}>
                        {stockDisplay}
                      </td>
                      <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                        <button 
                          onClick={() => handleOpenEditModal(item)}
                          style={{ 
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            backgroundColor: '#eff6ff', 
                            border: '1px solid #bfdbfe', 
                            cursor: 'pointer', 
                            color: '#1d4ed8', 
                            padding: '0.45rem 0.85rem',
                            borderRadius: '6px',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            transition: 'all 0.15s ease'
                          }}
                          title="Upravit prodejní cenu"
                        >
                          <Edit2 size={14} />
                          Upravit cenu
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Price Modal */}
      {editingItem && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.5)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem',
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '480px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
            overflow: 'hidden',
            border: '1px solid #e2e8f0',
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Tag size={18} color="var(--color-primary, #0052cc)" />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
                  Úprava prodejní ceny
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                disabled={savingPrice}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSavePrice} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {modalError && (
                <div style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: '#fee2e2',
                  border: '1px solid #fca5a5',
                  borderRadius: '8px',
                  color: '#991b1b',
                  fontSize: '0.875rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}>
                  <AlertCircle size={16} />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Product Info Card */}
              <div style={{
                backgroundColor: '#f8fafc',
                padding: '1rem',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
              }}>
                <div style={{ fontWeight: 600, fontSize: '1rem', color: '#0f172a', marginBottom: '0.25rem' }}>
                  {editingItem.name}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#64748b', display: 'flex', gap: '1rem' }}>
                  <span>EAN: <b>{editingItem.barcode || editingItem.id}</b></span>
                  <span>DPH: <b>{editingItem.vat}%</b></span>
                </div>
                <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #e2e8f0', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Původní cena (s DPH):</span>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>{formatCZK(editingItem.price)}</span>
                </div>
                <div style={{ fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                  <span style={{ color: '#64748b' }}>Nákupní cena (bez DPH):</span>
                  <span style={{ color: '#475569' }}>{formatCZK(editingItem.cost_price)}</span>
                </div>
              </div>

              {/* Input for new price */}
              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                  Nová prodejní cena s DPH (Kč) *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    required
                    autoFocus
                    value={newRetailPrice}
                    onChange={(e) => setNewRetailPrice(e.target.value)}
                    placeholder="např. 55.00"
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '1.1rem',
                      fontWeight: 600,
                      boxSizing: 'border-box',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* Live calculated margin info */}
              {calculatedMargin !== null && (
                <div style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  backgroundColor: calculatedMargin > 15 ? '#f0fdf4' : calculatedMargin > 0 ? '#fffbeb' : '#fef2f2',
                  border: `1px solid ${calculatedMargin > 15 ? '#bbf7d0' : calculatedMargin > 0 ? '#fde68a' : '#fecaca'}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem', color: '#475569' }}>
                    <TrendingUp size={16} />
                    <span>Nová marže:</span>
                  </div>
                  <span style={{
                    fontWeight: 700,
                    fontSize: '1rem',
                    color: calculatedMargin > 15 ? '#16a34a' : calculatedMargin > 0 ? '#d97706' : '#dc2626',
                  }}>
                    {calculatedMargin.toFixed(1)}%
                  </span>
                </div>
              )}

              {/* Modal Actions */}
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '0.75rem',
                marginTop: '0.5rem',
                paddingTop: '1rem',
                borderTop: '1px solid #e2e8f0',
              }}>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={savingPrice}
                  style={{
                    padding: '0.65rem 1.25rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#475569',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    cursor: savingPrice ? 'not-allowed' : 'pointer',
                  }}
                >
                  Zrušit
                </button>
                <button
                  type="submit"
                  disabled={savingPrice || !newRetailPrice}
                  style={{
                    padding: '0.65rem 1.5rem',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: 'var(--color-primary, #0052cc)',
                    color: '#ffffff',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    cursor: (savingPrice || !newRetailPrice) ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    opacity: (savingPrice || !newRetailPrice) ? 0.7 : 1,
                  }}
                >
                  {savingPrice ? (
                    <>
                      <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                      Zařazuji...
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      Zařadit do fronty pokladny
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.5)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem',
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '560px',
            maxHeight: '90vh',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
            overflowY: 'auto',
            border: '1px solid #e2e8f0',
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              position: 'sticky',
              top: 0,
              backgroundColor: '#ffffff',
              zIndex: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Package size={20} color="var(--color-primary, #0052cc)" />
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>
                  Přidat nový produkt
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCloseAddModal}
                disabled={savingNewProduct}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveNewProduct} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Informational banner */}
              <div style={{
                padding: '0.75rem 1rem',
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '8px',
                color: '#1e40af',
                fontSize: '0.85rem',
                lineHeight: 1.4,
              }}>
                Produkt bude zařazen do fronty změn. Při ranním spuštění si jej pokladna automaticky stáhne a zapíše do svého katalogu.
              </div>

              {addModalError && (
                <div style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: '#fee2e2',
                  border: '1px solid #fca5a5',
                  borderRadius: '8px',
                  color: '#991b1b',
                  fontSize: '0.875rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}>
                  <AlertCircle size={16} />
                  <span>{addModalError}</span>
                </div>
              )}

              {/* Name */}
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                  Název položky / produktu *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="např. Coca Cola 0.5l, Chléb Šumava..."
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.95rem',
                    boxSizing: 'border-box',
                    minHeight: '42px',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Barcode / EAN with generator */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155' }}>
                    Čárový kód (EAN)
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateBarcode}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-primary, #0052cc)',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      padding: 0,
                    }}
                  >
                    <Sparkles size={14} />
                    Generovat interní EAN
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="859... nebo nechte prázdné pro automatické vygenerování"
                  value={newProduct.barcode}
                  onChange={(e) => setNewProduct({ ...newProduct, barcode: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.95rem',
                    fontFamily: 'monospace',
                    boxSizing: 'border-box',
                    minHeight: '42px',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Prices Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                    Prodejní cena s DPH (Kč) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    required
                    placeholder="např. 45.00"
                    value={newProduct.retailPrice}
                    onChange={(e) => setNewProduct({ ...newProduct, retailPrice: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '1rem',
                      fontWeight: 600,
                      boxSizing: 'border-box',
                      minHeight: '42px',
                      outline: 'none',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                    Nákupní cena bez DPH (Kč)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="např. 25.00"
                    value={newProduct.costPrice}
                    onChange={(e) => setNewProduct({ ...newProduct, costPrice: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '1rem',
                      boxSizing: 'border-box',
                      minHeight: '42px',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* Margin preview */}
              {addProductMargin !== null && (
                <div style={{
                  padding: '0.65rem 0.85rem',
                  borderRadius: '8px',
                  backgroundColor: addProductMargin > 15 ? '#f0fdf4' : addProductMargin > 0 ? '#fffbeb' : '#fef2f2',
                  border: `1px solid ${addProductMargin > 15 ? '#bbf7d0' : addProductMargin > 0 ? '#fde68a' : '#fecaca'}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: '#475569' }}>
                    <TrendingUp size={15} />
                    <span>Odhadovaná marže:</span>
                  </div>
                  <span style={{
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    color: addProductMargin > 15 ? '#16a34a' : addProductMargin > 0 ? '#d97706' : '#dc2626',
                  }}>
                    {addProductMargin.toFixed(1)}%
                  </span>
                </div>
              )}

              {/* VAT and Category Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                    Sazba DPH
                  </label>
                  <select
                    value={newProduct.vat}
                    onChange={(e) => setNewProduct({ ...newProduct, vat: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.95rem',
                      boxSizing: 'border-box',
                      minHeight: '42px',
                      outline: 'none',
                      backgroundColor: '#ffffff',
                    }}
                  >
                    <option value="21">21% (Základní sazba)</option>
                    <option value="12">12% (Potraviny, léky)</option>
                    <option value="0">0% (Osvobozeno)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                    Kategorie
                  </label>
                  <select
                    value={newProduct.category}
                    onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.95rem',
                      boxSizing: 'border-box',
                      minHeight: '42px',
                      outline: 'none',
                      backgroundColor: '#ffffff',
                    }}
                  >
                    <option value="Potraviny">Potraviny</option>
                    <option value="Nápoje">Nápoje</option>
                    <option value="Tabák">Tabák</option>
                    <option value="Drogerie">Drogerie</option>
                    <option value="custom">Ostatní / Vlastní</option>
                  </select>
                </div>
              </div>

              {/* Stock and Unit Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                    Počáteční skladové množství
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    placeholder="0"
                    value={newProduct.stockQuantity}
                    onChange={(e) => setNewProduct({ ...newProduct, stockQuantity: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.95rem',
                      boxSizing: 'border-box',
                      minHeight: '42px',
                      outline: 'none',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                    Měrná jednotka
                  </label>
                  <select
                    value={newProduct.unit}
                    onChange={(e) => setNewProduct({ ...newProduct, unit: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.95rem',
                      boxSizing: 'border-box',
                      minHeight: '42px',
                      outline: 'none',
                      backgroundColor: '#ffffff',
                    }}
                  >
                    <option value="ks">ks (kusy)</option>
                    <option value="kg">kg (kilogramy)</option>
                    <option value="l">l (litry)</option>
                    <option value="bal">bal (balení)</option>
                  </select>
                </div>
              </div>

              {/* Track stock checkbox */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.9rem', color: '#334155', cursor: 'pointer', marginTop: '-0.25rem' }}>
                <input
                  type="checkbox"
                  checked={newProduct.trackStock}
                  onChange={(e) => setNewProduct({ ...newProduct, trackStock: e.target.checked })}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--color-primary, #0052cc)' }}
                />
                <span style={{ fontWeight: 500 }}>Sledovat stav skladu u tohoto produktu</span>
              </label>

              {/* Modal Actions */}
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '0.75rem',
                marginTop: '0.5rem',
                paddingTop: '1rem',
                borderTop: '1px solid #e2e8f0',
              }}>
                <button
                  type="button"
                  onClick={handleCloseAddModal}
                  disabled={savingNewProduct}
                  style={{
                    padding: '0.65rem 1.25rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#475569',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    cursor: savingNewProduct ? 'not-allowed' : 'pointer',
                    minHeight: '42px',
                  }}
                >
                  Zrušit
                </button>
                <button
                  type="submit"
                  disabled={savingNewProduct || !newProduct.name || !newProduct.retailPrice}
                  style={{
                    padding: '0.65rem 1.5rem',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: 'var(--color-primary, #0052cc)',
                    color: '#ffffff',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    cursor: (savingNewProduct || !newProduct.name || !newProduct.retailPrice) ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    opacity: (savingNewProduct || !newProduct.name || !newProduct.retailPrice) ? 0.7 : 1,
                    minHeight: '42px',
                  }}
                >
                  {savingNewProduct ? (
                    <>
                      <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                      Zařazuji produkt...
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      Zařadit produkt do fronty pokladny
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

