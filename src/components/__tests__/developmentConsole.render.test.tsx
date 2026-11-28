// @vitest-environment jsdom
/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Developer console: the screen an operator uses to diagnose storage, inspect sync state and run
 * phrase-gated resets. It was the last workspace screen with no executable coverage, so this file
 * mounts it for real and drives the two things a regression would break silently: the workspace
 * switcher and the destructive lab's arming/phrase gate.
 */

import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  detectCurrentBrowserCompatibility,
  detectCurrentDeviceCapability,
  type DeviceCapabilityController,
} from '../../storage/deviceCapabilityDetector';
import { buildFullPredefinedSampleSnapshot } from '../../domain/sampleData';
import { DevelopmentScreen } from '../DevelopmentScreen';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function makeDeviceCapability(): DeviceCapabilityController {
  const assessment = detectCurrentDeviceCapability();
  return {
    assessment,
    browserCompatibility: detectCurrentBrowserCompatibility(assessment),
    homeDismissed: false,
    settingsDismissed: false,
    homeVisible: true,
    settingsVisible: true,
    canCloseOnHome: true,
    canCloseInSettings: true,
    dismissOnHome: vi.fn(),
    reopenOnHome: vi.fn(),
    dismissInSettings: vi.fn(),
    reopenInSettings: vi.fn(),
    refreshDetection: vi.fn(),
  };
}

function renderConsole(overrides: Partial<React.ComponentProps<typeof DevelopmentScreen>> = {}) {
  const snapshot = buildFullPredefinedSampleSnapshot();
  const onPurgeOpfsTmp = vi.fn(async () => ({ filesRemoved: 0, bytesFreed: 0 }));
  const handlers = {
    onBackToSettings: vi.fn(),
    onRefreshStorageStatus: vi.fn(async () => {
      throw new Error('storage status must be stubbed by the caller');
    }),
    onRequestPersistentStorage: vi.fn(),
    onPurgeOpfsTmp,
    onClearLocalSyncAndReminderState: vi.fn(async () => undefined),
    recordBackupExport: vi.fn(),
    onScanDatabaseHealth: vi.fn(() => null),
    onRepairDatabaseHealth: vi.fn(async () => null),
    onResetDatabaseConnection: vi.fn(async () => undefined),
    onPurgeCorruptedCaches: vi.fn(async () => ({
      cachesCleared: 0,
      serviceWorkersUnregistered: 0,
      backupFilename: null,
    })),
    onSeedAllSpecies: vi.fn(async () => undefined),
    onClearAllRecords: vi.fn(async () => undefined),
    onRestoreFactoryDefaults: vi.fn(async () => undefined),
  };
  const utils = render(
    <DevelopmentScreen
      snapshot={snapshot}
      engineName="SQLite WASM + IndexedDB"
      storageStatus={null}
      opfsSupported={false}
      opfsVaultBackups={[]}
      deviceCapability={makeDeviceCapability()}
      deviceId="developer-test-device"
      {...handlers}
      onRefreshStorageStatus={vi.fn(async () => ({
        supported: false,
        persisted: false,
        usageBytes: 0,
        quotaBytes: 0,
        percentUsed: 0,
        checkedAtIso: '2026-11-28T00:00:00.000Z',
        isNativeWrapper: false,
        nativeContainerInfo: null,
      }))}
      {...overrides}
    />
  );
  return { ...utils, snapshot, onPurgeOpfsTmp };
}

describe('DevelopmentScreen', () => {
  it('opens on the storage workspace with host telemetry and the tier reference', () => {
    renderConsole();

    expect(screen.getByRole('heading', { name: 'Development' })).toBeTruthy();
    expect(screen.getAllByText(/Host Telemetry Summary/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Device Tier & Memory Hierarchy Guidelines/i).length).toBeGreaterThan(
      0
    );
    expect(
      screen.getByRole('tab', { name: /Storage & OPFS/i }).getAttribute('aria-selected')
    ).toBe('true');
  });

  it('switches between the runtime, logs and maintenance workspaces', () => {
    renderConsole();

    fireEvent.click(screen.getByRole('tab', { name: /Runtime & Sync/i }));
    expect(screen.getByRole('tabpanel', { name: /Runtime & Sync/i })).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: /Logs & Support/i }));
    expect(screen.getByRole('tabpanel', { name: /Logs & Support/i })).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: /Maintenance & Resets/i }));
    expect(screen.getByRole('tabpanel', { name: /Maintenance & Resets/i })).toBeTruthy();
  });

  it('opens every panel at once and collapses back to a single workspace', () => {
    renderConsole();

    const openAll = screen.getByRole('button', { name: /Open All Sections/i });
    fireEvent.click(openAll);

    expect(openAll.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /Collapse All Sections/i })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Collapse All Sections/i }));
    expect(openAll.getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('tab', { name: /Storage & OPFS/i }).getAttribute('aria-selected')).toBe(
      'true'
    );
  });

  it('keeps destructive resets locked until armed and the exact phrase is typed', async () => {
    const { onPurgeOpfsTmp } = renderConsole();

    fireEvent.click(screen.getByRole('tab', { name: /Maintenance & Resets/i }));
    fireEvent.click(
      screen.getByRole('button', { name: /Safeguarded Cache, Sync & Data Reset Controls/i })
    );

    // Locked: the phrase field does not even exist until safety is armed.
    expect(screen.queryByPlaceholderText('PURGE TMP')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Arm Destructive Controls/i }));
    expect(screen.getAllByText(/Safety Armed/i).length).toBeGreaterThan(0);

    const phraseInput = screen.getByPlaceholderText('PURGE TMP');
    const purgeButton = screen.getByRole('button', { name: /Purge \/tmp/i });
    expect((purgeButton as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(phraseInput, { target: { value: 'PURGE SOMETHING ELSE' } });
    expect((purgeButton as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(phraseInput, { target: { value: 'purge tmp' } });
    await waitFor(() => expect((purgeButton as HTMLButtonElement).disabled).toBe(false));

    fireEvent.click(purgeButton);

    await waitFor(() => expect(onPurgeOpfsTmp).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toMatch(/Purged 0 stale file/i)
    );
  });
});
