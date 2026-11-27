import { describe, expect, it } from 'vitest';
import {
  BACKUP_REMINDER_SNOOZE_STORAGE_KEY,
  LAST_BACKUP_META_STORAGE_KEY,
  clearStoredBackupReminderState,
  clearStoredSnoozedUntilMs,
  computeSnoozedUntilMs,
  readStoredLastBackupMeta,
  readStoredSnoozedUntilMs,
  resolveEffectiveSnoozedUntilMs,
  writeStoredLastBackupMeta,
  writeStoredSnoozedUntilMs,
  type ReminderStorage,
} from '../barnStore/backupReminder';

function fakeStorage(initial: Record<string, string> = {}): ReminderStorage & {
  data: Record<string, string>;
} {
  const data: Record<string, string> = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = value;
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
}

const throwingStorage: ReminderStorage = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
  removeItem: () => {
    throw new Error('blocked');
  },
};

describe('backup reminder storage', () => {
  it('reads a stored snooze deadline', () => {
    const storage = fakeStorage({ [BACKUP_REMINDER_SNOOZE_STORAGE_KEY]: '1700000000000' });
    expect(readStoredSnoozedUntilMs(storage)).toBe(1700000000000);
  });

  it('treats missing, empty or unparsable snooze values as "not snoozed"', () => {
    expect(readStoredSnoozedUntilMs(fakeStorage())).toBe(0);
    expect(readStoredSnoozedUntilMs(fakeStorage({ [BACKUP_REMINDER_SNOOZE_STORAGE_KEY]: '' }))).toBe(0);
    expect(readStoredSnoozedUntilMs(fakeStorage({ [BACKUP_REMINDER_SNOOZE_STORAGE_KEY]: 'later' }))).toBe(0);
    expect(readStoredSnoozedUntilMs(null)).toBe(0);
  });

  it('writes and clears the snooze deadline', () => {
    const storage = fakeStorage();
    writeStoredSnoozedUntilMs(42, storage);
    expect(storage.data[BACKUP_REMINDER_SNOOZE_STORAGE_KEY]).toBe('42');
    clearStoredSnoozedUntilMs(storage);
    expect(storage.data[BACKUP_REMINDER_SNOOZE_STORAGE_KEY]).toBeUndefined();
  });

  it('round-trips the last backup metadata', () => {
    const storage = fakeStorage();
    const meta = { exportedAtIso: '2026-01-01T00:00:00.000Z', format: 'zip' as const, fileName: 'backup.zip' };
    writeStoredLastBackupMeta(meta, storage);
    expect(readStoredLastBackupMeta(storage)).toEqual(meta);
  });

  it('ignores corrupt backup metadata instead of throwing', () => {
    expect(readStoredLastBackupMeta(fakeStorage({ [LAST_BACKUP_META_STORAGE_KEY]: '{not json' }))).toBeNull();
    expect(readStoredLastBackupMeta(fakeStorage())).toBeNull();
    expect(readStoredLastBackupMeta(null)).toBeNull();
  });

  it('clears the reminder state (both keys) at once', () => {
    const storage = fakeStorage({
      [LAST_BACKUP_META_STORAGE_KEY]: '{}',
      [BACKUP_REMINDER_SNOOZE_STORAGE_KEY]: '99',
      'unrelated.key': 'keep me',
    });
    clearStoredBackupReminderState(storage);
    expect(storage.data[LAST_BACKUP_META_STORAGE_KEY]).toBeUndefined();
    expect(storage.data[BACKUP_REMINDER_SNOOZE_STORAGE_KEY]).toBeUndefined();
    expect(storage.data['unrelated.key']).toBe('keep me');
  });

  it('never throws when storage is blocked', () => {
    expect(readStoredSnoozedUntilMs(throwingStorage)).toBe(0);
    expect(readStoredLastBackupMeta(throwingStorage)).toBeNull();
    expect(() => writeStoredSnoozedUntilMs(1, throwingStorage)).not.toThrow();
    expect(() =>
      writeStoredLastBackupMeta({ exportedAtIso: 'x', format: 'json' }, throwingStorage)
    ).not.toThrow();
    expect(() => clearStoredSnoozedUntilMs(throwingStorage)).not.toThrow();
    expect(() => clearStoredBackupReminderState(throwingStorage)).not.toThrow();
  });
});

describe('backup reminder policy', () => {
  it('prefers the snapshot value, including an explicit zero', () => {
    expect(resolveEffectiveSnoozedUntilMs(500, 900)).toBe(500);
    expect(resolveEffectiveSnoozedUntilMs(0, 900)).toBe(0);
  });

  it('falls back to the local mirror, then zero', () => {
    expect(resolveEffectiveSnoozedUntilMs(undefined, 900)).toBe(900);
    expect(resolveEffectiveSnoozedUntilMs(null, 900)).toBe(900);
    expect(resolveEffectiveSnoozedUntilMs(undefined, undefined)).toBe(0);
  });

  it('adds the snooze hours to the adjusted clock', () => {
    const now = 1_700_000_000_000;
    expect(computeSnoozedUntilMs(now, 24)).toBe(now + 86_400_000);
    expect(computeSnoozedUntilMs(now, 1)).toBe(now + 3_600_000);
    expect(computeSnoozedUntilMs(now, 0)).toBe(now);
  });

  it('uses the shared storage keys the previous inline code used', () => {
    expect(LAST_BACKUP_META_STORAGE_KEY).toBe('pedigree.lastBackupMeta.v1');
    expect(BACKUP_REMINDER_SNOOZE_STORAGE_KEY).toBe('pedigree.backupReminderSnoozedUntil.v1');
  });
});
