/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * PART 1 — FOR HUMANS: Decides which reminders should be delivered, and when.
 * PART 2 — FOR AI / DEVELOPERS:
 *
 * Pure reminder schedule builder. It takes the already-computed calendar output — dated tasks and
 * milestone offsets — and produces the ordered list of reminders that are due within a horizon,
 * minus anything already delivered (watermark) and with active snoozes pushed to their wake time.
 *
 * Deliberately free of React, storage, DOM globals and domain vocabulary: the caller supplies the
 * calendar terms (species-adjusted offsets, titles) and the delivery layer turns each entry into a
 * notification. That keeps every biological rule in the domain/app layers where it is tested, and
 * keeps this module usable from a service worker, a native bridge or a plain test.
 */

export type ReminderPriority = 'low' | 'normal' | 'high';

const PRIORITY_RANK: Record<ReminderPriority, number> = { high: 0, normal: 1, low: 2 };

/** A dated item from the calendar the caller wants to be reminded about. */
export interface ReminderTaskInput {
  id: string;
  title: string;
  /** Calendar day the item is due, `YYYY-MM-DD`. Invalid or empty values are ignored. */
  dueDateIso: string;
  completed: boolean;
  priority?: ReminderPriority;
  detail?: string;
  /** Extra reminders this many days *before* the due date (0 is the due date itself). */
  leadDays?: readonly number[];
}

/**
 * A milestone measured as an offset from an anchor date, e.g. the day-14/28/31/42 marks after an
 * event. The caller has already applied any species variance to `offsetDays`.
 */
export interface ReminderMilestoneInput {
  id: string;
  anchorDateIso: string;
  offsetDays: number;
  title: string;
  detail?: string;
  priority?: ReminderPriority;
  /** Extra reminders this many days before the milestone date. */
  leadDays?: readonly number[];
}

export interface ReminderScheduleSettings {
  /** Hour of day (0–23, UTC) the reminder fires on its calendar day. */
  fireHour: number;
  /** How many days ahead of `nowIso` the schedule is materialised. */
  horizonDays: number;
  /** How many days behind `nowIso` a missed reminder still fires; later ones are dropped. */
  graceDays?: number;
  /** Default lead reminders for tasks that do not set their own. */
  defaultLeadDays?: readonly number[];
}

/** Keys already delivered; a delivered reminder is never emitted again. */
export interface ReminderWatermark {
  deliveredKeys: readonly string[];
}

/** A snoozed reminder fires at `untilIso` instead of its original time, keeping its key. */
export interface ReminderSnooze {
  key: string;
  untilIso: string;
}

export interface ScheduledReminder {
  /** Stable identity: `<sourceId>@<reminderDateIso>#<leadDays>`. */
  key: string;
  sourceId: string;
  title: string;
  detail: string;
  /** Calendar day the reminder belongs to — the due/milestone day or its lead offset. */
  reminderDateIso: string;
  /** Instant the delivery layer should fire at, ISO-8601 UTC. */
  fireAtIso: string;
  priority: ReminderPriority;
}

export interface BuildReminderScheduleParams {
  nowIso: string;
  tasks?: readonly ReminderTaskInput[];
  milestones?: readonly ReminderMilestoneInput[];
  settings: ReminderScheduleSettings;
  watermark?: ReminderWatermark;
  snoozes?: readonly ReminderSnooze[];
}

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

interface YmdParts {
  year: number;
  month: number;
  day: number;
}

/** Parses `YYYY-MM-DD` and rejects impossible days (2026-02-30, month 13, …). */
export function parseReminderYmd(iso: string | undefined): YmdParts | null {
  if (!iso) return null;
  const match = YMD_RE.exec(iso);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) {
    return null;
  }
  return { year, month, day };
}

/** Adds whole days to a calendar date using explicit UTC arithmetic (no millisecond drift). */
export function addReminderDaysIso(iso: string, days: number): string | null {
  const parts = parseReminderYmd(iso);
  if (!parts || !Number.isFinite(days)) return null;
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return formatReminderYmd(shifted);
}

function formatReminderYmd(date: Date): string {
  const year = String(date.getUTCFullYear()).padStart(4, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function fireInstant(dateIso: string, fireHour: number): string | null {
  const parts = parseReminderYmd(dateIso);
  if (!parts) return null;
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, fireHour, 0, 0, 0)).toISOString();
}

function normalisePriority(priority: ReminderPriority | undefined): ReminderPriority {
  return priority === 'high' || priority === 'low' ? priority : 'normal';
}

/**
 * Lead reminders are *additional* to the reminder on the day itself, so 0 is always included and
 * the result is deduplicated and sorted earliest-first.
 */
function uniqueLeadDays(leadDays: readonly number[] | undefined): number[] {
  const seen = new Set<number>([0]);
  const out: number[] = [0];
  for (const lead of leadDays || []) {
    if (!Number.isInteger(lead) || lead <= 0 || seen.has(lead)) continue;
    seen.add(lead);
    out.push(lead);
  }
  return out.sort((a, b) => b - a);
}

