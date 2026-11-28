// @vitest-environment jsdom
/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * The Gantt scheduler had no mounted coverage at all: it is the only surface where a breeder drags
 * chores on a timeline, nudges due dates, applies smart escalations and reconciles a LAN outbox.
 * These tests mount the real component against the predefined sample barn so that grid, inspector,
 * escalation banner and reconciliation drawer actually run.
 */

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BarnSchedulerGantt } from '../BarnSchedulerGantt';
import { addDaysIso, todayDateIso } from '../../domain/models';
import type {
  BarnDatabaseSnapshot,
  BarnSettings,
  BarnTask,
  BreedingRecord,
  SpeciesProfile,
} from '../../domain/models';
import type { SyncConflictEntry, SyncOperation } from '../../domain/syncOutbox';
import type { P2pReconciliationSummary } from '../../domain/p2pSyncProtocol';
import { createP2pDeltaWireMessage } from '../../domain/p2pSyncProtocol';
import { buildFullPredefinedSampleSnapshot } from '../../domain/sampleData';

const snapshot: BarnDatabaseSnapshot = buildFullPredefinedSampleSnapshot();
const speciesProfile: SpeciesProfile = snapshot.speciesProfiles[0];
const settings: BarnSettings = snapshot.settings;
const animals = snapshot.animals.filter((a) => a.species === speciesProfile.name);
const breedings: BreedingRecord[] = snapshot.breedings.filter(
  (b) => b.species === speciesProfile.name
);
const sampleTasks: BarnTask[] = snapshot.tasks.filter((t) => t.species === speciesProfile.name);

/**
 * A clone of a real sample chore, made Low-priority and five days late so the scheduler bumps it to
 * High (nestbox work in a critical window) and the escalation banner actually appears.
 */
function overdueTask(): BarnTask {
  return {
    ...sampleTasks[0],
    id: 'gantt-overdue-task',
    category: 'Nestbox',
    priority: 'Low',
    completed: false,
    dueDateIso: addDaysIso(todayDateIso(), -5),
    startDateIso: undefined,
  };
}

const openConflict: SyncConflictEntry = {
  conflict_id: 'conflict-1',
  entity_type: 'task',
  entity_uuid: sampleTasks[0].id,
  entity_label: 'Nestbox check',
  field_name: 'due_date_iso',
  winning_value: '2026-11-20',
  winning_device_id: 'device-a',
  winning_timestamp: '2026-11-20T10:00:00.000Z',
  losing_value: '2026-11-22',
  losing_device_id: 'device-b',
  losing_timestamp: '2026-11-22T10:00:00.000Z',
  detected_at: '2026-11-23T09:00:00.000Z',
  resolved: false,
};

const reconcileSummary: P2pReconciliationSummary = {
  peerDeviceId: 'peer-9',
  receivedOpsCount: 3,
  appliedOpCount: 2,
  taskOpsReceivedCount: 1,
  newConflictCount: 0,
  newTaskConflictCount: 0,
  reconciledAtIso: '2026-11-28T12:00:00.000Z',
};

interface GanttHandlers {
  onRescheduleTask: (
    task: BarnTask,
    nextDates: { startDateIso?: string; dueDateIso: string }
  ) => Promise<boolean>;
  onToggleTask: (task: BarnTask) => Promise<boolean | void> | void;
  onApplySmartEscalations: (tasksToEscalate?: BarnTask[]) => Promise<number>;
  onReconcileOutboxOps: (
    incomingOps: SyncOperation[],
    peerDeviceId?: string
  ) => Promise<P2pReconciliationSummary>;
  onResolveSyncConflict: (conflictId: string, useSide: 'winning' | 'losing') => Promise<void>;
  onDismissSyncConflict: (conflictId: string) => Promise<void>;
  onDeleteTask: (taskId: string) => void;
  onOpenAnimal: (animalId: string) => void;
}

