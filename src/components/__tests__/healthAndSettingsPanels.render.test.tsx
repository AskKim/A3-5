// @vitest-environment jsdom
/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Mount coverage for the two largest screens that still had zero executable statements: the health
 * reference library (curated wiki cards + the offline vet-PDF folder pointer) and Settings & Sync
 * (seven collapsible preference sections). Both render real data instead of being skipped as
 * unimported modules, so their filter tabs, section toggles and preference writes actually execute.
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HealthReferencePanel } from '../HealthReferencePanel';
import { SettingsAndSyncScreen } from '../SettingsAndSyncScreen';
import { buildFullPredefinedSampleSnapshot } from '../../domain/sampleData';
import type { BackupStatusEvaluation } from '../../domain/backupStatus';
import type { StorageProtectionStatus } from '../../storage/storageProtection';

const snapshot = buildFullPredefinedSampleSnapshot();
const speciesName = snapshot.speciesProfiles[0].name;

const storageStatus: StorageProtectionStatus = {
  supported: true,
  persisted: true,
  usageBytes: 12_000_000,
  quotaBytes: 2_000_000_000,
  percentUsed: 0.6,
  checkedAtIso: '2026-11-28T10:00:00.000Z',
  isNativeWrapper: false,
  nativeContainerInfo: null,
};

const backupStatus: BackupStatusEvaluation = {
  level: 'changes_pending',
  hasRealData: true,
  hasChangesSinceBackup: true,
  ageDays: 4,
  latestRecordUpdatedAt: '2026-11-24T08:00:00.000Z',
  needsReminder: true,
  showDismissibleBanner: false,
  headline: 'Changes since your last backup',
  detail: 'Four days of edits are not in an external file yet.',
  lastExportLabel: 'ZIP export',
  lastExportRelative: '4 days ago',
  latestChangeLabel: 'Yesterday',
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderSettings(overrides: Partial<React.ComponentProps<typeof SettingsAndSyncScreen>> = {}) {
  const onUpdateSettings = vi.fn();
  const onConsumedOpenAddSpecies = vi.fn();
  const onSaveSpecies = vi.fn();
  render(
    <SettingsAndSyncScreen
      snapshot={snapshot}
      activeSpeciesName={speciesName}
      storageStatus={storageStatus}
      backupStatus={backupStatus}
      openAddSpeciesOnMount={false}
      onConsumedOpenAddSpecies={onConsumedOpenAddSpecies}
      onUpdateSettings={onUpdateSettings}
      onSaveSpecies={onSaveSpecies}
      onDeleteSpecies={vi.fn()}
      onDownloadTimestampedSpeciesBackup={vi.fn()}
      {...overrides}
    />
  );
  return { onUpdateSettings, onConsumedOpenAddSpecies, onSaveSpecies };
}

describe('HealthReferencePanel', () => {
  it('lists the species guides and widens the filter to every species', () => {
    render(<HealthReferencePanel speciesName={speciesName} />);

    expect(screen.getByText('Health Reference Wikis & Offline Veterinary PDFs')).toBeTruthy();
    expect(screen.getByText(`Rabbit & General (4)`)).toBeTruthy();
    const speciesGuideCount = screen.getAllByText('Open Guide').length;
    expect(speciesGuideCount).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'All Species (16)' }));
    expect(screen.getAllByText('Open Guide').length).toBeGreaterThan(speciesGuideCount);
  });

  it('opens and closes the preferred-source editor', () => {
    const onStatusNotice = vi.fn();
    render(<HealthReferencePanel speciesName={speciesName} initialSection="all" onStatusNotice={onStatusNotice} />);

    const toggle = screen.getByRole('button', { name: /Preferred Wiki Sources/ });
    fireEvent.click(toggle);
    expect(toggle.textContent).toContain('Hide');
    fireEvent.click(toggle);
    expect(toggle.textContent).toContain('Manage');
  });

  it('renders only the offline PDF folder pointer when asked for that section', () => {
    render(<HealthReferencePanel speciesName={speciesName} initialSection="pdfs" />);

    expect(screen.getByText('Local Veterinary PDF Folder Pointer (Offline)')).toBeTruthy();
    expect(screen.queryByText('Curated Health Reference Wikis')).toBeNull();
  });
});

describe('SettingsAndSyncScreen', () => {
  it('renders the preference summary with storage and backup state', () => {
    renderSettings();

    expect(screen.getByText('Barn Configuration & Master Preferences')).toBeTruthy();
    expect(screen.getByText('Changes since your last backup')).toBeTruthy();
    expect(screen.getByText(/0\.6% quota/)).toBeTruthy();
    expect(screen.getByText('Save Barn Preferences')).toBeTruthy();
  });

  it('saves the barn identity through onUpdateSettings', () => {
    const { onUpdateSettings } = renderSettings();

    fireEvent.click(screen.getByRole('button', { name: /Farm & Identity/ }));
    const nameInput = screen.getByLabelText('Barn / Farm / Rabbitry Name');
    fireEvent.change(nameInput, { target: { value: 'Willow Bend Barn' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Barn Preferences' }));

    expect(onUpdateSettings).toHaveBeenCalled();
    const [patch] = onUpdateSettings.mock.calls[0] as [{ barnName?: string }];
    expect(patch.barnName).toBe('Willow Bend Barn');
  });

  it('consumes the add-species request handed in by the shell', () => {
    const { onConsumedOpenAddSpecies } = renderSettings({ openAddSpeciesOnMount: true });

    expect(onConsumedOpenAddSpecies).toHaveBeenCalled();
  });

  it('expands the storage section from the section jump list', () => {
    renderSettings();

    fireEvent.click(screen.getByRole('button', { name: /Storage, Photos & Memory/ }));
    expect(screen.getByText(/SQLite \+ IndexedDB/)).toBeTruthy();
  });
});
