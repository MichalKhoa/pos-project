import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import appSource from '../App.jsx?raw';
import indexHtml from '../../index.html?raw';
import StockIntakeModal from '../components/inventory/StockIntakeModal';
import StockWriteOffModal from '../components/inventory/StockWriteOffModal';
import { LanguageProvider } from '../i18n/LanguageContext';
import { StoreConfigProvider } from '../context/StoreConfigContext';

// Vitest turns CSS imports into empty strings, so the stylesheets are read from disk.
const tokensCss = readFileSync('src/styles/tokens.css', 'utf8');
const layoutCss = readFileSync('src/styles/layout.css', 'utf8');

// Batch E (audit F-018, F-020, F-007, F-031, F-032): the app targets a touch PC only.

// All declarations of a rule whose selector list contains `selector` exactly.
const declarations = (css, selector) =>
  [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)]
    .filter(([, sel]) => sel.split(',').some((s) => s.trim() === selector))
    .map(([, , body]) => body)
    .join('\n');

describe('touch sizes (F-020)', () => {
  it('defines a 44 px touch minimum and applies it to buttons', () => {
    expect(tokensCss).toMatch(/--touch-min:\s*44px/);
    expect(declarations(tokensCss, 'button')).toMatch(/min-height:\s*var\(--touch-min\)/);
  });

  it('navbar tabs are 48 px high', () => {
    expect(declarations(layoutCss, '.nav-tab')).toMatch(/(?:^|\s)(?:min-)?height:\s*48px/m);
  });

  it('no navbar or status text below 12 px', () => {
    const small = [];
    for (const [, sel, body] of layoutCss.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      if (!/\.nav-|\.status-badge/.test(sel)) continue;
      const m = body.match(/font-size:\s*([\d.]+)(px|rem)/);
      if (!m) continue;
      const px = m[2] === 'rem' ? parseFloat(m[1]) * 16 : parseFloat(m[1]);
      if (px < 12) small.push(`${sel.trim().split('\n').pop()} ${m[1]}${m[2]}`);
    }
    expect(small).toEqual([]);
  });
});

describe('phone and tablet mode is gone (F-018)', () => {
  it('App.jsx has no mobile mode state, tab bar or hidden columns', () => {
    expect(appSource).not.toMatch(/isMobile|mobilePosTab|mobile-pos-tab|mobile-hidden/);
  });

  it('the viewport allows zoom', () => {
    expect(indexHtml).not.toMatch(/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(?![\d.])/);
  });
});

describe('default text size (F-007)', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-font-size');
    global.fetch = vi.fn(() => Promise.reject(new Error('offline')));
  });

  it('is Large when nothing is saved', () => {
    render(
      <StoreConfigProvider>
        <span>x</span>
      </StoreConfigProvider>
    );
    expect(document.documentElement.getAttribute('data-font-size')).toBe('lg');
  });
});

describe('stock modals (F-031, F-032)', () => {
  const presets = [{ id: 'p1', name: 'Rohlík', category: 'c', price: 3, costPrice: 2, stockQuantity: 10, unit: 'ks', trackStock: true }];

  it('the intake table scrolls sideways instead of being clipped', () => {
    const { container } = render(
      <LanguageProvider>
        <StockIntakeModal isOpen={true} onClose={vi.fn()} presets={presets} onIntakeCompleted={vi.fn()} />
      </LanguageProvider>
    );
    const wrapper = container.ownerDocument.querySelector('table').parentElement;
    expect(wrapper.style.overflowX).toBe('auto');
  });

  const renderWriteOff = () =>
    render(
      <LanguageProvider>
        <StockWriteOffModal isOpen={true} onClose={vi.fn()} presets={presets} categories={[]} onWriteOffCompleted={vi.fn()} />
      </LanguageProvider>
    );

  it('the write-off product select is wide enough to read', () => {
    renderWriteOff();
    const select = screen.getAllByRole('combobox').find((s) => !s.dataset.testid);
    expect(parseInt(select.style.minWidth, 10)).toBeGreaterThanOrEqual(200);
  });

  it('the tax notice is hidden until an item is chosen', () => {
    renderWriteOff();
    expect(screen.queryByText(/Režim:/)).toBeNull();
  });
});
