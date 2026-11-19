import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StoreConfigProvider, useStoreConfig } from '../context/StoreConfigContext.jsx';

function Probe() {
  const { fontSize, setFontSize } = useStoreConfig();
  return <button onClick={() => setFontSize('xl')}>size:{fontSize}</button>;
}

describe('font size persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-font-size');
  });

  it('restores the saved size on mount', () => {
    localStorage.setItem('voltflow_font_size', 'sm');
    render(<StoreConfigProvider><Probe /></StoreConfigProvider>);
    expect(screen.getByRole('button').textContent).toBe('size:sm');
    expect(document.documentElement.getAttribute('data-font-size')).toBe('sm');
  });

  it('falls back to lg and ignores an invalid saved value', () => {
    localStorage.setItem('voltflow_font_size', 'huge');
    render(<StoreConfigProvider><Probe /></StoreConfigProvider>);
    expect(screen.getByRole('button').textContent).toBe('size:lg');
  });

  it('saves a new size so a remount keeps it', () => {
    const { unmount } = render(<StoreConfigProvider><Probe /></StoreConfigProvider>);
    fireEvent.click(screen.getByRole('button'));
    unmount();
    render(<StoreConfigProvider><Probe /></StoreConfigProvider>);
    expect(screen.getByRole('button').textContent).toBe('size:xl');
  });
});
