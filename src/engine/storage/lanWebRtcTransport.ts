/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Content-Agnostic Serverless LAN WebRTC DataChannel Transport
 * (`@engine/storage/lanWebRtcTransport.ts`).
 *
 * Manages local-only ICE gathering (`iceServers: []`), chunk framing/reassembly,
 * and reliable ordered message delivery without cloud servers or signaling relays.
 */

export type GenericLanP2pSessionState =
  | 'idle'
  | 'creating_offer'
  | 'awaiting_answer'
  | 'creating_answer'
  | 'connecting'
  | 'connected'
  | 'closed'
  | 'error';

export interface GenericLanSignalEnvelope {
  v: 1;
  type: 'offer' | 'answer';
  deviceId: string;
  sdp: string;
  createdAtIso: string;
}

export interface GenericLanWebRtcSessionOptions<TMessage> {
  deviceId: string;
  dataChannelLabel?: string;
  chunkKind?: string;
  signalPrefixLabel?: string;
  iceGatherTimeoutMs?: number;
  chunkSizeChars?: number;
  encodeSignal: (envelope: GenericLanSignalEnvelope) => string;
  decodeSignal: (token: string) => GenericLanSignalEnvelope;
  getNowIso?: () => string;
  onTextMessage: (rawText: string) => void;
  serializeMessage?: (message: TMessage) => string;
  onStateChange?: (state: GenericLanP2pSessionState, detail?: string) => void;
  onError?: (message: string) => void;
}

export interface GenericLanWebRtcController<TMessage> {
  getState: () => GenericLanP2pSessionState;
  createOfferToken: () => Promise<string>;
  acceptOfferAndCreateAnswerToken: (offerToken: string) => Promise<string>;
  completeHandshakeWithAnswer: (answerToken: string) => Promise<void>;
  sendMessage: (message: TMessage) => void;
  close: () => void;
}

interface ChunkFrame {
  kind: string;
  transferId: string;
  index: number;
  total: number;
  data: string;
}

export function supportsLanWebRtcP2p(): boolean {
  return typeof RTCPeerConnection !== 'undefined';
}

function waitForIceGathering(
  pc: RTCPeerConnection,
  timeoutMs: number,
  signalClosed: () => boolean
): Promise<void> {
  if (pc.iceGatheringState === 'complete') {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const finish = () => {
      if (settled) return;
      settled = true;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      pc.removeEventListener('icegatheringstatechange', onStateChange);
      pc.removeEventListener('icecandidate', onCandidate);
      resolve();
    };

    const onStateChange = () => {
      if (signalClosed() || pc.iceGatheringState === 'complete') {
        finish();
      }
    };

    const onCandidate = (ev: RTCPeerConnectionIceEvent) => {
      if (signalClosed() || ev.candidate === null) {
        finish();
      }
    };

    pc.addEventListener('icegatheringstatechange', onStateChange);
    pc.addEventListener('icecandidate', onCandidate);
    timer = setTimeout(finish, timeoutMs);
  });
}

