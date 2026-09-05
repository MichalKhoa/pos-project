import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StoreConfigProvider } from '../context/StoreConfigContext';
import { LanguageProvider } from '../i18n/LanguageContext';
import TechnicianTab from '../components/TechnicianTab';
import SettingsView from '../components/SettingsView';
import * as posApi from '../api/posApi';

// Mock API calls
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
    verifyPinBackend: vi.fn().mockResolvedValue({ valid: true }),
    fetchSystemDiagnostics: vi.fn().mockResolvedValue({
      status: 'SUCCESS',
      timestamp: '2026-09-05T02:00:00Z',
      database: {
        path: 'c:/pos/pos_store.db',
        exists: true,
        size_bytes: 5242880, // 5 MB
        wal_size_bytes: 1048576, // 1 MB
        integrity: 'ok',
        sqlite_version: '3.42.0'
      },
      system: {
        platform: 'win32',
        python_version: '3.11.5',
        is_frozen: true,
        pid: 1234,
        uptime_seconds: 7320, // 2h 2m 0s
        cpu_percent: 15.2,
        ram_used_mb: 4096,
        ram_total_mb: 16384,
        disk_free_gb: 120.5,
        disk_total_gb: 512.0
      },
      eet: {
        configured: true,
        path: 'c:/pos/cert.p12',
        exists: true,
        loaded: true,
        subject: 'CN=TEST POPLATNIK',
        issuer: 'CN=EET TEST CA',
        valid_to: '2028-12-31T23:59:59Z',
        days_remaining: 800,
        is_expired: false,
        error: null
      },
      litestream: {
        running: true,
        configured: true
      }
    }),
    triggerDbVacuum: vi.fn().mockResolvedValue({
      status: 'SUCCESS',
      message: 'Databáze byla úspěšně optimalizována (VACUUM dokončen).',
      db_size_bytes: 4194304,
      wal_size_bytes: 0
    }),
    fetchSystemLogs: vi.fn().mockResolvedValue({
      status: 'SUCCESS',
      log_path: 'c:/pos/logs/pos_backend.log',
      log_file_size_bytes: 10240,
      total_file_lines: 50,
      returned_lines: 3,
      lines: [
        '2026-09-05 02:00:00 [INFO] Server started on port 8000',
        '2026-09-05 02:01:00 [WARNING] High latency on external network',
        '2026-09-05 02:02:00 [ERROR] Test error caught cleanly'
      ]
    }),
    downloadDatabaseSnapshot: vi.fn().mockResolvedValue({
      success: true,
      filename: 'pos_store_snapshot_2026-09-05.zip'
    }),
    restoreDatabaseSnapshot: vi.fn().mockResolvedValue({
      status: 'SUCCESS',
      message: 'Databáze byla úspěšně obnovena.',
      backup_filename: 'pos_uploaded_2026-09-05.zip'
    }),
    downloadDiagnosticBundle: vi.fn().mockResolvedValue({
      success: true,
      filename: 'voltflow_diagnostic_bundle_2026-09-05.zip'
    })
  };
});

const mockRestartBackend = vi.fn().mockResolvedValue({ success: true, message: 'Backend restarted successfully' });
vi.mock('../hooks/useTauri', () => ({
  useTauri: () => ({
    isTauri: true,
    restartBackend: mockRestartBackend,
    openCustomerDisplay: vi.fn(),
    toggleFullscreen: vi.fn(),
    minimizeWindow: vi.fn()
  })
}));

function renderWithProviders(ui) {
  return render(
    <LanguageProvider>
      <StoreConfigProvider>
        {ui}
      </StoreConfigProvider>
    </LanguageProvider>
  );
}

