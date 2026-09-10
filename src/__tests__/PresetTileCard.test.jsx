import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PresetTileCard, { arePresetCardPropsEqual } from '../components/presets/PresetTileCard';
import { LanguageProvider } from '../i18n/LanguageContext';

function renderWithLang(ui, lang = 'cs') {
  localStorage.setItem('lang', lang);
  return render(
    <LanguageProvider>
      {ui}
    </LanguageProvider>
  );
}

const defaultPreset = {
  id: 'preset-1',
  name: 'Rohl\u00edk standard',
  price: 3.5,
  vat: 12,
  color: '#10b981',
  icon: 'package'
};

const noop = () => {};

describe('PresetTileCard Component', () => {
  it('renders untracked preset without any stock badge', () => {
    const preset = { ...defaultPreset, trackStock: false, stockQuantity: 0 };
    const { container } = renderWithLang(
      <PresetTileCard
        preset={preset}
        index={0}
        onClick={noop}
        onDragStart={noop}
        onDragOver={noop}
        onDragLeave={noop}
        onDrop={noop}
        onDragEnd={noop}
      />
    );

    expect(container.querySelector('.preset-stock-badge')).toBeNull();
    expect(screen.getByText('Rohl\u00edk standard')).toBeInTheDocument();
  });

  it('renders tracked preset with ample stock without any stock badge', () => {
    const preset = {
      ...defaultPreset,
      trackStock: true,
      stockQuantity: 25,
      minStockAlert: 5
    };
    const { container } = renderWithLang(
      <PresetTileCard
        preset={preset}
        index={0}
        onClick={noop}
        onDragStart={noop}
        onDragOver={noop}
        onDragLeave={noop}
        onDrop={noop}
        onDragEnd={noop}
      />
    );

    expect(container.querySelector('.preset-stock-badge')).toBeNull();
  });

  it('renders out-of-stock badge when tracked and stockQuantity <= 0', () => {
    const presetZero = {
      ...defaultPreset,
      trackStock: true,
      stockQuantity: 0,
      minStockAlert: 5
    };
    const { container: c1 } = renderWithLang(
      <PresetTileCard
        preset={presetZero}
        index={0}
        onClick={noop}
        onDragStart={noop}
        onDragOver={noop}
        onDragLeave={noop}
        onDrop={noop}
        onDragEnd={noop}
      />
    );

    const badgeZero = c1.querySelector('.preset-stock-badge.out-of-stock');
    expect(badgeZero).not.toBeNull();
    expect(badgeZero.textContent).toBe('Vyprod\u00e1no');

    // Negative stock (oversold) should also show out-of-stock badge
    const presetNegative = {
      ...defaultPreset,
      trackStock: true,
      stockQuantity: -2,
      minStockAlert: 5
    };
    const { container: c2 } = renderWithLang(
      <PresetTileCard
        preset={presetNegative}
        index={0}
        onClick={noop}
        onDragStart={noop}
        onDragOver={noop}
        onDragLeave={noop}
        onDrop={noop}
        onDragEnd={noop}
      />
    );

    const badgeNeg = c2.querySelector('.preset-stock-badge.out-of-stock');
    expect(badgeNeg).not.toBeNull();
    expect(badgeNeg.textContent).toBe('Vyprod\u00e1no');
  });

  it('renders low-stock badge with count when tracked and 0 < stockQuantity <= minStockAlert', () => {
    const preset = {
      ...defaultPreset,
      trackStock: true,
      stockQuantity: 3,
      minStockAlert: 5
    };
    const { container } = renderWithLang(
      <PresetTileCard
        preset={preset}
        index={0}
        onClick={noop}
        onDragStart={noop}
        onDragOver={noop}
        onDragLeave={noop}
        onDrop={noop}
        onDragEnd={noop}
      />
    );

    const badge = container.querySelector('.preset-stock-badge.low-stock');
    expect(badge).not.toBeNull();
    expect(badge.textContent).toBe('Zb\u00fdv\u00e1 3 ks');
  });

  it('supports snake_case inventory attributes (track_stock, stock_quantity, min_stock_alert)', () => {
    const presetSnake = {
      ...defaultPreset,
      track_stock: true,
      stock_quantity: 2,
      min_stock_alert: 5
    };
    const { container } = renderWithLang(
      <PresetTileCard
        preset={presetSnake}
        index={0}
        onClick={noop}
        onDragStart={noop}
        onDragOver={noop}
        onDragLeave={noop}
        onDrop={noop}
        onDragEnd={noop}
      />
    );

    const badge = container.querySelector('.preset-stock-badge.low-stock');
    expect(badge).not.toBeNull();
    expect(badge.textContent).toBe('Zb\u00fdv\u00e1 2 ks');
  });

  it('invokes onClick handler when preset card is tapped', () => {
    const handleClick = vi.fn();
    const preset = { ...defaultPreset, trackStock: true, stockQuantity: 0 };
    renderWithLang(
      <PresetTileCard
        preset={preset}
        index={0}
        onClick={handleClick}
        onDragStart={noop}
        onDragOver={noop}
        onDragLeave={noop}
        onDrop={noop}
        onDragEnd={noop}
      />
    );

    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(handleClick).toHaveBeenCalledWith(preset);
  });
});

describe('arePresetCardPropsEqual memo comparator', () => {
  const baseProps = {
    preset: {
      id: 'p-1',
      name: 'Pivo Kozel',
      price: 25,
      isOpenPrice: false,
      vat: 21,
      color: '#3b82f6',
      icon: 'beer',
      imageUrl: null,
      trackStock: true,
      stockQuantity: 10,
      minStockAlert: 5
    },
    index: 0,
    isEditMode: false,
    itemMultiplier: 1,
    isDraggingThis: false,
    isDragOverThis: false,
    onClick: noop,
    buttonStyle: 'left-stripe',
    storeConfig: { presetButtonStyle: 'left-stripe', showPresetVat: true }
  };

  it('returns true when stock quantities and properties match', () => {
    const nextProps = {
      ...baseProps,
      preset: { ...baseProps.preset }
    };
    expect(arePresetCardPropsEqual(baseProps, nextProps)).toBe(true);
  });

  it('returns false when stockQuantity updates', () => {
    const nextProps = {
      ...baseProps,
      preset: { ...baseProps.preset, stockQuantity: 2 }
    };
    expect(arePresetCardPropsEqual(baseProps, nextProps)).toBe(false);
  });

  it('returns false when trackStock flag toggles', () => {
    const nextProps = {
      ...baseProps,
      preset: { ...baseProps.preset, trackStock: false }
    };
    expect(arePresetCardPropsEqual(baseProps, nextProps)).toBe(false);
  });

  it('returns false when minStockAlert threshold updates', () => {
    const nextProps = {
      ...baseProps,
      preset: { ...baseProps.preset, minStockAlert: 8 }
    };
    expect(arePresetCardPropsEqual(baseProps, nextProps)).toBe(false);
  });

  it('returns false when snake_case stock_quantity updates', () => {
    const snakeBase = {
      ...baseProps,
      preset: { ...baseProps.preset, trackStock: undefined, stockQuantity: undefined, track_stock: true, stock_quantity: 10, min_stock_alert: 5 }
    };
    const snakeNext = {
      ...snakeBase,
      preset: { ...snakeBase.preset, stock_quantity: 0 }
    };
    expect(arePresetCardPropsEqual(snakeBase, snakeNext)).toBe(false);
  });
});
