/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * PART 1 — FOR HUMANS: Lets the app read a scanned paper pedigree into records, with the reading kept out of the screens.
 * PART 2 — FOR AI / DEVELOPERS:
 * Pedigree OCR scanning capability port.
 *
 * The browser implementation stays in `src/storage/pedigreeOcrScanner`; the app layer owns that edge, so UI
 * components depend on this contract instead of importing a storage singleton directly. A host
 * shell or a test can substitute its own implementation at the composition layer without touching
 * the components.
 */
export * from '../../storage/pedigreeOcrScanner';
