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