export function createGenericLanWebRtcSession<TMessage = unknown>(
  options: GenericLanWebRtcSessionOptions<TMessage>
): GenericLanWebRtcController<TMessage> {
  const channelLabel = options.dataChannelLabel || 'core-lan-sync';
  const chunkKind = options.chunkKind || 'core-lan-chunk-v1';
  const signalPrefixLabel = options.signalPrefixLabel || 'LAN1:...';
  const iceGatherTimeoutMs = options.iceGatherTimeoutMs ?? 2200;
  const chunkSizeChars = options.chunkSizeChars ?? 16384;

  let state: GenericLanP2pSessionState = 'idle';
  let pc: RTCPeerConnection | null = null;
  let dc: RTCDataChannel | null = null;
  let closed = false;
  const incomingChunkMap = new Map<string, { parts: string[]; received: number; total: number }>();

  const setState = (next: GenericLanP2pSessionState, detail?: string) => {
    if (closed && next !== 'closed') return;
    state = next;
    options.onStateChange?.(next, detail);
  };

  const fail = (msg: string) => {
    setState('error', msg);
    options.onError?.(msg);
  };

  const attachDataChannel = (channel: RTCDataChannel) => {
    dc = channel;
    channel.onopen = () => {
      setState('connected', `Peer link open (${channel.label})`);
    };
    channel.onclose = () => {
      if (!closed) {
        setState('closed', 'Peer disconnected');
      }
    };
    channel.onerror = () => {
      if (!closed) {
        fail('WebRTC DataChannel transport error.');
      }
    };
    channel.onmessage = (ev: MessageEvent) => {
      if (typeof ev.data !== 'string') return;
      const text = ev.data;
      if (text.includes(`"${chunkKind}"`)) {
        try {
          const frame = JSON.parse(text) as Partial<ChunkFrame>;
          if (
            frame.kind === chunkKind &&
            typeof frame.transferId === 'string' &&
            typeof frame.index === 'number' &&
            typeof frame.total === 'number' &&
            typeof frame.data === 'string' &&
            frame.total > 0 &&
            frame.total <= 2048 &&
            frame.index >= 0 &&
            frame.index < frame.total
          ) {
            let bucket = incomingChunkMap.get(frame.transferId);
            if (!bucket) {
              bucket = {
                parts: new Array<string>(frame.total),
                received: 0,
                total: frame.total,
              };
              incomingChunkMap.set(frame.transferId, bucket);
            }
            if (bucket.parts[frame.index] === undefined) {
              bucket.parts[frame.index] = frame.data;
              bucket.received += 1;
            }
            if (bucket.received === bucket.total) {
              incomingChunkMap.delete(frame.transferId);
              options.onTextMessage(bucket.parts.join(''));
            }
            return;
          }
        } catch {
          // Fall through to normal handler
        }
      }
      options.onTextMessage(text);
    };
  };

  const ensurePeerConnection = () => {
    if (!supportsLanWebRtcP2p()) {
      throw new Error(
        'WebRTC DataChannel is not supported in this browser. Use LAN Folder Sync or Delta JSON instead.'
      );
    }
    if (pc) {
      try {
        pc.close();
      } catch {
        // Ignore cleanup error
      }
    }
    closed = false;
    pc = new RTCPeerConnection({ iceServers: [] });
    pc.onconnectionstatechange = () => {
      if (!pc || closed) return;
      if (pc.connectionState === 'connected') {
        if (dc?.readyState === 'open') {
          setState('connected');
        }
      } else if (pc.connectionState === 'failed') {
        fail('LAN peer connection failed. Verify both devices are on the same Wi-Fi/LAN.');
      } else if (pc.connectionState === 'closed') {
        setState('closed');
      }
    };
    pc.ondatachannel = (ev) => {
      attachDataChannel(ev.channel);
    };
    return pc;
  };

  const currentIso = () => (options.getNowIso ? options.getNowIso() : new Date().toISOString());

  return {
    getState: () => state,

    createOfferToken: async () => {
      const conn = ensurePeerConnection();
      setState('creating_offer');
      const channel = conn.createDataChannel(channelLabel, { ordered: true });
      attachDataChannel(channel);

      const offer = await conn.createOffer();
      await conn.setLocalDescription(offer);
      await waitForIceGathering(conn, iceGatherTimeoutMs, () => closed);

      const localSdp = conn.localDescription?.sdp || offer.sdp || '';
      if (!localSdp) {
        throw new Error('Failed to generate local WebRTC offer SDP.');
      }
      setState('awaiting_answer');
      return options.encodeSignal({
        v: 1,
        type: 'offer',
        deviceId: options.deviceId,
        sdp: localSdp,
        createdAtIso: currentIso(),
      });
    },

    acceptOfferAndCreateAnswerToken: async (offerToken: string) => {
      const env = options.decodeSignal(offerToken);
      if (env.type !== 'offer') {
        throw new Error(
          `Expected a peer Offer code (\`${signalPrefixLabel}\`) from the initiating device.`
        );
      }
      const conn = ensurePeerConnection();
      setState('creating_answer');
      await conn.setRemoteDescription({ type: 'offer', sdp: env.sdp });
      const answer = await conn.createAnswer();
      await conn.setLocalDescription(answer);
      await waitForIceGathering(conn, iceGatherTimeoutMs, () => closed);

      const localSdp = conn.localDescription?.sdp || answer.sdp || '';
      if (!localSdp) {
        throw new Error('Failed to generate local WebRTC answer SDP.');
      }
      setState('connecting', `Connecting to ${env.deviceId}...`);
      return options.encodeSignal({
        v: 1,
        type: 'answer',
        deviceId: options.deviceId,
        sdp: localSdp,
        createdAtIso: currentIso(),
      });
    },

    completeHandshakeWithAnswer: async (answerToken: string) => {
      if (!pc) {
        throw new Error('Create a LAN Offer code first before applying a peer Answer code.');
      }
      const env = options.decodeSignal(answerToken);
      if (env.type !== 'answer') {
        throw new Error(
          `Expected a peer Answer code (\`${signalPrefixLabel}\`) from the joining device.`
        );
      }
      setState('connecting', `Connecting to ${env.deviceId}...`);
      await pc.setRemoteDescription({ type: 'answer', sdp: env.sdp });
    },

    sendMessage: (message: TMessage) => {
      if (!dc || dc.readyState !== 'open') {
        throw new Error('LAN DataChannel is not open yet. Complete pairing first.');
      }
      const serialized = options.serializeMessage
        ? options.serializeMessage(message)
        : JSON.stringify(message);
      if (serialized.length <= chunkSizeChars) {
        dc.send(serialized);
        return;
      }
      const total = Math.ceil(serialized.length / chunkSizeChars);
      const transferId = `${options.deviceId}-${Date.now().toString(36)}`;
      for (let i = 0; i < total; i++) {
        const chunk: ChunkFrame = {
          kind: chunkKind,
          transferId,
          index: i,
          total,
          data: serialized.slice(i * chunkSizeChars, (i + 1) * chunkSizeChars),
        };
        dc.send(JSON.stringify(chunk));
      }
    },

    close: () => {
      closed = true;
      incomingChunkMap.clear();
      if (dc) {
        try {
          dc.onopen = null;
          dc.onclose = null;
          dc.onerror = null;
          dc.onmessage = null;
          dc.close();
        } catch {
          // Ignore close error
        }
        dc = null;
      }
      if (pc) {
        try {
          pc.onconnectionstatechange = null;
          pc.ondatachannel = null;
          pc.close();
        } catch {
          // Ignore close error
        }
        pc = null;
      }
      state = 'closed';
      options.onStateChange?.('closed');
    },
  };
}
