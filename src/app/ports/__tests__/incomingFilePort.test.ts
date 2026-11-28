// @vitest-environment jsdom
/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getIncomingFilePort,
  nativeIncomingFilePort,
  resetIncomingFilePort,
  setIncomingFilePort,
  type IncomingFilePort,
} from '../incomingFile';
import { pedigreeBridge } from '../../../native/pedigreeBridge';

afterEach(() => {
  resetIncomingFilePort();
  vi.unstubAllGlobals();
});

describe('incoming file port', () => {
  it('delivers a file envelope to every subscriber', () => {
    const first = vi.fn();
    const second = vi.fn();
    const stopFirst = nativeIncomingFilePort.subscribe(first);
    const stopSecond = nativeIncomingFilePort.subscribe(second);

    pedigreeBridge.handleIncomingNativeMessage({
      type: 'OPEN_EXTERNAL_FILE',
      payload: {
        filename: 'herd.json',
        mimeType: 'application/json',
        source: 'share',
        sizeBytes: 2,
        base64Data: 'aGk=',
      },
    });

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(first.mock.calls[0]?.[0]).toMatchObject({
      filename: 'herd.json',
      mimeType: 'application/json',
      source: 'share',
      sizeBytes: 2,
    });

    stopFirst();
    stopSecond();
    pedigreeBridge.handleIncomingNativeMessage({
      type: 'OPEN_EXTERNAL_FILE',
      payload: { filename: 'herd.json', mimeType: 'application/json', source: 'view' },
    });
    expect(first).toHaveBeenCalledTimes(1);
  });

  it('ignores an envelope without a filename', () => {
    const listener = vi.fn();
    const stop = nativeIncomingFilePort.subscribe(listener);
    pedigreeBridge.handleIncomingNativeMessage({
      type: 'OPEN_EXTERNAL_FILE',
      payload: { mimeType: 'application/json' },
    });
    expect(listener).not.toHaveBeenCalled();
    stop();
  });

  it('defaults an unknown source to share and decodes the payload', () => {
    const listener = vi.fn();
    const stop = nativeIncomingFilePort.subscribe(listener);
    pedigreeBridge.handleIncomingNativeMessage({
      type: 'OPEN_EXTERNAL_FILE',
      payload: { filename: 'notes.txt', base64Data: 'aGk=' },
    });

    expect(listener).toHaveBeenCalledTimes(1);
    const file = listener.mock.calls[0]?.[0];
    expect(file.source).toBe('share');
    expect(file.mimeType).toBe('application/octet-stream');
    expect(Array.from(nativeIncomingFilePort.readBytes(file) ?? [])).toEqual([104, 105]);
    stop();
  });

  it('returns null when the shell attached no bytes or the payload is corrupt', () => {
    expect(nativeIncomingFilePort.readBytes({ filename: 'x.json', mimeType: 'text/plain', source: 'view' })).toBeNull();
    expect(
      nativeIncomingFilePort.readBytes({
        filename: 'x.json',
        mimeType: 'text/plain',
        source: 'view',
        base64Data: '!!!not-base64!!!',
      })
    ).toBeNull();
  });

  it('swaps and restores the active port', () => {
    const fake: IncomingFilePort = {
      isSupported: () => true,
      subscribe: () => () => undefined,
      readBytes: () => null,
    };
    expect(setIncomingFilePort(fake)).toBe(nativeIncomingFilePort);
    expect(getIncomingFilePort()).toBe(fake);
    resetIncomingFilePort();
    expect(getIncomingFilePort()).toBe(nativeIncomingFilePort);
  });
});
