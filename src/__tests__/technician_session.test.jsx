import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { StoreConfigProvider, useStoreConfig } from '../context/StoreConfigContext';
import { LanguageProvider } from '../i18n/LanguageContext';
import Navbar from '../components/Navbar';
import SettingsView from '../components/SettingsView';

// Partial mock preserving all exports
vi.mock('../api/posApi', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchBackendRoot: vi.fn().mockResolvedValue({ online: true }),
    fetchEetStatus: vi.fn().mockResolvedValue(null),
    fetchStoreConfigBackend: vi.fn().mockResolvedValue({}),
    saveStoreConfigBackend: vi.fn().mockResolvedValue({ status: 'SUCCESS' }),
    fetchPrinterDevices: vi.fn().mockResolvedValue([]),
    fetchTerminalConfig: vi.fn().mockResolvedValue({ enabled: false }),
    fetchLitestreamStatus: vi.fn().mockResolvedValue(null),
    verifyAdminPinBackend: vi.fn().mockResolvedValue({ valid: true }),
    verifyPinBackend: vi.fn().mockResolvedValue({ valid: true })
  };
});

function TestConsumer() {
  const {
    isAdminMode,
    adminSessionRemainingSeconds,
    enterAdminMode,
    exitAdminMode,
    resetAdminInactivity
  } = useStoreConfig();

  return (
    <div>
      <div data-testid="is-admin">{isAdminMode ? 'true' : 'false'}</div>
      <div data-testid="remaining">{adminSessionRemainingSeconds}</div>
      <button onClick={() => enterAdminMode('1234')} data-testid="enter-btn">
        Enter
      </button>
      <button onClick={exitAdminMode} data-testid="exit-btn">
        Exit
      </button>
      <button onClick={resetAdminInactivity} data-testid="reset-btn">
        Reset
      </button>
    </div>
  );
}

describe('Technician Admin Session & Inactivity Auto-Lock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes in cashier mode with 0 remaining seconds', () => {
    render(
      <StoreConfigProvider>
        <TestConsumer />
      </StoreConfigProvider>
    );

    expect(screen.getByTestId('is-admin').textContent).toBe('false');
    expect(screen.getByTestId('remaining').textContent).toBe('0');
  });

  it('enters admin mode and counts down from 600 seconds', () => {
    render(
      <StoreConfigProvider>
        <TestConsumer />
      </StoreConfigProvider>
    );

    act(() => {
      screen.getByTestId('enter-btn').click();
    });

    expect(screen.getByTestId('is-admin').textContent).toBe('true');
    expect(screen.getByTestId('remaining').textContent).toBe('600');

    // Advance by 15 seconds
    act(() => {
      vi.advanceTimersByTime(15000);
    });

    expect(screen.getByTestId('is-admin').textContent).toBe('true');
    expect(screen.getByTestId('remaining').textContent).toBe('585');
  });

  it('resets inactivity countdown on user interaction', () => {
    render(
      <StoreConfigProvider>
        <TestConsumer />
      </StoreConfigProvider>
    );

    act(() => {
      screen.getByTestId('enter-btn').click();
    });

    // Advance 100 seconds
    act(() => {
      vi.advanceTimersByTime(100000);
    });
    expect(Number(screen.getByTestId('remaining').textContent)).toBeLessThanOrEqual(500);

    // Simulate user interaction
    act(() => {
      fireEvent.click(window);
      vi.advanceTimersByTime(1000);
    });

    // Should be reset back to ~599-600
    expect(Number(screen.getByTestId('remaining').textContent)).toBeGreaterThanOrEqual(598);
  });

  it('auto-locks session when 10 minutes (600s) of inactivity elapse', () => {
    render(
      <StoreConfigProvider>
        <TestConsumer />
      </StoreConfigProvider>
    );

    act(() => {
      screen.getByTestId('enter-btn').click();
    });

    expect(screen.getByTestId('is-admin').textContent).toBe('true');

    // Advance 601 seconds
    act(() => {
      vi.advanceTimersByTime(601000);
    });

    expect(screen.getByTestId('is-admin').textContent).toBe('false');
    expect(screen.getByTestId('remaining').textContent).toBe('0');
  });

  it('exits immediately on exitAdminMode()', () => {
    render(
      <StoreConfigProvider>
        <TestConsumer />
      </StoreConfigProvider>
    );

    act(() => {
      screen.getByTestId('enter-btn').click();
    });
    expect(screen.getByTestId('is-admin').textContent).toBe('true');

    act(() => {
      screen.getByTestId('exit-btn').click();
    });
    expect(screen.getByTestId('is-admin').textContent).toBe('false');
    expect(screen.getByTestId('remaining').textContent).toBe('0');
  });
});

