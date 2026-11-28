// @vitest-environment jsdom
/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Tier A render coverage: the recovery modals and the animal editor. These are the screens
 * where a rendering regression is indistinguishable from data loss, so each test drives a
 * user-visible control and asserts the callback contract or the surfaced error.
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ArchivedHerdIndexEntry, VaultBackupMetadata } from '../../domain/backupVault';
import type { AnimalSaveDraft } from '../../domain/animalConflicts';
import type { Animal } from '../../domain/models';
import { buildFullPredefinedSampleSnapshot } from '../../domain/sampleData';
import type { RollingBackupMeta } from '../../storage/storageProtection';
import { ArchivedHerdsModal } from '../ArchivedHerdsModal';
import { UnifiedBackupVaultPanel } from '../UnifiedBackupVaultPanel';
import { WipedStorageRecoveryModal } from '../WipedStorageRecoveryModal';
import { AnimalEditorModal } from '../AnimalEditorModal';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function makeVaultBackup(overrides: Partial<VaultBackupMetadata> = {}): VaultBackupMetadata {
  return {
    key: 'manual-2026-11-28-a1b2c3.json',
    fileName: 'manual-2026-11-28-a1b2c3.json',
    kind: 'manual',
    schemaVersion: 6,
    createdAtIso: '2026-11-28T09:00:00.000Z',
    createdByAppVersion: '0.1.0-alpha.3',
    barnName: 'Willow Warrening',
    animalCount: 12,
    photoCount: 3,
    speciesCount: 2,
    byteSize: 4096,
    checksumSha256: 'deadbeef',
    source: 'opfs',
    compressed: false,
    ...overrides,
  };
}

function makeRollingBackup(overrides: Partial<RollingBackupMeta> = {}): RollingBackupMeta {
  return {
    key: 'rolling-1',
    savedAtIso: '2026-11-27T08:00:00.000Z',
    animalCount: 9,
    photoCount: 1,
    speciesCount: 1,
    byteSize: 2048,
    ...overrides,
  };
}

function makeArchiveEntry(overrides: Partial<ArchivedHerdIndexEntry> = {}): ArchivedHerdIndexEntry {
  return {
    archiveKey: 'archive-1',
    fileName: 'herd-2026-11-20.archive.zip',
    createdAtIso: '2026-11-20T10:00:00.000Z',
    schemaVersion: 6,
    byteSize: 8192,
    checksumSha256: 'cafebabe',
    speciesSummary: ['Rabbit'],
    animalCount: 2,
    photoCount: 4,
    careLogCount: 6,
    animals: [
      {
        id: 'archived-1',
        name: 'Clover',
        tattoo: 'CLV1',
        species: 'Rabbit',
        breed: 'New Zealand',
        variety: 'Red',
        sex: 'Female',
        status: 'Sold',
        birthDateIso: '2025-02-01',
        buyerName: 'Meadow Farm',
        hasPedigreeStubInDb: true,
      },
    ],
    ...overrides,
  };
}

describe('WipedStorageRecoveryModal', () => {
  const baseProps = {
    onRestoreLatestOpfs: vi.fn(async () => undefined),
    onImportJsonReplace: vi.fn(async () => undefined),
    onImportArchiveReplace: vi.fn(async () => undefined),
    onImportSqlite: vi.fn(async () => undefined),
    onStartFresh: vi.fn(async () => undefined),
  };

  it('renders nothing without an eviction context', () => {
    render(<WipedStorageRecoveryModal context={null} {...baseProps} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('offers the surviving OPFS backup with its record count and restores it', async () => {
    const onRestoreLatestOpfs = vi.fn(async () => undefined);
    render(
      <WipedStorageRecoveryModal
        context={{
          detected: true,
          reason: 'opfs_backups',
          sentinel: {
            barnName: 'Willow Warrening',
            animalCount: 12,
            nonTestingCount: 12,
            lastSeenIso: '2026-11-27T00:00:00.000Z',
          },
          latestOpfsBackup: makeVaultBackup(),
          opfsBackupsCount: 1,
          opfsArchivesCount: 0,
          rollingBackupsCount: 0,
        }}
        {...baseProps}
        onRestoreLatestOpfs={onRestoreLatestOpfs}
      />
    );

    expect(screen.getByText(/Browser Storage Cleared/i)).toBeTruthy();
    expect(screen.getByText(/12 prior records/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Restore Latest OPFS Backup \(12 animals\)/i }));
    await waitFor(() => expect(onRestoreLatestOpfs).toHaveBeenCalledTimes(1));
  });

  it('surfaces a restore failure as an alert instead of silently closing', async () => {
    const onRestoreLatestOpfs = vi.fn(async () => {
      throw new Error('Checksum mismatch on vault envelope');
    });
    render(
      <WipedStorageRecoveryModal
        context={{
          detected: true,
          reason: 'opfs_backups',
          sentinel: null,
          latestOpfsBackup: makeVaultBackup(),
          opfsBackupsCount: 1,
          opfsArchivesCount: 0,
          rollingBackupsCount: 0,
        }}
        {...baseProps}
        onRestoreLatestOpfs={onRestoreLatestOpfs}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Restore Latest OPFS Backup/i }));
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('Checksum mismatch')
    );
  });

  it('requires an explicit confirmation before wiping to starter herds', async () => {
    const onStartFresh = vi.fn(async () => undefined);
    render(
      <WipedStorageRecoveryModal
        context={{
          detected: true,
          reason: 'sentinel',
          sentinel: null,
          latestOpfsBackup: null,
          opfsBackupsCount: 0,
          opfsArchivesCount: 0,
          rollingBackupsCount: 0,
        }}
        {...baseProps}
        onStartFresh={onStartFresh}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Start Fresh/i }));
    expect(onStartFresh).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Confirm Start Fresh/i }));
    await waitFor(() => expect(onStartFresh).toHaveBeenCalledTimes(1));
  });

  it('offers rolling IndexedDB snapshots and restores the chosen key', async () => {
    const onRestoreRollingBackup = vi.fn(async () => undefined);
    render(
      <WipedStorageRecoveryModal
        context={{
          detected: true,
          reason: 'rolling_backups',
          sentinel: null,
          latestOpfsBackup: null,
          opfsBackupsCount: 0,
          opfsArchivesCount: 0,
          rollingBackupsCount: 1,
        }}
        rollingBackups={[makeRollingBackup({ animalCount: 9 })]}
        onRestoreRollingBackup={onRestoreRollingBackup}
        {...baseProps}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Restore Rolling Backup/i }));
    await waitFor(() => expect(onRestoreRollingBackup).toHaveBeenCalledWith('rolling-1'));
  });
});

