/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * PART 1 — FOR HUMANS: Asks the browser to keep the app data, notices when you go offline, and tracks whether the app is installed.
 * PART 2 — FOR AI / DEVELOPERS:
 * Persistent-storage, connectivity and PWA install capability port.
 *
 * The browser implementation stays in `src/storage/storageProtection`; the app layer owns that edge, so UI
 * components depend on this contract instead of importing a storage singleton directly. A host
 * shell or a test can substitute its own implementation at the composition layer without touching
 * the components.
 */
export * from '../../storage/storageProtection';
