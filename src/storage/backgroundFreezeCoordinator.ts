/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * PART 1 — FOR HUMANS: Pauses background work when a phone puts the app aside, and releases it again on return.
 * PART 2 — FOR AI / DEVELOPERS:
 *
 * Mobile Background Freeze Coordinator (`src/storage/backgroundFreezeCoordinator.ts`).
 *
 * Thin compatibility facade delegating cooperative freeze pausing, auto-resume, and
 * handle/lock release to `@engine/storage/lifecycleCoordinator`.
 */

export {
  BackgroundPausedError,
  assertForegroundOrPause,
  checkpointAwareStep,
  clearPausedBackgroundJob,
  getPausedBackgroundJobs,
  isDocumentHidden,
  notifyBackgroundTransition,
  notifyPageHide,
  registerFreezeLifecycleListener,
  registerPausedBackgroundJob,
  resetBackgroundFreezeCoordinatorForTests,
  resumePausedBackgroundJob,
  subscribePausedBackgroundJobs,
  yieldToEventLoop,
  type FreezeLifecycleListener,
  type PausedBackgroundJob,
  type PausedJobsSubscriber,
} from '@engine/storage/lifecycleCoordinator';