describe('ArchivedHerdsModal', () => {
  const handlers = {
    onToggleAutoOffload: vi.fn(),
    onRestoreArchive: vi.fn(async () => undefined),
    onDownloadArchive: vi.fn(async () => undefined),
    onDeleteArchive: vi.fn(async () => undefined),
    onClose: vi.fn(),
  };

  it('renders nothing while closed', () => {
    render(
      <ArchivedHerdsModal
        isOpen={false}
        opfsSupported
        archives={[makeArchiveEntry()]}
        autoOffloadEnabled={false}
        {...handlers}
      />
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('explains when OPFS archives are unavailable in this browser', () => {
    render(
      <ArchivedHerdsModal
        isOpen
        opfsSupported={false}
        archives={[]}
        autoOffloadEnabled={false}
        {...handlers}
      />
    );
    expect(screen.getByText(/OPFS\) directory access is not supported/i)).toBeTruthy();
    expect((screen.getByRole('checkbox') as HTMLInputElement).disabled).toBe(true);
  });

  it('filters archives by animal name and by species', () => {
    render(
      <ArchivedHerdsModal
        isOpen
        opfsSupported
        archives={[
          makeArchiveEntry(),
          makeArchiveEntry({
            archiveKey: 'archive-2',
            fileName: 'goats.archive.zip',
            speciesSummary: ['Goat'],
            animals: [
              {
                id: 'archived-2',
                name: 'Bramble',
                tattoo: 'BR2',
                species: 'Goat',
                breed: 'Nubian',
                variety: 'Black',
                sex: 'Male',
                status: 'Deceased',
                birthDateIso: '2024-03-01',
                hasPedigreeStubInDb: false,
              },
            ],
          }),
        ]}
        autoOffloadEnabled
        {...handlers}
      />
    );

    fireEvent.change(screen.getByLabelText(/Search archived herds/i), {
      target: { value: 'bramble' },
    });
    expect(screen.queryByText(/Clover/)).toBeNull();
    expect(screen.getByText(/Bramble/)).toBeTruthy();
  });

  it('gates deletion behind a confirm button', async () => {
    render(
      <ArchivedHerdsModal
        isOpen
        opfsSupported
        archives={[makeArchiveEntry()]}
        autoOffloadEnabled={false}
        {...handlers}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Delete archive/i }));
    expect(handlers.onDeleteArchive).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Confirm Delete/i }));
    await waitFor(() => expect(handlers.onDeleteArchive).toHaveBeenCalledWith('archive-1'));
  });

  it('restores to active status and requests the bundle be removed after restore', async () => {
    render(
      <ArchivedHerdsModal
        isOpen
        opfsSupported
        archives={[makeArchiveEntry()]}
        autoOffloadEnabled={false}
        {...handlers}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Restore to Active/i }));
    await waitFor(() =>
      expect(handlers.onRestoreArchive).toHaveBeenCalledWith('archive-1', {
        restoreToActiveStatus: true,
        deleteArchiveAfterRestore: true,
      })
    );
  });
});

