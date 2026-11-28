import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createGenericLanWebRtcSession,
  supportsLanWebRtcP2p,
} from '../lanWebRtcTransport';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('supportsLanWebRtcP2p', () => {
  it('reports the presence of RTCPeerConnection', () => {
    vi.stubGlobal('RTCPeerConnection', class {});
    expect(supportsLanWebRtcP2p()).toBe(true);
  });

  it('reports absence when the API is missing', () => {
    vi.stubGlobal('RTCPeerConnection', undefined);
    expect(supportsLanWebRtcP2p()).toBe(false);
  });
});

describe('createGenericLanWebRtcSession', () => {
  it('creates an idle controller with the default channel labels', () => {
    const onStateChange = vi.fn();
    const controller = createGenericLanWebRtcSession<{ hello: string }>({
      deviceId: 'device-test',
      encodeSignal: (envelope) => JSON.stringify(envelope),
      decodeSignal: (token) => ({
        v: 1,
        type: 'offer',
        deviceId: token,
        sdp: '',
        createdAtIso: '2026-01-01T00:00:00.000Z',
      }),
      onTextMessage: vi.fn(),
      onStateChange,
    });
    expect(controller).toBeTruthy();
    expect(typeof controller.close).toBe('function');
    controller.close();
    controller.close();
    expect(onStateChange).toHaveBeenCalled();
  });
});

class FakeDataChannel {
  label: string;
  readyState = 'connecting';
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;

  constructor(label: string) {
    this.label = label;
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = 'closed';
  }

  emitOpen() {
    this.readyState = 'open';
    this.onopen?.();
  }

  emitClose() {
    this.readyState = 'closed';
    this.onclose?.();
  }

  emitError() {
    this.onerror?.();
  }

  emitMessage(data: unknown) {
    this.onmessage?.(new MessageEvent('message', { data }));
  }
}

class FakePeerConnection {
  static last: FakePeerConnection | null = null;

  iceGatheringState = 'complete';
  connectionState = 'new';
  localDescription: { type?: string; sdp?: string } | null = null;
  onconnectionstatechange: (() => void) | null = null;
  ondatachannel: ((ev: { channel: FakeDataChannel }) => void) | null = null;
  channels: FakeDataChannel[] = [];
  remoteDescriptions: Array<{ type?: string; sdp?: string }> = [];
  offerSdp: string | null = 'v=0 fake-offer';
  answerSdp: string | null = 'v=0 fake-answer';
  closed = false;

  constructor() {
    FakePeerConnection.last = this;
  }

  createDataChannel(label: string) {
    const channel = new FakeDataChannel(label);
    this.channels.push(channel);
    return channel;
  }

  async createOffer() {
    return { type: 'offer', sdp: this.offerSdp };
  }

  async createAnswer() {
    return { type: 'answer', sdp: this.answerSdp };
  }

  async setLocalDescription(description: { type?: string; sdp?: string }) {
    this.localDescription = description;
  }

  async setRemoteDescription(description: { type?: string; sdp?: string }) {
    this.remoteDescriptions.push(description);
  }

  addEventListener(_type: string, _listener: () => void) {}

  removeEventListener(_type: string, _listener: () => void) {}

  close() {
    this.closed = true;
  }

  setConnectionState(next: string) {
    this.connectionState = next;
    this.onconnectionstatechange?.();
  }

  emitIncomingChannel(channel: FakeDataChannel) {
    this.ondatachannel?.({ channel });
  }
}

