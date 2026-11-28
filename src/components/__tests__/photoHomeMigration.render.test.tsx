// @vitest-environment jsdom
/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Mount coverage for the animal photo gallery, the home species dashboard and the cross-species
 * migration modal — three screens that carried zero executable statements. The gallery renders a
 * real two-photo set (thumbnail strip, viewer, primary flag), home renders every sample species card
 * plus the first-run barn naming form, and the migration modal walks its configure → confirm flow.
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnimalPhotoGallery } from '../AnimalPhotoGallery';
import { HomeSpeciesScreen } from '../HomeSpeciesScreen';
import { SpeciesMigrationModal } from '../SpeciesMigrationModal';
import { buildFullPredefinedSampleSnapshot } from '../../domain/sampleData';
import type { AnimalPhoto } from '../../domain/models';

const snapshot = buildFullPredefinedSampleSnapshot();
const animal = snapshot.animals[0];

function makePhoto(id: string, isPrimary: boolean): AnimalPhoto {
  return {
    id,
    species: animal.species,
    animalId: animal.id,
    isPrimary,
    sortOrder: isPrimary ? 0 : 1,
    caption: isPrimary ? 'Best side profile' : 'Second angle',
    originalFileName: `${id}.jpg`,
    mimeType: 'image/jpeg',
    width: 800,
    height: 600,
    originalBytes: 120_000,
    storedBytes: 60_000,
    thumbnailDataUrl: 'data:image/jpeg;base64,AAAA',
    dataUrl: 'data:image/jpeg;base64,BBBB',
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-01T10:00:00.000Z',
  };
}

function renderHome(overrides: Partial<ComponentProps<typeof HomeSpeciesScreen>> = {}) {
  const onOpenSpecies = vi.fn();
  const onSaveBarnName = vi.fn();
  render(
    <HomeSpeciesScreen
      snapshot={snapshot}
      onOpenSpecies={onOpenSpecies}
      onMoveSpeciesCard={vi.fn()}
      onReorderSpeciesCards={vi.fn()}
      onSaveBarnName={onSaveBarnName}
      onHideSummaryGrid={vi.fn()}
      onIgnoreTaskAlerts={vi.fn()}
      onClearTaskAlertGroup={vi.fn()}
      onNavigateToAddSpecies={vi.fn()}
      {...overrides}
    />
  );
  return { onOpenSpecies, onSaveBarnName };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('AnimalPhotoGallery', () => {
  it('summarises the footprint and promotes a secondary photo', () => {
    const onSetPrimary = vi.fn();
    render(
      <AnimalPhotoGallery
        animal={animal}
        photos={[makePhoto('p1', true), makePhoto('p2', false)]}
        onAddPhotos={vi.fn()}
        onSetPrimary={onSetPrimary}
        onUpdateCaption={vi.fn()}
        onDeletePhoto={vi.fn()}
      />
    );

    expect(screen.getByText('Animal Photos (2)')).toBeTruthy();
    expect(screen.getByText(/Saved 50%/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Set Primary' }));
    expect(onSetPrimary).toHaveBeenCalledWith('p2');
  });

  it('opens the full-size viewer and steps between photos', () => {
    render(
      <AnimalPhotoGallery
        animal={animal}
        photos={[makePhoto('p1', true), makePhoto('p2', false)]}
        onAddPhotos={vi.fn()}
        onSetPrimary={vi.fn()}
        onUpdateCaption={vi.fn()}
        onDeletePhoto={vi.fn()}
      />
    );

    fireEvent.click(screen.getAllByLabelText('Inspect full size')[0]);
    expect(screen.getByLabelText('Close photo viewer')).toBeTruthy();
    fireEvent.click(screen.getAllByLabelText('Next photo')[0]);
    fireEvent.click(screen.getAllByLabelText('Previous photo')[0]);
    fireEvent.click(screen.getByLabelText('Close photo viewer'));
    expect(screen.queryByLabelText('Close photo viewer')).toBeNull();
  });

  it('deletes a photo after the inline confirmation', () => {
    const onDeletePhoto = vi.fn();
    render(
      <AnimalPhotoGallery
        animal={animal}
        photos={[makePhoto('p1', true), makePhoto('p2', false)]}
        onAddPhotos={vi.fn()}
        onSetPrimary={vi.fn()}
        onUpdateCaption={vi.fn()}
        onDeletePhoto={onDeletePhoto}
      />
    );

    fireEvent.click(screen.getAllByLabelText('Delete photo')[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onDeletePhoto).toHaveBeenCalledWith('p1');
  });
});

describe('HomeSpeciesScreen', () => {
  it('names the barn on first run', () => {
    const { onSaveBarnName } = renderHome();

    expect(screen.getByText('Welcome — Name Your Barn, Rabbitry, or Farm')).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText(/Copper Creek/i), {
      target: { value: 'Willow Bend Warren' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Farm Name' }));
    expect(onSaveBarnName).toHaveBeenCalledWith('Willow Bend Warren');
  });

  it('lists every sample species and opens a hub', () => {
    const { onOpenSpecies } = renderHome();

    expect(screen.getByText('Your Livestock (11)')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Open Hub' })[0]);
    expect(onOpenSpecies).toHaveBeenCalledWith('Rabbit', expect.anything());
  });
});

describe('SpeciesMigrationModal', () => {
  it('walks from configuring the move to the confirm step', () => {
    const onConfirmMigrate = vi.fn();
    render(
      <SpeciesMigrationModal
        snapshot={snapshot}
        sourceSpecies={animal.species}
        directAnimalIds={[animal.id]}
        mode="single"
        onConfirmMigrate={onConfirmMigrate}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(new RegExp(`Move .* to Another Species`))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Review & Confirm Migration/ }));
    expect(screen.getByText('Confirm Cross-Species Migration')).toBeTruthy();
  });
});
