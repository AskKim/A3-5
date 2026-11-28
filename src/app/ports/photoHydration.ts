/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * PART 1 — FOR HUMANS: Loads a photo at full size only when it is opened, instead of holding them all in memory.
 * PART 2 — FOR AI / DEVELOPERS:
 * Photo blob hydration and data-url normalisation capability port.
 *
 * The browser implementation stays in `src/storage/photoHydration`; the app layer owns that edge, so UI
 * components depend on this contract instead of importing a storage singleton directly. A host
 * shell or a test can substitute its own implementation at the composition layer without touching
 * the components.
 */
export * from '../../storage/photoHydration';