describe('createGenericLanWebRtcSession — handshake', () => {
  it('builds an offer token and reaches awaiting_answer', async () => {
    vi.stubGlobal('RTCPeerConnection', FakePeerConnection);
    const states: string[] = [];
    const controller = createGenericLanWebRtcSession<{ n: number }>({
      deviceId: 'device-a',
      encodeSignal: (envelope) => `LAN1:${JSON.stringify(envelope)}`,
      decodeSignal: () => {
        throw new Error('not used');
      },
      onTextMessage: vi.fn(),
      onStateChange: (next) => states.push(next),
      getNowIso: () => '2026-11-28T00:00:00.000Z',
      iceGatherTimeoutMs: 20,
    });

    const token = await controller.createOfferToken();
    const pc = FakePeerConnection.last;

    expect(token.startsWith('LAN1:')).toBe(true);
    expect(token).toContain('"type":"offer"');
    expect(token).toContain('"deviceId":"device-a"');
    expect(token).toContain('v=0 fake-offer');
    expect(pc?.remoteDescriptions).toHaveLength(0);
    expect(states).toEqual(['creating_offer', 'awaiting_answer']);
    expect(controller.getState()).toBe('awaiting_answer');
  });

  it('waits out the ICE gathering timeout instead of hanging', async () => {
    class SlowPeerConnection extends FakePeerConnection {
      constructor() {
        super();
        this.iceGatheringState = 'gathering';
      }
    }
    vi.stubGlobal('RTCPeerConnection', SlowPeerConnection);
    const controller = createGenericLanWebRtcSession<unknown>({
      deviceId: 'device-slow',
      encodeSignal: (envelope) => JSON.stringify(envelope),
      decodeSignal: () => {
        throw new Error('not used');
      },
      onTextMessage: vi.fn(),
      iceGatherTimeoutMs: 5,
    });

    await expect(controller.createOfferToken()).resolves.toContain('v=0 fake-offer');
  });

  it('fails clearly when the browser has no WebRTC', async () => {
    vi.stubGlobal('RTCPeerConnection', undefined);
    const controller = createGenericLanWebRtcSession<unknown>({
      deviceId: 'device-a',
      encodeSignal: (envelope) => JSON.stringify(envelope),
      decodeSignal: () => {
        throw new Error('not used');
      },
      onTextMessage: vi.fn(),
    });

    await expect(controller.createOfferToken()).rejects.toThrow(/WebRTC DataChannel is not supported/);
  });

  it('rejects an empty local SDP', async () => {
    class NoSdpPeerConnection extends FakePeerConnection {
      constructor() {
        super();
        this.offerSdp = null;
      }
    }
    vi.stubGlobal('RTCPeerConnection', NoSdpPeerConnection);
    const controller = createGenericLanWebRtcSession<unknown>({
      deviceId: 'device-a',
      encodeSignal: (envelope) => JSON.stringify(envelope),
      decodeSignal: () => {
        throw new Error('not used');
      },
      onTextMessage: vi.fn(),
    });

    await expect(controller.createOfferToken()).rejects.toThrow(/Failed to generate local WebRTC offer SDP/);
  });

  it('answers an offer and returns an answer token', async () => {
    vi.stubGlobal('RTCPeerConnection', FakePeerConnection);
    const controller = createGenericLanWebRtcSession<unknown>({
      deviceId: 'device-b',
      encodeSignal: (envelope) => JSON.stringify(envelope),
      decodeSignal: (token) => ({
        v: 1,
        type: 'offer',
        deviceId: token,
        sdp: 'v=0 remote-offer',
        createdAtIso: '2026-11-28T00:00:00.000Z',
      }),
      onTextMessage: vi.fn(),
      iceGatherTimeoutMs: 20,
    });

    const token = await controller.acceptOfferAndCreateAnswerToken('device-a');

    expect(token).toContain('"type":"answer"');
    expect(token).toContain('v=0 fake-answer');
    expect(FakePeerConnection.last?.remoteDescriptions[0]?.sdp).toBe('v=0 remote-offer');
    expect(controller.getState()).toBe('connecting');
  });

  it('refuses to answer with the wrong signal type', async () => {
    vi.stubGlobal('RTCPeerConnection', FakePeerConnection);
    const controller = createGenericLanWebRtcSession<unknown>({
      deviceId: 'device-b',
      encodeSignal: (envelope) => JSON.stringify(envelope),
      decodeSignal: () => ({
        v: 1,
        type: 'answer',
        deviceId: 'device-a',
        sdp: 'v=0',
        createdAtIso: '2026-11-28T00:00:00.000Z',
      }),
      onTextMessage: vi.fn(),
    });

    await expect(controller.acceptOfferAndCreateAnswerToken('device-a')).rejects.toThrow(
      /Expected a peer Offer code/
    );
  });

  it('requires a local offer before applying an answer', async () => {
    const controller = createGenericLanWebRtcSession<unknown>({
      deviceId: 'device-a',
      encodeSignal: (envelope) => JSON.stringify(envelope),
      decodeSignal: () => ({
        v: 1,
        type: 'answer',
        deviceId: 'device-b',
        sdp: 'v=0 answer',
        createdAtIso: '2026-11-28T00:00:00.000Z',
      }),
      onTextMessage: vi.fn(),
    });

    await expect(controller.completeHandshakeWithAnswer('device-b')).rejects.toThrow(
      /Create a LAN Offer code first/
    );
  });

  it('applies a peer answer after the offer exists', async () => {
    vi.stubGlobal('RTCPeerConnection', FakePeerConnection);
    const controller = createGenericLanWebRtcSession<unknown>({
      deviceId: 'device-a',
      encodeSignal: (envelope) => JSON.stringify(envelope),
      decodeSignal: (token) => ({
        v: 1,
        type: token === 'wrong' ? 'offer' : 'answer',
        deviceId: 'device-b',
        sdp: `v=0 ${token}`,
        createdAtIso: '2026-11-28T00:00:00.000Z',
      }),
      onTextMessage: vi.fn(),
      iceGatherTimeoutMs: 20,
    });

    await controller.createOfferToken();
    await expect(controller.completeHandshakeWithAnswer('wrong')).rejects.toThrow(
      /Expected a peer Answer code/
    );
    await controller.completeHandshakeWithAnswer('answer-sdp');
    expect(FakePeerConnection.last?.remoteDescriptions.at(-1)?.sdp).toBe('v=0 answer-sdp');
  });
});