function renderGantt(
  overrides: Partial<GanttHandlers> & { tasks?: BarnTask[]; syncConflicts?: SyncConflictEntry[] } = {}
) {
  const handlers: GanttHandlers = {
    onRescheduleTask: overrides.onRescheduleTask ?? vi.fn(async () => true),
    onToggleTask: overrides.onToggleTask ?? vi.fn(async () => true),
    onApplySmartEscalations: overrides.onApplySmartEscalations ?? vi.fn(async () => 1),
    onReconcileOutboxOps: overrides.onReconcileOutboxOps ?? vi.fn(async () => reconcileSummary),
    onResolveSyncConflict: overrides.onResolveSyncConflict ?? vi.fn(async () => undefined),
    onDismissSyncConflict: overrides.onDismissSyncConflict ?? vi.fn(async () => undefined),
    onDeleteTask: overrides.onDeleteTask ?? vi.fn(),
    onOpenAnimal: overrides.onOpenAnimal ?? vi.fn(),
  };
  const view = render(
    <BarnSchedulerGantt
      speciesProfile={speciesProfile}
      animals={animals}
      tasks={overrides.tasks ?? sampleTasks}
      breedings={breedings}
      settings={settings}
      deviceId="device-local"
      syncOperations={[]}
      syncConflicts={overrides.syncConflicts ?? []}
      backupSyncStatus={null}
      masterBackupJson="{}"
      onToggleTask={handlers.onToggleTask}
      onRescheduleTask={handlers.onRescheduleTask}
      onApplySmartEscalations={handlers.onApplySmartEscalations}
      onDeleteTask={handlers.onDeleteTask}
      onOpenAnimal={handlers.onOpenAnimal}
      onReconcileOutboxOps={handlers.onReconcileOutboxOps}
      onResolveSyncConflict={handlers.onResolveSyncConflict}
      onDismissSyncConflict={handlers.onDismissSyncConflict}
      onBuildLocalDeltaJson={() => ({ filename: 'delta_local.json', content: '{"ops":[]}' })}
    />
  );
  return { ...handlers, ...view };
}

