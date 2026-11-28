/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * PART 1 — FOR HUMANS: The connection the app uses to tell other open tabs that something has changed.
 * PART 2 — FOR AI / DEVELOPERS:
 * Cross-tab/local sync channel capability port.
 *
 * The browser implementation stays in `src/storage/localSyncChannels`; the app layer owns that edge, so UI
 * components depend on this contract instead of importing a storage singleton directly. A host
 * shell or a test can substitute its own implementation at the composition layer without touching
 * the components.
 */
export * from '../../storage/localSyncChannels';
