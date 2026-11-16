import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CheckoutFlashBanner from '../components/CheckoutFlashBanner';
import { LanguageProvider } from '../i18n/LanguageContext';

const show = (banner, onDismiss = vi.fn()) => {
  const utils = render(
    <LanguageProvider>
      <CheckoutFlashBanner flashBanner={banner} onDismiss={onDismiss} />
    </LanguageProvider>
  );
  return { ...utils, card: utils.container.querySelector('.flash-banner-card'), onDismiss };
};

describe('CheckoutFlashBanner (F-011)', () => {
  it.each([
    ['SUCCESS', 'flash-success'],
    ['success', 'flash-success'],
    ['WARNING', 'flash-warning'],
    ['warning', 'flash-warning'],
    ['ERROR', 'flash-error'],
    ['error', 'flash-error'],
    ['info', 'flash-info'],
    ['default', 'flash-info']
  ])('type %s looks like %s', (type, cls) => {
    const { card } = show({ type, message: 'x' });
    expect(card).toHaveClass(cls);
  });

  it('a lowercase success banner is not shown as an error', () => {
    const { card } = show({ type: 'success', message: '✓ Rohlík (3.5 Kč)' });
    expect(card).not.toHaveClass('flash-error');
  });

  it('falls back to translated default texts', () => {
    show({ type: 'SUCCESS' });
    expect(screen.getByText('Zaplaceno!')).toBeInTheDocument();
  });

  it('has a translated close button', () => {
    const { onDismiss } = show({ type: 'ERROR', message: 'x' });
    fireEvent.click(screen.getByRole('button', { name: 'Zavřít' }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it('shows the amount with two decimals', () => {
    show({ type: 'SUCCESS', message: 'x', amount: 3.5 });
    expect(screen.getByText('3.50 Kč')).toBeInTheDocument();
  });
});
