/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * PART 1 — FOR HUMANS: Decides when a new version of the app is applied, and checks for one in the background.
 * PART 2 — FOR AI / DEVELOPERS:
 * PWA update lifecycle capability port.
 *
 * The browser implementation stays in `src/storage/pwaUpdateManager`; the app layer owns that edge, so UI
 * components depend on this contract instead of importing a storage singleton directly. A host
 * shell or a test can substitute its own implementation at the composition layer without touching
 * the components.
 */
export * from '../../storage/pwaUpdateManager';
