/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * PART 1 — FOR HUMANS: Releases memory and background work when the app is hidden or the device is low, so a phone does not kill it.
 * PART 2 — FOR AI / DEVELOPERS:
 *
 * Content-Agnostic Background Freeze & Resource Release Coordinator
 * (`@engine/storage/lifecycleCoordinator.ts`).
 *
 * Integrates with `visibilitychange` / `pagehide` dispatchers to pause background tasks,
 * auto-resume clean pauses on foreground return, escalate severity issues, and flush or
 * release OPFS handles, IDB connections/transactions, BroadcastChannels, and Web Locks.
 */

import {
  abortPendingWebLocks,
  hasActiveForegroundTransferLease,
  releaseOpenBroadcastChannels,
  releaseOpenIdbResources,
  resetForegroundTransferLeasesForTests,
} from './browserProbes';
import { flushActiveOpfsHandles, releaseActiveOpfsHandles } from './opfsStream';

export class BackgroundPausedError extends Error {
  readonly taskName: string;
  readonly severityIssue: string | null;
  readonly checkpointSummary: string | null;

  constructor(
    taskName: string,
    options?: {
      severityIssue?: string | null;
      checkpointSummary?: string | null;
    }
  ) {
    const severityIssue = options?.severityIssue || null;
    const checkpointSummary = options?.checkpointSummary || null;
    super(
      severityIssue
        ? `${taskName} paused: ${severityIssue}`
        : `${taskName} paused safely when app moved to background.`
    );
    this.name = 'BackgroundPausedError';
    this.taskName = taskName;
    this.severityIssue = severityIssue;
    this.checkpointSummary = checkpointSummary;
  }
}

export interface FreezeLifecycleListener {
  id: string;
  onHidden?: () => void | Promise<void>;
  onVisible?: () => void | Promise<void>;
  onReleaseResources?: (reason: 'hidden' | 'pagehide') => void | Promise<void>;
}

export interface PausedBackgroundJob {
  taskId: string;
  label: string;
  pausedAtMs: number;
  severity: 'minor' | 'severity';
  severityReason?: string;
  resumeHandler?: () => void | Promise<void>;
}

export type PausedJobsSubscriber = (jobs: PausedBackgroundJob[]) => void;

const lifecycleListeners = new Map<string, FreezeLifecycleListener>();
const pausedJobs = new Map<string, PausedBackgroundJob>();
const pausedJobSubscribers = new Set<PausedJobsSubscriber>();

function readInitialVisibilityState(): 'visible' | 'hidden' {
  try {
    return typeof document !== 'undefined' && document.visibilityState === 'hidden'
      ? 'hidden'
      : 'visible';
  } catch {
    return 'visible';
  }
}

let lastVisibilityState: 'visible' | 'hidden' = readInitialVisibilityState();

function emitPausedJobs(): void {
  const snapshot = Array.from(pausedJobs.values());
  for (const sub of pausedJobSubscribers) {
    try {
      sub(snapshot);
    } catch {
      // Never allow subscriber failure to disrupt lifecycle handling
    }
  }
}

export function isDocumentHidden(docOverride?: { visibilityState?: string }): boolean {
  try {
    const target = docOverride ?? (typeof document !== 'undefined' ? document : undefined);
    return Boolean(target && target.visibilityState === 'hidden');
  } catch {
    return false;
  }
}

export function assertForegroundOrPause(
  taskName: string,
  checkpointSummary?: string | null,
  docOverride?: { visibilityState?: string }
): void {
  if (isDocumentHidden(docOverride)) {
    throw new BackgroundPausedError(taskName, {
      checkpointSummary: checkpointSummary ?? null,
    });
  }
}

export function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

export async function checkpointAwareStep(
  taskName: string,
  checkpointSummary?: string | null,
  docOverride?: { visibilityState?: string }
): Promise<void> {
  assertForegroundOrPause(taskName, checkpointSummary, docOverride);
  await yieldToEventLoop();
  assertForegroundOrPause(taskName, checkpointSummary, docOverride);
}

