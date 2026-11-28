/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * PART 1 — FOR HUMANS: Stores reminder opt-in, shows the notifications, and remembers what was already shown.
 * PART 2 — FOR AI / DEVELOPERS:
 *
 * Web reminder delivery (`src/storage/reminderScheduler.ts`).
 *
 * Owns the persisted opt-in/permission state machine and the only browser delivery call in the app
 * (`ServiceWorkerRegistration.showNotification`). It deliberately knows nothing about the schedule
 * rules: callers hand it ready-made entries, because `src/storage` may not import `@features/*`.
 *
 * Rules:
 * - Denied/unsupported permission is a silent no-op, never an error path.
 * - A delivered key is recorded so a reopened tab cannot fire the same reminder twice.
 * - A frozen (backgrounded) document delivers nothing; the service worker or the next resume owns it.
 * - The delivered-key ring is capped so `localStorage` cannot grow without bound.
 */

export type ReminderPermissionState = 'unsupported' | 'default' | 'granted' | 'denied';

/** One reminder to display. A structural shape, not a feature-layer import (layering rule). */
export interface ReminderDeliveryEntry {
  key: string;
  title: string;
  detail: string;
  fireAtIso: string;
}

export interface ReminderSnoozeEntry {
  key: string;
  untilIso: string;
}

export interface ReminderPersistedState {
  enabled: boolean;
  snoozes: ReminderSnoozeEntry[];
  deliveredKeys: string[];
  lastRunIso?: string;
}

export interface ReminderDeliveryResult {
  delivered: string[];
  /** Entries that were due but intentionally not shown (permission, freeze or already delivered). */
  skipped: number;
  permission: ReminderPermissionState;
}

const STORAGE_KEY = 'pedigree.reminders.v1';
const MAX_DELIVERED_KEYS = 200;

const EMPTY_STATE: ReminderPersistedState = {
  enabled: false,
  snoozes: [],
  deliveredKeys: [],
};

function storageOrNull(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

function safeParse(raw: string | null): ReminderPersistedState {
  if (!raw) return { ...EMPTY_STATE };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { ...EMPTY_STATE };
    const record = parsed as Record<string, unknown>;
    const snoozes = Array.isArray(record.snoozes)
      ? record.snoozes.filter(
          (entry): entry is ReminderSnoozeEntry =>
            !!entry &&
            typeof entry === 'object' &&
            typeof (entry as ReminderSnoozeEntry).key === 'string' &&
            typeof (entry as ReminderSnoozeEntry).untilIso === 'string'
        )
      : [];
    const deliveredKeys = Array.isArray(record.deliveredKeys)
      ? record.deliveredKeys.filter((key): key is string => typeof key === 'string')
      : [];
    return {
      enabled: record.enabled === true,
      snoozes,
      deliveredKeys,
      lastRunIso: typeof record.lastRunIso === 'string' ? record.lastRunIso : undefined,
    };
  } catch {
    return { ...EMPTY_STATE };
  }
}

/** Reads the persisted reminder state, falling back to defaults on any malformed value. */
export function loadReminderState(): ReminderPersistedState {
  const storage = storageOrNull();
  if (!storage) return { ...EMPTY_STATE };
  try {
    return safeParse(storage.getItem(STORAGE_KEY));
  } catch {
    return { ...EMPTY_STATE };
  }
}

function persist(state: ReminderPersistedState): ReminderPersistedState {
  const storage = storageOrNull();
  if (storage) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Quota/private mode: delivery still works for this session, persistence is best effort.
    }
  }
  return state;
}

/** Patch helper that never drops the parts of the state the caller did not touch. */
export function saveReminderState(patch: Partial<ReminderPersistedState>): ReminderPersistedState {
  const current = loadReminderState();
  return persist({ ...current, ...patch });
}

