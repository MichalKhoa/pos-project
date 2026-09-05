import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BackupSection from '../components/settings/BackupSection';
import { StoreConfigProvider } from '../context/StoreConfigContext';
import { LanguageProvider } from '../i18n/LanguageContext';
import * as posApi from '../api/posApi';

// Mock API functions
vi.mock('../api/posApi', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchDatabaseBackupStatus: vi.fn().mockResolvedValue({
      status: 'SUCCESS',
      last_backup_time: '2026-09-05T12:00:00',
      last_backup_file: 'pos_backup_2026-09-05_120000.zip'
    }),
    triggerDatabaseBackup: vi.fn().mockResolvedValue({
      status: 'SUCCESS',
      filename: 'pos_backup_manual.zip',
      size_bytes: 102400
    }),
    fetchCloudBackupStatus: vi.fn().mockResolvedValue({
      status: 'SUCCESS',
      enabled: false,
      endpoint: 'https://test-account.r2.cloudflarestorage.com',
      bucket: 'pos-test-backups',
      access_key: 'test_access_key',
      has_secret_key: true,
      prefix: 'store_01',
      retention_days: 30,
      last_sync: '2026-09-05T12:00:00',
      last_status: 'SUCCESS',
      last_error: ''
    }),
    testCloudBackupConnection: vi.fn().mockResolvedValue({
      status: 'SUCCESS',
      message: 'Spojení s cloudovým úložištěm bylo úspěšně ověřeno.'
    }),
    configureCloudBackup: vi.fn().mockResolvedValue({
      status: 'SUCCESS',
      message: 'Nastavení uloženo.',
      config: {
        enabled: true,
        endpoint: 'https://test-account.r2.cloudflarestorage.com',
        bucket: 'pos-test-backups',
        access_key: 'test_access_key',
        has_secret_key: true,
        prefix: 'store_01',
        retention_days: 30
      }
    }),
    triggerCloudBackupUpload: vi.fn().mockResolvedValue({
      status: 'SUCCESS',
      filename: 'pos_backup_2026-09-05_120000.zip',
      key: 'store_01/pos_backup_2026-09-05_120000.zip',
      size_bytes: 102400
    }),
    fetchRemoteCloudBackups: vi.fn().mockResolvedValue([
      {
        key: 'store_01/pos_backup_2026-09-05_120000.zip',
        filename: 'pos_backup_2026-09-05_120000.zip',
        size_bytes: 102400,
        last_modified: '2026-09-05T12:00:00+00:00'
      },
      {
        key: 'store_01/pos_backup_2026-09-04_120000.zip',
        filename: 'pos_backup_2026-09-04_120000.zip',
        size_bytes: 98000,
        last_modified: '2026-09-04T12:00:00+00:00'
      }
    ]),
    restoreRemoteCloudBackup: vi.fn().mockResolvedValue({
      status: 'SUCCESS',
      message: 'Databáze byla úspěšně obnovena z cloudu.'
    })
  };
});

// Mock Tauri hook
vi.mock('../hooks/useTauri', () => ({
  useTauri: () => ({
    isTauri: false,
    checkTauriUpdate: vi.fn(),
    installTauriUpdate: vi.fn()
  })
}));

