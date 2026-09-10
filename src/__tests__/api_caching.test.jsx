import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  cachedFetch,
  invalidateApiCache,
  _apiCache,
  fetchCategoriesBackend,
  fetchPresetsBackend,
  fetchStoreConfigBackend,
  saveCategoryBackend,
  deleteCategoryBackend,
  reorderCategoriesBackend,
  savePresetBackend,
  bulkSavePresetsBackend,
  reorderPresetsBackend,
  deletePresetBackend,
  togglePresetPinBackend,
  saveStoreConfigBackend
} from '../api/posApi';
import { usePosCatalog, lookupPresetByBarcode } from '../hooks/usePosCatalog';

describe('posApi - In-Memory Caching & Throttling', () => {
  beforeEach(() => {
    invalidateApiCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('cachedFetch caches GET requests within TTL and returns cloned data', async () => {
    const mockData = [{ id: '1', name: 'Item A' }];
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockData
    });

    const res1 = await cachedFetch('http://127.0.0.1:8000/api/v1/test', {}, { ttlMs: 10000, tag: 'test' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(res1).toEqual(mockData);

    // Mutate returned data
    res1[0].name = 'Mutated';

    // Second call within TTL should return cached copy without mutation
    const res2 = await cachedFetch('http://127.0.0.1:8000/api/v1/test', {}, { ttlMs: 10000, tag: 'test' });
    expect(fetchSpy).toHaveBeenCalledTimes(1); // Still 1 fetch
    expect(res2[0].name).toBe('Item A');
  });

  it('cachedFetch bypasses cache for non-GET requests', async () => {
    const mockData = { status: 'OK' };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockData
    });

    await cachedFetch('http://127.0.0.1:8000/api/v1/post', { method: 'POST', body: '{}' });
    await cachedFetch('http://127.0.0.1:8000/api/v1/post', { method: 'POST', body: '{}' });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('cachedFetch deduplicates concurrent in-flight requests', async () => {
    let resolveFetch;
    const fetchPromise = new Promise(resolve => {
      resolveFetch = resolve;
    });

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      fetchPromise.then(() => ({
        ok: true,
        json: async () => [{ id: 'dup-test' }]
      }))
    );

    const call1 = cachedFetch('http://127.0.0.1:8000/api/v1/inflight', {}, { ttlMs: 5000 });
    const call2 = cachedFetch('http://127.0.0.1:8000/api/v1/inflight', {}, { ttlMs: 5000 });

    resolveFetch();
    const [res1, res2] = await Promise.all([call1, call2]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(res1).toEqual([{ id: 'dup-test' }]);
    expect(res2).toEqual([{ id: 'dup-test' }]);
  });

  it('invalidateApiCache clears by tag and clears all', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ key: 'val' })
    });

    await cachedFetch('http://127.0.0.1:8000/api/v1/c1', {}, { tag: 'catalog' });
    await cachedFetch('http://127.0.0.1:8000/api/v1/c2', {}, { tag: 'config' });
    expect(_apiCache.size).toBe(2);

    invalidateApiCache('catalog');
    expect(_apiCache.size).toBe(1);
    expect(_apiCache.has('http://127.0.0.1:8000/api/v1/c2')).toBe(true);

    invalidateApiCache();
    expect(_apiCache.size).toBe(0);
  });

  it('mutations invalidate catalog and config tags', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'SUCCESS' })
    });

    // Populate catalog cache
    await fetchCategoriesBackend();
    await fetchPresetsBackend();
    expect(_apiCache.size).toBe(2);

    // Mutate catalog
    await saveCategoryBackend({ id: 'cat-1', name: 'Test' });
    expect(_apiCache.size).toBe(0);

    // Populate again
    await fetchCategoriesBackend();
    await deleteCategoryBackend('cat-1');
    expect(_apiCache.size).toBe(0);

    await fetchCategoriesBackend();
    await reorderCategoriesBackend([]);
    expect(_apiCache.size).toBe(0);

    await fetchPresetsBackend();
    await savePresetBackend({ id: 'p1' });
    expect(_apiCache.size).toBe(0);

    await fetchPresetsBackend();
    await bulkSavePresetsBackend([{ id: 'p1' }]);
    expect(_apiCache.size).toBe(0);

    await fetchPresetsBackend();
    await reorderPresetsBackend([{ id: 'p1' }]);
    expect(_apiCache.size).toBe(0);

    await fetchPresetsBackend();
    await deletePresetBackend('p1');
    expect(_apiCache.size).toBe(0);

    await fetchPresetsBackend();
    await togglePresetPinBackend('p1');
    expect(_apiCache.size).toBe(0);

    // Populate config cache
    await fetchStoreConfigBackend();
    expect(_apiCache.size).toBe(1);

    await saveStoreConfigBackend({ storeName: 'New' });
    expect(_apiCache.size).toBe(0);
  });
});

