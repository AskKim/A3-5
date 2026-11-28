/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * PART 1 — FOR HUMANS: The front door for the sync and integrity helpers.
 * PART 2 — FOR AI / DEVELOPERS:
 *
 * Modular Core — Pure Sync & Integrity Primitives Barrel (`@engine/sync`).
 *
 * Strictly depends only on `@engine/primitives/*`.
 * Zero DOM globals, zero domain terms, zero feature/app imports.
 */

export * from '../primitives/genericSync';
export * from '../primitives/crypto';
