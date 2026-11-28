/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * PART 1 — FOR HUMANS: Points the app at your folder of vet documents, and remembers those files are not in the backup.
 * PART 2 — FOR AI / DEVELOPERS:
 * Veterinary document folder capability port.
 *
 * The browser implementation stays in `src/storage/vetDocsFolder`; the app layer owns that edge, so UI
 * components depend on this contract instead of importing a storage singleton directly. A host
 * shell or a test can substitute its own implementation at the composition layer without touching
 * the components.
 */
export * from '../../storage/vetDocsFolder';
