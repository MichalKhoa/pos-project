import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StoreConfigProvider } from '../context/StoreConfigContext';
import { LanguageProvider } from '../i18n/LanguageContext';
import { ConfirmProvider } from '../context/ConfirmContext';
import Navbar from '../components/Navbar';
import SettingsView from '../components/SettingsView';
import AdminPinModal from '../components/AdminPinModal';
import * as posApi from '../api/posApi';

vi.mock('../api/posApi', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchBackendRoot: vi.fn().mockResolvedValue({ online: true }),
    fetchEetStatus: vi.fn().mockResolvedValue(null),
    fetchStoreConfigBackend: vi.fn().mockResolvedValue({}),
    saveStoreConfigBackend: vi.fn().mockResolvedValue({ status: 'SUCCESS' }),
    saveSecuritySettingsBackend: vi.fn().mockResolvedValue({ status: 'SUCCESS' }),
    createRecoveryCodeBackend: vi.fn(),
    fetchPrinterDevices: vi.fn().mockResolvedValue([]),
    fetchTerminalConfig: vi.fn().mockResolvedValue({ enabled: false }),
    fetchLitestreamStatus: vi.fn().mockResolvedValue(null),
    verifyAdminPinBackend: vi.fn().mockResolvedValue({ valid: false }),
    verifyPinBackend: vi.fn().mockResolvedValue({ valid: true })
  };
});

const renderSettings = (storeConfig, isAdminMode = false) =>
  render(
    <LanguageProvider>
      <ConfirmProvider>
        <StoreConfigProvider>
          <SettingsView
            storeConfig={storeConfig}
            onSaveStoreConfig={() => {}}
            presets={[]}
            onResetData={() => {}}
            onNavigateToPresets={() => {}}
            isAdminMode={isAdminMode}
          />
        </StoreConfigProvider>
      </ConfirmProvider>
    </LanguageProvider>
  );

const typePin = (digits) => digits.split('').forEach((d) => fireEvent.click(screen.getByRole('button', { name: d })));

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Navbar lock button follows the lock screen switch', () => {
  const renderNavbar = (storeConfig) =>
    render(
      <LanguageProvider>
        <StoreConfigProvider>
          <Navbar activeTab="register" setActiveTab={() => {}} storeConfig={storeConfig} onLockApp={() => {}} />
        </StoreConfigProvider>
      </LanguageProvider>
    );

  it('hides the quick lock button when the lock screen is off', () => {
    renderNavbar({ lockScreenEnabled: false });
    expect(screen.queryByLabelText(/Quick Lock/i)).not.toBeInTheDocument();
  });

  it('shows the quick lock button when the lock screen is on', () => {
    renderNavbar({ lockScreenEnabled: true });
    expect(screen.getByLabelText(/Quick Lock/i)).toBeInTheDocument();
  });
});

describe('Admin mode gate follows the Admin PIN switch', () => {
  it('opens a locked tab without asking for a PIN when the switch is off', () => {
    renderSettings({ adminPinEnabled: false });
    fireEvent.click(screen.getByText('Platební Terminál'));
    expect(screen.queryByText(/Ověření Admin PIN/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/ČSOB/i).length).toBeGreaterThanOrEqual(1);
  });

  it('asks for the Admin PIN when the switch is on', () => {
    renderSettings({ adminPinEnabled: true });
    fireEvent.click(screen.getByText('Platební Terminál'));
    expect(screen.getByText(/Ověření Admin PIN/i)).toBeInTheDocument();
  });
});

describe('AdminPinModal', () => {
  it('does not accept the cashier PIN: only the Admin PIN endpoint is asked', async () => {
    posApi.verifyAdminPinBackend.mockResolvedValue({ valid: false });
    posApi.verifyPinBackend.mockResolvedValue({ valid: true });
    const onSuccess = vi.fn();
    render(
      <LanguageProvider>
        <AdminPinModal mode="VERIFY" onClose={() => {}} onSuccess={onSuccess} />
      </LanguageProvider>
    );
    typePin('2468');
    await waitFor(() => expect(posApi.verifyAdminPinBackend).toHaveBeenCalledWith('2468'));
    expect(posApi.verifyPinBackend).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(await screen.findByText(/Nesprávný Admin PIN/i)).toBeInTheDocument();
  });

  it('wants exactly 4 digits for a new PIN', () => {
    render(
      <LanguageProvider>
        <AdminPinModal mode="SET_PIN" onClose={() => {}} onSuccess={() => {}} />
      </LanguageProvider>
    );
    typePin('2468');
    expect(screen.getByRole('button', { name: /Pokračovat/i })).toBeEnabled();
    typePin('1');
    expect(screen.getByRole('button', { name: /Pokračovat/i })).toBeDisabled();
  });

  it('refuses 1234 as a new PIN', () => {
    render(
      <LanguageProvider>
        <AdminPinModal mode="SET_PIN" kind="cashier" onClose={() => {}} onSuccess={() => {}} />
      </LanguageProvider>
    );
    expect(screen.getByText(/nový PIN obsluhy/i)).toBeInTheDocument();
    typePin('1234');
    fireEvent.click(screen.getByRole('button', { name: /Pokračovat/i }));
    expect(screen.getByText(/nesmí být 1234/i)).toBeInTheDocument();
  });
});

