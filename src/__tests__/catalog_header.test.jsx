import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import QuickPresetGrid from '../components/QuickPresetGrid';
import { LanguageProvider } from '../i18n/LanguageContext';

vi.mock('../api/posApi', () => ({ openSystemKeyboard: vi.fn().mockResolvedValue({ status: 'SUCCESS' }) }));

const presets = [{ id: 'p1', name: 'Kofola', price: 35, vat: 21, category: 'all' }];

const renderGrid = (props = {}) =>
  render(
    <LanguageProvider>
      <QuickPresetGrid
        presets={presets}
        onAddToCart={() => {}}
        onTogglePriceCheck={() => {}}
        onOpenCustomModal={() => {}}
        {...props}
      />
    </LanguageProvider>
  );

describe('catalogue header', () => {
  it('has search, custom item, price check and edit only; add and categories wait for edit mode', () => {
    renderGrid();
    const header = document.querySelector('.catalog-header');
    expect(header.querySelectorAll('button.catalog-action-btn')).toHaveLength(3);
    expect(screen.getByRole('button', { name: /Vlastní položka/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Kontrola ceny/i })).toBeInTheDocument();
    expect(document.querySelector('.preset-edit-mode-bar')).toBeNull();
  });

  it('edit mode shows each action once, with no duplicate done or category controls', () => {
    renderGrid();
    fireEvent.click(screen.getByRole('button', { name: 'Upravit' }));
    const bar = document.querySelector('.preset-edit-mode-bar');
    expect(bar.querySelectorAll('.preset-edit-cat-btn')).toHaveLength(2); // add item + manage categories
    expect(bar.querySelectorAll('.preset-edit-done-btn')).toHaveLength(1);
    expect(document.querySelector('.category-chip-manage')).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Hotovo' }).length).toBeGreaterThan(0);
    expect(document.querySelector('.catalog-action-btn.is-edit')).toHaveAttribute('aria-pressed', 'true');
  });

  it('edit bar add button opens the add-item modal', () => {
    renderGrid();
    fireEvent.click(screen.getByRole('button', { name: 'Upravit' }));
    fireEvent.click(document.querySelectorAll('.preset-edit-cat-btn')[0]);
    expect(document.querySelector('.modal-card')).not.toBeNull();
  });

  it('title has no item count', () => {
    renderGrid();
    expect(document.querySelector('.section-title').textContent).not.toMatch(/\(\d+\)/);
  });

  it('category bar is one scrolling row with no separator', () => {
    const categories = [{ id: 'all', name: 'Vše' }, { id: 'a', name: 'A' }, { id: 'b', name: 'B' }];
    renderGrid({ categories });
    expect(document.querySelector('.category-bar')).toHaveClass('is-scroll');
    expect(document.querySelector('.category-presets-separator')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'B' }));
    expect(screen.getByRole('button', { name: 'B' })).toHaveClass('active');
  });

  it('mouse wheel scrolls the category row sideways', () => {
    renderGrid({ categories: [{ id: 'all', name: 'Vše' }, { id: 'a', name: 'A' }] });
    const bar = document.querySelector('.category-bar');
    bar.scrollLeft = 0;
    fireEvent.wheel(bar, { deltaY: 40 });
    expect(bar.scrollLeft).toBe(40);
  });
});
