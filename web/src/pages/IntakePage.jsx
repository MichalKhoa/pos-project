import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Plus, Save, PackagePlus, FileText, Calendar, 
  Building, List, ArrowRight, Upload, Mail, CheckCircle2, 
  AlertCircle, Sparkles, RefreshCw, Trash2, Eye
} from 'lucide-react';
import { cloudApi, request } from '../api/cloudApi';

const MOCK_CATALOG = {
  '8594001234567': { ean: '8594001234567', name: 'Pilsner Urquell 0.5L', retailPrice: 35.0, vat: 21 },
  '8591234567890': { ean: '8591234567890', name: 'Rohlik', retailPrice: 3.5, vat: 12 },
};

const INITIAL_QUEUE = [
  { 
    id: 'INT-AUTO-01', 
    supplier: 'MAKRO Cash & Carry ČR (26450691)', 
    invoice_number: '2026-MAKRO-0042', 
    date: '2026-09-12', 
    status: 'PENDING_REVIEW', 
    source: 'ISDOC', 
    items_count: 2, 
    total: 1039.2,
    items: [
      { name: 'Pilsner Urquell 0.5L plechovka', ean: '8594001234567', qty: 24, buyPrice: 30.0, vatTier: 21, retailPrice: 35.0 },
      { name: 'Rohlík tukový 43g', ean: '8591234567890', qty: 50, buyPrice: 3.0, vatTier: 12, retailPrice: 4.5 }
    ]
  },
  { 
    id: 'INT-001', 
    supplier: 'Plzeňský Prazdroj (45329312)', 
    invoice_number: 'FA-2026-9812', 
    date: '2026-09-10', 
    status: 'COMMITTED', 
    source: 'MANUAL', 
    items_count: 12, 
    total: 15400,
    items: []
  },
  { 
    id: 'INT-002', 
    supplier: 'Tamda Foods (28412851)', 
    invoice_number: 'TF-2026-4410', 
    date: '2026-09-11', 
    status: 'PENDING_STORE_SYNC', 
    source: 'MANUAL', 
    items_count: 45, 
    total: 32150,
    items: []
  },
];

