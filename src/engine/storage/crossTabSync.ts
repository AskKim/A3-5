/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Content-Agnostic Cross-Tab Mutex & Commit Event Bus
 * (`@engine/storage/crossTabSync.ts`).
 *
 * Provides FIFO in-tab queueing + `navigator.locks` mutual exclusion with bounded timeout
 * and restricted-browser fallback, plus a parameterized `BroadcastChannel` + `localStorage`
 * commit notification bus with self-tab filtering and epoch deduplication.
 */

import {
  getSafeBroadcastChannelCtor,
  getSafeLocalStorage,
  getSafeWebLocks,
  registerPendingWebLockAbort,
  trackBroadcastChannel,
} from './browserProbes';

const DEFAULT_WEB_LOCK_TIMEOUT_MS = 5000;
const inTabLockQueues = new Map<string, Promise<void>>();

export function generateTabId(prefix = 'tab'): string {
  const c = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  const uuid =
    c && typeof c.randomUUID === 'function'
      ? c.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${uuid}`;
}

export function withCrossTabLock<T>(
  lockName: string,
  task: () => Promise<T>,
  options?: { timeoutMs?: number }
): Promise<T> {
  const prev = inTabLockQueues.get(lockName) ?? Promise.resolve();
  const lockTimeoutMs = Math.max(10, options?.timeoutMs ?? DEFAULT_WEB_LOCK_TIMEOUT_MS);

  const executeWithWebLock = async (): Promise<T> => {
    const locks = getSafeWebLocks();
    if (!locks) {
      return task();
    }

    let callbackEntered = false;
    let timedOutFallback = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let graceTimer: ReturnType<typeof setTimeout> | null = null;
    const controller = typeof AbortController === 'function' ? new AbortController() : null;

    const cleanupTimers = () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      if (graceTimer !== null) {
        clearTimeout(graceTimer);
        graceTimer = null;
      }
    };

    const runWithRequest = async (useSignal: boolean): Promise<T> => {
      return new Promise<T>((resolve, reject) => {
        let settled = false;
        const finishResolve = (val: T) => {
          if (settled) return;
          settled = true;
          cleanupTimers();
          untrackPending();
          resolve(val);
        };
        const finishReject = (err: unknown) => {
          if (settled) return;
          settled = true;
          cleanupTimers();
          untrackPending();
          reject(err);
        };

        const triggerFallback = () => {
          if (settled || callbackEntered) return;
          timedOutFallback = true;
          if (controller && !controller.signal.aborted) {
            try {
              controller.abort();
            } catch {
              // Ignore abort failure
            }
          }
          task().then(finishResolve, finishReject);
        };

        const untrackPending = registerPendingWebLockAbort(() => {
          if (callbackEntered || settled) return;
          if (controller && !controller.signal.aborted) {
            try {
              controller.abort();
            } catch {
              // Ignore abort failure
            }
          }
          graceTimer = setTimeout(triggerFallback, 25);
        });

        timer = setTimeout(triggerFallback, lockTimeoutMs);

        const reqOpts: { mode?: 'exclusive' | 'shared'; signal?: AbortSignal } =
          useSignal && controller
            ? { mode: 'exclusive', signal: controller.signal }
            : { mode: 'exclusive' };

        try {
          const reqPromise = locks.request(lockName, reqOpts, async () => {
            if (timedOutFallback || settled) {
              return undefined as unknown as T;
            }
            callbackEntered = true;
            cleanupTimers();
            untrackPending();
            return await task();
          });

          Promise.resolve(reqPromise).then(
            (val) => {
              if (!timedOutFallback) {
                finishResolve(val);
              }
            },
            (err) => {
              if (timedOutFallback || settled) return;
              if (callbackEntered) {
                finishReject(err);
                return;
              }
              if (useSignal && controller && err instanceof TypeError) {
                cleanupTimers();
                untrackPending();
                runWithRequest(false).then(finishResolve, finishReject);
                return;
              }
              timedOutFallback = true;
              task().then(finishResolve, finishReject);
            }
          );
        } catch (syncErr) {
          if (callbackEntered || timedOutFallback) {
            finishReject(syncErr);
            return;
          }
          if (useSignal && controller && syncErr instanceof TypeError) {
            cleanupTimers();
            untrackPending();
            runWithRequest(false).then(finishResolve, finishReject);
            return;
          }
          timedOutFallback = true;
          task().then(finishResolve, finishReject);
        }
      });
    };

    return runWithRequest(Boolean(controller));
  };

  const run = prev.catch(() => undefined).then(executeWithWebLock);
  const settled = run.then(
    () => undefined,
    () => undefined
  );
  inTabLockQueues.set(lockName, settled);
  return run.finally(() => {
    if (inTabLockQueues.get(lockName) === settled) {
      inTabLockQueues.delete(lockName);
    }
  });
}

export interface CrossTabCommitEvent {
  epoch: number;
  writerTabId: string;
  committedAtIso: string;
  reason?: string;
}

export interface CrossTabCommitBusOptions {
  channelName: string;
  storageKey: string;
  defaultTabId?: string;
  getNowIso?: () => string;
  registerVisibilityReconnect?: (onVisible: () => void) => () => void;
}

export interface CrossTabCommitBus {
  readonly tabId: string;
  publish(params: { epoch: number; writerTabId?: string; reason?: string }): CrossTabCommitEvent;
  subscribe(
    onRemoteCommit: (event: CrossTabCommitEvent) => void,
    options?: { selfTabId?: string }
  ): () => void;
  resetForTests(): void;
}

export function createCrossTabCommitBus(options: CrossTabCommitBusOptions): CrossTabCommitBus {
  const tabId = options.defaultTabId || generateTabId('tab');
  let sharedChannel: BroadcastChannel | null = null;
  let untrackSharedChannel: (() => void) | null = null;

  const getSharedChannel = (): BroadcastChannel | null => {
    const Ctor = getSafeBroadcastChannelCtor();
    if (!Ctor) return null;
    if (!sharedChannel) {
      try {
        const ch = new Ctor(options.channelName);
        sharedChannel = ch;
        untrackSharedChannel = trackBroadcastChannel(ch, () => {
          if (sharedChannel === ch) {
            sharedChannel = null;
            untrackSharedChannel = null;
          }
        });
      } catch {
        return null;
      }
    }
    return sharedChannel;
  };

  const publish = (params: {
    epoch: number;
    writerTabId?: string;
    reason?: string;
  }): CrossTabCommitEvent => {
    const payload: CrossTabCommitEvent = {
      epoch: params.epoch,
      writerTabId: params.writerTabId || tabId,
      committedAtIso: options.getNowIso ? options.getNowIso() : new Date().toISOString(),
      reason: params.reason,
    };
    const ls = getSafeLocalStorage();
    if (ls) {
      try {
        ls.setItem(options.storageKey, JSON.stringify(payload));
      } catch {
        // Non-fatal
      }
    }
    const ch = getSharedChannel();
    if (ch) {
      try {
        ch.postMessage(payload);
      } catch {
        untrackSharedChannel?.();
        untrackSharedChannel = null;
        sharedChannel = null;
      }
    }
    return payload;
  };

  const subscribe = (
    onRemoteCommit: (event: CrossTabCommitEvent) => void,
    subOptions?: { selfTabId?: string }
  ): (() => void) => {
    const selfId = subOptions?.selfTabId || tabId;
    let lastDeliveredEpoch = 0;
    let disposed = false;

    const handleCandidate = (raw: unknown) => {
      if (!raw || typeof raw !== 'object') return;
      const candidate = raw as Partial<CrossTabCommitEvent>;
      const epoch = Number(candidate.epoch);
      const writerTabId = typeof candidate.writerTabId === 'string' ? candidate.writerTabId : '';
      if (!Number.isFinite(epoch) || epoch <= 0 || !writerTabId || writerTabId === selfId) {
        return;
      }
      if (epoch <= lastDeliveredEpoch) return;
      lastDeliveredEpoch = epoch;
      onRemoteCommit({
        epoch,
        writerTabId,
        committedAtIso: String(candidate.committedAtIso || ''),
        reason: typeof candidate.reason === 'string' ? candidate.reason : undefined,
      });
    };

    let bc: BroadcastChannel | null = null;
    let untrackBc: (() => void) | null = null;
    const onBcMessage = (ev: MessageEvent) => {
      handleCandidate(ev.data);
    };

    const openBcChannel = () => {
      if (disposed || bc) return;
      const Ctor = getSafeBroadcastChannelCtor();
      if (!Ctor) return;
      try {
        const channel = new Ctor(options.channelName);
        channel.addEventListener('message', onBcMessage);
        bc = channel;
        untrackBc = trackBroadcastChannel(channel, () => {
          try {
            channel.removeEventListener('message', onBcMessage);
          } catch {
            // Ignore
          }
          if (bc === channel) {
            bc = null;
            untrackBc = null;
          }
        });
      } catch {
        bc = null;
      }
    };

    openBcChannel();

    const unregisterVisibility = options.registerVisibilityReconnect
      ? options.registerVisibilityReconnect(() => {
          openBcChannel();
        })
      : () => {};

    const onStorage = (ev: StorageEvent) => {
      if (ev.key !== options.storageKey || !ev.newValue) return;
      try {
        handleCandidate(JSON.parse(ev.newValue));
      } catch {
        // Ignore malformed storage payload
      }
    };
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('storage', onStorage);
    }

    return () => {
      disposed = true;
      unregisterVisibility();
      untrackBc?.();
      untrackBc = null;
      if (bc) {
        try {
          bc.removeEventListener('message', onBcMessage);
          bc.close();
        } catch {
          // Ignore
        }
        bc = null;
      }
      if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
        window.removeEventListener('storage', onStorage);
      }
    };
  };

  const resetForTests = () => {
    untrackSharedChannel?.();
    untrackSharedChannel = null;
    if (sharedChannel) {
      try {
        sharedChannel.close();
      } catch {
        // Ignore
      }
      sharedChannel = null;
    }
  };

  return {
    tabId,
    publish,
    subscribe,
    resetForTests,
  };
}
