/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * PWA update lifecycle capability port.
 *
 * The browser implementation stays in `src/storage/pwaUpdateManager`; the app layer owns that edge, so UI
 * components depend on this contract instead of importing a storage singleton directly. A host
 * shell or a test can substitute its own implementation at the composition layer without touching
 * the components.
 */
export * from '../../storage/pwaUpdateManager';
