import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import Navbar from '../components/Navbar';
import { LanguageProvider } from '../i18n/LanguageContext';
import { StoreConfigProvider } from '../context/StoreConfigContext';
import appSource from '../App.jsx?raw';

// Every view App.jsx can show must have a way in from the navbar (F-017: the
// Sklad tab was removed from the navbar while its view stayed in App.jsx).
const viewKeys = [...new Set([...appSource.matchAll(/activeTab === '([a-z]+)'/g)].map(m => m[1]))];

function keysOpenedBy(selector) {
  const setActiveTab = vi.fn();
  const { container, unmount } = render(
    <LanguageProvider>
      <StoreConfigProvider>
        <Navbar activeTab="register" setActiveTab={setActiveTab} storeConfig={{}} />
      </StoreConfigProvider>
    </LanguageProvider>
  );
  container.querySelectorAll(selector).forEach(button => fireEvent.click(button));
  unmount();
  return new Set(setActiveTab.mock.calls.map(call => call[0]));
}

describe('navbar reachability', () => {
  it('finds the views App.jsx renders', () => {
    expect(viewKeys).toEqual(expect.arrayContaining(['register', 'presets', 'history', 'settings']));
  });

  it.each(viewKeys)('desktop navbar opens the %s view', (key) => {
    expect(keysOpenedBy('.nav-tab')).toContain(key);
  });
});
