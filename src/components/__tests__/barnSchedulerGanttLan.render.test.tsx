// @vitest-environment jsdom
/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * The Gantt drawer's LAN pairing UI is untestable with real WebRTC in jsdom, so this file mocks the
 * `p2pLanChannel` port and drives the component's wiring: offer/answer/connect, the guards that run
 * before a session exists, pushing the outbox over a connected link, and the shared-folder fallback.
 * The transport itself is covered by `lanWebRtcTransport.test.ts`; what is checked here is that the
 * drawer calls it with the right arguments and reports the result honestly.
 */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BarnSchedulerGantt } from '../BarnSchedulerGantt';
import { addDaysIso, todayDateIso } from '../../domain/models';
import type { BarnDatabaseSnapshot, BarnTask, SpeciesProfile } from '../../domain/models';
import type { P2pReconciliationSummary } from '../../domain/p2pSyncProtocol';
import { buildFullPredefinedSampleSnapshot } from '../../domain/sampleData';

const mocks = vi.hoisted(() => {
  const controller = {
    getState: vi.fn(() => 'idle' as const),
    sendWireMessage: vi.fn(),
    createOfferToken: vi.fn(async () => 'CP-LAN1:offer-token'),
    acceptOfferAndCreateAnswerToken: vi.fn(async () => 'CP-LAN1:answer-token'),
    completeHandshakeWithAnswer: vi.fn(async () => undefined),
    close: vi.fn(),
  };
  const state: {
    lastOptions: {
      deviceId: string;
      onStateChange?: (state: string, detail?: string) => void;
      onError?: (message: string) => void;
      onDeltaOperations?: (ops: unknown[], peer?: string) => void;
    } | null;
  } = { lastOptions: null };
  return {
    controller,
    state,
    createLanP2pSession: vi.fn((options: NonNullable<typeof state.lastOptions>) => {
      state.lastOptions = options;
      return controller;
    }),
    reconcile: vi.fn(async () => ({
      incomingOps: [],
      folderName: 'SyncThing',
      peerFilesRead: 2,
    })),
  };
});

vi.mock('../../app/ports/p2pLanChannel', () => ({
  supportsLanWebRtcP2p: () => true,
  createLanP2pSession: mocks.createLanP2pSession,
  reconcileWithPickedSyncFolder: mocks.reconcile,
}));

const snapshot: BarnDatabaseSnapshot = buildFullPredefinedSampleSnapshot();
const speciesProfile: SpeciesProfile = snapshot.speciesProfiles[0];
const task: BarnTask = {
  ...snapshot.tasks.filter((t) => t.species === speciesProfile.name)[0],
  id: 'lan-handshake-task',
  dueDateIso: addDaysIso(todayDateIso(), 4),
  completed: false,
};

const summary: P2pReconciliationSummary = {
  peerDeviceId: 'folder:SyncThing',
  receivedOpsCount: 3,
  appliedOpCount: 2,
  taskOpsReceivedCount: 1,
  newConflictCount: 0,
  newTaskConflictCount: 0,
  reconciledAtIso: '2026-11-28T12:00:00.000Z',
};

