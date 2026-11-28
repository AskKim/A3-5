// @vitest-environment jsdom
/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Backup/export surfaces: the Import & Export hub (backup + exporters workspaces) and the
 * diagnostics panel's health-check entry point. These are the screens a breeder uses to get
 * data out of the app, so the tests assert the visible contracts rather than internals.
 */

import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BUILTIN_NON_NATIVE_EXPORTERS } from '../../domain/exporters/registry';
import { analyzeBarnDataHealth } from '../../domain/dataHealthCheck';
import { buildFullPredefinedSampleSnapshot } from '../../domain/sampleData';
import { SyncConflictSliceProvider } from '../../hooks/barnStore/syncConflictSlice';
import { VaultSliceProvider } from '../../hooks/barnStore/vaultSlice';
import { SyncStateSliceProvider } from '../../hooks/barnStore/syncStateSlice';
import { DiagnosticsAndSupportPanel } from '../DiagnosticsAndSupportPanel';
import { ImportExportHubScreen } from '../ImportExportHubScreen';

const downloadTextFileMock = vi.fn(
  async (_fileName: string, _content: string, _mimeType?: string) => undefined
);

vi.mock('../../utils/webFileActions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/webFileActions')>();
  return {
    ...actual,
    downloadTextFile: (...args: Parameters<typeof actual.downloadTextFile>) =>
      downloadTextFileMock(...args),
  };
});

// `readEmergencySessionTrace` is the first call inside the guarded tail of `refreshDiagnostics`, so
// observing it proves whether a refresh that settled after unmount was applied or dropped. React
// itself cannot show this: an update on an unmounted root is a silent no-op.
const readEmergencyTraceSpy = vi.fn();

vi.mock('../../storage/crashLogger', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../storage/crashLogger')>();
  return {
    ...actual,
    readEmergencySessionTrace: () => {
      readEmergencyTraceSpy();
      return actual.readEmergencySessionTrace();
    },
  };
});

afterEach(() => {
  // Unmount before jsdom teardown so deferred React work cannot run without a window.
  cleanup();
  downloadTextFileMock.mockClear();
  readEmergencyTraceSpy.mockClear();
  vi.restoreAllMocks();
});

function installLocalStorageShim() {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, String(value)),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
    },
    configurable: true,
    writable: true,
  });
  return store;
}

function renderHub(overrides: Partial<React.ComponentProps<typeof ImportExportHubScreen>> = {}) {
  installLocalStorageShim();
  const snapshot = buildFullPredefinedSampleSnapshot();
  return render(
    <SyncConflictSliceProvider
      syncConflicts={[]}
      resolveSyncConflict={async () => undefined}
      dismissSyncConflict={async () => undefined}
    >
    <SyncStateSliceProvider
      backupStatus={null}
      syncOperations={[]}
      backupSyncStatus={null}
      pruneSyncWarning={null}
      storageStatus={null}
      cloudSyncState={null}
      cloudSyncBusy={false}
    >
    <VaultSliceProvider
      opfsSupported
      opfsVaultBackups={[]}
      rollingBackups={[]}
      archivedHerdBundles={[]}
      onSaveManualOpfsVaultBackup={async () => undefined}
      onCreateVerifiedPreUpgradeBackup={async () => null}
      onRestoreOpfsVaultBackup={async () => undefined}
      onDeleteOpfsVaultBackup={async () => undefined}
      onRestoreRollingBackup={async () => undefined}
    >
    <ImportExportHubScreen
      snapshot={snapshot}
      engineName="SQLite WASM + IndexedDB"
      activeSpeciesName={snapshot.speciesProfiles[0]?.name ?? 'Rabbit'}
      deviceId="render-test-device"
      initialSection="exporters"
      onOpenSettings={vi.fn()}
      recordBackupExport={vi.fn()}
      onUpdateSettings={vi.fn()}
      onApplyPlatformImport={vi.fn(async () => undefined)}
      onImportJson={vi.fn(async () => undefined)}
      onImportBackupArchive={vi.fn(async () => undefined)}
      onImportDeltaOperations={vi.fn(async () => undefined)}
      onBuildLocalDeltaJson={() => ({ filename: 'delta.json', content: '{}' })}
      onExportSqliteBytes={vi.fn(async () => null)}
      onImportSqliteBytes={vi.fn(async () => undefined)}
      {...overrides}
    />
    </VaultSliceProvider>
    </SyncStateSliceProvider>
    </SyncConflictSliceProvider>
  );
}

