/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * PART 1 — FOR HUMANS: Encrypts and decrypts backups with a passphrase you choose.
 * PART 2 — FOR AI / DEVELOPERS:
 * Backup passphrase encryption capability port.
 *
 * The browser implementation stays in `src/storage/passphraseCrypto`; the app layer owns that edge, so UI
 * components depend on this contract instead of importing a storage singleton directly. A host
 * shell or a test can substitute its own implementation at the composition layer without touching
 * the components.
 */
export * from '../../storage/passphraseCrypto';
