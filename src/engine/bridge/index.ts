/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * PART 1 — FOR HUMANS: The front door for the platform layer: the shared list of things a browser, a phone or a desktop window can each provide.
 * PART 2 — FOR AI / DEVELOPERS:
 *
 * Core Bridge Module (`@engine/bridge`).
 * Pure content-agnostic platform bridge contracts and capability interfaces.
 */

export * from './platformBridge.interface';
export * from './desktopBridgeAdapter';
export * from './platformBridge';
