import React from 'react';
import { Search, Package, Plus, Edit2, Trash2 } from 'lucide-react';

const MOCK_CATALOG = [
  { id: 1, name: 'Espresso', ean: '859000000001', code: 'IT-001', price: '45.00 CZK', vat: '12%', stock: '-' },
  { id: 2, name: 'Cappuccino', ean: '859000000002', code: 'IT-002', price: '65.00 CZK', vat: '12%', stock: '-' },
  { id: 3, name: 'Croissant', ean: '859000000003', code: 'FD-001', price: '35.00 CZK', vat: '12%', stock: '24' },
  { id: 4, name: 'Orange Juice 0.3l', ean: '859000000004', code: 'BV-001', price: '50.00 CZK', vat: '21%', stock: '15' },
  { id: 5, name: 'Sandwich Ham & Cheese', ean: '859000000005', code: 'FD-002', price: '85.00 CZK', vat: '12%', stock: '8' },
];

export default function CatalogPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: 0 }}>Product Catalog</h1>
        <button style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.5rem', 
          backgroundColor: 'var(--color-primary, #0052cc)', 
          color: '#ffffff', 
          border: 'none',
          padding: '0.75rem 1.25rem',
          borderRadius: '8px',
          fontWeight: 600,
          cursor: 'pointer'
        }}>
          <Plus size={18} />
          Add Product
        </button>
      </div>
      
      <div style={{ 
        backgroundColor: 'var(--color-surface, #ffffff)', 
        borderRadius: '12px', 
        border: '1px solid var(--color-border, #e2e8f0)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Toolbar */}
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--color-border, #e2e8f0)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ flex: 1, display: 'flex', gap: '0.5rem', alignItems: 'center', backgroundColor: 'var(--color-background, #f8fafc)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--color-border, #e2e8f0)' }}>
            <Search size={18} color="var(--color-text-secondary, #64748b)" />
            <input 
              type="text" 
              placeholder="Search by product name, EAN, or internal code..." 
              style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '0.95rem' }}
            />
          </div>
        </div>
        
        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ backgroundColor: 'var(--color-background, #f8fafc)' }}>
              <tr>
                <th style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--color-border, #e2e8f0)', fontWeight: 600, color: 'var(--color-text-secondary, #475569)' }}>Name</th>
                <th style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--color-border, #e2e8f0)', fontWeight: 600, color: 'var(--color-text-secondary, #475569)' }}>Internal Code</th>
                <th style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--color-border, #e2e8f0)', fontWeight: 600, color: 'var(--color-text-secondary, #475569)' }}>EAN</th>
                <th style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--color-border, #e2e8f0)', fontWeight: 600, color: 'var(--color-text-secondary, #475569)' }}>Price (Incl. VAT)</th>
                <th style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--color-border, #e2e8f0)', fontWeight: 600, color: 'var(--color-text-secondary, #475569)' }}>VAT Tier</th>
                <th style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--color-border, #e2e8f0)', fontWeight: 600, color: 'var(--color-text-secondary, #475569)' }}>Stock</th>
                <th style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--color-border, #e2e8f0)', fontWeight: 600, color: 'var(--color-text-secondary, #475569)', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_CATALOG.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid var(--color-border, #e2e8f0)' }}>
                  <td style={{ padding: '1rem 1.5rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '6px', backgroundColor: 'var(--color-background, #f8fafc)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary, #64748b)' }}>
                      <Package size={16} />
                    </div>
                    {item.name}
                  </td>
                  <td style={{ padding: '1rem 1.5rem', color: 'var(--color-text-secondary, #475569)' }}>{item.code}</td>
                  <td style={{ padding: '1rem 1.5rem', color: 'var(--color-text-secondary, #475569)', fontFamily: 'monospace' }}>{item.ean}</td>
                  <td style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>{item.price}</td>
                  <td style={{ padding: '1rem 1.5rem', color: 'var(--color-text-secondary, #475569)' }}>
                    <span style={{ backgroundColor: 'var(--color-background, #f8fafc)', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.85rem' }}>{item.vat}</span>
                  </td>
                  <td style={{ padding: '1rem 1.5rem', color: 'var(--color-text-secondary, #475569)' }}>{item.stock}</td>
                  <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary, #64748b)', padding: '0.25rem' }}>
                        <Edit2 size={16} />
                      </button>
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger, #ef4444)', padding: '0.25rem' }}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