/** Bars are `role="button"` divs whose label carries the effective span: `Title (start to due)`. */
function barFor(tasks: BarnTask[], dueDateIso: string): HTMLElement {
  const found = screen
    .getAllByRole('button')
    .find((el) => (el.getAttribute('aria-label') || '').includes(` to ${dueDateIso}`));
  if (!found) throw new Error(`No Gantt bar ends on ${dueDateIso}`);
  expect(tasks.some((task) => task.dueDateIso === dueDateIso)).toBe(true);
  return found;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('BarnSchedulerGantt', () => {
  it('shows the empty-state copy when no chore matches the filter', () => {
    renderGantt({ tasks: [] });
    expect(
      screen.getByText(
        `No scheduled ${speciesProfile.name.toLowerCase()} chores match the active filter.`
      )
    ).toBeTruthy();
  });

  it('renders sample chores as timeline bars and opens the inspector on click', () => {
    renderGantt();
    const task = sampleTasks[0];
    const bar = barFor(sampleTasks, task.dueDateIso);

    fireEvent.click(bar);

    const inspector = screen.getByRole('button', { name: 'Move +1d' }).closest('div')
      ?.parentElement as HTMLElement;
    expect(inspector).toBeTruthy();
    expect(within(inspector).getByText(/priority$/)).toBeTruthy();
    expect(bar.getAttribute('aria-pressed')).toBe('true');
  });

  it('nudges, completes and deletes the selected chore', async () => {
    const handlers = renderGantt();
    const task = sampleTasks[0];
    fireEvent.click(barFor(sampleTasks, task.dueDateIso));

    fireEvent.click(screen.getByRole('button', { name: 'Move +1d' }));
    await vi.waitFor(() =>
      expect(handlers.onRescheduleTask).toHaveBeenCalledWith(task, {
        startDateIso: task.startDateIso ?? '',
        dueDateIso: addDaysIso(task.dueDateIso, 1),
      })
    );

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(handlers.onToggleTask).toHaveBeenCalledWith(task);

    fireEvent.click(screen.getByRole('button', { name: `Delete chore ${task.title}` }));
    expect(handlers.onDeleteTask).toHaveBeenCalledWith(task.id);
  });

  it('escalates overdue chores through the banner', async () => {
    const handlers = renderGantt({ tasks: [overdueTask()] });

    const banner = screen.getByRole('status');
    expect(banner.textContent).toContain('Smart Priority Escalation');

    const apply = within(banner).getByRole('button', { name: /Apply \d+ Smart Escalation/ });
    fireEvent.click(apply);
    await vi.waitFor(() =>
      expect(handlers.onApplySmartEscalations).toHaveBeenCalledWith([overdueTask()])
    );
    // The busy label clears once the handler settles.
    await vi.waitFor(() => expect(screen.queryByText('Escalating...')).toBeNull());
    expect(within(banner).getByRole('button', { name: 'Apply 1 Smart Escalation' })).toBeTruthy();
  });

  it('switches window length and grouping from the toolbar', () => {
    renderGantt();
    fireEvent.click(screen.getByRole('button', { name: '30d' }));
    expect(screen.getByRole('button', { name: '30d' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: '21d' }).getAttribute('aria-pressed')).toBe('false');

    const grouping = screen.getByRole('button', { name: /Group: Breeding \/ Animal/ });
    fireEvent.click(grouping);
    expect(screen.getByRole('button', { name: /Group: Category/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Group: Category/ }));
    expect(screen.getByRole('button', { name: /Group: Breeding \/ Animal/ })).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Show Done'));
    expect((screen.getByLabelText('Show Done') as HTMLInputElement).checked).toBe(true);
  });

  it('lists unresolved outbox conflicts and resolves them', () => {
    const handlers = renderGantt({ syncConflicts: [openConflict] });
    fireEvent.click(screen.getByRole('button', { name: /LAN P2P Outbox/ }));

    expect(screen.getByText(/Unresolved Outbox Collisions \(1\)/)).toBeTruthy();
    expect(screen.getByText(/\[task\] Nestbox check/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Keep Applied' }));
    expect(handlers.onResolveSyncConflict).toHaveBeenCalledWith('conflict-1', 'winning');

    fireEvent.click(screen.getByRole('button', { name: 'Use Other' }));
    expect(handlers.onResolveSyncConflict).toHaveBeenCalledWith('conflict-1', 'losing');

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss conflict conflict-1' }));
    expect(handlers.onDismissSyncConflict).toHaveBeenCalledWith('conflict-1');
  });

  it('rejects a malformed manual delta and merges a valid one', async () => {
    const handlers = renderGantt();
    fireEvent.click(screen.getByRole('button', { name: /LAN P2P Outbox/ }));

    const input = screen.getByLabelText('Paste peer delta JSON');
    fireEvent.change(input, { target: { value: 'not json at all' } });
    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));
    await vi.waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(handlers.onReconcileOutboxOps).not.toHaveBeenCalled();

    const wire = createP2pDeltaWireMessage({ senderDeviceId: 'peer-9', operations: [] });
    fireEvent.change(input, { target: { value: JSON.stringify(wire) } });
    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));

    await vi.waitFor(() =>
      expect(handlers.onReconcileOutboxOps).toHaveBeenCalledWith([], 'peer-9')
    );
    await vi.waitFor(() =>
      expect(screen.getByText(/Manual delta merged: 2 of 3 op\(s\) applied\./)).toBeTruthy()
    );
    expect((input as HTMLInputElement).value).toBe('');
  });

  it('falls back to folder/manual sync when the browser has no WebRTC', () => {
    renderGantt();
    fireEvent.click(screen.getByRole('button', { name: /LAN P2P Outbox/ }));

    expect(
      screen.getByText(
        'WebRTC is unavailable in this browser; use Folder Sync or Manual Delta JSON below.'
      )
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Generate LAN Offer Code' }).hasAttribute('disabled')
    ).toBe(true);
  });
});

/** A chore with an explicit two-day span, so move versus resize can be told apart. */
function spannedTask(): BarnTask {
  return {
    ...sampleTasks[0],
    id: 'gantt-drag-task',
    category: 'Care',
    priority: 'Low',
    completed: false,
    startDateIso: addDaysIso(todayDateIso(), 8),
    dueDateIso: addDaysIso(todayDateIso(), 10),
  };
}