interface Candidate {
  entry: ScheduledReminder;
}

function buildCandidate(
  params: {
    sourceId: string;
    title: string;
    detail: string;
    baseDateIso: string;
    leadDays: number;
    priority: ReminderPriority;
    fireHour: number;
  }
): Candidate | null {
  const reminderDateIso =
    params.leadDays === 0
      ? params.baseDateIso
      : addReminderDaysIso(params.baseDateIso, -params.leadDays);
  if (!reminderDateIso) return null;
  const fireAtIso = fireInstant(reminderDateIso, params.fireHour);
  if (!fireAtIso) return null;
  return {
    entry: {
      key: `${params.sourceId}@${reminderDateIso}#${params.leadDays}`,
      sourceId: params.sourceId,
      title: params.title,
      detail: params.detail,
      reminderDateIso,
      fireAtIso,
      priority: params.priority,
    },
  };
}

/**
 * Builds the ordered reminder list for the delivery layer.
 *
 * Ordering is deterministic: fire time, then priority (high first), then title, then key — so the
 * same inputs always produce the same schedule for tests and for cross-tab election.
 */
export function buildReminderSchedule(params: BuildReminderScheduleParams): ScheduledReminder[] {
  const { nowIso, settings } = params;
  const nowMs = Date.parse(nowIso);
  if (!Number.isFinite(nowMs)) return [];
  if (settings.fireHour < 0 || settings.fireHour > 23 || !Number.isInteger(settings.fireHour)) {
    return [];
  }
  const horizonDays = Number.isFinite(settings.horizonDays) ? Math.max(0, settings.horizonDays) : 0;
  const graceDays = Number.isFinite(settings.graceDays as number)
    ? Math.max(0, settings.graceDays as number)
    : 0;

  const delivered = new Set(params.watermark?.deliveredKeys || []);
  const snoozeUntil = new Map<string, number>();
  for (const snooze of params.snoozes || []) {
    const until = Date.parse(snooze.untilIso);
    if (snooze.key && Number.isFinite(until)) snoozeUntil.set(snooze.key, until);
  }

  const candidates: ScheduledReminder[] = [];
  const seen = new Set<string>();
  const push = (candidate: Candidate | null) => {
    if (!candidate) return;
    const { entry } = candidate;
    if (seen.has(entry.key) || delivered.has(entry.key)) return;
    seen.add(entry.key);
    candidates.push(entry);
  };

  const defaultLeadDays = uniqueLeadDays(settings.defaultLeadDays);

  for (const task of params.tasks || []) {
    if (task.completed) continue;
    const base = parseReminderYmd(task.dueDateIso);
    if (!base) continue;
    const leadDays = uniqueLeadDays(task.leadDays || defaultLeadDays);
    for (const lead of leadDays) {
      push(
        buildCandidate({
          sourceId: task.id,
          title: task.title,
          detail: task.detail || '',
          baseDateIso: task.dueDateIso,
          leadDays: lead,
          priority: normalisePriority(task.priority),
          fireHour: settings.fireHour,
        })
      );
    }
  }

  for (const milestone of params.milestones || []) {
    const milestoneDateIso = addReminderDaysIso(milestone.anchorDateIso, milestone.offsetDays);
    if (!milestoneDateIso) continue;
    const leadDays = uniqueLeadDays(milestone.leadDays);
    for (const lead of leadDays) {
      push(
        buildCandidate({
          sourceId: milestone.id,
          title: milestone.title,
          detail: milestone.detail || '',
          baseDateIso: milestoneDateIso,
          leadDays: lead,
          priority: normalisePriority(milestone.priority),
          fireHour: settings.fireHour,
        })
      );
    }
  }

  const horizonEndMs = nowMs + horizonDays * DAY_MS;
  const graceStartMs = nowMs - graceDays * DAY_MS;

  const scheduled: ScheduledReminder[] = [];
  for (const entry of candidates) {
    const snoozedUntilMs = snoozeUntil.get(entry.key);
    const originalMs = Date.parse(entry.fireAtIso);
    if (!Number.isFinite(originalMs)) continue;
    if (originalMs < graceStartMs || originalMs > horizonEndMs) {
      // A snoozed reminder is judged by its wake time, not its original slot.
      if (snoozedUntilMs === undefined) continue;
      if (snoozedUntilMs < graceStartMs || snoozedUntilMs > horizonEndMs) continue;
    }
    const fireAtMs =
      snoozedUntilMs !== undefined && snoozedUntilMs > originalMs ? snoozedUntilMs : originalMs;
    scheduled.push({
      ...entry,
      fireAtIso: new Date(fireAtMs).toISOString(),
    });
  }

  return scheduled.sort((a, b) => {
    if (a.fireAtIso !== b.fireAtIso) return a.fireAtIso < b.fireAtIso ? -1 : 1;
    const rank = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (rank !== 0) return rank;
    if (a.title !== b.title) return a.title < b.title ? -1 : 1;
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  });
}