describe('Security tab switches', () => {
  const openSecurityTab = () => fireEvent.click(screen.getByText('Bezpečnost & PIN'));
  const lockSwitch = () => screen.getByLabelText(/Zamykání obrazovky/i, { selector: 'input' });

  it('lock switch on without a PIN opens the set-PIN flow and saves PIN and switch together', async () => {
    renderSettings({ adminPinEnabled: false, hasPin: false, lockScreenEnabled: false }, true);
    openSecurityTab();
    fireEvent.click(lockSwitch());
    expect(screen.getByText(/nový PIN obsluhy/i)).toBeInTheDocument();
    expect(posApi.saveSecuritySettingsBackend).not.toHaveBeenCalled();

    typePin('2468');
    fireEvent.click(screen.getByRole('button', { name: /Pokračovat/i }));
    typePin('2468');
    await waitFor(() =>
      expect(posApi.saveSecuritySettingsBackend).toHaveBeenCalledWith({ cashierPin: '2468', lockScreenEnabled: true }),
      { timeout: 3000 } // the modal shows its success message for 1.2 s first
    );
  });

  it('lock switch on with a PIN already set only flips the switch', async () => {
    renderSettings({ adminPinEnabled: false, hasPin: true, lockScreenEnabled: false }, true);
    openSecurityTab();
    fireEvent.click(lockSwitch());
    await waitFor(() => expect(posApi.saveSecuritySettingsBackend).toHaveBeenCalledWith({ lockScreenEnabled: true }));
    expect(screen.queryByText(/nový PIN obsluhy/i)).not.toBeInTheDocument();
  });

  it('closes the PIN dialog and reports the error when the server refuses the save', async () => {
    posApi.saveSecuritySettingsBackend.mockResolvedValue({ status: 'ERROR', message: 'PIN nesmí být 1234' });
    renderSettings({ adminPinEnabled: false, hasPin: false, lockScreenEnabled: false }, true);
    openSecurityTab();
    fireEvent.click(lockSwitch());
    typePin('2468');
    fireEvent.click(screen.getByRole('button', { name: /Pokračovat/i }));
    typePin('2468');
    await waitFor(() => expect(screen.queryByText(/Potvrďte nový PIN obsluhy/i)).not.toBeInTheDocument(), { timeout: 3000 });
    expect(await screen.findByText(/PIN nesmí být 1234/i)).toBeInTheDocument();
  });

  it('shows no cashier PIN input any more', () => {
    renderSettings({ adminPinEnabled: false, hasPin: true, lockScreenEnabled: true }, true);
    openSecurityTab();
    expect(document.querySelector('input[type="password"]')).toBeNull();
  });
});

describe('Recovery code', () => {
  const openSecurityTab = () => fireEvent.click(screen.getByText('Bezpečnost & PIN'));

  it('shows the code returned with the first PIN, once, and drops it on close', async () => {
    posApi.saveSecuritySettingsBackend.mockResolvedValue({ status: 'SUCCESS', recoveryCode: 'ABCD-EFGH-JKLM-NPQR' });
    renderSettings({ adminPinEnabled: false, hasPin: false, lockScreenEnabled: false }, true);
    openSecurityTab();
    fireEvent.click(screen.getByLabelText(/Zamykání obrazovky/i, { selector: 'input' }));
    typePin('2468');
    fireEvent.click(screen.getByRole('button', { name: /Pokračovat/i }));
    typePin('2468');
    expect(await screen.findByTestId('recovery-code', {}, { timeout: 3000 })).toHaveTextContent('ABCD-EFGH-JKLM-NPQR');
    fireEvent.click(screen.getByRole('button', { name: /Zapsal/i }));
    expect(screen.queryByTestId('recovery-code')).not.toBeInTheDocument();
  });

  it('issues a new code only after the Admin PIN is checked', async () => {
    posApi.verifyAdminPinBackend.mockResolvedValue({ valid: true });
    posApi.createRecoveryCodeBackend.mockResolvedValue({ status: 'SUCCESS', recoveryCode: 'WXYZ-2345-6789-ABCD' });
    renderSettings({ adminPinEnabled: true, hasAdminPin: true, hasPin: true }, true);
    openSecurityTab();
    fireEvent.click(screen.getByRole('button', { name: /Vydat nový záchranný kód/i }));
    expect(posApi.createRecoveryCodeBackend).not.toHaveBeenCalled();
    typePin('2580');
    await waitFor(() => expect(posApi.createRecoveryCodeBackend).toHaveBeenCalledWith('2580'));
    expect(await screen.findByTestId('recovery-code')).toHaveTextContent('WXYZ-2345-6789-ABCD');
  });
});

describe('Recovery drops the cached config read', () => {
  it('reads /config again after a successful recovery code', async () => {
    const real = await vi.importActual('../api/posApi');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => ({
      ok: true,
      status: 200,
      json: async () => (String(url).endsWith('/config') ? { lockScreenEnabled: true } : { valid: true })
    }));
    await real.fetchStoreConfigBackend();
    await real.fetchStoreConfigBackend();
    const configReads = () => fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/config')).length;
    expect(configReads()).toBe(1); // second read came from the cache
    await real.verifyRecoveryCodeBackend('ABCD-EFGH-JKLM-NPQR');
    await real.fetchStoreConfigBackend();
    expect(configReads()).toBe(2);
  });
});

describe('Whole-config save never carries PINs or switches', () => {
  it('strips the security keys before posting /config', async () => {
    const real = await vi.importActual('../api/posApi');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => ({}) });
    await real.saveStoreConfigBackend({
      storeName: 'Shop',
      cashierPin: '2468',
      adminPin: '1357',
      lockScreenEnabled: true,
      adminPinEnabled: true,
      hasPin: true,
      hasAdminPin: true,
      hasRecoveryCode: true
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({ storeName: 'Shop' });
  });
});
