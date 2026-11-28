import { describe, expect, it } from 'vitest';
import type { Animal, AnimalPhoto, BarnDatabaseSnapshot } from '../models';
import { computeSnapshotChecksum } from '../snapshotChecksum';

const animal = (id: string, name: string, rev = 1): Animal =>
  ({ id, name, species: 'Sheep', _rev: rev, status: 'Active' }) as Animal;

const photo = (id: string, dataUrl: string): AnimalPhoto =>
  ({ id, animalId: 'a1', species: 'Sheep', dataUrl, thumbnailDataUrl: 'thumb' }) as AnimalPhoto;

const snapshot = (over: Partial<BarnDatabaseSnapshot> = {}): BarnDatabaseSnapshot =>
  ({
    settings: { defaultSpecies: 'Sheep' },
    speciesProfiles: [],
    animals: [animal('a1', 'Ada'), animal('a2', 'Bess')],
    animalPhotos: [photo('p1', 'data:image/png;base64,AAAA')],
    cages: [],
    breedings: [],
    tasks: [],
    careLogs: [],
    shows: [],
    feedBatches: [],
    feedAllocations: [],
    ...over,
  }) as unknown as BarnDatabaseSnapshot;

describe('computeSnapshotChecksum', () => {
  it('ignores photo payload differences between a full read and a lightweight read', () => {
    const full = snapshot();
    const lightweight = snapshot({
      animalPhotos: [{ ...photo('p1', '') }],
    });
    (lightweight.animalPhotos[0] as { dataUrl?: string }).dataUrl = undefined;
    expect(computeSnapshotChecksum(lightweight)).toBe(computeSnapshotChecksum(full));
  });

  it('ignores collection order and key order', () => {
    const forward = snapshot();
    const reversed = snapshot({ animals: [animal('a2', 'Bess'), animal('a1', 'Ada')] });
    expect(computeSnapshotChecksum(reversed)).toBe(computeSnapshotChecksum(forward));
  });

  it('changes when a record value changes at the same revision', () => {
    const before = computeSnapshotChecksum(snapshot());
    const after = computeSnapshotChecksum(snapshot({ animals: [animal('a1', 'Zed'), animal('a2', 'Bess')] }));
    expect(after).not.toBe(before);
  });

  it('ignores the backup bookkeeping a restore deliberately strips', () => {
    const before = computeSnapshotChecksum(snapshot());
    const withBookkeeping = snapshot();
    withBookkeeping.settings = {
      ...withBookkeeping.settings,
      lastBackupMeta: { exportedAtIso: '2026-01-01T00:00:00.000Z', format: 'json' },
      backupReminderSnoozedUntilMs: 1234,
    };
    expect(computeSnapshotChecksum(withBookkeeping)).toBe(before);
  });
});
