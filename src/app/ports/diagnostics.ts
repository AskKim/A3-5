/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Diagnostics capability port.
 *
 * The error boundaries and the async-error toast host reached straight into `src/storage/crashLogger`,
 * `backgroundFreezeCoordinator` and `offThreadWorkerClient`. Error boundaries are class components, so
 * a React context would not reach their render/catch paths; the port is therefore a module-level
 * injectable: the storage implementation is active by default, and a test (or another host shell) can
 * swap in its own with `setDiagnosticsPort` and restore it with `resetDiagnosticsPort`.
 */
import {
  dismissAsyncErrorToast,
  getActiveAsyncErrorToasts,
  getDiagnosticSummary,
  isMemoryLikeError,
  listDiagnosticLogs,
  markCleanSessionExit,
  recordReactCrash,
  subscribeAsyncErrorToasts,
  type AsyncErrorNotice,
  type DiagnosticLogEntry,
  type DiagnosticSummary,
} from '../../storage/crashLogger';
import {
  getPausedBackgroundJobs,
  resumePausedBackgroundJob,
  subscribePausedBackgroundJobs,
  type PausedBackgroundJob,
} from '../../storage/backgroundFreezeCoordinator';
import { buildSupportBundleZipOffThread } from '../../storage/offThreadWorkerClient';

export type {
  AsyncErrorNotice,
  DiagnosticLogEntry,
  DiagnosticSummary,
  PausedBackgroundJob,
};

/** Everything the crash surfaces need to log, summarise, export and dismiss. */
export interface DiagnosticsPort {
  recordReactCrash: typeof recordReactCrash;
  listDiagnosticLogs: typeof listDiagnosticLogs;
  getDiagnosticSummary: typeof getDiagnosticSummary;
  isMemoryLikeError: typeof isMemoryLikeError;
  markCleanSessionExit: typeof markCleanSessionExit;
  getActiveAsyncErrorToasts: typeof getActiveAsyncErrorToasts;
  dismissAsyncErrorToast: typeof dismissAsyncErrorToast;
  subscribeAsyncErrorToasts: typeof subscribeAsyncErrorToasts;
  getPausedBackgroundJobs: typeof getPausedBackgroundJobs;
  resumePausedBackgroundJob: typeof resumePausedBackgroundJob;
  subscribePausedBackgroundJobs: typeof subscribePausedBackgroundJobs;
  buildSupportBundleZipOffThread: typeof buildSupportBundleZipOffThread;
}

/** The browser implementation over the real offline log and freeze-coordinator stores. */
export const browserDiagnosticsPort: DiagnosticsPort = {
  recordReactCrash,
  listDiagnosticLogs,
  getDiagnosticSummary,
  isMemoryLikeError,
  markCleanSessionExit,
  getActiveAsyncErrorToasts,
  dismissAsyncErrorToast,
  subscribeAsyncErrorToasts,
  getPausedBackgroundJobs,
  resumePausedBackgroundJob,
  subscribePausedBackgroundJobs,
  buildSupportBundleZipOffThread,
};

let activePort: DiagnosticsPort = browserDiagnosticsPort;

export function getDiagnosticsPort(): DiagnosticsPort {
  return activePort;
}

/** Swaps the port (tests, alternate shells). Returns the previous port for easy restoration. */
export function setDiagnosticsPort(next: DiagnosticsPort): DiagnosticsPort {
  const previous = activePort;
  activePort = next;
  return previous;
}

export function resetDiagnosticsPort(): void {
  activePort = browserDiagnosticsPort;
}
