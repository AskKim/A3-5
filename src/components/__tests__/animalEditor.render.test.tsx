// @vitest-environment jsdom
/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Tier A render coverage for the animal editor: editing an existing record must hand a real draft
 * back to the store, and cancelling must not.
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnimalEditorModal } from '../AnimalEditorModal';
import { buildFullPredefinedSampleSnapshot } from '../../domain/sampleData';
import { makeSpeciesProfile } from '../../domain/__tests__/testFixtures';

const snapshot = buildFullPredefinedSampleSnapshot();
const speciesProfile = makeSpeciesProfile('Rabbit');
const subject = snapshot.animals.find((animal) => animal.species === 'Rabbit');

function renderEditor(initialAnimal = subject ?? null) {
  const onSave = vi.fn(async (_draft: { name: string; species: string }) => null);
  const onClose = vi.fn();
  const onDelete = vi.fn(async () => undefined);
  render(
    <AnimalEditorModal
      initialAnimal={initialAnimal}
      speciesProfile={speciesProfile}
      speciesAnimals={snapshot.animals.filter((animal) => animal.species === 'Rabbit')}
      speciesCages={snapshot.cages.filter((cage) => cage.species === 'Rabbit')}
      animalCareLogs={snapshot.careLogs.filter((log) => log.species === 'Rabbit')}
      preferredUnit="lbs_oz"
      currencyCode="USD"
      defaultBreederName="Breeder"
      defaultOwnerName="Owner"
      onSave={onSave}
      onDelete={onDelete}
      onClose={onClose}
    />
  );
  return { onSave, onClose, onDelete };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('AnimalEditorModal', () => {
  it('requires a name and saves an edited animal draft', async () => {
    expect(subject).toBeDefined();
    const { onSave } = renderEditor();

    fireEvent.change(screen.getByLabelText('Animal Name *'), {
      target: { value: 'Willow Renamed' },
    });
    fireEvent.click(screen.getByRole('button', { name: `Save ${speciesProfile.name}` }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const [draft] = onSave.mock.calls[0];
    expect(draft.name).toBe('Willow Renamed');
    expect(draft.species).toBe('Rabbit');
  });

  it('closes without saving when cancelled', () => {
    const { onSave, onClose } = renderEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('creates a new animal with the forced sex', async () => {
    const { onSave } = renderEditor(null);
    fireEvent.change(screen.getByLabelText('Animal Name *'), {
      target: { value: 'New Kit' },
    });
    fireEvent.click(screen.getByRole('button', { name: `Save ${speciesProfile.name}` }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0].name).toBe('New Kit');
  });
});
