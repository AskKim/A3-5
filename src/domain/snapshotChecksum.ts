/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Structural checksum for a barn snapshot — the checksum half of restore verification.
 *
 * Row counts catch a restore that dropped or duplicated records, but not one that landed the right
 * number of rows with the wrong values. This hasher canonicalises the snapshot (sorted keys, sorted
 * collections, volatile payloads removed) so the snapshot the adapter actually committed can be
 * compared with the one that was loaded from the backup file.
 *
 * Volatile keys are excluded on purpose: a committed read uses `lightweightPhotos`, so the same photo
 * arrives with a `thumbnailDataUrl` instead of a `dataUrl`. Those bytes are payload, not identity, and
 * hashing them would report a false mismatch on every successful restore.
 */
import { sha256HexPure } from '../engine/primitives/crypto';
import type { BarnDatabaseSnapshot } from './models';

/** Payload-only fields: present in one read and absent in the other, never part of the record. */
const VOLATILE_KEYS = new Set([
  'dataUrl',
  'thumbnailDataUrl',
  'tagPhotoDataUrl',
  'receiptPhotoDataUrl',
  'checksumSha256',
]);

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    const items = value.map(canonicalize);
    const allRowsHaveIds =
      items.length > 0 &&
      items.every(
        (item) => typeof item === 'object' && item !== null && 'id' in (item as Record<string, unknown>)
      );
    if (!allRowsHaveIds) return items;
    return [...items].sort((a, b) =>
      String((a as { id: unknown }).id).localeCompare(String((b as { id: unknown }).id))
    );
  }
  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      if (VOLATILE_KEYS.has(key)) continue;
      out[key] = canonicalize(source[key]);
    }
    return out;
  }
  return value;
}

/**
 * Stable SHA-256 over the snapshot's records. Two snapshots with the same ids, revisions and field
 * values hash the same regardless of collection or key order and of photo payload differences.
 */
export function computeSnapshotChecksum(snapshot: BarnDatabaseSnapshot): string {
  const settings: Record<string, unknown> = { ...snapshot.settings };
  // Restores deliberately strip these; the committed read can carry them back.
  delete settings.lastBackupMeta;
  delete settings.backupReminderSnoozedUntilMs;
  return sha256HexPure(JSON.stringify(canonicalize({ ...snapshot, settings })));
}