describe('TechnicianTab Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders DB, System, and EET telemetry cards upon loading', async () => {
    renderWithProviders(<TechnicianTab />);

    // Check DB health info
    await waitFor(() => {
      expect(screen.getByTestId('db-integrity-badge')).toHaveTextContent(/ok/i);
    });
    expect(screen.getByTestId('db-size-val')).toHaveTextContent('5 MB');
    expect(screen.getByText('3.42.0')).toBeInTheDocument();

    // Check system uptime & CPU
    expect(screen.getByTestId('uptime-val')).toHaveTextContent('2h 2m 0s');
    expect(screen.getByText('15.2%')).toBeInTheDocument();
    expect(screen.getByText(/4096 MB \/ 16384 MB/i)).toBeInTheDocument();

    // Check EET and Litestream
    expect(screen.getByText('CN=TEST POPLATNIK')).toBeInTheDocument();
    expect(screen.getByText(/800 dní|800 days/i)).toBeInTheDocument();
    expect(screen.getByText(/🟢 AKTIVNÍ/i)).toBeInTheDocument();
  });

  it('triggers VACUUM optimization when button is clicked', async () => {
    renderWithProviders(<TechnicianTab />);

    await waitFor(() => {
      expect(screen.getByTestId('vacuum-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('vacuum-btn'));

    await waitFor(() => {
      expect(posApi.triggerDbVacuum).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('vacuum-result-banner')).toHaveTextContent(/VACUUM dokončen/i);
    });
  });

  it('renders log lines and filters by level and search', async () => {
    renderWithProviders(<TechnicianTab />);

    await waitFor(() => {
      expect(screen.getByTestId('log-terminal-output')).toHaveTextContent(/Server started on port 8000/i);
    });

    expect(screen.getByTestId('log-terminal-output')).toHaveTextContent(/High latency on external network/i);
    expect(screen.getByTestId('log-terminal-output')).toHaveTextContent(/Test error caught cleanly/i);

    // Filter level to ERROR
    fireEvent.click(screen.getByTestId('log-level-ERROR'));

    await waitFor(() => {
      expect(posApi.fetchSystemLogs).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'ERROR' })
      );
    });

    // Search filter
    const searchInput = screen.getByTestId('log-search-input');
    fireEvent.change(searchInput, { target: { value: 'latency' } });

    await waitFor(() => {
      expect(posApi.fetchSystemLogs).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'latency' })
      );
    });
  });

  it('triggers database snapshot download', async () => {
    renderWithProviders(<TechnicianTab />);

    await waitFor(() => {
      expect(screen.getByTestId('download-snapshot-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('download-snapshot-btn'));

    await waitFor(() => {
      expect(posApi.downloadDatabaseSnapshot).toHaveBeenCalledTimes(1);
    });
  });

  it('opens confirmation modal and restores database from uploaded file', async () => {
    renderWithProviders(<TechnicianTab />);

    await waitFor(() => {
      expect(screen.getByTestId('trigger-restore-btn')).toBeInTheDocument();
    });

    // Select file in hidden file input
    const fileInput = screen.getByTestId('restore-file-input');
    const dummyFile = new File(['fake db'], 'pos_test_backup.db', { type: 'application/octet-stream' });
    fireEvent.change(fileInput, { target: { files: [dummyFile] } });

    // Confirm modal should be visible
    expect(screen.getByTestId('restore-confirm-modal')).toBeInTheDocument();
    expect(screen.getByText('pos_test_backup.db')).toBeInTheDocument();

    // Click confirm restore
    fireEvent.click(screen.getByTestId('confirm-restore-action-btn'));

    await waitFor(() => {
      expect(posApi.restoreDatabaseSnapshot).toHaveBeenCalledWith(dummyFile, null);
      expect(screen.getByTestId('restore-result-banner')).toHaveTextContent(/obnovena/i);
    });
  });

  it('triggers diagnostic bundle export', async () => {
    renderWithProviders(<TechnicianTab />);

    await waitFor(() => {
      expect(screen.getByTestId('export-bundle-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('export-bundle-btn'));

    await waitFor(() => {
      expect(posApi.downloadDiagnosticBundle).toHaveBeenCalledTimes(1);
    });
  });

  it('integrates into SettingsView and switches between Technician and Overview sub-modes', async () => {
    renderWithProviders(
      <SettingsView
        storeConfig={{}}
        onSaveStoreConfig={() => {}}
        presets={[]}
        onResetData={() => {}}
        onNavigateToPresets={() => {}}
        isAdminMode={true}
      />
    );

    // Click diagnostics subtab in sidebar
    fireEvent.click(screen.getByText('Náhled & Diagnostika'));

    // Switcher should exist
    expect(screen.getByTestId('diag-subtab-switcher')).toBeInTheDocument();

    // Default is technician sub-mode
    await waitFor(() => {
      expect(screen.getByTestId('db-integrity-badge')).toBeInTheDocument();
    });

    // Switch to Overview sub-mode
    fireEvent.click(screen.getByTestId('diag-subtab-overview-btn'));

    // DiagnosticsSection receipt preview and test buttons should now be shown
    expect(screen.getByText('Živý náhled účtenky')).toBeInTheDocument();
    expect(screen.getByText('Vytisknout test')).toBeInTheDocument();

    // Switch back to technician
    fireEvent.click(screen.getByTestId('diag-subtab-tech-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('db-integrity-badge')).toBeInTheDocument();
    });
  });

  it('triggers Tauri backend restart and shows reconnect status', async () => {
    renderWithProviders(<TechnicianTab />);

    await waitFor(() => {
      expect(screen.getByTestId('restart-backend-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('restart-backend-btn'));

    expect(mockRestartBackend).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(screen.getByTestId('restart-backend-banner')).toBeInTheDocument();
    });
  });

  it('handles backend restart failure gracefully', async () => {
    mockRestartBackend.mockResolvedValueOnce({ success: false, error: 'IPC channel closed' });
    renderWithProviders(<TechnicianTab />);

    await waitFor(() => {
      expect(screen.getByTestId('restart-backend-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('restart-backend-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('restart-backend-banner')).toHaveTextContent(/IPC channel closed/i);
    });
  });
});
