/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * PART 1 — FOR HUMANS: Runs upkeep on the local database, such as compacting it, from outside the screens.
 * PART 2 — FOR AI / DEVELOPERS:
 * Web SQLite maintenance capability port.
 *
 * The browser implementation stays in `src/storage/webSqliteAdapter`; the app layer owns that edge,
 * so UI components depend on this contract instead of importing the adapter directly. A host shell
 * or a test can substitute its own implementation at the composition layer without touching the
 * components.
 */
export { purgeStaleBrowserCaches } from '../../storage/webSqliteAdapter';
