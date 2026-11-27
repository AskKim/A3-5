/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Serverless LAN / Peer-to-Peer WebRTC DataChannel & Folder Sync Bridge (`src/storage/p2pLanChannel.ts`).
 *
 * Thin Pedigree-wired facade delegating WebRTC transport (`iceServers: []`) and chunk
 * framing to `@engine/storage/lanWebRtcTransport` while supplying `CP-LAN1:` signaling
 * codecs and SyncThing/LAN folder reconciliation.
 */

import {
  createGenericLanWebRtcSession,
  supportsLanWebRtcP2p as supportsLanWebRtcP2pCore,
  type GenericLanP2pSessionState,
} from '@engine/storage/lanWebRtcTransport';
import { nowIsoUtc } from '../domain/models';
import {
  decodeP2pSignalToken,
  encodeP2pSignalToken,
  P2pWireMessage,
  parseP2pWireOrDeltaPayload,
} from '../domain/p2pSyncProtocol';
import { SyncOperation } from '../domain/syncOutbox';
import {
  resumePersistedDirectorySyncIfGranted,
  syncWithPickedDirectory,
} from './localSyncChannels';

export type LanP2pSessionState = GenericLanP2pSessionState;

export interface LanP2pSessionController {
  getState: () => LanP2pSessionState;
  createOfferToken: () => Promise<string>;
  acceptOfferAndCreateAnswerToken: (offerToken: string) => Promise<string>;
  completeHandshakeWithAnswer: (answerToken: string) => Promise<void>;
  sendWireMessage: (message: P2pWireMessage) => void;
  close: () => void;
}

const DATA_CHANNEL_LABEL = 'community-pedigree-sync';
const CHUNK_KIND = 'cp-lan-chunk-v1';

export function supportsLanWebRtcP2p(): boolean {
  return supportsLanWebRtcP2pCore();
}

/**
 * Creates a clean, self-contained serverless WebRTC DataChannel session controller.
 * Configured with `iceServers: []` so all ICE candidates stay strictly on the local LAN/device.
 */
export function createLanP2pSession(options: {
  deviceId: string;
  onDeltaOperations: (ops: SyncOperation[], senderDeviceId: string) => void;
  onAckReceived?: (ack: Extract<P2pWireMessage, { kind: 'pedigree-p2p-ack-v1' }>) => void;
  onStateChange?: (state: LanP2pSessionState, detail?: string) => void;
  onError?: (message: string) => void;
}): LanP2pSessionController {
  const transport = createGenericLanWebRtcSession<P2pWireMessage>({
    deviceId: options.deviceId,
    dataChannelLabel: DATA_CHANNEL_LABEL,
    chunkKind: CHUNK_KIND,
    signalPrefixLabel: 'CP-LAN1:...',
    getNowIso: nowIsoUtc,
    encodeSignal: (envelope) => encodeP2pSignalToken(envelope),
    decodeSignal: (token) => decodeP2pSignalToken(token),
    onTextMessage: (rawText) => {
      try {
        const parsed = parseP2pWireOrDeltaPayload(rawText);
        if (parsed.messageKind === 'ack' && parsed.ack) {
          options.onAckReceived?.(parsed.ack);
          return;
        }
        options.onDeltaOperations(parsed.operations, parsed.senderDeviceId);
      } catch (err) {
        options.onError?.(err instanceof Error ? err.message : 'Invalid incoming LAN sync message.');
      }
    },
    onStateChange: options.onStateChange,
    onError: options.onError,
  });

  return {
    getState: transport.getState,
    createOfferToken: transport.createOfferToken,
    acceptOfferAndCreateAnswerToken: transport.acceptOfferAndCreateAnswerToken,
    completeHandshakeWithAnswer: transport.completeHandshakeWithAnswer,
    sendWireMessage: transport.sendMessage,
    close: transport.close,
  };
}

/**
 * Reconciles delta outbox files using a persisted or freshly picked LAN / SyncThing folder.
 */
export async function reconcileWithPickedSyncFolder(params: {
  deviceId: string;
  localOperations: SyncOperation[];
  masterBackupJson: string;
  passphrase?: string;
}): Promise<{
  folderName: string;
  peerFilesRead: number;
  incomingOps: SyncOperation[];
  encryptedPeersSkipped: number;
  wroteEncrypted: boolean;
}> {
  const resumed = await resumePersistedDirectorySyncIfGranted({
    deviceId: params.deviceId,
    localOperations: params.localOperations,
    masterBackupJson: params.masterBackupJson,
    passphrase: params.passphrase,
  });
  if (resumed.resumed) {
    return {
      folderName: resumed.folderName,
      peerFilesRead: resumed.peerFilesRead,
      incomingOps: resumed.incomingOps,
      encryptedPeersSkipped: resumed.encryptedPeersSkipped,
      wroteEncrypted: resumed.wroteEncrypted,
    };
  }
  return syncWithPickedDirectory({
    deviceId: params.deviceId,
    localOperations: params.localOperations,
    masterBackupJson: params.masterBackupJson,
    passphrase: params.passphrase,
  });
}
