import { describe, expect, it, vi } from 'vitest';
import { createStorePorts } from '../barnStore/storePorts';

describe('createStorePorts', () => {
  it('serialises mutations and keeps going after a rejection', async () => {
    const ports = createStorePorts({ deviceId: 'dev-1' });
    const order: string[] = [];

    const first = ports.enqueueStoreMutation(async () => {
      order.push('first');
      throw new Error('boom');
    });
    const second = ports.enqueueStoreMutation(async () => {
      order.push('second');
      return 2;
    });

    await expect(first).rejects.toThrow('boom');
    await expect(second).resolves.toBe(2);
    expect(order).toEqual(['first', 'second']);
  });

  it('never allocates a revision lower than one already seen for the entity', () => {
    const ports = createStorePorts({ deviceId: 'dev-1' });
    const first = ports.nextEntityRev('a1', 7);
    const stale = ports.nextEntityRev('a1', 2);
    const other = ports.nextEntityRev('a2');

    expect(first).toBe(8);
    expect(stale).toBe(9);
    expect(other).toBe(1);
  });

  it('supplies safe defaults for the optional callbacks', async () => {
    const ports = createStorePorts({ deviceId: 'dev-1' });
    expect(ports.snapshotRef.current).toBeNull();
    expect(() => ports.notify('x')).not.toThrow();
    expect(() => ports.reportPersistenceFailure('save', new Error('x'))).not.toThrow();
    expect(() => ports.setPendingCalendarSync({ tasks: [], filenameHint: 'x' })).not.toThrow();
    expect(typeof ports.nowIsoUtc()).toBe('string');
  });

  it('uses the caller-supplied snapshot ref and online probe', () => {
    const snapshotRef = { current: null };
    const isOnline = vi.fn(() => false);
    const ports = createStorePorts({ deviceId: 'dev-1', snapshotRef, isOnline });

    expect(ports.snapshotRef).toBe(snapshotRef);
    expect(ports.isOnline()).toBe(false);
  });
});
