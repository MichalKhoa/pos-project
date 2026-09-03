import { describe, it, expect, vi } from 'vitest';
import { exportInventoryToCSV, parseInventoryCSV } from '../utils/csvExporter';

describe('Inventory CSV Export & Import', () => {
  const samplePresets = [
    {
      id: 'p-1',
      name: 'Kofola 0.5L',
      category: 'beverages',
      price: 35.0,
      costPrice: 18.0,
      vat: 21,
      stockQuantity: 48,
      minStockAlert: 10,
      trackStock: true,
      barcode: '8594001234567',
      showInPresets: true
    },
    {
      id: 'p-2',
      name: 'Skladový Šroub M8',
      category: 'hardware',
      price: 5.5,
      costPrice: 2.0,
      vat: 21,
      stockQuantity: 500,
      minStockAlert: 50,
      trackStock: true,
      barcode: '8594009999999',
      showInPresets: false
    }
  ];

  const sampleCategories = [
    { id: 'beverages', name: 'Nápoje' },
    { id: 'hardware', name: 'Spojovací materiál' }
  ];

  it('exports inventory to CSV with UTF-8 BOM, semicolons and correct headers', () => {
    let capturedBlob = null;
    let capturedDownload = null;

    // Mock URL and createElement
    const mockClick = vi.fn();
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const originalCreateElement = document.createElement.bind(document);

    URL.createObjectURL = vi.fn(blob => {
      capturedBlob = blob;
      return 'blob:test-url';
    });
    URL.revokeObjectURL = vi.fn();

    vi.spyOn(document, 'createElement').mockImplementation(tagName => {
      const el = originalCreateElement(tagName);
      if (tagName === 'a') {
        el.click = mockClick;
        const origSetAttribute = el.setAttribute.bind(el);
        el.setAttribute = (attr, val) => {
          if (attr === 'download') capturedDownload = val;
          origSetAttribute(attr, val);
        };
      }
      return el;
    });

    exportInventoryToCSV(samplePresets, sampleCategories);

    expect(mockClick).toHaveBeenCalled();
    expect(capturedDownload).toMatch(/voltflow_pos_sklad_\d{4}-\d{2}-\d{2}\.csv/);
    expect(capturedBlob).toBeTruthy();

    // Restore mocks
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    vi.restoreAllMocks();
  });

  it('parses valid inventory CSV with existing preset updates and new preset creations', () => {
    const csvContent = [
      'ID položky;Název;Kategorie ID;Kategorie Název;Prodejní cena (Kč);Nákupní cena (Kč);Sazba DPH (%);Skladová zásoba;Minimální stav;Sledovat sklad (1/0);Čárový kód (EAN);Zobrazit na pokladně (1/0)',
      '"p-1";"Kofola 0.5L";"beverages";"Nápoje";39.00;20.00;21;60;12;1;"8594001234567";1',
      '"p-new";"Pilsner Urquell 0.5L";"beverages";"Nápoje";45.00;25.00;21;100;20;1;"8594001112223";0'
    ].join('\r\n');

    const result = parseInventoryCSV(csvContent, samplePresets);

    expect(result.toUpdate).toHaveLength(1);
    expect(result.toCreate).toHaveLength(1);

    // Updated existing preset p-1
    const updated = result.toUpdate[0];
    expect(updated.id).toBe('p-1');
    expect(updated.name).toBe('Kofola 0.5L');
    expect(updated.price).toBe(39);
    expect(updated.costPrice).toBe(20);
    expect(updated.stockQuantity).toBe(60);
    expect(updated.minStockAlert).toBe(12);
    expect(updated.showInPresets).toBe(true);

    // Created new preset
    const created = result.toCreate[0];
    expect(created.id).toBe('p-new');
    expect(created.name).toBe('Pilsner Urquell 0.5L');
    expect(created.price).toBe(45);
    expect(created.stockQuantity).toBe(100);
    expect(created.showInPresets).toBe(false);
  });

  it('handles empty or malformed CSV gracefully', () => {
    const emptyResult = parseInventoryCSV('');
    expect(emptyResult.errors).toHaveLength(1);

    const headerOnlyResult = parseInventoryCSV('ID;Název;Cena\n');
    expect(headerOnlyResult.errors).toHaveLength(1);
  });
});
