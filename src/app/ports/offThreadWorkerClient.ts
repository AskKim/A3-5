/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * PART 1 — FOR HUMANS: Lets the app hand heavy work to a background worker, so the screen does not freeze.
 * PART 2 — FOR AI / DEVELOPERS:
 * Off-main-thread worker capability port.
 *
 * The browser implementation stays in `src/storage/offThreadWorkerClient`; the app layer owns that edge, so UI
 * components depend on this contract instead of importing a storage singleton directly. A host
 * shell or a test can substitute its own implementation at the composition layer without touching
 * the components.
 */
export * from '../../storage/offThreadWorkerClient';