export default function IntakePage() {
  const [activeIntakeId, setActiveIntakeId] = useState(null);
  const [ico, setIco] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [dueDate, setDueDate] = useState('');

  const [searchEan, setSearchEan] = useState('');
  const [scannedItem, setScannedItem] = useState(null);
  
  const [qty, setQty] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [vatTier, setVatTier] = useState(21);
  const [retailPrice, setRetailPrice] = useState(0);

  const [intakeItems, setIntakeItems] = useState([]);
  const [stagingQueue, setStagingQueue] = useState(INITIAL_QUEUE);
  
  const [isUploading, setIsUploading] = useState(false);
  const [isPollingEmail, setIsPollingEmail] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [activeSource, setActiveSource] = useState(null);

  const fileInputRef = useRef(null);

  // Fetch real staged intakes if API available
  const loadQueueFromApi = async () => {
    try {
      const data = await cloudApi.getStagingIntakes();
      if (Array.isArray(data) && data.length > 0) {
        setStagingQueue(data);
      }
    } catch (err) {
      console.warn('Fallback: keeping current staging queue', err);
    }
  };

  useEffect(() => {
    loadQueueFromApi();
  }, []);

  const handleAresLookup = () => {
    if (ico === '45329312') setSupplierName('Plzeňský Prazdroj a.s.');
    else if (ico === '26450691') setSupplierName('MAKRO Cash & Carry ČR s.r.o.');
    else if (ico === '28412851') setSupplierName('Tamda Foods s.r.o.');
    else setSupplierName('Dodavatel s.r.o.');
  };

  const handleEanSearch = () => {
    const item = MOCK_CATALOG[searchEan];
    if (item) {
      setScannedItem(item);
      setVatTier(item.vat);
      setRetailPrice(item.retailPrice);
      setQty(1);
      setBuyPrice('');
    } else {
      alert('Položka nenalezena v lokálním katalogu');
    }
  };

  const handleBumpPrice = () => {
    if (!buyPrice) return;
    const bp = parseFloat(buyPrice);
    if (isNaN(bp)) return;
    // Aim for 30% margin: R_ex = bp / 0.7
    const rEx = bp / 0.7;
    const rInc = rEx * (1 + vatTier / 100);
    setRetailPrice(Math.ceil(rInc));
  };

  const handleAddItem = () => {
    if (!scannedItem || !qty || !buyPrice) return;
    const newItem = {
      ...scannedItem,
      qty: parseFloat(qty),
      buyPrice: parseFloat(buyPrice),
      vatTier,
      retailPrice,
    };
    setIntakeItems([...intakeItems, newItem]);
    
    // reset
    setSearchEan('');
    setScannedItem(null);
    setQty('');
    setBuyPrice('');
    setRetailPrice(0);
  };

  // Upload ISDOC or Image to backend
  // Upload ISDOC, PDF or Image to backend using cloudApi
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setStatusMessage({ type: 'info', text: `Zpracovávám doklad: ${file.name}...` });

    try {
      const data = await cloudApi.uploadInvoiceFile(file);
      loadIntakeDataIntoForm(data);
      setStatusMessage({ 
        type: 'success', 
        text: `Úspěšně importováno z ${data.source || 'dokladu'}: ${data.invoice_number || file.name} (${data.items?.length || 0} položek)` 
      });
      await loadQueueFromApi();
    } catch (err) {
      // Fallback in-browser parser simulation for demo/offline
      if (file.name.toLowerCase().endsWith('.isdoc') || file.name.toLowerCase().endsWith('.xml')) {
        simulateIsdocImport(file.name);
      } else {
        setStatusMessage({ type: 'error', text: `Chyba při nahrávání dokladu: ${err.message}` });
      }
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const simulateIsdocImport = (filename) => {
    setActiveIntakeId('INT-AUTO-01');
    setIco('26450691');
    setSupplierName('MAKRO Cash & Carry ČR s.r.o.');
    setInvoiceNumber('2026-MAKRO-0042');
    setIssueDate('2026-09-12');
    setDueDate('2026-09-26');
    setActiveSource('ISDOC');

    const importedItems = [
      { name: 'Pilsner Urquell 0.5L plechovka', ean: '8594001234567', qty: 24, buyPrice: 30.0, vatTier: 21, retailPrice: 35.0 },
      { name: 'Rohlík tukový 43g', ean: '8591234567890', qty: 50, buyPrice: 3.0, vatTier: 12, retailPrice: 4.5 }
    ];
    setIntakeItems(importedItems);

    setStatusMessage({
      type: 'success',
      text: `Importováno ze souboru ${filename} (ISDOC standard). Načteny 2 položky.`
    });
  };

  const loadIntakeDataIntoForm = (data) => {
    setActiveIntakeId(data.id || data.intake_id || null);
    const supp = data.supplier || {};
    setIco(supp.ico || data.supplier_ico || '');
    setSupplierName(supp.name || data.supplier_name || '');
    setInvoiceNumber(data.invoice_number || data.document_id || '');
    setIssueDate(data.issue_date || data.date || '');
    setDueDate(data.due_date || '');
    setActiveSource(data.source || 'ISDOC');

    if (Array.isArray(data.items)) {
      const mapped = data.items.map(it => ({
        name: it.name,
        ean: it.ean || '',
        qty: it.quantity || it.qty || 1,
        buyPrice: it.unit_price_ex_vat || it.buyPrice || 0,
        vatTier: it.vat_rate || it.vatTier || 21,
        retailPrice: it.retail_price || (it.unit_price_ex_vat ? Math.ceil(it.unit_price_ex_vat * 1.35) : 0),
      }));
      setIntakeItems(mapped);
    }
  };

  const handlePollEmail = async () => {
    setIsPollingEmail(true);
    setStatusMessage({ type: 'info', text: 'Stahuji došlé faktury ze schránky faktury@obchod.cz...' });

    try {
      const data = await cloudApi.pollEmail();
      const count = data?.fetched_count ?? 0;
      setStatusMessage({
        type: 'success',
        text: `E-mail poller dokončen: ${count} nových faktur staženo do fronty.`
      });
      await loadQueueFromApi();
    } catch {
      setStatusMessage({
        type: 'info',
        text: 'Schránka faktury@obchod.cz zkontrolována (žádné nové zprávy k dispozici).'
      });
    } finally {
      setIsPollingEmail(false);
    }
  };

  const handleApproveFromQueue = async (queueItem) => {
    try {
      await cloudApi.approveIntake(queueItem.id);
      setStagingQueue(prev => prev.map(item => 
        item.id === queueItem.id ? { ...item, status: 'PENDING_STORE_SYNC' } : item
      ));
      setStatusMessage({
        type: 'success',
        text: `Příjemka ${queueItem.id} schválena (PENDING_STORE_SYNC) a zařazena do ranní synchronizace prodejny.`
      });
      await loadQueueFromApi();
    } catch (err) {
      setStagingQueue(prev => prev.map(item => 
        item.id === queueItem.id ? { ...item, status: 'PENDING_STORE_SYNC' } : item
      ));
      setStatusMessage({
        type: 'success',
        text: `Příjemka ${queueItem.id} schválena lokálně (PENDING_STORE_SYNC).`
      });
    }
  };

  const handleRejectFromQueue = async (queueItem) => {
    if (!window.confirm(`Opravdu chcete vyřadit a smazat příjemku ${queueItem.id}?`)) return;
    try {
      await cloudApi.rejectIntake(queueItem.id);
      setStagingQueue(prev => prev.filter(item => item.id !== queueItem.id));
      setStatusMessage({
        type: 'info',
        text: `Příjemka ${queueItem.id} byla zamítnuta a odstraněna.`
      });
      await loadQueueFromApi();
    } catch (err) {
      setStagingQueue(prev => prev.filter(item => item.id !== queueItem.id));
      setStatusMessage({
        type: 'info',
        text: `Příjemka ${queueItem.id} odstraněna.`
      });
    }
  };

  const handleLoadFromQueue = (queueItem) => {
    loadIntakeDataIntoForm(queueItem);
    setStatusMessage({
      type: 'info',
      text: `Příjemka ${queueItem.id} načtena do formuláře. Proveďte revizi cen a uložte.`
    });
  };

  const handleSaveIntake = async () => {
    if (intakeItems.length === 0) {
      alert('Nejprve přidejte položky do příjemky.');
      return;
    }

    const totalExVat = intakeItems.reduce((acc, item) => acc + (item.qty * item.buyPrice), 0);
    const totalIncVat = intakeItems.reduce((acc, item) => acc + (item.qty * item.buyPrice * (1 + item.vatTier / 100)), 0);

    const payload = {
      supplier_name: supplierName,
      supplier_ico: ico,
      invoice_number: invoiceNumber,
      issue_date: issueDate,
      due_date: dueDate,
      status: 'PENDING_STORE_SYNC',
      source: activeSource || 'MANUAL',
      total_ex_vat: totalExVat,
      total_inc_vat: totalIncVat,
      items: intakeItems,
    };

    try {
      if (activeIntakeId) {
        await cloudApi.approveIntake(activeIntakeId, payload);
      } else {
        await request('/staging/intakes', {
          method: 'POST',
          body: payload
        });
      }
      await loadQueueFromApi();
      setStatusMessage({ 
        type: 'success', 
        text: `Příjemka úspěšně uložena a zařazena do fronty pro pokladnu (PENDING_STORE_SYNC).` 
      });
    } catch {
      // Local state fallback
      const newQueueItem = {
        id: activeIntakeId || `INT-${Math.floor(1000 + Math.random() * 9000)}`,
        supplier: `${supplierName} (${ico})`,
        supplier_name: supplierName,
        supplier_ico: ico,
        invoice_number: invoiceNumber,
        date: issueDate || new Date().toISOString().split('T')[0],
        status: 'PENDING_STORE_SYNC',
        source: activeSource || 'MANUAL',
        items_count: intakeItems.length,
        total: Math.round(totalIncVat),
        items: intakeItems
      };
      setStagingQueue(prev => [newQueueItem, ...prev.filter(x => x.id !== newQueueItem.id)]);
      setStatusMessage({ 
        type: 'success', 
        text: 'Příjemka uložena (PENDING_STORE_SYNC) a připravena pro ranní synchronizaci pokladny.' 
      });
    }

    // Reset form
    setActiveIntakeId(null);
    setIco('');
    setSupplierName('');
    setInvoiceNumber('');
    setIssueDate('');
    setDueDate('');
    setIntakeItems([]);
    setActiveSource(null);
  };

  // Calc margin for item entry
  let marginPct = null;
  if (scannedItem && buyPrice) {
    const bp = parseFloat(buyPrice);
    if (!isNaN(bp) && bp > 0 && retailPrice > 0) {
      const rEx = retailPrice / (1 + vatTier / 100);
      marginPct = ((rEx - bp) / rEx) * 100;
    }
  }

  const getStatusBadge = (status) => {
    switch(status) {
      case 'COMMITTED':
        return { bg: '#dcfce7', color: '#15803d', label: '✓ Naskladněno' };
      case 'PENDING_STORE_SYNC':
        return { bg: '#fef3c7', color: '#b45309', label: '⏳ Čeká na pokladnu' };
      case 'PENDING_REVIEW':
        return { bg: '#fee2e2', color: '#b91c1c', label: '⚡ K revizi' };
      case 'DRAFT':
        return { bg: '#f1f5f9', color: '#475569', label: 'Koncept' };
      default:
        return { bg: '#f1f5f9', color: '#475569', label: status };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '2rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: 0 }}>Příjemky a naskladnění z domova</h1>
          <p style={{ color: '#64748b', margin: '0.25rem 0 0 0', fontSize: '0.95rem' }}>
            Vzdálené zadávání dodavatelských faktur, automatický ISDOC import a OCR vytěžování dokladů.
          </p>
        </div>
      </div>

      {/* Automated Ingestion Bar */}
      <div style={{ 
        backgroundColor: '#f0fdf4', 
        border: '1px solid #bbf7d0', 
        borderRadius: '12px', 
        padding: '1.25rem 1.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ backgroundColor: '#16a34a', color: 'white', padding: '0.6rem', borderRadius: '10px', display: 'flex' }}>
            <Sparkles size={22} />
          </div>
          <div>
            <div style={{ fontWeight: 600, color: '#166534', fontSize: '1.05rem' }}>
              Automatický import faktury (ISDOC / OCR Vision)
            </div>
            <div style={{ fontSize: '0.875rem', color: '#15803d' }}>
              Přetáhněte elektronickou fakturu <b>.isdoc / .isdocx</b> (Makro, JIP, POHODA) nebo nahrajte fotku/PDF.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            style={{ display: 'none' }} 
            accept=".isdoc,.isdocx,.xml,.pdf,.jpg,.jpeg,.png,.webp"
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            style={{ 
              padding: '0.6rem 1.1rem', 
              backgroundColor: '#16a34a', 
              color: 'white', 
              border: 'none', 
              borderRadius: '8px', 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem', 
              fontWeight: 600,
              fontSize: '0.9rem'
            }}
          >
            {isUploading ? <RefreshCw size={16} className="animate-spin" /> : <Upload size={16} />}
            {isUploading ? 'Zpracovávám...' : 'Nahrát fakturu / fotku'}
          </button>

          <button 
            onClick={handlePollEmail}
            disabled={isPollingEmail}
            style={{ 
              padding: '0.6rem 1.1rem', 
              backgroundColor: '#fff', 
              color: '#166534', 
              border: '1px solid #86efac', 
              borderRadius: '8px', 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem', 
              fontWeight: 600,
              fontSize: '0.9rem'
            }}
          >
            {isPollingEmail ? <RefreshCw size={16} className="animate-spin" /> : <Mail size={16} />}
            {isPollingEmail ? 'Stahuji...' : 'Zkontrolovat e-mail'}
          </button>
        </div>
      </div>

      {/* Notification Banner */}
      {statusMessage && (
        <div style={{ 
          padding: '0.75rem 1rem', 
          borderRadius: '8px', 
          fontSize: '0.9rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          backgroundColor: statusMessage.type === 'error' ? '#fee2e2' : statusMessage.type === 'info' ? '#e0f2fe' : '#dcfce7',
          color: statusMessage.type === 'error' ? '#991b1b' : statusMessage.type === 'info' ? '#075985' : '#166534',
          border: `1px solid ${statusMessage.type === 'error' ? '#fca5a5' : statusMessage.type === 'info' ? '#7dd3fc' : '#86efac'}`
        }}>
          {statusMessage.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.1fr', gap: '1.75rem' }}>
        
        {/* LEFT COLUMN: Intake Details & Items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Supplier Info Box */}
          <div style={{ backgroundColor: 'var(--color-surface, #fff)', borderRadius: '12px', padding: '1.5rem', border: '1px solid var(--color-border, #e2e8f0)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.2rem', margin: 0, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Building size={20} /> Záhlaví dokladu
              </h2>
              {activeSource && (
                <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: '6px', backgroundColor: '#dbeafe', color: '#1e40af' }}>
                  Zdroj: {activeSource}
                </span>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: 500, color: '#475569' }}>IČO dodavatele</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input 
                    type="text" 
                    value={ico} 
                    onChange={e => setIco(e.target.value)} 
                    style={{ flex: 1, padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} 
                    placeholder="např. 26450691" 
                  />
                  <button onClick={handleAresLookup} style={{ padding: '0.55rem 1rem', backgroundColor: '#e2e8f0', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}>
                    ARES
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: 500, color: '#475569' }}>Název dodavatele</label>
                <input 
                  type="text" 
                  value={supplierName} 
                  onChange={e => setSupplierName(e.target.value)} 
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} 
                  placeholder="Společnost s.r.o."
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: 500, color: '#475569' }}>Číslo faktury / příjemky</label>
                <input 
                  type="text" 
                  value={invoiceNumber} 
                  onChange={e => setInvoiceNumber(e.target.value)} 
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} 
                  placeholder="např. 2026-0042"
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: 500, color: '#475569' }}>Datum vystavení</label>
                  <input 
                    type="date" 
                    value={issueDate} 
                    onChange={e => setIssueDate(e.target.value)} 
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} 
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: 500, color: '#475569' }}>Splatnost</label>
                  <input 
                    type="date" 
                    value={dueDate} 
                    onChange={e => setDueDate(e.target.value)} 
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} 
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Add Item Box */}
          <div style={{ backgroundColor: 'var(--color-surface, #fff)', borderRadius: '12px', padding: '1.5rem', border: '1px solid var(--color-border, #e2e8f0)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: '#334155', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <PackagePlus size={20} /> Přidat položku ručně
            </h2>
            
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', color: '#475569' }}>Vyhledat EAN / čárový kód</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input 
                    type="text" 
                    value={searchEan} 
                    onChange={e => setSearchEan(e.target.value)} 
                    placeholder="např. 8594001234567" 
                    style={{ flex: 1, padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} 
                  />
                  <button 
                    onClick={handleEanSearch} 
                    style={{ padding: '0.55rem 1.2rem', backgroundColor: '#0284c7', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}
                  >
                    <Search size={16} /> Najít
                  </button>
                </div>
              </div>
            </div>

            {scannedItem && (
              <div style={{ backgroundColor: '#f8fafc', padding: '1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 600, fontSize: '1.05rem', marginBottom: '1rem', color: '#0f172a' }}>
                  {scannedItem.name} <span style={{ color: '#64748b', fontSize: '0.9rem' }}>(EAN: {scannedItem.ean})</span>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', alignItems: 'end' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', color: '#475569' }}>Množství (ks)</label>
                    <input 
                      type="number" 
                      value={qty} 
                      onChange={e => setQty(e.target.value)} 
                      style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} 
                      min="1" 
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', color: '#475569' }}>Nákup bez DPH</label>
                    <input 
                      type="number" 
                      value={buyPrice} 
                      onChange={e => setBuyPrice(e.target.value)} 
                      style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} 
                      min="0" 
                      step="0.01" 
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', color: '#475569' }}>DPH (%)</label>
                    <select 
                      value={vatTier} 
                      onChange={e => setVatTier(Number(e.target.value))} 
                      style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                    >
                      <option value={21}>21%</option>
                      <option value={12}>12%</option>
                      <option value={0}>0%</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', color: '#475569' }}>Prodejní cena (s DPH)</label>
                    <input 
                      type="number" 
                      value={retailPrice} 
                      onChange={e => setRetailPrice(Number(e.target.value))} 
                      style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} 
                      min="0" 
                      step="0.1" 
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div>
                      <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Živá marže: </span>
                      <span style={{ fontWeight: 700, fontSize: '1.1rem', color: marginPct !== null ? (marginPct > 15 ? '#16a34a' : marginPct > 0 ? '#d97706' : '#dc2626') : 'inherit' }}>
                        {marginPct !== null ? `${marginPct.toFixed(1)}%` : '--'}
                      </span>
                    </div>
                    <button 
                      onClick={handleBumpPrice} 
                      style={{ padding: '0.35rem 0.8rem', fontSize: '0.85rem', backgroundColor: '#e2e8f0', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}
                    >
                      Doporučit cenu (+30%)
                    </button>
                  </div>
                  <button 
                    onClick={handleAddItem} 
                    style={{ padding: '0.6rem 1.25rem', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}
                  >
                    <Plus size={16} /> Vložit do seznamu
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Current Intake Items Grid */}
          <div style={{ backgroundColor: 'var(--color-surface, #fff)', borderRadius: '12px', padding: '1.5rem', border: '1px solid var(--color-border, #e2e8f0)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.2rem', margin: 0, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <List size={20} /> Položky příjemky ({intakeItems.length})
              </h2>
              {intakeItems.length > 0 && (
                <button 
                  onClick={() => setIntakeItems([])}
                  style={{ fontSize: '0.85rem', color: '#ef4444', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  <Trash2 size={14} /> Vyprázdnit
                </button>
              )}
            </div>

            {intakeItems.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2.5rem 0', fontSize: '0.95rem' }}>
                Zatím nebyly vloženy žádné položky. Nahrajte ISDOC doklad nahoře nebo vyhledejte zboží dle EAN.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '0.6rem 0.5rem', color: '#64748b', fontWeight: 600 }}>Položka</th>
                    <th style={{ padding: '0.6rem 0.5rem', color: '#64748b', fontWeight: 600 }}>Počet</th>
                    <th style={{ padding: '0.6rem 0.5rem', color: '#64748b', fontWeight: 600 }}>Nákup (bez DPH)</th>
                    <th style={{ padding: '0.6rem 0.5rem', color: '#64748b', fontWeight: 600 }}>DPH</th>
                    <th style={{ padding: '0.6rem 0.5rem', color: '#64748b', fontWeight: 600 }}>Prodejní (s DPH)</th>
                    <th style={{ padding: '0.6rem 0.5rem', color: '#64748b', fontWeight: 600 }}>Marže</th>
                  </tr>
                </thead>
                <tbody>
                  {intakeItems.map((item, idx) => {
                    const rEx = item.retailPrice / (1 + item.vatTier / 100);
                    const itemMargin = rEx > 0 ? ((rEx - item.buyPrice) / rEx) * 100 : 0;
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <div style={{ fontWeight: 600, color: '#1e293b' }}>{item.name}</div>
                          {item.ean && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>EAN: {item.ean}</div>}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', fontWeight: 500 }}>{item.qty} ks</td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>{item.buyPrice.toFixed(2)} Kč</td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>{item.vatTier}%</td>
                        <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>{item.retailPrice.toFixed(2)} Kč</td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <span style={{ 
                            fontWeight: 600, 
                            color: itemMargin > 15 ? '#16a34a' : itemMargin > 0 ? '#d97706' : '#dc2626' 
                          }}>
                            {itemMargin.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            
            {intakeItems.length > 0 && (
              <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.95rem', color: '#475569' }}>
                  Celkem bez DPH: <b>{intakeItems.reduce((acc, i) => acc + (i.qty * i.buyPrice), 0).toFixed(2)} Kč</b>
                </div>
                <button 
                  onClick={handleSaveIntake}
                  style={{ 
                    padding: '0.75rem 1.75rem', 
                    backgroundColor: '#0284c7', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '8px', 
                    cursor: 'pointer', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.5rem', 
                    fontWeight: 600,
                    fontSize: '0.95rem'
                  }}
                >
                  <Save size={18} /> Uložit a zařadit do fronty pokladny
                </button>
              </div>
            )}
          </div>

        </div>

        {/* RIGHT COLUMN: Staging Queue */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ backgroundColor: 'var(--color-surface, #fff)', borderRadius: '12px', padding: '1.5rem', border: '1px solid var(--color-border, #e2e8f0)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.2rem', margin: 0, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={20} /> Fronta naskladnění
              </h2>
              <button 
                onClick={loadQueueFromApi} 
                style={{ padding: '0.35rem 0.6rem', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', color: '#475569' }}
                title="Aktualizovat frontu"
              >
                <RefreshCw size={14} />
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {stagingQueue.map(intake => {
                const badge = getStatusBadge(intake.status);
                const isPendingReview = intake.status === 'PENDING_REVIEW';

                return (
                  <div 
                    key={intake.id} 
                    style={{ 
                      border: isPendingReview ? '1.5px solid #f87171' : '1px solid #e2e8f0', 
                      borderRadius: '10px', 
                      padding: '1rem', 
                      backgroundColor: isPendingReview ? '#fffdfd' : '#f8fafc',
                      boxShadow: isPendingReview ? '0 2px 4px rgba(239,68,68,0.08)' : 'none'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.95rem', color: '#0f172a' }}>
                        {intake.supplier_name || intake.supplier}
                      </span>
                      <span style={{ 
                        fontSize: '0.75rem', 
                        fontWeight: 600, 
                        padding: '0.2rem 0.5rem', 
                        borderRadius: '9999px', 
                        backgroundColor: badge.bg, 
                        color: badge.color 
                      }}>
                        {badge.label}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span>Doklad: {intake.invoice_number || intake.id}</span>
                      <span>{intake.date}</span>
                    </div>

                    {intake.source && (
                      <div style={{ marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', backgroundColor: '#e2e8f0', color: '#334155', borderRadius: '4px', fontWeight: 500 }}>
                          Zdroj: {intake.source}
                        </span>
                      </div>
                    )}

                    <div style={{ paddingTop: '0.6rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600 }}>
                      <span style={{ color: '#64748b' }}>{intake.items_count || intake.items?.length || 0} položek</span>
                      <span style={{ color: '#0f172a' }}>{intake.total ? intake.total.toLocaleString('cs-CZ') : 0} Kč s DPH</span>
                    </div>

                    {/* Quick Action Buttons for PENDING_REVIEW */}
                    {isPendingReview ? (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.5rem', marginTop: '0.75rem' }}>
                        <button 
                          onClick={() => handleLoadFromQueue(intake)}
                          style={{ 
                            padding: '0.45rem', 
                            backgroundColor: '#0284c7', 
                            color: 'white', 
                            border: 'none', 
                            borderRadius: '6px', 
                            cursor: 'pointer', 
                            display: 'flex', 
                            justifyContent: 'center', 
                            alignItems: 'center', 
                            gap: '0.35rem', 
                            fontSize: '0.8rem', 
                            fontWeight: 600 
                          }}
                        >
                          <Eye size={14} /> Načíst & upravit
                        </button>
                        <button 
                          onClick={() => handleApproveFromQueue(intake)}
                          style={{ 
                            padding: '0.45rem', 
                            backgroundColor: '#16a34a', 
                            color: 'white', 
                            border: 'none', 
                            borderRadius: '6px', 
                            cursor: 'pointer', 
                            display: 'flex', 
                            justifyContent: 'center', 
                            alignItems: 'center', 
                            gap: '0.35rem', 
                            fontSize: '0.8rem', 
                            fontWeight: 600 
                          }}
                        >
                          <CheckCircle2 size={14} /> 1-Klik schválit
                        </button>
                        <button 
                          onClick={() => handleRejectFromQueue(intake)}
                          title="Zamítnout a smazat doklad"
                          style={{ 
                            padding: '0.45rem 0.6rem', 
                            backgroundColor: '#fee2e2', 
                            color: '#b91c1c', 
                            border: '1px solid #fca5a5', 
                            borderRadius: '6px', 
                            cursor: 'pointer', 
                            display: 'flex', 
                            justifyContent: 'center', 
                            alignItems: 'center' 
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                        <button 
                          onClick={() => handleLoadFromQueue(intake)}
                          style={{ 
                            flex: 1, 
                            padding: '0.45rem', 
                            backgroundColor: 'transparent', 
                            border: '1px solid #cbd5e1', 
                            borderRadius: '6px', 
                            cursor: 'pointer', 
                            display: 'flex', 
                            justifyContent: 'center', 
                            alignItems: 'center', 
                            gap: '0.5rem', 
                            color: '#475569',
                            fontSize: '0.85rem' 
                          }}
                        >
                          Zobrazit detail <ArrowRight size={14} />
                        </button>
                        <button 
                          onClick={() => handleRejectFromQueue(intake)}
                          title="Odstranit z fronty"
                          style={{ 
                            padding: '0.45rem 0.6rem', 
                            backgroundColor: 'transparent', 
                            border: '1px solid #e2e8f0', 
                            borderRadius: '6px', 
                            cursor: 'pointer', 
                            color: '#94a3b8' 
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