describe('createGenericLanWebRtcSession — messaging', () => {
  async function connectedSession(message: { n: number } | string, chunkSizeChars?: number) {
    vi.stubGlobal('RTCPeerConnection', FakePeerConnection);
    const received: string[] = [];
    const errors: string[] = [];
    const states: string[] = [];
    const controller = createGenericLanWebRtcSession<{ n: number } | string>({
      deviceId: 'device-a',
      encodeSignal: (envelope) => JSON.stringify(envelope),
      decodeSignal: () => {
        throw new Error('not used');
      },
      onTextMessage: (text) => received.push(text),
      onError: (msg) => errors.push(msg),
      onStateChange: (next) => states.push(next),
      chunkSizeChars,
      iceGatherTimeoutMs: 20,
    });
    await controller.createOfferToken();
    const pc = FakePeerConnection.last;
    const channel = pc?.channels[0];
    channel?.emitOpen();
    return { controller, channel, pc, received, errors, states };
  }

  it('refuses to send before the channel is open', async () => {
    vi.stubGlobal('RTCPeerConnection', FakePeerConnection);
    const controller = createGenericLanWebRtcSession<{ n: number }>({
      deviceId: 'device-a',
      encodeSignal: (envelope) => JSON.stringify(envelope),
      decodeSignal: () => {
        throw new Error('not used');
      },
      onTextMessage: vi.fn(),
    });
    await controller.createOfferToken();
    expect(() => controller.sendMessage({ n: 1 })).toThrow(/LAN DataChannel is not open yet/);
  });

  it('sends a small message as one frame and splits a large one', async () => {
    const small = await connectedSession({ n: 1 });
    small.controller.sendMessage({ n: 1 });
    expect(small.channel?.sent).toEqual(['{"n":1}']);

    // The wire form is the JSON serialisation, so the quotes count toward the chunk budget.
    const serialized = JSON.stringify('abcdefghijklmnop');
    const large = await connectedSession('abcdefghijklmnop', 8);
    large.controller.sendMessage('abcdefghijklmnop');
    expect(large.channel?.sent).toHaveLength(3);
    const frames = large.channel?.sent.map((raw) => JSON.parse(raw) as Record<string, unknown>) ?? [];
    expect(frames.map((frame) => frame.index)).toEqual([0, 1, 2]);
    expect(frames.every((frame) => frame.total === 3)).toBe(true);
    expect(frames.map((frame) => frame.data).join('')).toBe(serialized);
    expect(frames[0].kind).toBe('core-lan-chunk-v1');
  });

  it('passes plain text through and reassembles chunk frames', async () => {
    const session = await connectedSession('ignored');
    session.channel?.emitMessage('hello peer');
    expect(session.received).toEqual(['hello peer']);

    const frame = (index: number, data: string, total = 2) =>
      JSON.stringify({ kind: 'core-lan-chunk-v1', transferId: 't1', index, total, data });
    session.channel?.emitMessage(frame(1, 'world'));
    expect(session.received).toEqual(['hello peer']);
    session.channel?.emitMessage(frame(0, 'hello '));
    expect(session.received).toEqual(['hello peer', 'hello world']);

    session.channel?.emitMessage(frame(0, 'duplicate '));
    expect(session.received).toEqual(['hello peer', 'hello world']);
  });

  it('falls back to plain text for malformed or oversized chunk frames', async () => {
    const session = await connectedSession('ignored');
    const invalid = JSON.stringify({ kind: 'core-lan-chunk-v1', transferId: 't2', index: 0, total: 0, data: 'x' });
    session.channel?.emitMessage(invalid);
    expect(session.received).toEqual([invalid]);

    const oversized = JSON.stringify({ kind: 'core-lan-chunk-v1', transferId: 't3', index: 0, total: 5000, data: 'x' });
    session.channel?.emitMessage(oversized);
    expect(session.received.at(-1)).toBe(oversized);

    session.channel?.emitMessage(new Uint8Array([1, 2, 3]));
    expect(session.received).toHaveLength(2);
  });

  it('reports channel open, close and transport errors', async () => {
    const session = await connectedSession('ignored');
    expect(session.states).toContain('connected');
    session.channel?.emitError();
    expect(session.errors).toEqual(['WebRTC DataChannel transport error.']);
    session.channel?.emitClose();
    expect(session.states).toContain('closed');
  });

  it('maps peer-connection state changes onto session state', async () => {
    const session = await connectedSession('ignored');
    session.pc?.setConnectionState('failed');
    expect(session.errors).toContain(
      'LAN peer connection failed. Verify both devices are on the same Wi-Fi/LAN.'
    );
    session.pc?.setConnectionState('closed');
    expect(session.controller.getState()).toBe('closed');
  });

  it('accepts an incoming data channel from the answering peer', async () => {
    const session = await connectedSession('ignored');
    const incoming = new FakeDataChannel('core-lan-sync');
    session.pc?.emitIncomingChannel(incoming);
    incoming.emitOpen();
    incoming.emitMessage('from peer');
    expect(session.received).toEqual(['from peer']);
  });
});
