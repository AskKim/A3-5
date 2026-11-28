// @vitest-environment jsdom
/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * The storage suite pins the weather client's copy; this mounts the real drawer so the promise the
 * breeder actually gets is checked end to end: a failed Refresh explains the connection in plain
 * words and the cached 7-day strip stays on screen instead of vanishing.
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BreedingCalendarPanel } from '../BreedingCalendarPanel';
import type { BarnDatabaseSnapshot, BarnSettings } from '../../domain/models';
import type { WeatherForecastBundle } from '../../domain/breedingCalendar';
import { buildFullPredefinedSampleSnapshot } from '../../domain/sampleData';

const CACHE_KEY = 'pedigree.weatherForecast.cache.v1';
const CONNECTION_MESSAGE =
  'Could not reach Open-Meteo — check your internet connection and try again.';

const snapshot: BarnDatabaseSnapshot = buildFullPredefinedSampleSnapshot();
const speciesProfile = snapshot.speciesProfiles[0];

const weatherSettings: BarnSettings = {
  ...snapshot.settings,
  weatherForecast: {
    enabled: true,
    locationLabel: 'Copper Creek',
    latitude: 44.5,
    longitude: -72.9,
    temperatureUnit: 'F',
  },
};

/** A fresh cache (fetched now), so mounting renders it without any network call. */
function cachedBundle(): WeatherForecastBundle {
  return {
    fetchedAtIso: new Date().toISOString(),
    locationLabel: 'Copper Creek',
    latitude: 44.5,
    longitude: -72.9,
    days: [
      {
        dateIso: '2026-11-28',
        tempMaxC: 15.6,
        tempMinC: 0.5,
        precipitationProbabilityMax: 0,
        weatherCode: 0,
        label: 'Clear Sky',
        iconEmoji: '☀️',
      },
      {
        dateIso: '2026-11-29',
        tempMaxC: 18.5,
        tempMinC: 4.5,
        precipitationProbabilityMax: 99,
        weatherCode: 3,
        label: 'Overcast',
        iconEmoji: '☁️',
      },
    ],
  };
}

function renderPanel() {
  return render(
    <BreedingCalendarPanel
      speciesProfile={speciesProfile}
      breedings={snapshot.breedings.filter((b) => b.species === speciesProfile.name)}
      tasks={snapshot.tasks.filter((t) => t.species === speciesProfile.name)}
      shows={snapshot.shows.filter((s) => s.species === speciesProfile.name)}
      animals={snapshot.animals.filter((a) => a.species === speciesProfile.name)}
      settings={weatherSettings}
      onUpdateSettings={vi.fn()}
    />
  );
}

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem(CACHE_KEY, JSON.stringify(cachedBundle()));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('BreedingCalendarPanel weather drawer', () => {
  it('shows the cached forecast days on mount without touching the network', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    renderPanel();

    expect(screen.getByText('Copper Creek')).toBeTruthy();
    // The strip line carries the day label *and* its precipitation; the selected-day details do not.
    expect(screen.getByText(/Clear Sky\s*·\s*0%/)).toBeTruthy();
    expect(screen.getByText(/Overcast\s*·\s*99%/)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('explains a failed refresh in plain words and keeps the cached days visible', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));

    renderPanel();

    const daysBefore = screen.getByText(/Clear Sky\s*·\s*0%/).textContent;
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    await screen.findByText(CONNECTION_MESSAGE);
    expect(screen.queryByText('Failed to fetch')).toBeNull();
    expect(screen.getByText(/Clear Sky\s*·\s*0%/).textContent).toBe(daysBefore);
    expect(screen.getByText(/Overcast\s*·\s*99%/)).toBeTruthy();
    expect(screen.getByText('Copper Creek')).toBeTruthy();
  });
});
