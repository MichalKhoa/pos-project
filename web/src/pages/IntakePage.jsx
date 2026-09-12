import React, { useState } from 'react';
import { Search, Plus, Save, PackagePlus, FileText, Calendar, Building, List, ArrowRight } from 'lucide-react';

const MOCK_CATALOG = {
  '8594001234567': { ean: '8594001234567', name: 'Pilsner Urquell 0.5L', retailPrice: 35.0, vat: 21 },
  '8591234567890': { ean: '8591234567890', name: 'Rohlik', retailPrice: 3.5, vat: 12 },
};

const MOCK_QUEUE = [
  { id: 'INT-001', supplier: 'Plzensky Prazdroj (45329312)', date: '2023-10-01', status: 'COMMITTED', items: 12, total: 15400 },
  { id: 'INT-002', supplier: 'Makro (26450691)', date: '2023-10-05', status: 'PENDING_STORE_SYNC', items: 45, total: 32150 },
  { id: 'INT-003', supplier: 'Coca-Cola (2531631)', date: '2023-10-06', status: 'DRAFT', items: 3, total: 4200 },
];

export default function IntakePage() {
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

  const handleAresLookup = () => {
    if (ico === '45329312') setSupplierName('Plzensky Prazdroj');
    else if (ico === '26450691') setSupplierName('Makro');
    else setSupplierName('Mocked Supplier s.r.o.');
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
      alert('Item not found in catalog');
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
      qty: parseInt(qty, 10),
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

  // Calc margin
  let marginPct = null;
  if (scannedItem && buyPrice) {
    const bp = parseFloat(buyPrice);
    if (!isNaN(bp) && bp > 0 && retailPrice > 0) {
      const rEx = retailPrice / (1 + vatTier / 100);
      marginPct = ((rEx - bp) / rEx) * 100;
    }
  }

  const getStatusColor = (status) => {
    switch(status) {
      case 'COMMITTED': return '#10b981';
      case 'PENDING_STORE_SYNC': return '#f59e0b';
      case 'DRAFT': return '#64748b';
      default: return '#64748b';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '2rem' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: 0 }}>Supplier Intake</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
        
        {/* LEFT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Supplier Info */}
          <div style={{ backgroundColor: 'var(--color-surface, #fff)', borderRadius: '12px', padding: '1.5rem', border: '1px solid var(--color-border, #e2e8f0)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--color-text-secondary, #475569)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Building size={20} /> Invoice Details
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>IČO (Supplier ID)</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input type="text" value={ico} onChange={e => setIco(e.target.value)} style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} placeholder="e.g. 45329312" />
                  <button onClick={handleAresLookup} style={{ padding: '0.5rem 1rem', backgroundColor: '#e2e8f0', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Lookup</button>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Supplier Name</label>
                <input type="text" value={supplierName} onChange={e => setSupplierName(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Invoice Number</label>
                <input type="text" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Issue Date</label>
                  <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Due Date</label>
                  <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Item Entry */}
          <div style={{ backgroundColor: 'var(--color-surface, #fff)', borderRadius: '12px', padding: '1.5rem', border: '1px solid var(--color-border, #e2e8f0)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--color-text-secondary, #475569)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <PackagePlus size={20} /> Add Item
            </h2>
            
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Search EAN</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input type="text" value={searchEan} onChange={e => setSearchEan(e.target.value)} placeholder="e.g. 8594001234567" style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                  <button onClick={handleEanSearch} style={{ padding: '0.5rem 1rem', backgroundColor: 'var(--color-primary, #0052cc)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Search size={16} /> Find
                  </button>
                </div>
              </div>
            </div>

            {scannedItem && (
              <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '1rem' }}>{scannedItem.name} (EAN: {scannedItem.ean})</div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', alignItems: 'end' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Quantity</label>
                    <input type="number" value={qty} onChange={e => setQty(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} min="1" />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Buy Price (ex VAT)</label>
                    <input type="number" value={buyPrice} onChange={e => setBuyPrice(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} min="0" step="0.01" />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>VAT Tier (%)</label>
                    <select value={vatTier} onChange={e => setVatTier(Number(e.target.value))} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}>
                      <option value={21}>21%</option>
                      <option value={12}>12%</option>
                      <option value={0}>0%</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Retail Price</label>
                    <input type="number" value={retailPrice} onChange={e => setRetailPrice(Number(e.target.value))} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} min="0" step="0.1" />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div>
                      <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Live Margin: </span>
                      <span style={{ fontWeight: 600, fontSize: '1.1rem', color: marginPct !== null ? (marginPct > 15 ? '#10b981' : marginPct > 0 ? '#f59e0b' : '#ef4444') : 'inherit' }}>
                        {marginPct !== null ? `${marginPct.toFixed(1)}%` : '--'}
                      </span>
                    </div>
                    <button onClick={handleBumpPrice} style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem', backgroundColor: '#e2e8f0', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                      Bump Retail Price
                    </button>
                  </div>
                  <button onClick={handleAddItem} style={{ padding: '0.5rem 1rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                    <Plus size={16} /> Add to Grid
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Current Intake Items Grid */}
          <div style={{ backgroundColor: 'var(--color-surface, #fff)', borderRadius: '12px', padding: '1.5rem', border: '1px solid var(--color-border, #e2e8f0)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--color-text-secondary, #475569)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <List size={20} /> Current Items
            </h2>
            {intakeItems.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem 0' }}>No items added yet.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '0.5rem', color: '#64748b', fontWeight: 500 }}>Item</th>
                    <th style={{ padding: '0.5rem', color: '#64748b', fontWeight: 500 }}>Qty</th>
                    <th style={{ padding: '0.5rem', color: '#64748b', fontWeight: 500 }}>Buy (ex VAT)</th>
                    <th style={{ padding: '0.5rem', color: '#64748b', fontWeight: 500 }}>VAT</th>
                    <th style={{ padding: '0.5rem', color: '#64748b', fontWeight: 500 }}>Retail</th>
                  </tr>
                </thead>
                <tbody>
                  {intakeItems.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '0.75rem 0.5rem' }}>{item.name}</td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>{item.qty}</td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>{item.buyPrice.toFixed(2)} CZK</td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>{item.vatTier}%</td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>{item.retailPrice.toFixed(2)} CZK</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            
            {intakeItems.length > 0 && (
              <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button style={{ padding: '0.75rem 1.5rem', backgroundColor: 'var(--color-primary, #0052cc)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                  <Save size={18} /> Save Intake
                </button>
              </div>
            )}
          </div>

        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ backgroundColor: 'var(--color-surface, #fff)', borderRadius: '12px', padding: '1.5rem', border: '1px solid var(--color-border, #e2e8f0)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', color: 'var(--color-text-secondary, #475569)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={20} /> Staging Queue
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {MOCK_QUEUE.map(intake => (
                <div key={intake.id} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', backgroundColor: '#f8fafc' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 600 }}>{intake.supplier}</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.25rem 0.5rem', borderRadius: '9999px', backgroundColor: `${getStatusColor(intake.status)}20`, color: getStatusColor(intake.status) }}>
                      {intake.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{intake.id}</span>
                    <span>{intake.date}</span>
                  </div>
                  <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', fontWeight: 500 }}>
                    <span>{intake.items} items</span>
                    <span>{intake.total.toLocaleString()} CZK</span>
                  </div>
                  <button style={{ marginTop: '0.75rem', width: '100%', padding: '0.5rem', backgroundColor: 'transparent', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', color: '#475569' }}>
                    View <ArrowRight size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
