import { beforeEach, describe, expect, it } from 'vitest';
import type { Animal, AnimalPhoto, BarnTask } from '../../domain/models';
import {
  collectionRevKey,
  invalidateSpeciesSelectorCache,
  memoizeByCollectionRev,
  resetSpeciesSelectorCache,
  selectSpeciesAnimals,
  selectSpeciesPhotoIndex,
  selectSpeciesTasks,
} from '../barnStore/speciesSelectors';

const animal = (id: string, name: string, rev: number, species = 'Sheep'): Animal =>
  ({ id, name, species, _rev: rev, status: 'Active' }) as Animal;

describe('collectionRevKey', () => {
  beforeEach(() => resetSpeciesSelectorCache());

  it('is stable for the same rows and changes when a revision moves', () => {
    const rows = [animal('a', 'Ada', 1), animal('b', 'Bess', 2)];
    expect(collectionRevKey(rows)).toBe(collectionRevKey([...rows]));
    expect(collectionRevKey(rows)).not.toBe(collectionRevKey([animal('a', 'Ada', 2), rows[1]]));
  });

  it('treats an absent collection as empty', () => {
    expect(collectionRevKey(undefined)).toBe(collectionRevKey([]));
  });
});

describe('dataset replacement', () => {
  beforeEach(() => resetSpeciesSelectorCache());

  it('cannot tell two datasets apart from ids and revisions alone', () => {
    const first = selectSpeciesAnimals([animal('a', 'Ada', 1)], 'Sheep');
    // A restored backup can hold the same id at the same revision with a different name; without
    // an invalidation this signature match is exactly the stale-row hazard.
    const sameSignature = selectSpeciesAnimals([animal('a', 'Zed', 1)], 'Sheep');
    expect(sameSignature).toBe(first);
    expect(sameSignature[0].name).toBe('Ada');
  });

  it('serves the replacement after a restore or import invalidates the cache', () => {
    const before = selectSpeciesAnimals([animal('a', 'Ada', 1)], 'Sheep');
    invalidateSpeciesSelectorCache();
    const after = selectSpeciesAnimals([animal('a', 'Zed', 1)], 'Sheep');
    expect(after).not.toBe(before);
    expect(after[0].name).toBe('Zed');
  });

  it('scopes the memo key to the dataset generation', () => {
    const rows = [animal('a', 'Ada', 1)];
    const before = memoizeByCollectionRev('probe', 'Sheep', rows, () => ({ generation: 1 }));
    invalidateSpeciesSelectorCache();
    const after = memoizeByCollectionRev('probe', 'Sheep', rows, () => ({ generation: 2 }));
    expect(after).not.toBe(before);
    expect(after.generation).toBe(2);
  });
});

describe('selectSpeciesAnimals', () => {
  beforeEach(() => resetSpeciesSelectorCache());

  it('filters by species and sorts by name', () => {
    const rows = [
      animal('a', 'Zoe', 1),
      animal('b', 'Ada', 1),
      animal('c', 'Bella', 1, 'Goats'),
    ];
    expect(selectSpeciesAnimals(rows, 'Sheep').map((a) => a.name)).toEqual(['Ada', 'Zoe']);
  });

  it('returns the cached array while the rev signature is unchanged', () => {
    const rows = [animal('a', 'Ada', 1)];
    const first = selectSpeciesAnimals(rows, 'Sheep');
    const second = selectSpeciesAnimals([...rows], 'Sheep');
    expect(second).toBe(first);
  });

  it('recomputes when a row revision changes', () => {
    const first = selectSpeciesAnimals([animal('a', 'Ada', 1)], 'Sheep');
    const second = selectSpeciesAnimals([animal('a', 'Zed', 2)], 'Sheep');
    expect(second).not.toBe(first);
    expect(second.map((a) => a.name)).toEqual(['Zed']);
  });

  it('keeps species separate', () => {
    const rows = [animal('a', 'Ada', 1), animal('b', 'Bella', 1, 'Goats')];
    expect(selectSpeciesAnimals(rows, 'Goats').map((a) => a.id)).toEqual(['b']);
  });
});

describe('selectSpeciesTasks', () => {
  beforeEach(() => resetSpeciesSelectorCache());

  const task = (
    id: string,
    opts: { completed?: boolean; priority?: 'High' | 'Normal' | 'Low'; animalId?: string } = {}
  ): BarnTask =>
    ({
      id,
      species: 'Sheep',
      completed: opts.completed ?? false,
      priority: opts.priority ?? 'Normal',
      dueDateIso: '2026-02-01',
      linkedAnimalId: opts.animalId,
    }) as BarnTask;

  it('drops incomplete tasks for archived animals but keeps completed ones', () => {
    const archived = [{ ...animal('a', 'Ada', 1), status: 'Archived' as const }] as Animal[];
    const rows = [
      task('open', { animalId: 'a' }),
      task('done', { animalId: 'a', completed: true }),
      task('free'),
    ];
    expect(selectSpeciesTasks(rows, 'Sheep', archived).map((t) => t.id).sort()).toEqual([
      'done',
      'free',
    ]);
  });

  it('orders incomplete first, then by priority', () => {
    const rows = [
      task('low', { priority: 'Low' }),
      task('high', { priority: 'High' }),
      task('done', { completed: true, priority: 'High' }),
    ];
    expect(selectSpeciesTasks(rows, 'Sheep', []).map((t) => t.id)).toEqual([
      'high',
      'low',
      'done',
    ]);
  });
});

describe('selectSpeciesPhotoIndex', () => {
  beforeEach(() => resetSpeciesSelectorCache());

  const photo = (id: string, animalId: string, primary: boolean, sortOrder: number): AnimalPhoto =>
    ({
      id,
      animalId,
      species: 'Sheep',
      isPrimary: primary,
      sortOrder,
      createdAt: '2026-01-01T00:00:00.000Z',
    }) as AnimalPhoto;

  it('buckets photos per animal and surfaces the primary one', () => {
    const index = selectSpeciesPhotoIndex(
      [photo('p1', 'a', false, 2), photo('p2', 'a', true, 5), photo('p3', 'b', false, 0)],
      'Sheep'
    );
    expect(index.animalPhotos).toHaveLength(3);
    expect(index.photosByAnimalId.get('a')?.map((p) => p.id)).toEqual(['p2', 'p1']);
    expect(index.primaryPhotoByAnimalId.get('a')?.id).toBe('p2');
    expect(index.primaryPhotoByAnimalId.get('b')?.id).toBe('p3');
  });
});
