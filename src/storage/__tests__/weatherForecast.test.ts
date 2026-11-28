// @vitest-environment jsdom
/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Coverage for the strictly opt-in weather client. Everything here runs against a stubbed `fetch`
 * and a real jsdom `localStorage`: the point is the branches a breeder actually hits — offline with
 * and without a cached forecast, a stale cache, an HTTP failure, a timeout, a malformed payload, and
 * a manual-offline override — never a real network call to Open-Meteo.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearWeatherForecastCache,
  fetchWeeklyWeatherForecast,
  isWeatherCacheFresh,
  readCachedWeatherForecast,
  searchWeatherLocations,
} from '../weatherForecast';
import { setManualOfflineMode } from '../storageProtection';
import type { WeatherForecastBundle } from '../../domain/breedingCalendar';

const CACHE_KEY = 'pedigree.weatherForecast.cache.v1';
/** The plain copy a breeder sees when the browser cannot reach Open-Meteo at all. */
const CONNECTION_MESSAGE =
  'Could not reach Open-Meteo — check your internet connection and try again.';

function bundle(overrides: Partial<WeatherForecastBundle> = {}): WeatherForecastBundle {
  return {
    fetchedAtIso: new Date().toISOString(),
    locationLabel: 'Copper Creek',
    latitude: 44.5,
    longitude: -72.9,
    days: [
      {
        dateIso: '2026-11-28',
        tempMaxC: 4.2,
        tempMinC: -3.1,
        precipitationProbabilityMax: 40,
        weatherCode: 3,
        label: 'Overcast',
        iconEmoji: '☁️',
      },
    ],
    ...overrides,
  };
}

function jsonResponse(payload: unknown, init: { ok?: boolean; status?: number } = {}): Response {
  const ok = init.ok ?? true;
  const status = init.status ?? (ok ? 200 : 500);
  return {
    ok,
    status,
    json: async () => payload,
  } as unknown as Response;
}

const originalOnLine = Object.getOwnPropertyDescriptor(Navigator.prototype, 'onLine');

function setNavigatorOnline(online: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => online });
}

beforeEach(() => {
  window.localStorage.clear();
  setManualOfflineMode(false);
  setNavigatorOnline(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.localStorage.clear();
  setManualOfflineMode(false);
  if (originalOnLine) {
    Object.defineProperty(Navigator.prototype, 'onLine', originalOnLine);
  }
});

describe('weather cache', () => {
  it('round-trips a bundle and rejects a different location', () => {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(bundle()));

    const cached = readCachedWeatherForecast(44.5, -72.9);
    expect(cached?.locationLabel).toBe('Copper Creek');
    expect(readCachedWeatherForecast(10, 10)).toBeNull();
  });

  it('treats corrupt or unusable cache entries as empty', () => {
    window.localStorage.setItem(CACHE_KEY, '{not json');
    expect(readCachedWeatherForecast(44.5, -72.9)).toBeNull();

    window.localStorage.setItem(CACHE_KEY, JSON.stringify({ latitude: 44.5, longitude: -72.9 }));
    expect(readCachedWeatherForecast(44.5, -72.9)).toBeNull();
  });

  it('clears the cached forecast', () => {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(bundle()));
    clearWeatherForecastCache();
    expect(window.localStorage.getItem(CACHE_KEY)).toBeNull();
  });

  it('only calls a forecast fresh inside the three-hour window', () => {
    const now = Date.parse('2026-11-28T12:00:00.000Z');

    expect(isWeatherCacheFresh(bundle({ fetchedAtIso: '2026-11-28T10:30:00.000Z' }), now)).toBe(true);
    expect(isWeatherCacheFresh(bundle({ fetchedAtIso: '2026-11-28T08:00:00.000Z' }), now)).toBe(false);
    expect(isWeatherCacheFresh(bundle({ fetchedAtIso: '2026-11-28T13:00:00.000Z' }), now)).toBe(false);
    expect(isWeatherCacheFresh(bundle({ fetchedAtIso: 'not-a-date' }), now)).toBe(false);
    expect(isWeatherCacheFresh(bundle({ fetchedAtIso: '' }), now)).toBe(false);
  });
});

describe('searchWeatherLocations', () => {
  it('requires two characters before searching', async () => {
    const result = await searchWeatherLocations(' a ');
    expect(result.results).toEqual([]);
    expect(result.offline).toBe(false);
    expect(result.error).toMatch(/at least 2 characters/);
  });

  it('refuses to search while the device is offline', async () => {
    setNavigatorOnline(false);
    const result = await searchWeatherLocations('Willow');
    expect(result.offline).toBe(true);
    expect(result.error).toMatch(/Device is offline/);
  });

  it('explains the manual offline override', async () => {
    setManualOfflineMode(true);
    const result = await searchWeatherLocations('Willow');
    expect(result.offline).toBe(true);
    expect(result.error).toMatch(/Manual App Offline Mode/);
  });

  it('normalises the geocoding payload and drops unusable rows', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({
        results: [
          { name: 'Willow Bend', latitude: 44.123456, longitude: -72.654321, admin1: 'Vermont', country: 'United States' },
          { name: '', latitude: 1, longitude: 2 },
          { name: 'No Coords' },
        ],
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await searchWeatherLocations('Willow');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('geocoding-api.open-meteo.com');
    expect(url).toContain('name=Willow');
    expect(result.results).toEqual([
      {
        label: 'Willow Bend, Vermont, United States',
        latitude: 44.1235,
        longitude: -72.6543,
        admin1: 'Vermont',
        country: 'United States',
      },
    ]);
  });

  it('reports an HTTP failure and a timeout', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({}, { ok: false, status: 503 })));
    await expect(searchWeatherLocations('Willow')).resolves.toMatchObject({
      offline: false,
      error: 'Location lookup failed (HTTP 503).',
    });

    const abort = new Error('aborted');
    abort.name = 'AbortError';
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(abort)));
    await expect(searchWeatherLocations('Willow')).resolves.toMatchObject({
      error: 'Location lookup timed out after 6 seconds.',
    });

    // A transport failure must read as a connection problem, never as `Failed to fetch`.
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    await expect(searchWeatherLocations('Willow')).resolves.toMatchObject({
      offline: false,
      error: CONNECTION_MESSAGE,
    });
  });
});

