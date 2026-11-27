import { describe, expect, it, vi } from 'vitest';
import type { BarnDatabaseSnapshot } from '../../domain/models';
import {
  recordBackupExportAction,
  snoozeBackupReminderAction,
  type BackupReminderActionDeps,
} from '../barnStore/useBackupReminderActions';

function makeDeps(options: { withSnapshot: boolean }) {
  const enqueued: Array<() => Promise<unknown>> = [];
  const setLastMeta = vi.fn();
  const setSnoozed = vi.fn();
  const updateSettingsInternal = vi.fn(async () => {});
  const deps: BackupReminderActionDeps = {
    enqueueStoreMutation: async (task) => {
      enqueued.push(task);
      return task();
    },
    updateSettingsInternal,
    snapshotRef: {
      current: options.withSnapshot ? ({ id: 'snap-1' } as unknown as BarnDatabaseSnapshot) : null,
    },
    setLocalLastBackupMeta: setLastMeta,
    setLocalSnoozedUntilMs: setSnoozed,
  };
  return { deps, enqueued, setLastMeta, setSnoozed, updateSettingsInternal };
}

describe('recordBackupExportAction', () => {
  it('mirrors the export locally, clears the snooze and persists to settings', async () => {
    const { deps, setLastMeta, setSnoozed, updateSettingsInternal } = makeDeps({ withSnapshot: true });

    await recordBackupExportAction(deps, 'zip', 'pedigree-backup.zip');

    const meta = setLastMeta.mock.calls[0][0];
    expect(meta.format).toBe('zip');
    expect(meta.fileName).toBe('pedigree-backup.zip');
    expect(meta.exportedAtIso).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(setSnoozed).toHaveBeenCalledWith(0);
    expect(updateSettingsInternal).toHaveBeenCalledWith(
      { lastBackupMeta: meta, backupReminderSnoozedUntilMs: 0 },
      { silent: true }
    );
  });

  it('still records the export when no snapshot is loaded yet', async () => {
    const { deps, setLastMeta, updateSettingsInternal } = makeDeps({ withSnapshot: false });

    await recordBackupExportAction(deps, 'json');

    expect(setLastMeta).toHaveBeenCalledTimes(1);
    expect(updateSettingsInternal).not.toHaveBeenCalled();
  });

  it('accepts every export format', async () => {
    for (const format of ['zip', 'sqlite', 'json'] as const) {
      const { deps, setLastMeta } = makeDeps({ withSnapshot: false });
      await recordBackupExportAction(deps, format);
      expect(setLastMeta.mock.calls[0][0].format).toBe(format);
    }
  });
});

describe('snoozeBackupReminderAction', () => {
  it('defaults to a 24 hour snooze on the adjusted clock', async () => {
    const { deps, setSnoozed, updateSettingsInternal } = makeDeps({ withSnapshot: true });
    const before = Date.now();

    await snoozeBackupReminderAction(deps);

    const untilMs = setSnoozed.mock.calls[0][0] as number;
    expect(untilMs).toBeGreaterThanOrEqual(before + 24 * 60 * 60 * 1000);
    expect(untilMs).toBeLessThanOrEqual(Date.now() + 24 * 60 * 60 * 1000);
    expect(updateSettingsInternal).toHaveBeenCalledWith(
      { backupReminderSnoozedUntilMs: untilMs },
      { silent: true }
    );
  });

  it('honours a custom snooze length', async () => {
    const { deps, setSnoozed } = makeDeps({ withSnapshot: false });
    const before = Date.now();

    await snoozeBackupReminderAction(deps, 1);

    const untilMs = setSnoozed.mock.calls[0][0] as number;
    expect(untilMs - before).toBeGreaterThanOrEqual(60 * 60 * 1000 - 5000);
    expect(untilMs - before).toBeLessThanOrEqual(60 * 60 * 1000 + 5000);
  });

  it('updates local state without touching settings before a snapshot exists', async () => {
    const { deps, setSnoozed, updateSettingsInternal } = makeDeps({ withSnapshot: false });

    await snoozeBackupReminderAction(deps, 2);

    expect(setSnoozed).toHaveBeenCalledTimes(1);
    expect(updateSettingsInternal).not.toHaveBeenCalled();
  });
});