/**
 * jsdom reports `clientWidth` as 0, so the component falls back to a 560px track; with the default
 * 21-day window each day column is 560/21 ≈ 26.7px. These helpers drag by whole columns.
 */
const COLUMN_PX = 560 / 21;

async function beginDrag(target: HTMLElement, clientX = 100, bar: HTMLElement = target) {
  fireEvent.pointerDown(target, { clientX, button: 0, pointerType: 'mouse' });
  // Starting a drag from the separator still selects the bar that owns it.
  await vi.waitFor(() => expect(bar.getAttribute('aria-pressed')).toBe('true'));
  return clientX;
}

describe('BarnSchedulerGantt pointer and keyboard scheduling', () => {
  it('reschedules a chore two days later when its bar is dragged and released', async () => {
    const task = spannedTask();
    const handlers = renderGantt({ tasks: [task] });
    const bar = barFor([task], task.dueDateIso);

    const startX = await beginDrag(bar);
    fireEvent.pointerMove(window, { clientX: startX + COLUMN_PX * 2 });
    fireEvent.pointerUp(window);

    await vi.waitFor(() =>
      expect(handlers.onRescheduleTask).toHaveBeenCalledWith(task, {
        startDateIso: addDaysIso(task.startDateIso as string, 2),
        dueDateIso: addDaysIso(task.dueDateIso, 2),
      })
    );
  });

  it('does not reschedule when the drag lands on the same day or is cancelled', async () => {
    const task = spannedTask();
    const handlers = renderGantt({ tasks: [task] });
    const bar = barFor([task], task.dueDateIso);

    const startX = await beginDrag(bar);
    fireEvent.pointerMove(window, { clientX: startX + 3 });
    fireEvent.pointerUp(window);
    expect(handlers.onRescheduleTask).not.toHaveBeenCalled();

    await beginDrag(bar);
    fireEvent.pointerMove(window, { clientX: startX + COLUMN_PX * 3 });
    fireEvent.pointerCancel(window);
    expect(handlers.onRescheduleTask).not.toHaveBeenCalled();
  });

  it('resizes the start edge from the bar separator without moving the due date', async () => {
    const task = spannedTask();
    const handlers = renderGantt({ tasks: [task] });
    const bar = barFor([task], task.dueDateIso);
    const separator = within(bar).getByRole('separator');

    const startX = await beginDrag(separator, 100, bar);
    fireEvent.pointerMove(window, { clientX: startX + COLUMN_PX });
    fireEvent.pointerUp(window);

    await vi.waitFor(() =>
      expect(handlers.onRescheduleTask).toHaveBeenCalledWith(task, {
        startDateIso: addDaysIso(task.startDateIso as string, 1),
        dueDateIso: task.dueDateIso,
      })
    );
  });

  it('nudges the selected chore by keyboard arrows', async () => {
    const task = spannedTask();
    const handlers = renderGantt({ tasks: [task] });
    const bar = barFor([task], task.dueDateIso);

    fireEvent.keyDown(bar, { key: 'ArrowRight' });
    await vi.waitFor(() =>
      expect(handlers.onRescheduleTask).toHaveBeenCalledWith(task, {
        startDateIso: addDaysIso(task.startDateIso as string, 1),
        dueDateIso: addDaysIso(task.dueDateIso, 1),
      })
    );

    fireEvent.keyDown(bar, { key: 'ArrowLeft' });
    await vi.waitFor(() =>
      expect(handlers.onRescheduleTask).toHaveBeenCalledWith(task, {
        startDateIso: addDaysIso(task.startDateIso as string, -1),
        dueDateIso: addDaysIso(task.dueDateIso, -1),
      })
    );
  });

  it('offers to schedule a chore that has no usable dates', () => {
    const task: BarnTask = { ...sampleTasks[0], id: 'gantt-unscheduled', dueDateIso: 'not-a-date' };
    const handlers = renderGantt({ tasks: [task] });

    expect(screen.getByText('Unscheduled Chores (1)')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Schedule Today' }));
    expect(handlers.onRescheduleTask).toHaveBeenCalledWith(task, {
      startDateIso: '',
      dueDateIso: todayDateIso(),
    });
  });
});
