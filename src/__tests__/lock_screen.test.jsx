import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import LockScreenModal from '../components/LockScreenModal';
import AdminPinModal from '../components/AdminPinModal';
import { LanguageProvider } from '../i18n/LanguageContext';
import * as posApi from '../api/posApi';

vi.mock('../api/posApi', () => ({
  verifyPinBackend: vi.fn(),
  verifyAdminPinBackend: vi.fn(),
  verifyPukBackend: vi.fn()
}));

const renderLock = onUnlock =>
  render(<LanguageProvider><LockScreenModal storeConfig={{ cashierPin: '9999' }} onUnlock={onUnlock} /></LanguageProvider>);

const typePin = pin => pin.split('').forEach(d => fireEvent.click(screen.getByRole('button', { name: d })));
const flush = async (ms = 0) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

describe('lock screen never falls back to a default PIN (audit F-012)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });
  afterEach(() => vi.useRealTimers());

  it('unlocks when the server accepts the PIN', async () => {
    posApi.verifyPinBackend.mockResolvedValue({ valid: true });
    const onUnlock = vi.fn();
    renderLock(onUnlock);
    typePin('4321');
    await flush();
    expect(onUnlock).toHaveBeenCalledTimes(1);
  });

  it('a wrong PIN shows the attempt counter and does not unlock', async () => {
    posApi.verifyPinBackend.mockResolvedValue({ valid: false });
    const onUnlock = vi.fn();
    renderLock(onUnlock);
    typePin('1111');
    await flush();
    expect(onUnlock).not.toHaveBeenCalled();
    expect(screen.getByText(/Nesprávný PIN kód! \(1\/5 pokusů\)/)).toBeInTheDocument();
  });

  it('server unreachable: 1234 does not unlock, a waiting message shows, and it does not count as a wrong PIN', async () => {
    posApi.verifyPinBackend.mockResolvedValue({ valid: null });
    const onUnlock = vi.fn();
    renderLock(onUnlock);
    typePin('1234');
    await flush();
    expect(onUnlock).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent(/Server se spouští/i);
    expect(screen.queryByText(/pokusů/)).not.toBeInTheDocument();
  });

  it('the configured PIN does not unlock offline either', async () => {
    posApi.verifyPinBackend.mockResolvedValue({ valid: null });
    const onUnlock = vi.fn();
    renderLock(onUnlock);
    typePin('9999');
    await flush();
    expect(onUnlock).not.toHaveBeenCalled();
  });

  it('retries with backoff and unlocks once the server is back and accepts the PIN', async () => {
    posApi.verifyPinBackend.mockResolvedValue({ valid: null });
    const onUnlock = vi.fn();
    renderLock(onUnlock);
    typePin('4321');
    await flush();
    await flush(1000);
    await flush(2000);
    expect(posApi.verifyPinBackend.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(onUnlock).not.toHaveBeenCalled();

    posApi.verifyPinBackend.mockResolvedValue({ valid: true });
    await flush(5000);
    expect(onUnlock).toHaveBeenCalledTimes(1);
    expect(posApi.verifyPinBackend).toHaveBeenLastCalledWith('4321');
  });

  it('after the server is back a wrong PIN is rejected normally', async () => {
    posApi.verifyPinBackend.mockResolvedValue({ valid: null });
    const onUnlock = vi.fn();
    renderLock(onUnlock);
    typePin('1234');
    await flush();
    posApi.verifyPinBackend.mockResolvedValue({ valid: false });
    await flush(5000);
    expect(onUnlock).not.toHaveBeenCalled();
    expect(screen.getByText(/Nesprávný PIN kód!/)).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('Clear cancels the waiting and allows a fresh PIN', async () => {
    posApi.verifyPinBackend.mockResolvedValue({ valid: null });
    renderLock(vi.fn());
    typePin('1234');
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'C' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    const calls = posApi.verifyPinBackend.mock.calls.length;
    await flush(10000);
    expect(posApi.verifyPinBackend.mock.calls.length).toBe(calls);
  });

  it('opens the PUK recovery form without crashing', async () => {
    renderLock(vi.fn());
    fireEvent.click(screen.getByText(/Zapomněli jste PIN/i));
    expect(screen.getByPlaceholderText('VOLTFLOW-12345678-MASTER')).toBeInTheDocument();
  });
});

describe('admin PIN dialog has no default PIN either', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });
  afterEach(() => vi.useRealTimers());

  it('server unreachable: 1234 is not accepted and a message explains why', async () => {
    posApi.verifyAdminPinBackend.mockResolvedValue({ valid: null });
    posApi.verifyPinBackend.mockResolvedValue({ valid: null });
    const onSuccess = vi.fn();
    render(
      <LanguageProvider>
        <AdminPinModal mode="VERIFY" storeConfig={{}} onClose={() => {}} onSuccess={onSuccess} />
      </LanguageProvider>
    );
    typePin('1234');
    await flush();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(screen.getByText(/Server není dostupný/i)).toBeInTheDocument();
  });
});