export function registerFreezeLifecycleListener(listener: FreezeLifecycleListener): () => void {
  lifecycleListeners.set(listener.id, listener);
  return () => {
    lifecycleListeners.delete(listener.id);
  };
}

export function registerPausedBackgroundJob(job: PausedBackgroundJob): void {
  pausedJobs.set(job.taskId, job);
  emitPausedJobs();
}

export function clearPausedBackgroundJob(taskId: string): void {
  if (pausedJobs.delete(taskId)) {
    emitPausedJobs();
  }
}

export function getPausedBackgroundJobs(): PausedBackgroundJob[] {
  return Array.from(pausedJobs.values());
}

export function subscribePausedBackgroundJobs(cb: PausedJobsSubscriber): () => void {
  pausedJobSubscribers.add(cb);
  try {
    cb(getPausedBackgroundJobs());
  } catch {
    // Ignore initial emit error
  }
  return () => {
    pausedJobSubscribers.delete(cb);
  };
}

export async function resumePausedBackgroundJob(taskId: string): Promise<boolean> {
  const job = pausedJobs.get(taskId);
  if (!job) return false;
  pausedJobs.delete(taskId);
  emitPausedJobs();
  if (job.resumeHandler) {
    await job.resumeHandler();
  }
  return true;
}

function emitReleaseResources(reason: 'hidden' | 'pagehide'): void {
  const deferActiveHandles = reason === 'hidden' && hasActiveForegroundTransferLease();

  if (!deferActiveHandles) {
    try {
      abortPendingWebLocks();
    } catch {
      // Non-fatal
    }
    try {
      releaseOpenIdbResources();
    } catch {
      // Non-fatal
    }
    try {
      releaseOpenBroadcastChannels();
    } catch {
      // Non-fatal
    }
  }

  try {
    if (deferActiveHandles) {
      void flushActiveOpfsHandles().catch(() => {});
    } else {
      void releaseActiveOpfsHandles().catch(() => {});
    }
  } catch {
    // Non-fatal
  }

  const listeners = Array.from(lifecycleListeners.values());
  for (const listener of listeners) {
    if (typeof listener.onReleaseResources === 'function') {
      try {
        void Promise.resolve(listener.onReleaseResources(reason)).catch(() => {});
      } catch {
        // Non-fatal resource release failure
      }
    }
  }
}

function applyBackgroundTransition(
  nextState: 'hidden' | 'visible',
  releaseReason: 'hidden' | 'pagehide'
): void {
  if (nextState === 'hidden') {
    emitReleaseResources(releaseReason);
  }

  if (nextState === lastVisibilityState && nextState === 'hidden') {
    return;
  }
  lastVisibilityState = nextState;

  const listeners = Array.from(lifecycleListeners.values());
  if (nextState === 'hidden') {
    for (const listener of listeners) {
      if (typeof listener.onHidden === 'function') {
        try {
          void Promise.resolve(listener.onHidden()).catch(() => {});
        } catch {
          // Non-fatal
        }
      }
    }
    return;
  }

  for (const listener of listeners) {
    if (typeof listener.onVisible === 'function') {
      try {
        void Promise.resolve(listener.onVisible()).catch(() => {});
      } catch {
        // Non-fatal
      }
    }
  }

  const jobsSnapshot = Array.from(pausedJobs.values());
  let removedAny = false;
  for (const job of jobsSnapshot) {
    if (job.severity === 'minor' && job.resumeHandler) {
      pausedJobs.delete(job.taskId);
      removedAny = true;
      try {
        void Promise.resolve(job.resumeHandler()).catch(() => {});
      } catch {
        // Handler reports its own errors
      }
    }
  }
  if (removedAny) {
    emitPausedJobs();
  }
}

export function notifyBackgroundTransition(nextState: 'hidden' | 'visible'): void {
  applyBackgroundTransition(nextState, 'hidden');
}

export function notifyPageHide(): void {
  applyBackgroundTransition('hidden', 'pagehide');
}

export function resetBackgroundFreezeCoordinatorForTests(): void {
  lifecycleListeners.clear();
  pausedJobs.clear();
  pausedJobSubscribers.clear();
  resetForegroundTransferLeasesForTests();
  lastVisibilityState = 'visible';
}
