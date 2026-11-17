import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Navbar from '../components/Navbar';
import PaymentModal from '../components/PaymentModal';
import { LanguageProvider } from '../i18n/LanguageContext';
import { StoreConfigProvider } from '../context/StoreConfigContext';
import { DEFAULT_STORE_CONFIG } from '../data/initialData';

// Audit F-010, F-013, F-024, F-025: keep the UI debt from growing.
const sources = import.meta.glob(['../**/*.js', '../**/*.jsx', '!../__tests__/**'], {
  query: '?raw',
  import: 'default',
  eager: true
});

// Returns every <button ...> opening tag, reading past "=>" and braces inside attributes.
function buttonTags(src) {
  const tags = [];
  for (const m of src.matchAll(/<button(?=[\s>])/g)) {
    let depth = 0;
    let i = m.index + 7;
    for (; i < src.length; i++) {
      const c = src[i];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0 && src[i - 1] !== '=') break;
    }
    tags.push({ tag: src.slice(m.index, i + 1), line: src.slice(0, m.index).split('\n').length });
  }
  return tags;
}

describe('native dialogs (F-010)', () => {
  it('no confirm() or alert() calls in the app', () => {
    const found = [];
    for (const [file, src] of Object.entries(sources)) {
      src.split('\n').forEach((line, i) => {
        if (/(?<![\w$.])(?:window\.)?(?:confirm|alert)\(/.test(line)) found.push(`${file.replace('../', '')}:${i + 1}`);
      });
    }
    expect(found).toEqual([]);
  });
});

describe('button type (F-024)', () => {
  it('every <button> sets its type', () => {
    const missing = [];
    for (const [file, src] of Object.entries(sources)) {
      for (const { tag, line } of buttonTags(src)) {
        if (!/\stype\s*=/.test(tag) && !/\{\.\.\./.test(tag)) missing.push(`${file.replace('../', '')}:${line}`);
      }
    }
    expect(missing).toEqual([]);
  });
});

describe('accessible names (F-013)', () => {
  it('every navbar button has text or an aria-label', () => {
    render(
      <LanguageProvider>
        <StoreConfigProvider>
          <Navbar activeTab="register" setActiveTab={vi.fn()} storeConfig={{}} />
        </StoreConfigProvider>
      </LanguageProvider>
    );
    const unnamed = screen
      .getAllByRole('button', { hidden: true })
      .filter((b) => !b.textContent.trim() && !b.getAttribute('aria-label'))
      .map((b) => b.className || b.outerHTML.slice(0, 80));
    expect(unnamed).toEqual([]);
  });
});

describe('B2B fields (F-025)', () => {
  it('the IČO field asks for the numeric keyboard', () => {
    render(
      <LanguageProvider>
        <PaymentModal
          totalAmount={350}
          initialMethod="cash"
          storeConfig={{ ...DEFAULT_STORE_CONFIG, enableB2bInvoicing: true }}
          onClose={vi.fn()}
          onCompleteSale={vi.fn()}
        />
      </LanguageProvider>
    );
    fireEvent.click(screen.getByText(/\+ Firemní faktura \(B2B\)/));
    const input = screen.getByText('IČO Odběratele').parentElement.querySelector('input');
    expect(input).toHaveAttribute('inputmode', 'numeric');
  });
});