/** Current browser permission, cached state ignored on purpose so the OS stays the source of truth. */
export function getReminderPermissionState(): ReminderPermissionState {
  if (typeof Notification === 'undefined') return 'unsupported';
  const permission = Notification.permission;
  return permission === 'granted' || permission === 'denied' ? permission : 'default';
}

/** Asks the OS once; an unsupported or already-decided host resolves without prompting. */
export async function requestReminderPermission(): Promise<ReminderPermissionState> {
  if (typeof Notification === 'undefined') return 'unsupported';
  const current = getReminderPermissionState();
  if (current === 'granted' || current === 'denied') return current;
  try {
    const next = await Notification.requestPermission();
    return next === 'granted' || next === 'denied' ? next : 'default';
  } catch {
    return 'default';
  }
}

/** Turns reminders on/off without forgetting what was already delivered. */
export function setRemindersEnabled(enabled: boolean): ReminderPersistedState {
  return saveReminderState({ enabled });
}

/** Snoozes one reminder until an explicit instant; replaces an earlier snooze for the same key. */
export function snoozeReminderEntry(key: string, untilIso: string): ReminderPersistedState {
  if (!key || !Number.isFinite(Date.parse(untilIso))) return loadReminderState();
  const state = loadReminderState();
  const snoozes = state.snoozes.filter((entry) => entry.key !== key);
  snoozes.push({ key, untilIso });
  return persist({ ...state, snoozes });
}

function isFrozen(): boolean {
  try {
    return typeof document !== 'undefined' && document.visibilityState === 'hidden';
  } catch {
    return false;
  }
}

async function serviceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  try {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
    const container = navigator.serviceWorker as ServiceWorkerContainer | undefined;
    if (!container || typeof container.ready === 'undefined') return null;
    return await container.ready;
  } catch {
    return null;
  }
}

function capDelivered(keys: string[]): string[] {
  return keys.length > MAX_DELIVERED_KEYS ? keys.slice(keys.length - MAX_DELIVERED_KEYS) : keys;
}

/**
 * Shows every entry that is due (fire time at or before `nowIso`) and not yet delivered.
 *
 * Never throws: a browser without notifications, a denied permission, a frozen document or a
 * failing `showNotification` all resolve to a result the caller can log.
 */
export async function deliverDueReminders(
  entries: readonly ReminderDeliveryEntry[],
  nowIso: string
): Promise<ReminderDeliveryResult> {
  const nowMs = Date.parse(nowIso);
  const permission = getReminderPermissionState();
  if (!Number.isFinite(nowMs) || entries.length === 0) {
    return { delivered: [], skipped: 0, permission };
  }

  const state = loadReminderState();
  const delivered = new Set(state.deliveredKeys);
  const due = entries.filter((entry) => {
    const fireMs = Date.parse(entry.fireAtIso);
    return Number.isFinite(fireMs) && fireMs <= nowMs && !delivered.has(entry.key);
  });
  if (due.length === 0) return { delivered: [], skipped: 0, permission };

  if (permission !== 'granted' || !state.enabled || isFrozen()) {
    return { delivered: [], skipped: due.length, permission };
  }

  const registration = await serviceWorkerRegistration();
  if (!registration || typeof registration.showNotification !== 'function') {
    return { delivered: [], skipped: due.length, permission };
  }

  const shown: string[] = [];
  for (const entry of due) {
    try {
      await registration.showNotification(entry.title, {
        body: entry.detail,
        tag: entry.key,
        data: { key: entry.key, fireAtIso: entry.fireAtIso },
      });
      shown.push(entry.key);
    } catch {
      // One failing notification must not block the rest of the batch.
    }
  }

  if (shown.length > 0) {
    persist({
      ...state,
      deliveredKeys: capDelivered([...state.deliveredKeys, ...shown]),
      lastRunIso: nowIso,
    });
  }

  return { delivered: shown, skipped: due.length - shown.length, permission };
}

/** Clears the persisted state. Tests only. */
export function resetReminderSchedulerForTests(): void {
  const storage = storageOrNull();
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