describe('UnifiedBackupVaultPanel', () => {
  const handlers = {
    onSaveManualVaultBackup: vi.fn(async () => undefined),
    onRestoreOpfsBackup: vi.fn(async () => undefined),
    onDownloadOpfsBackup: vi.fn(async () => undefined),
    onDeleteOpfsBackup: vi.fn(async () => undefined),
    onRestoreRollingBackup: vi.fn(async () => undefined),
    onDeleteRollingBackup: vi.fn(async () => undefined),
    onOpenArchivedHerdsModal: vi.fn(),
  };

  function renderPanel(overrides: Partial<React.ComponentProps<typeof UnifiedBackupVaultPanel>> = {}) {
    return render(
      <UnifiedBackupVaultPanel
        opfsSupported
        opfsBackups={[]}
        rollingBackups={[]}
        archivedBundlesCount={0}
        archivedAnimalsCount={0}
        {...handlers}
        {...overrides}
      />
    );
  }

  it('shows the empty state when no snapshot tiers exist', () => {
    renderPanel();
    expect(screen.getByText(/No local vault snapshots recorded yet/i)).toBeTruthy();
  });

  it('saves a manual snapshot with the entered note', async () => {
    const onSaveManualVaultBackup = vi.fn(async () => undefined);
    renderPanel({ onSaveManualVaultBackup });

    fireEvent.change(screen.getByLabelText(/Optional backup snapshot note/i), {
      target: { value: 'Pre-show weekend check' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save Snapshot to Vault Now/i }));
    await waitFor(() =>
      expect(onSaveManualVaultBackup).toHaveBeenCalledWith('Pre-show weekend check')
    );
  });

  it('surfaces a failed manual save instead of claiming success', async () => {
    const onSaveManualVaultBackup = vi.fn(async () => {
      throw new Error('QuotaExceededError while writing vault snapshot');
    });
    renderPanel({ onSaveManualVaultBackup });

    fireEvent.click(screen.getByRole('button', { name: /Save Snapshot to Vault Now/i }));
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('QuotaExceededError')
    );
  });

  it('confirms before restoring an OPFS snapshot', async () => {
    const onRestoreOpfsBackup = vi.fn(async () => undefined);
    renderPanel({ opfsBackups: [makeVaultBackup()], onRestoreOpfsBackup });

    fireEvent.click(screen.getByRole('button', { name: /^Restore$/i }));
    expect(onRestoreOpfsBackup).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Confirm Restore/i }));
    await waitFor(() => expect(onRestoreOpfsBackup).toHaveBeenCalledWith(makeVaultBackup().key));
  });

  it('confirms before deleting a rolling snapshot', async () => {
    const onDeleteRollingBackup = vi.fn(async () => undefined);
    renderPanel({ rollingBackups: [makeRollingBackup()], onDeleteRollingBackup });

    fireEvent.click(screen.getByRole('button', { name: /Delete IndexedDB rolling backup/i }));
    fireEvent.click(screen.getByRole('button', { name: /Confirm Delete/i }));
    await waitFor(() => expect(onDeleteRollingBackup).toHaveBeenCalledWith('rolling-1'));
  });
});

describe('AnimalEditorModal', () => {
  function renderEditor(overrides: Partial<React.ComponentProps<typeof AnimalEditorModal>> = {}) {
    const snapshot = buildFullPredefinedSampleSnapshot();
    const speciesProfile = snapshot.speciesProfiles[0];
    const speciesAnimals = snapshot.animals.filter((a) => a.species === speciesProfile.name);
    return render(
      <AnimalEditorModal
        initialAnimal={speciesAnimals[0]}
        speciesProfile={speciesProfile}
        speciesAnimals={speciesAnimals}
        speciesCages={snapshot.cages.filter((c) => c.species === speciesProfile.name)}
        preferredUnit="kg"
        defaultBreederName="Willow Warrening"
        defaultOwnerName="Willow Warrening"
        onSave={vi.fn()}
        onClose={vi.fn()}
        {...overrides}
      />
    );
  }

  it('opens in edit mode for the selected animal', () => {
    const snapshot = buildFullPredefinedSampleSnapshot();
    const animal = snapshot.animals[0];
    renderEditor({ initialAnimal: animal });

    expect(screen.getByRole('dialog', { name: `Edit ${animal.name}` })).toBeTruthy();
    expect(screen.getByRole('button', { name: `Save ${animal.species}` })).toBeTruthy();
  });

  it('submits the prefilled animal instead of discarding the edit', async () => {
    const onSave = vi.fn(async (_draft: AnimalSaveDraft) => undefined);
    const snapshot = buildFullPredefinedSampleSnapshot();
    const animal = snapshot.animals[0];
    renderEditor({ initialAnimal: animal, onSave });

    fireEvent.click(screen.getByRole('button', { name: `Save ${animal.species}` }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0].id).toBe(animal.id);
  });

  it('closes without saving when cancelled', () => {
    const onClose = vi.fn();
    const onSave = vi.fn();
    renderEditor({ onClose, onSave });

    fireEvent.click(screen.getByRole('button', { name: /^Cancel$/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });
});
