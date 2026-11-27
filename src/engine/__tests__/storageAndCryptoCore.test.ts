/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BackgroundPausedError,
  BoundedStringLruCache,
  createCrossTabCommitBus,
  decryptTextWithPassphraseGeneric,
  encryptTextWithPassphraseGeneric,
  isIndexedDbBlockedError,
  isQuotaExceededError,
  notifyBackgroundTransition,
  probeLocalStorageSupport,
  registerPausedBackgroundJob,
  resetBackgroundFreezeCoordinatorForTests,
  resetTrackedProbeResourcesForTests,
  withCrossTabLock,
} from '../index';

describe('@engine storage & crypto core modules (non-default fixtures)', () => {
  afterEach(() => {
    resetBackgroundFreezeCoordinatorForTests();
    resetTrackedProbeResourcesForTests();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('supports custom probe keys and quota/blocked error classification in browserProbes', () => {
    const store = new Map<string, string>();
    const fakeStorage = {
      length: 0,
      clear: () => store.clear(),
      key: () => null,
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    } as Storage;
    vi.stubGlobal('localStorage', fakeStorage);

    expect(probeLocalStorageSupport('__custom_write_probe__', '__custom_read_probe__')).toEqual({
      available: true,
      writable: true,
    });
    expect(store.size).toBe(0);

    expect(isQuotaExceededError({ name: 'NS_ERROR_DOM_QUOTA_REACHED' })).toBe(true);
    expect(isQuotaExceededError(new Error('SQLITE_FULL: quota reached'))).toBe(true);
    expect(isQuotaExceededError(new Error('ordinary error'))).toBe(false);

    expect(isIndexedDbBlockedError({ name: 'SecurityError', message: 'blocked' })).toBe(true);
    expect(isIndexedDbBlockedError({ name: 'VersionError', message: 'version mismatch' })).toBe(
      false
    );
    expect(isIndexedDbBlockedError({ name: 'TypeError', message: 'bad arg' })).toBe(false);
  });

  it('encrypts and decrypts text using custom envelope formats and error messages', async () => {
    const encrypted = await encryptTextWithPassphraseGeneric(
      'inventory-ledger-payload-42',
      'obsidian-vault-key',
      {
        format: 'alt-app-env-v2',
        payloadKind: 'workspace-snapshot',
        originalFileName: 'workspace.json',
        iterations: 10_000,
        createdAtIso: '2026-11-27T12:00:00.000Z',
        minPassphraseLength: 6,
      }
    );

    expect(encrypted.format).toBe('alt-app-env-v2');
    expect(encrypted.payloadKind).toBe('workspace-snapshot');

    const decrypted = await decryptTextWithPassphraseGeneric(encrypted, 'obsidian-vault-key', {
      invalidPassphraseMessage: 'Custom mismatch error',
    });
    expect(decrypted).toBe('inventory-ledger-payload-42');

    await expect(
      decryptTextWithPassphraseGeneric(encrypted, 'wrong-secret', {
        invalidPassphraseMessage: 'Custom mismatch error',
      })
    ).rejects.toThrow('Custom mismatch error');
  });

  it('enforces entry and byte caps in BoundedStringLruCache', () => {
    const cache = new BoundedStringLruCache(3, 10);
    cache.set('item-a', '1234');
    cache.set('item-b', '5678');
    expect(cache.size()).toBe(2);
    expect(cache.byteSize()).toBe(8);

    // Touch item-a so item-b becomes least recently used
    expect(cache.get('item-a')).toBe('1234');

    // Adding '9012' pushes total to 12 > 10, evicting item-b
    cache.set('item-c', '9012');
    expect(cache.get('item-b')).toBeUndefined();
    expect(cache.get('item-a')).toBe('1234');
    expect(cache.get('item-c')).toBe('9012');
    expect(cache.byteSize()).toBe(8);
  });

  it('runs cross-tab lock and parameterized commit bus with custom channels', async () => {
    const store = new Map<string, string>();
    const listeners = new Set<(ev: StorageEvent) => void>();
    const fakeStorage = {
      length: 0,
      clear: () => store.clear(),
      key: () => null,
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
        for (const fn of listeners) {
          fn({ key: k, newValue: v } as unknown as StorageEvent);
        }
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    } as Storage;
    vi.stubGlobal('localStorage', fakeStorage);
    vi.stubGlobal('window', {
      addEventListener: (type: string, fn: (ev: StorageEvent) => void) => {
        if (type === 'storage') listeners.add(fn);
      },
      removeEventListener: (type: string, fn: (ev: StorageEvent) => void) => {
        if (type === 'storage') listeners.delete(fn);
      },
    });

    const events: string[] = [];
    const bus = createCrossTabCommitBus({
      channelName: 'alt-app-sync-channel',
      storageKey: 'alt.sync.epoch.v1',
      defaultTabId: 'writer-2',
      getNowIso: () => '2026-11-27T12:34:56.000Z',
    });

    const unsub = bus.subscribe(
      (ev) => {
        events.push(`${ev.epoch}:${ev.reason}:${ev.committedAtIso}`);
      },
      { selfTabId: 'reader-1' }
    );

    await withCrossTabLock('alt-app-lock-1', async () => {
      bus.publish({ epoch: 42, writerTabId: 'writer-2', reason: 'manual-commit' });
    });

    unsub();
    bus.resetForTests();
    expect(events).toEqual(['42:manual-commit:2026-11-27T12:34:56.000Z']);
  });

  it('auto-resumes minor background jobs on foreground return while holding severity jobs', async () => {
    const resumed: string[] = [];
    const err = new BackgroundPausedError('Folder Sync', { checkpointSummary: 'batch 2/5' });
    expect(err.name).toBe('BackgroundPausedError');

    registerPausedBackgroundJob({
      taskId: 'job-minor',
      label: 'Background delta sweep',
      pausedAtMs: 1000,
      severity: 'minor',
      resumeHandler: async () => {
        resumed.push('job-minor');
      },
    });
    registerPausedBackgroundJob({
      taskId: 'job-severity',
      label: 'Quota exhausted export',
      pausedAtMs: 1001,
      severity: 'severity',
      severityReason: 'Insufficient space',
      resumeHandler: async () => {
        resumed.push('job-severity');
      },
    });

    notifyBackgroundTransition('hidden');
    notifyBackgroundTransition('visible');
    await Promise.resolve();

    expect(resumed).toEqual(['job-minor']);
  });
});