describe('Navbar Technician Status Badge', () => {
  it('does not display technician badge when in cashier mode', () => {
    render(
      <LanguageProvider>
        <StoreConfigProvider>
          <Navbar activeTab="register" setActiveTab={() => {}} />
        </StoreConfigProvider>
      </LanguageProvider>
    );

    expect(screen.queryByText(/Technik/i)).not.toBeInTheDocument();
  });

  it('displays technician badge with countdown and lock button when admin mode is active', () => {
    render(
      <LanguageProvider>
        <StoreConfigProvider>
          <Navbar activeTab="register" setActiveTab={() => {}} isAdminMode={true} />
        </StoreConfigProvider>
      </LanguageProvider>
    );

    const badges = screen.getAllByText(/Technik/i);
    expect(badges.length).toBeGreaterThanOrEqual(1);

    // Quick exit lock button exists
    const lockBtns = screen.getAllByTitle(/Uzamknout/i);
    expect(lockBtns.length).toBeGreaterThanOrEqual(1);
  });
});

describe('SettingsView Tab Gating', () => {
  it('renders public store tab freely without lock indicator', () => {
    render(
      <LanguageProvider>
        <StoreConfigProvider>
          <SettingsView
            storeConfig={{}}
            onSaveStoreConfig={() => {}}
            presets={[]}
            onResetData={() => {}}
            onNavigateToPresets={() => {}}
            isAdminMode={false}
          />
        </StoreConfigProvider>
      </LanguageProvider>
    );

    // Public tabs exist
    expect(screen.getByText('Údaje prodejny')).toBeInTheDocument();
    expect(screen.getByText('Rozvržení & Zobrazení')).toBeInTheDocument();

    // Gated tabs in sidebar
    expect(screen.getByText('Platební Terminál')).toBeInTheDocument();
    expect(screen.getByText('Bezpečnost & PIN')).toBeInTheDocument();
  });

  it('shows PIN modal when clicking a gated tab in cashier mode', () => {
    render(
      <LanguageProvider>
        <StoreConfigProvider>
          <SettingsView
            storeConfig={{}}
            onSaveStoreConfig={() => {}}
            presets={[]}
            onResetData={() => {}}
            onNavigateToPresets={() => {}}
            isAdminMode={false}
          />
        </StoreConfigProvider>
      </LanguageProvider>
    );

    // Click tab 'Platební Terminál' which is locked
    fireEvent.click(screen.getByText('Platební Terminál'));

    // Should open PIN modal to unlock
    expect(screen.getByText(/Ověření Admin PIN/i)).toBeInTheDocument();
  });

  it('renders sensitive configuration directly when admin mode is active', () => {
    render(
      <LanguageProvider>
        <StoreConfigProvider>
          <SettingsView
            storeConfig={{}}
            onSaveStoreConfig={() => {}}
            presets={[]}
            onResetData={() => {}}
            onNavigateToPresets={() => {}}
            isAdminMode={true}
          />
        </StoreConfigProvider>
      </LanguageProvider>
    );

    // Click tab 'Platební Terminál'
    fireEvent.click(screen.getByText('Platební Terminál'));

    // No PIN modal appears, terminal section is rendered
    expect(screen.queryByText(/Ověření Admin PIN/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/ČSOB/i).length).toBeGreaterThanOrEqual(1);
  });

  it('unlocks gated tab and activates admin mode after entering correct PIN', async () => {
    function TestApp() {
      const { isAdminMode, toggleAdminMode } = useStoreConfig();
      return (
        <SettingsView
          storeConfig={{ cashierPin: '1234' }}
          onSaveStoreConfig={() => {}}
          presets={[]}
          onResetData={() => {}}
          onNavigateToPresets={() => {}}
          isAdminMode={isAdminMode}
          onToggleAdminMode={toggleAdminMode}
        />
      );
    }

    render(
      <LanguageProvider>
        <StoreConfigProvider>
          <TestApp />
        </StoreConfigProvider>
      </LanguageProvider>
    );

    // Click tab 'Platební Terminál' which is locked
    fireEvent.click(screen.getByText('Platební Terminál'));

    // Admin PIN modal appears
    expect(screen.getByText(/Ověření Admin PIN/i)).toBeInTheDocument();

    // Enter digits 1, 2, 3, 4
    fireEvent.click(screen.getByRole('button', { name: '1' }));
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    fireEvent.click(screen.getByRole('button', { name: '3' }));
    fireEvent.click(screen.getByRole('button', { name: '4' }));

    // Wait for authentication and verify tab unlocks
    await waitFor(() => {
      expect(screen.queryByText(/Ověření Admin PIN/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Sekce vyžaduje oprávnění technika/i)).not.toBeInTheDocument();
      expect(screen.getAllByText(/ČSOB/i).length).toBeGreaterThanOrEqual(1);
    });
  });
});