function renderDrawer() {
  const onReconcileOutboxOps = vi.fn(async () => summary);
  const view = render(
    <BarnSchedulerGantt
      speciesProfile={speciesProfile}
      animals={snapshot.animals.filter((a) => a.species === speciesProfile.name)}
      tasks={[task]}
      breedings={[]}
      settings={snapshot.settings}
      deviceId="device-local"
      syncOperations={[]}
      syncConflicts={[]}
      backupSyncStatus={null}
      masterBackupJson='{"animals":[]}'
      onToggleTask={vi.fn()}
      onRescheduleTask={vi.fn(async () => true)}
      onApplySmartEscalations={vi.fn(async () => 0)}
      onDeleteTask={vi.fn()}
      onOpenAnimal={vi.fn()}
      onReconcileOutboxOps={onReconcileOutboxOps}
      onResolveSyncConflict={vi.fn(async () => undefined)}
      onDismissSyncConflict={vi.fn(async () => undefined)}
      onBuildLocalDeltaJson={() => ({ filename: 'delta_local.json', content: '{"ops":[]}' })}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: /LAN P2P Outbox/ }));
  return { ...view, onReconcileOutboxOps };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.state.lastOptions = null;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('BarnSchedulerGantt LAN handshake', () => {
  it('generates and shows a host offer code', async () => {
    renderDrawer();

    fireEvent.click(screen.getByRole('button', { name: 'Generate LAN Offer Code' }));

    await vi.waitFor(() => expect(mocks.createLanP2pSession).toHaveBeenCalledTimes(1));
    expect(mocks.createLanP2pSession.mock.calls[0][0].deviceId).toBe('device-local');
    await vi.waitFor(() =>
      expect((screen.getByLabelText('Local LAN Offer Code') as HTMLTextAreaElement).value).toBe(
        'CP-LAN1:offer-token'
      )
    );
    expect(
      screen.getByText('Offer code generated. Share it with your second device on this LAN.')
    ).toBeTruthy();
  });

  it('reports a failure instead of a code when the offer cannot be created', async () => {
    mocks.controller.createOfferToken.mockRejectedValueOnce(new Error('WebRTC is unavailable'));
    renderDrawer();

    fireEvent.click(screen.getByRole('button', { name: 'Generate LAN Offer Code' }));

    await vi.waitFor(() => expect(screen.getByRole('alert').textContent).toBe('WebRTC is unavailable'));
    expect(screen.queryByLabelText('Local LAN Offer Code')).toBeNull();
  });

  it('answers a pasted host offer and exposes the answer code', async () => {
    renderDrawer();

    fireEvent.change(screen.getByLabelText('Paste host Offer code'), {
      target: { value: 'CP-LAN1:host-offer' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create Answer' }));

    await vi.waitFor(() =>
      expect(mocks.controller.acceptOfferAndCreateAnswerToken).toHaveBeenCalledWith(
        'CP-LAN1:host-offer'
      )
    );
    await vi.waitFor(() =>
      expect(
        (screen.getByLabelText('Generated LAN Answer Code') as HTMLTextAreaElement).value
      ).toBe('CP-LAN1:answer-token')
    );
    expect(
      screen.getByText('Answer code ready. Send it back to the host device to open the link.')
    ).toBeTruthy();
  });

  it('refuses to complete a handshake with no session and then completes a real one', async () => {
    renderDrawer();

    fireEvent.change(screen.getByLabelText('Paste peer Answer code'), {
      target: { value: 'CP-LAN1:answer' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    await vi.waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Generate an Offer code first.'));
    expect(mocks.controller.completeHandshakeWithAnswer).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Generate LAN Offer Code' }));
    await vi.waitFor(() => expect(screen.getByLabelText('Local LAN Offer Code')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    await vi.waitFor(() =>
      expect(mocks.controller.completeHandshakeWithAnswer).toHaveBeenCalledWith('CP-LAN1:answer')
    );
  });

  it('refuses to push the outbox before the link reports connected', async () => {
    renderDrawer();
    expect(screen.queryByRole('button', { name: /Push Outbox to Peer/ })).toBeNull();
  });

  it('pushes the outbox once connected and surfaces send failures', async () => {
    renderDrawer();
    fireEvent.click(screen.getByRole('button', { name: 'Generate LAN Offer Code' }));
    await vi.waitFor(() => expect(mocks.state.lastOptions).not.toBeNull());

    await act(async () => {
      mocks.state.lastOptions?.onStateChange?.('connected');
    });

    fireEvent.click(await screen.findByRole('button', { name: /Push Outbox to Peer/ }));
    expect(mocks.controller.sendWireMessage).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Sent 0 outbox op(s) to connected peer.')).toBeTruthy();

    mocks.controller.sendWireMessage.mockImplementationOnce(() => {
      throw new Error('DataChannel closed');
    });
    fireEvent.click(screen.getByRole('button', { name: /Push Outbox to Peer/ }));
    await vi.waitFor(() => expect(screen.getByRole('alert').textContent).toBe('DataChannel closed'));
  });

  it('merges peer ops from a picked sync folder', async () => {
    const { onReconcileOutboxOps } = renderDrawer();

    fireEvent.click(screen.getByRole('button', { name: 'Pick Shared LAN / SyncThing Folder' }));

    await vi.waitFor(() =>
      expect(mocks.reconcile).toHaveBeenCalledWith({
        deviceId: 'device-local',
        localOperations: [],
        masterBackupJson: '{"animals":[]}',
      })
    );
    await vi.waitFor(() =>
      expect(onReconcileOutboxOps).toHaveBeenCalledWith([], 'folder:SyncThing')
    );
    await vi.waitFor(() =>
      expect(
        screen.getByText('Folder "SyncThing": read 2 peer file(s), merged 2 op(s).')
      ).toBeTruthy()
    );
  });

  it('closes an open LAN session when the drawer unmounts', async () => {
    const { unmount } = renderDrawer();
    fireEvent.click(screen.getByRole('button', { name: 'Generate LAN Offer Code' }));
    await vi.waitFor(() => expect(screen.getByLabelText('Local LAN Offer Code')).toBeTruthy());

    unmount();
    expect(mocks.controller.close).toHaveBeenCalled();
  });


});
