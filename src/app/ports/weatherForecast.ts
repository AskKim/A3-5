/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * PART 1 — FOR HUMANS: Fetches a short weather forecast only when you let it, and stays quiet while you are offline.
 * PART 2 — FOR AI / DEVELOPERS:
 * Weather forecast lookup capability port.
 *
 * The browser implementation stays in `src/storage/weatherForecast`; the app layer owns that edge, so UI
 * components depend on this contract instead of importing a storage singleton directly. A host
 * shell or a test can substitute its own implementation at the composition layer without touching
 * the components.
 */
export * from '../../storage/weatherForecast';
