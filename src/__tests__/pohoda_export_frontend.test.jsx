import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { downloadPohodaXml } from '../api/posApi';
import SalesHistoryView from '../components/SalesHistoryView.jsx';
import { LanguageProvider } from '../i18n/LanguageContext.jsx';

describe('POHODA XML Frontend Export', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('downloadPohodaXml handles string month parameter and triggers download', async () => {
    let capturedDownload = null;
    const mockClick = vi.fn();

    const originalCreateObjectURL = window.URL.createObjectURL;
    const originalRevokeObjectURL = window.URL.revokeObjectURL;
    window.URL.createObjectURL = vi.fn(() => 'blob:test-pohoda');
    window.URL.revokeObjectURL = vi.fn();

    const origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(tagName => {
      const el = origCreateElement(tagName);
      if (tagName === 'a') {
        el.click = mockClick;
        const origSetAttribute = el.setAttribute.bind(el);
        el.setAttribute = (attr, val) => {
          if (attr === 'download') capturedDownload = val;
          return origSetAttribute(attr, val);
        };
      }
      return el;
    });

    const mockBlob = new Blob(['<dat:dataPack></dat:dataPack>'], { type: 'application/xml' });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({
        'content-disposition': 'attachment; filename="pohoda_export_2026-09.xml"'
      }),
      blob: () => Promise.resolve(mockBlob)
    });

    const result = await downloadPohodaXml('2026-09');

    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/sales/export/pohoda?month=2026-09'));
    expect(result.success).toBe(true);
    expect(result.filename).toBe('pohoda_export_2026-09.xml');
    expect(mockClick).toHaveBeenCalled();
    expect(capturedDownload).toBe('pohoda_export_2026-09.xml');

    window.URL.createObjectURL = originalCreateObjectURL;
    window.URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it('downloadPohodaXml handles date range object parameter', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers(),
      blob: () => Promise.resolve(new Blob(['test']))
    });

    await downloadPohodaXml({ fromDate: '2026-09-01', toDate: '2026-09-10' });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/sales\/export\/pohoda\?from_date=2026-09-01&to_date=2026-09-10/)
    );
  });

  it('renders POHODA XML button in SalesHistoryView and responds to clicks', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'X-Total-Count': '0' }),
      json: () => Promise.resolve([])
    });

    const mockSales = [
      {
        id: 'sale-1',
        receiptNumber: '2026-000001',
        timestamp: new Date().toISOString(),
        totalAmount: 150.0,
        paymentMethod: 'cash',
        isRefund: false,
        items: []
      }
    ];

    render(
      <LanguageProvider>
        <SalesHistoryView
          salesHistory={mockSales}
          storeConfig={{ ico: '12345678' }}
          isAdminMode={false}
          onToggleAdminMode={() => {}}
          onDeleteSale={() => {}}
          onClearAllTestSales={() => {}}
          onInitiateRefund={() => {}}
        />
      </LanguageProvider>
    );

    const pohodaBtn = screen.getByTitle(/Export pro účetní \(Stormware POHODA XML\)/i);
    expect(pohodaBtn).toBeInTheDocument();
    expect(pohodaBtn).toHaveTextContent(/POHODA XML/i);

    fireEvent.click(pohodaBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/sales/export/pohoda'));
    });
  });
});