describe('fetchWeeklyWeatherForecast', () => {
  it('rejects missing coordinates', async () => {
    await expect(
      fetchWeeklyWeatherForecast({ latitude: Number.NaN, longitude: 0, locationLabel: 'x' })
    ).resolves.toMatchObject({ bundle: null, source: 'error' });
  });

  it('serves a fresh cache without touching the network', async () => {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(bundle()));
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchWeeklyWeatherForecast({
      latitude: 44.5,
      longitude: -72.9,
      locationLabel: 'Copper Creek',
    });

    expect(result.source).toBe('cache');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falls back to a stale cache when offline', async () => {
    window.localStorage.setItem(
      CACHE_KEY,
      JSON.stringify(bundle({ fetchedAtIso: '2026-01-01T00:00:00.000Z' }))
    );
    setNavigatorOnline(false);

    const result = await fetchWeeklyWeatherForecast({
      latitude: 44.5,
      longitude: -72.9,
      locationLabel: 'Copper Creek',
    });

    expect(result.source).toBe('offline');
    expect(result.bundle?.locationLabel).toBe('Copper Creek');
    expect(result.message).toMatch(/Offline — showing last cached forecast/);
  });

  it('reports manual offline mode when there is no cache', async () => {
    setManualOfflineMode(true);
    const result = await fetchWeeklyWeatherForecast({
      latitude: 44.5,
      longitude: -72.9,
      locationLabel: 'Copper Creek',
    });
    expect(result.source).toBe('offline');
    expect(result.bundle).toBeNull();
    expect(result.message).toMatch(/Manual App Offline Mode active/);
  });

  it('parses a live payload, clamps precipitation and caches the result', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          daily: {
            time: ['2026-11-28', 'not-a-date', '2026-11-30'],
            weather_code: [3.4, 1, 'abc'],
            temperature_2m_max: [4.26, 9, 11.04],
            temperature_2m_min: [-3.14, 1, null],
            precipitation_probability_max: [140, 20, null],
          },
        })
      )
    );

    const result = await fetchWeeklyWeatherForecast({
      latitude: 44.5,
      longitude: -72.9,
      locationLabel: '  Copper Creek  ',
      forceRefresh: true,
    });

    expect(result.source).toBe('live');
    expect(result.message).toBe('7-day forecast updated.');
    expect(result.bundle?.locationLabel).toBe('Copper Creek');
    expect(result.bundle?.days).toHaveLength(2);
    expect(result.bundle?.days[0]).toMatchObject({
      dateIso: '2026-11-28',
      tempMaxC: 4.3,
      tempMinC: -3.1,
      precipitationProbabilityMax: 100,
      weatherCode: 3,
    });
    expect(result.bundle?.days[1]).toMatchObject({
      dateIso: '2026-11-30',
      precipitationProbabilityMax: null,
      weatherCode: 0,
    });
    expect(window.localStorage.getItem(CACHE_KEY)).toContain('Copper Creek');
  });

  it('reports an empty forecast payload as an error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ daily: { time: [] } })));
    const result = await fetchWeeklyWeatherForecast({
      latitude: 44.5,
      longitude: -72.9,
      locationLabel: 'Copper Creek',
    });
    expect(result.source).toBe('error');
    expect(result.message).toMatch(/did not contain daily forecast values/);
  });

  it('reports HTTP and timeout failures while keeping the cache', async () => {
    window.localStorage.setItem(
      CACHE_KEY,
      JSON.stringify(bundle({ fetchedAtIso: '2026-01-01T00:00:00.000Z' }))
    );
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({}, { ok: false, status: 502 })));

    const http = await fetchWeeklyWeatherForecast({
      latitude: 44.5,
      longitude: -72.9,
      locationLabel: 'Copper Creek',
      forceRefresh: true,
    });
    expect(http.source).toBe('error');
    expect(http.message).toBe('Weather service returned HTTP 502.');
    expect(http.bundle?.locationLabel).toBe('Copper Creek');

    const abort = new Error('aborted');
    abort.name = 'AbortError';
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(abort)));
    const timedOut = await fetchWeeklyWeatherForecast({
      latitude: 44.5,
      longitude: -72.9,
      locationLabel: 'Copper Creek',
      forceRefresh: true,
    });
    expect(timedOut.message).toBe('Weather forecast request timed out after 6 seconds.');

    // An unreachable network keeps the cached forecast and explains the connection problem plainly.
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    const unreachable = await fetchWeeklyWeatherForecast({
      latitude: 44.5,
      longitude: -72.9,
      locationLabel: 'Copper Creek',
      forceRefresh: true,
    });
    expect(unreachable.source).toBe('error');
    expect(unreachable.message).toBe(CONNECTION_MESSAGE);
    expect(unreachable.bundle?.locationLabel).toBe('Copper Creek');
    expect(window.localStorage.getItem(CACHE_KEY)).toContain('2026-01-01T00:00:00.000Z');
  });
});
