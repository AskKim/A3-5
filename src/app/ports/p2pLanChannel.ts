/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * PART 1 — FOR HUMANS: Lets two devices on the same network trade records directly, with no server in between.
 * PART 2 — FOR AI / DEVELOPERS:
 * Peer-to-peer LAN channel capability port.
 *
 * The browser implementation stays in `src/storage/p2pLanChannel`; the app layer owns that edge, so UI
 * components depend on this contract instead of importing a storage singleton directly. A host
 * shell or a test can substitute its own implementation at the composition layer without touching
 * the components.
 */
export * from '../../storage/p2pLanChannel';
