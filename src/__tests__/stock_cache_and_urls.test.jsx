import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PhysicalInventoryModal from '../components/inventory/PhysicalInventoryModal';
import DepositPackagingModal from '../components/inventory/DepositPackagingModal';
import TaxReportsModal from '../components/inventory/TaxReportsModal';
import { LanguageProvider } from '../i18n/LanguageContext';
import { fetchPresetsBackend, submitStockIntake, submitStockWriteOff, invalidateApiCache } from '../api/posApi';

// Audit F-029: the stock table must show the new stock right after a stock change.
// Audit F-030: inventory screens must call the backend by its full address.

const PRESETS_URL = 'http://127.0.0.1:8000/api/v1/catalog/presets';
const presetFetches = (fetchMock) => fetchMock.mock.calls.filter(([url]) => String(url) === PRESETS_URL).length;
const auditProtocol = {
  id: 1,
  protocol_number: 'INV-2026-0001',
  audit_number: 'INV-2026-0001',
  total_items_counted: 1,
  total_surplus_value: 50.0,
  total_shortage_value: 0.0,
  net_discrepancy_value: 50.0,
  audit_date: '2026-12-31T20:00:00',
  responsible_person: 'Vedoucí skladu',
  items: []
};
const jsonOk = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) });

describe('stock changes refresh the preset list (F-029)', () => {
  let fetchMock;
  beforeEach(() => {
    invalidateApiCache();
    fetchMock = vi.fn(() => jsonOk([]));
    global.fetch = fetchMock;
  });
  afterEach(() => invalidateApiCache());

  it('control: two reads without a stock change hit the network once', async () => {
    await fetchPresetsBackend();
    await fetchPresetsBackend();
    expect(presetFetches(fetchMock)).toBe(1);
  });

  it('refetches after a stock intake', async () => {
    await fetchPresetsBackend();
    await submitStockIntake({ items: [] });
    await fetchPresetsBackend();
    expect(presetFetches(fetchMock)).toBe(2);
  });

  it('refetches after a stock write-off', async () => {
    await fetchPresetsBackend();
    await submitStockWriteOff({ items: [] });
    await fetchPresetsBackend();
    expect(presetFetches(fetchMock)).toBe(2);
  });

  it('refetches after a physical inventory audit', async () => {
    const presets = [{ id: 'item-1', name: 'Pilsner Urquell 0.5l', barcode: '8594001', stockQuantity: 20, costPrice: 25, price: 35, unit: 'ks' }];
    await fetchPresetsBackend();
    fetchMock.mockImplementation((url) =>
      String(url).includes('/inventory/audit') ? jsonOk(auditProtocol) : jsonOk([])
    );
    render(
      <LanguageProvider>
        <PhysicalInventoryModal isOpen={true} onClose={vi.fn()} presets={presets} />
      </LanguageProvider>
    );
    const scanInput = screen.getByPlaceholderText(/Pípněte čárový kód/i);
    fireEvent.change(scanInput, { target: { value: '8594001' } });
    fireEvent.keyDown(scanInput, { key: 'Enter', code: 'Enter' });
    fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '22' } });
    fireEvent.click(screen.getByRole('button', { name: /Uzavřít a narovnat sklad/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Ano, zúčtovat sklad/i }));
    await screen.findByText(/Inventura úspěšně zaúčtována!/i);

    await fetchPresetsBackend();
    expect(presetFetches(fetchMock)).toBe(2);
  });
});

describe('inventory screens use the full backend address (F-030)', () => {
  let fetchMock;
  beforeEach(() => {
    fetchMock = vi.fn(() => jsonOk({ balances: [], recent_movements: [], items: [], monthly: [], quarters: [] }));
    global.fetch = fetchMock;
  });
  const relativeCalls = () => fetchMock.mock.calls.map(([url]) => String(url)).filter((url) => url.startsWith('/'));

  it('deposit book', async () => {
    render(
      <LanguageProvider>
        <DepositPackagingModal isOpen={true} onClose={vi.fn()} />
      </LanguageProvider>
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(relativeCalls()).toEqual([]);
  });

  it('tax reports', async () => {
    render(
      <LanguageProvider>
        <TaxReportsModal isOpen={true} onClose={vi.fn()} />
      </LanguageProvider>
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(relativeCalls()).toEqual([]);
  });

  it('deposit book shows an error when the summary cannot be loaded', async () => {
    fetchMock.mockImplementation(() => Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) }));
    render(
      <LanguageProvider>
        <DepositPackagingModal isOpen={true} onClose={vi.fn()} />
      </LanguageProvider>
    );
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});

describe('no component calls a relative /api URL (F-030)', () => {
  const sources = import.meta.glob(['../**/*.js', '../**/*.jsx', '!../__tests__/**'], {
    query: '?raw',
    import: 'default',
    eager: true
  });
  it('every fetch goes through the API base URL', () => {
    const offenders = [];
    for (const [file, src] of Object.entries(sources)) {
      if (/fetch\(\s*[`'"]\/api\//.test(src)) offenders.push(file.replace('../', ''));
    }
    expect(offenders).toEqual([]);
  });
});
