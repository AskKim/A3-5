/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * PART 1 — FOR HUMANS: The front door for on-device reminders.
 * PART 2 — FOR AI / DEVELOPERS:
 *
 * Reminders Feature Barrel (`@features/reminders`). Pure scheduling only: delivery lives in
 * `src/storage/reminderScheduler.ts`, permissions and UI in `src/app/ports/reminders.tsx`.
 */

export * from './reminderSchedule';