describe('usePosCatalog - Throttling & Barcode Lookup', () => {
  beforeEach(() => {
    invalidateApiCache();
    vi.restoreAllMocks();
  });

  it('lookupPresetByBarcode finds preset case-insensitively and handles multiple comma-separated barcodes', () => {
    const presets = [
      { id: 'p1', name: 'Kofola', barcode: '8594001, 8594002' },
      { id: 'p2', name: 'Plzeň', barcode: '123456' }
    ];

    expect(lookupPresetByBarcode(presets, '8594001')).toEqual(presets[0]);
    expect(lookupPresetByBarcode(presets, '8594002')).toEqual(presets[0]);
    expect(lookupPresetByBarcode(presets, '  8594002  ')).toEqual(presets[0]);
    expect(lookupPresetByBarcode(presets, '123456')).toEqual(presets[1]);
    expect(lookupPresetByBarcode(presets, '999999')).toBeNull();
    expect(lookupPresetByBarcode(null, '123456')).toBeNull();
  });

  it('usePosCatalog provides barcodeMap and findPresetByBarcode callback', () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => []
    });

    const { result } = renderHook(() => usePosCatalog());

    act(() => {
      result.current.setPresets([
        { id: 'item-1', name: 'Rohlík', barcode: '111, 222' },
        { id: 'item-2', name: 'Chléb', barcode: '333' }
      ]);
    });

    expect(result.current.findPresetByBarcode('111')).toMatchObject({ id: 'item-1' });
    expect(result.current.findPresetByBarcode('222')).toMatchObject({ id: 'item-1' });
    expect(result.current.findPresetByBarcode('333')).toMatchObject({ id: 'item-2' });
    expect(result.current.findPresetByBarcode('444')).toBeNull();
    expect(result.current.barcodeMap.get('111')).toMatchObject({ id: 'item-1' });
  });

  it('throttles reloadBackendCatalog unless forced or dirty', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => []
    });

    const { result } = renderHook(() => usePosCatalog());
    // Allow initial mount async fetch to complete
    await act(async () => {
      await Promise.resolve();
    });

    // Initial mount triggers 1 reload (categories + presets = 2 fetch calls)
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    // Call reloadBackendCatalog(false) without mutations -> throttled, no new fetch calls
    act(() => {
      result.current.reloadBackendCatalog(false);
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    // Invalidate API cache so the next call would fetch if not throttled
    invalidateApiCache('catalog');

    // Still throttled by hook since force is false and isDirty is false
    act(() => {
      result.current.reloadBackendCatalog(false);
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    // Call reloadBackendCatalog(true) forced -> bypasses hook throttle, calls fetch
    await act(async () => {
      result.current.reloadBackendCatalog(true);
      await Promise.resolve();
    });
    expect(fetchSpy).toHaveBeenCalledTimes(4);

    // Mark dirty via handler, invalidate cache, then unforced reload -> bypasses throttle because isDirty
    await act(async () => {
      result.current.handleAddCategory('Nová kategorie');
      await Promise.resolve();
    });
    // handleAddCategory does 1 POST and invalidates catalog cache
    expect(fetchSpy).toHaveBeenCalledTimes(5);

    await act(async () => {
      result.current.reloadBackendCatalog(false);
      await Promise.resolve();
    });
    // reload does 2 GETs because isDirty is true and cache was invalidated by handleAddCategory
    expect(fetchSpy).toHaveBeenCalledTimes(7);
  });
});

import { render, fireEvent } from '@testing-library/react';
import SalesHistoryView from '../components/SalesHistoryView';
import { LanguageProvider } from '../i18n/LanguageContext';
import * as posApi from '../api/posApi';

describe('SalesHistoryView - 300ms Search Debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    vi.spyOn(posApi, 'fetchSalesHistoryBackend').mockResolvedValue({
      sales: [],
      totalCount: 0
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('debounces backend search query by 300ms', async () => {
    const { container } = render(
      <LanguageProvider>
        <SalesHistoryView
          salesHistory={[]}
          storeConfig={{}}
          isAdminMode={false}
          onToggleAdminMode={() => {}}
          onDeleteSale={() => {}}
          onClearAllTestSales={() => {}}
          onInitiateRefund={() => {}}
        />
      </LanguageProvider>
    );

    // Initial mount call with search: null
    expect(posApi.fetchSalesHistoryBackend).toHaveBeenCalledWith(
      expect.objectContaining({ search: null })
    );

    const input = container.querySelector('input.keypad-label-input');
    expect(input).toBeTruthy();

    // Type first character
    act(() => {
      fireEvent.change(input, { target: { value: 'k' } });
      vi.advanceTimersByTime(100);
    });

    // Type more characters before 300ms expires
    act(() => {
      fireEvent.change(input, { target: { value: 'káva' } });
      vi.advanceTimersByTime(200);
    });

    // Still within debounce window - no new call with 'káva'
    const callsBeforeDebounce = posApi.fetchSalesHistoryBackend.mock.calls.filter(
      call => call[0].search === 'káva'
    );
    expect(callsBeforeDebounce.length).toBe(0);

    // Advance past 300ms
    act(() => {
      vi.advanceTimersByTime(150);
    });

    const callsAfterDebounce = posApi.fetchSalesHistoryBackend.mock.calls.filter(
      call => call[0].search === 'káva'
    );
    expect(callsAfterDebounce.length).toBeGreaterThanOrEqual(1);
  });
});