describe('ImportExportHubScreen backup & export workspaces', () => {
  it('opens on the exporters workspace and lists the built-in formats', () => {
    renderHub();

    expect(screen.getByRole('tab', { name: /03 · Exporters/i }).getAttribute('aria-selected')).toBe(
      'true'
    );
    for (const exporter of BUILTIN_NON_NATIVE_EXPORTERS.slice(0, 3)) {
      expect(screen.getAllByText(new RegExp(exporter.name, 'i')).length).toBeGreaterThan(0);
    }
  });

  it('switches to the system backup workspace and shows the backup status card', () => {
    renderHub();

    fireEvent.click(screen.getByRole('tab', { name: /01 · System Backup/i }));

    expect(
      screen.getByRole('tab', { name: /01 · System Backup/i }).getAttribute('aria-selected')
    ).toBe('true');
    expect(screen.getAllByText(/Backup Status/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Protected & Current|Backup Recommended|Ready/i).length).toBeGreaterThan(
      0
    );
  });

  it('switches to the imports workspace and keeps the native restore entry point visible', () => {
    renderHub();

    fireEvent.click(screen.getByRole('tab', { name: /02 · Imports/i }));

    expect(screen.getByRole('tab', { name: /02 · Imports/i }).getAttribute('aria-selected')).toBe(
      'true'
    );
    expect(screen.getAllByText(/Import|Restore/i).length).toBeGreaterThan(0);
  });

  it('executes the CSV exporter end to end and hands the file to the download layer', async () => {
    renderHub();
    const snapshot = buildFullPredefinedSampleSnapshot();
    const sampleAnimal = snapshot.animals[0];
    const csvCard = screen.getByRole('heading', { name: /Herd Roster Spreadsheet/i }).closest('article');
    expect(csvCard).not.toBeNull();

    fireEvent.click(within(csvCard as HTMLElement).getByRole('button', { name: /Export .*\.CSV/i }));

    await waitFor(() => expect(downloadTextFileMock).toHaveBeenCalledTimes(1));
    const [fileName, content, mimeType] = downloadTextFileMock.mock.calls[0];
    expect(fileName).toMatch(/\.csv$/i);
    expect(mimeType).toContain('text/csv');
    // RFC-4180 payload: UTF-8 BOM, human-readable header row, and a real animal from the barn.
    expect(content.startsWith('\uFEFF')).toBe(true);
    expect(content).toMatch(/Species/);
    expect(content).toContain(sampleAnimal.tattoo || sampleAnimal.name);
    await waitFor(() => expect(screen.getByRole('status').textContent).toBeTruthy());
  });

  it('reports the active species and engine it is exporting from', () => {
    renderHub();
    expect(screen.getAllByText(/SQLite WASM \+ IndexedDB/).length).toBeGreaterThan(0);
  });
});

function renderDiagnostics(
  overrides: Partial<React.ComponentProps<typeof DiagnosticsAndSupportPanel>> = {}
) {
  installLocalStorageShim();
  const snapshot = buildFullPredefinedSampleSnapshot();
  return render(
    <DiagnosticsAndSupportPanel
      snapshot={snapshot}
      onScanDatabaseHealth={() => analyzeBarnDataHealth(snapshot)}
      onRepairDatabaseHealth={vi.fn(async () => null)}
      onResetDatabaseConnection={vi.fn(async () => undefined)}
      onPurgeCorruptedCaches={vi.fn(async () => ({
        cachesCleared: 0,
        serviceWorkersUnregistered: 0,
        backupFilename: null,
      }))}
      visibleSections="maintenance"
      {...overrides}
    />
  );
}

describe('DiagnosticsAndSupportPanel export & repair entry points', () => {
  it('runs the database health scan and renders the all-clear verdict', async () => {
    const snapshot = buildFullPredefinedSampleSnapshot();
    const onScanDatabaseHealth = vi.fn(() => analyzeBarnDataHealth(snapshot));
    renderDiagnostics({ snapshot, onScanDatabaseHealth });

    fireEvent.click(screen.getByRole('button', { name: /Scan Herd & DB Health/i }));

    await waitFor(() => expect(onScanDatabaseHealth).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getAllByText(/All Clear|structural issue/i).length).toBeGreaterThan(0)
    );
  });

  it('keeps the destructive repair action out of reach when nothing is auto-repairable', async () => {
    renderDiagnostics();

    fireEvent.click(screen.getByRole('button', { name: /Scan Herd & DB Health/i }));

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /Auto-Repair/i })).toBeNull()
    );
  });

  it('drops a diagnostics refresh that resolves after the panel unmounts', async () => {
    // CI failed this file with `window is not defined`: the mount refresh awaited its log reads,
    // the panel unmounted first, and the late result was applied into a torn-down jsdom document.
    // Unmounting in the same tick keeps those reads in flight, so this asserts the refresh is
    // dropped rather than applied — the behaviour that used to dispatch the fatal update.
    readEmergencyTraceSpy.mockClear();

    const { unmount } = renderDiagnostics();
    unmount();

    // Two macrotasks: the first lets the deferred log reads settle, the second catches anything
    // they scheduled behind them.
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(readEmergencyTraceSpy).not.toHaveBeenCalled();
  });
});