describe('BackupSection Component (Native Python Cloud Sync)', () => {
  const mockConfig = {
    eetEnabled: false
  };

  const renderComponent = () => {
    return render(
      <LanguageProvider>
        <StoreConfigProvider>
          <BackupSection
            config={mockConfig}
            setConfig={vi.fn()}
            saveConfigBatch={vi.fn()}
            onSaveStoreConfig={vi.fn()}
            onExportJSON={vi.fn()}
            onImportJSON={vi.fn()}
            onResetData={vi.fn()}
            litestreamData={null}
            updateData={null}
            updateLoading={false}
            onCheckUpdate={vi.fn()}
          />
        </StoreConfigProvider>
      </LanguageProvider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Cloud Backup card and loads stored cloud configuration', async () => {
    renderComponent();

    expect(screen.getByTestId('cloud-backup-card')).toBeInTheDocument();

    await waitFor(() => {
      expect(posApi.fetchCloudBackupStatus).toHaveBeenCalled();
    });

    const endpointInput = screen.getByLabelText('cloud-endpoint');
    expect(endpointInput.value).toBe('https://test-account.r2.cloudflarestorage.com');

    const bucketInput = screen.getByLabelText('cloud-bucket');
    expect(bucketInput.value).toBe('pos-test-backups');

    const accessKeyInput = screen.getByLabelText('cloud-access-key');
    expect(accessKeyInput.value).toBe('test_access_key');
  });

  it('toggles cloud backup enabled state and triggers save', async () => {
    renderComponent();

    await waitFor(() => {
      expect(posApi.fetchCloudBackupStatus).toHaveBeenCalled();
    });

    const toggle = screen.getByLabelText('cloud-backup-toggle');
    expect(toggle.checked).toBe(false);

    fireEvent.click(toggle);

    await waitFor(() => {
      expect(posApi.configureCloudBackup).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: true }),
        null
      );
    });
  });

  it('tests cloud storage connection when clicking test button', async () => {
    renderComponent();

    await waitFor(() => {
      expect(posApi.fetchCloudBackupStatus).toHaveBeenCalled();
    });

    const testBtn = screen.getByText('Otestovat spojení');
    fireEvent.click(testBtn);

    await waitFor(() => {
      expect(posApi.testCloudBackupConnection).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: 'https://test-account.r2.cloudflarestorage.com',
          bucket: 'pos-test-backups',
          access_key: 'test_access_key'
        }),
        null
      );
    });

    expect(await screen.findByText('Spojení s cloudovým úložištěm bylo úspěšně ověřeno.')).toBeInTheDocument();
  });

  it('saves cloud configuration when clicking save button', async () => {
    renderComponent();

    await waitFor(() => {
      expect(posApi.fetchCloudBackupStatus).toHaveBeenCalled();
    });

    const endpointInput = screen.getByLabelText('cloud-endpoint');
    fireEvent.change(endpointInput, { target: { value: 'https://new-endpoint.r2.cloudflarestorage.com' } });

    const saveBtn = screen.getByText('Uložit nastavení cloudu');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(posApi.configureCloudBackup).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: 'https://new-endpoint.r2.cloudflarestorage.com'
        }),
        null
      );
    });
  });

  it('triggers instant cloud backup upload and displays success notification', async () => {
    posApi.fetchCloudBackupStatus.mockResolvedValueOnce({
      status: 'SUCCESS',
      enabled: true,
      endpoint: 'https://test-account.r2.cloudflarestorage.com',
      bucket: 'pos-test-backups',
      access_key: 'test_access_key',
      has_secret_key: true,
      prefix: 'store_01',
      retention_days: 30,
      last_sync: '',
      last_status: '',
      last_error: ''
    });

    renderComponent();

    await waitFor(() => {
      expect(posApi.fetchCloudBackupStatus).toHaveBeenCalled();
    });

    const uploadNowBtn = screen.getByText('Zálohovat do cloudu nyní');
    fireEvent.click(uploadNowBtn);

    await waitFor(() => {
      expect(posApi.triggerCloudBackupUpload).toHaveBeenCalled();
    });

    expect(await screen.findByText(/Záloha vytvořena a odeslána: pos_backup_2026-09-05_120000\.zip/)).toBeInTheDocument();
  });

  it('opens cloud restore modal, lists remote backups, and confirms restore', async () => {
    renderComponent();

    await waitFor(() => {
      expect(posApi.fetchCloudBackupStatus).toHaveBeenCalled();
    });

    const browseBtn = screen.getByText('Procházet a obnovit z cloudu');
    fireEvent.click(browseBtn);

    expect(screen.getByTestId('cloud-restore-modal')).toBeInTheDocument();

    await waitFor(() => {
      expect(posApi.fetchRemoteCloudBackups).toHaveBeenCalled();
    });

    expect(screen.getByText('pos_backup_2026-09-05_120000.zip')).toBeInTheDocument();
    expect(screen.getByText('pos_backup_2026-09-04_120000.zip')).toBeInTheDocument();

    const restoreBtn = screen.getByLabelText('restore-pos_backup_2026-09-05_120000.zip');
    fireEvent.click(restoreBtn);

    // Confirmation box should appear
    expect(await screen.findByText('Opravdu obnovit databázi z cloudu?')).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /Potvrdit a obnovit databázi/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(posApi.restoreRemoteCloudBackup).toHaveBeenCalledWith(
        'pos_backup_2026-09-05_120000.zip',
        null
      );
    });

    expect(await screen.findByText('Databáze byla úspěšně obnovena z cloudu.')).toBeInTheDocument();
  });
});
