/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * PART 1 — FOR HUMANS: The single place the UI asks for reminders, and the only place the two halves meet.
 * PART 2 — FOR AI / DEVELOPERS:
 *
 * Reminders capability port (`src/app/ports/reminders.tsx`).
 *
 * The schedule rules live in `@features/reminders` and the browser delivery/persistence in
 * `src/storage/reminderScheduler.ts`; neither may import the other (`storage` may not import
 * `@features`). The app layer is the only place allowed to know both, so this port composes them:
 * it builds the schedule from the caller's calendar inputs, then hands the due entries to delivery.
 *
 * Like the other ports this is injectable: the browser implementation is active by default, and a
 * test or alternate shell can swap it with `setRemindersPort` / `resetRemindersPort`.
 */
import { createContext, useContext, type ReactNode } from 'react';
import {
  buildReminderSchedule,
  type ReminderMilestoneInput,
  type ReminderPriority,
  type ReminderScheduleSettings,
  type ReminderSnooze,
  type ReminderTaskInput,
  type ScheduledReminder,
} from '@features/reminders';
import {
  deliverDueReminders,
  getReminderPermissionState,
  loadReminderState,
  requestReminderPermission,
  setRemindersEnabled,
  snoozeReminderEntry,
  type ReminderDeliveryResult,
  type ReminderPermissionState,
  type ReminderPersistedState,
} from '../../storage/reminderScheduler';

export type {
  ReminderDeliveryResult,
  ReminderPersistedState,
  ReminderPermissionState,
  ReminderMilestoneInput,
  ReminderPriority,
  ReminderScheduleSettings,
  ReminderSnooze,
  ReminderTaskInput,
  ScheduledReminder,
};

export interface RunDueRemindersParams {
  nowIso: string;
  settings: ReminderScheduleSettings;
  tasks?: readonly ReminderTaskInput[];
  milestones?: readonly ReminderMilestoneInput[];
  snoozes?: readonly ReminderSnooze[];
}

export interface ReminderRunResult extends ReminderDeliveryResult {
  /** The full schedule that was considered, due or not — useful for a diagnostics view. */
  scheduled: ScheduledReminder[];
}

/** Everything a reminder surface needs, with no storage or feature import on the component side. */
export interface RemindersPort {
  loadState(): ReminderPersistedState;
  getPermission(): ReminderPermissionState;
  requestPermission(): Promise<ReminderPermissionState>;
  setEnabled(enabled: boolean): ReminderPersistedState;
  snooze(key: string, untilIso: string): ReminderPersistedState;
  /** Composes the schedule and delivers everything already due. Never throws. */
  runDue(params: RunDueRemindersParams): Promise<ReminderRunResult>;
}

/** The browser implementation: feature schedule + storage delivery. */
export const browserRemindersPort: RemindersPort = {
  loadState: loadReminderState,
  getPermission: getReminderPermissionState,
  requestPermission: requestReminderPermission,
  setEnabled: setRemindersEnabled,
  snooze: snoozeReminderEntry,
  async runDue(params) {
    const state = loadReminderState();
    const scheduled = buildReminderSchedule({
      nowIso: params.nowIso,
      settings: params.settings,
      tasks: params.tasks,
      milestones: params.milestones,
      snoozes: params.snoozes || state.snoozes,
      watermark: { deliveredKeys: state.deliveredKeys },
    });
    const result = await deliverDueReminders(scheduled, params.nowIso);
    return { ...result, scheduled };
  },
};

let activePort: RemindersPort = browserRemindersPort;

export function getRemindersPort(): RemindersPort {
  return activePort;
}

/** Swaps the port (tests, alternate shells). Returns the previous port for easy restoration. */
export function setRemindersPort(next: RemindersPort): RemindersPort {
  const previous = activePort;
  activePort = next;
  return previous;
}

export function resetRemindersPort(): void {
  activePort = browserRemindersPort;
}

const RemindersPortContext = createContext<RemindersPort | null>(null);

/** Reads the port: an injected provider wins, otherwise the browser implementation is used. */
export function useRemindersPort(): RemindersPort {
  const injected = useContext(RemindersPortContext);
  return injected ?? getRemindersPort();
}

/** Injects a different reminders capability (tests, alternate host shells). */
export function RemindersPortProvider({
  value,
  children,
}: {
  value: RemindersPort;
  children: ReactNode;
}) {
  return <RemindersPortContext.Provider value={value}>{children}</RemindersPortContext.Provider>;
}
