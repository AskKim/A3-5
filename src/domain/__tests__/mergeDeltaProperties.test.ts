import { describe, expect, it } from 'vitest';
import type { BarnDatabaseSnapshot } from '../models';
import { diffSnapshotsToSyncOperations, mergeDeltaOperations } from '../syncOutbox';
import { makeAnimal, makeEmptySnapshot } from './testFixtures';

/**
 * Seeded property tests for `mergeDeltaOperations`.
 *
 * A hand-picked fixture proves one path; these assert the properties the sync engine relies on
 * across many random devisions of the same base snapshot. The generator is a small LCG so a failure
 * is reproducible from the seed printed in the assertion message — no extra dependency.
 */
const makeRng = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

const SEEDS = [1, 7, 42, 1234, 99991];

const buildSnapshot = (rand: () => number, suffix: string, count: number): BarnDatabaseSnapshot =>
  makeEmptySnapshot({
    animals: Array.from({ length: count }, (_, index) =>
      makeAnimal(`a${index}`, {
        name: `Animal ${index} ${suffix} ${Math.floor(rand() * 100)}`,
        weightGrams: Math.floor(rand() * 5000),
        tattoo: `T${index}${suffix}`,
      })
    ),
  });

const opsBetween = (
  previous: BarnDatabaseSnapshot,
  next: BarnDatabaseSnapshot,
  deviceId: string,
  counterStart: number
) => {
  let counter = counterStart;
  return diffSnapshotsToSyncOperations({
    previous,
    next,
    deviceId,
    nextCounter: () => counter++,
    timestamp: '2026-01-01T00:00:00.000Z',
  });
};

describe('mergeDeltaOperations — seeded properties', () => {
  it('produces the same operation set regardless of which device merged first', () => {
    for (const seed of SEEDS) {
      const rand = makeRng(seed);
      const base = buildSnapshot(rand, 'base', 4);
      const left = buildSnapshot(rand, 'left', 4);
      const right = buildSnapshot(rand, 'right', 4);
      const leftOps = opsBetween(base, left, 'dev-a', 1);
      const rightOps = opsBetween(base, right, 'dev-b', 100);

      const afterLeft = mergeDeltaOperations(base, [], leftOps, 'dev-a');
      const leftThenRight = mergeDeltaOperations(
        afterLeft.nextSnapshot,
        afterLeft.mergedOperations,
        rightOps,
        'dev-b'
      );

      const afterRight = mergeDeltaOperations(base, [], rightOps, 'dev-b');
      const rightThenLeft = mergeDeltaOperations(
        afterRight.nextSnapshot,
        afterRight.mergedOperations,
        leftOps,
        'dev-a'
      );

      const idsA = leftThenRight.mergedOperations.map((op) => op.op_id).sort();
      const idsB = rightThenLeft.mergedOperations.map((op) => op.op_id).sort();
      expect(idsA, `seed ${seed}`).toEqual(idsB);
      expect(new Set(idsA).size, `seed ${seed}`).toBe(idsA.length);
    }
  });

  it('is idempotent when the same delta is merged twice', () => {
    for (const seed of SEEDS) {
      const rand = makeRng(seed);
      const base = buildSnapshot(rand, 'base', 3);
      const incoming = buildSnapshot(rand, 'incoming', 3);
      const ops = opsBetween(base, incoming, 'dev-a', 1);

      const once = mergeDeltaOperations(base, [], ops, 'dev-a');
      const twice = mergeDeltaOperations(once.nextSnapshot, once.mergedOperations, ops, 'dev-a');

      expect(twice.mergedOperations, `seed ${seed}`).toHaveLength(once.mergedOperations.length);
      expect(twice.mergedOperations.map((op) => op.op_id), `seed ${seed}`).toEqual(
        once.mergedOperations.map((op) => op.op_id)
      );
    }
  });

  it('keeps the local operation order and appends unseen remote operations after it', () => {
    for (const seed of SEEDS) {
      const rand = makeRng(seed);
      const base = buildSnapshot(rand, 'base', 3);
      const local = buildSnapshot(rand, 'local', 3);
      const remote = buildSnapshot(rand, 'remote', 3);
      const localOps = opsBetween(base, local, 'dev-a', 1);
      const remoteOps = opsBetween(base, remote, 'dev-b', 100);

      const merged = mergeDeltaOperations(base, localOps, remoteOps, 'dev-a');

      expect(merged.mergedOperations.slice(0, localOps.length).map((op) => op.op_id)).toEqual(
        localOps.map((op) => op.op_id)
      );
    }
  });

  it('does not grow without bound when deltas are replayed', () => {
    for (const seed of SEEDS) {
      const rand = makeRng(seed);
      const base = buildSnapshot(rand, 'base', 2);
      const incoming = buildSnapshot(rand, 'incoming', 2);
      const ops = opsBetween(base, incoming, 'dev-a', 1);

      let snapshot = base;
      let log: ReturnType<typeof diffSnapshotsToSyncOperations> = [];
      for (let replay = 0; replay < 4; replay++) {
        const result = mergeDeltaOperations(snapshot, log, ops, 'dev-a');
        snapshot = result.nextSnapshot;
        log = result.mergedOperations;
      }

      expect(log, `seed ${seed}`).toHaveLength(ops.length);
    }
  });
});
