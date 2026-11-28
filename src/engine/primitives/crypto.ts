/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * PART 1 — FOR HUMANS: Hashing and password-based encryption, so a backup file can be locked with a passphrase.
 * PART 2 — FOR AI / DEVELOPERS:
 *
 * Pure Content-Agnostic Hashing & Encrypted Envelope Primitives
 * (`@engine/primitives/crypto.ts`).
 *
 * Zero DOM, zero Node built-ins, zero domain terminology.
 */

import { strFromU8, strToU8, zipSync } from 'fflate';
import {
  base64ToBytesPure,
  bytesToBase64Pure,
  bytesToUtf8String,
  utf8StringToBytes,
} from '../binaryEncoding';
import { MAX_JSON_BACKUP_BYTES, safeUnzipArchive } from './sanitization';

export function fnv1a64Hex(bytes: Uint8Array): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < bytes.length; i += 1) {
    h1 ^= bytes[i];
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= bytes[i] ^ (i & 0xff);
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

export function fnv1a32Base36(input: string): string {
  let h1 = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h1 ^= input.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193);
  }
  return (h1 >>> 0).toString(36);
}

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits));
}

/**
 * Synchronous, dependency-free pure TypeScript SHA-256 hex digest.
 */
export function sha256HexPure(input: Uint8Array | string): string {
  const bytes = typeof input === 'string' ? utf8StringToBytes(input) : input;
  const bitLenHi = Math.floor((bytes.length * 8) / 0x100000000);
  const bitLenLo = (bytes.length * 8) >>> 0;

  const paddedLen = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(bytes, 0);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLen - 8, bitLenHi, false);
  view.setUint32(paddedLen - 4, bitLenLo, false);

  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const w = new Uint32Array(64);

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i += 1) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i += 1) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (hh + s1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;

      hh = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + hh) >>> 0;
  }

  let hex = '';
  for (let i = 0; i < h.length; i += 1) {
    hex += h[i].toString(16).padStart(8, '0');
  }
  return hex;
}

export interface GenericEncryptedEnvelope {
  format: string;
  cipher: 'AES-256-GCM';
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  saltBase64: string;
  ivBase64: string;
  payloadKind: string;
  originalFileName?: string;
  createdAtIso: string;
  ciphertextBase64: string;
}

export function isGenericEncryptedEnvelope(
  value: unknown,
  expectedFormat?: string
): value is GenericEncryptedEnvelope {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const obj = value as Record<string, unknown>;
  if (expectedFormat && obj.format !== expectedFormat) return false;
  return (
    typeof obj.format === 'string' &&
    obj.format.length > 0 &&
    obj.cipher === 'AES-256-GCM' &&
    obj.kdf === 'PBKDF2-SHA256' &&
    typeof obj.iterations === 'number' &&
    Number.isFinite(obj.iterations) &&
    obj.iterations >= 10_000 &&
    typeof obj.saltBase64 === 'string' &&
    obj.saltBase64.length > 0 &&
    typeof obj.ivBase64 === 'string' &&
    obj.ivBase64.length > 0 &&
    typeof obj.ciphertextBase64 === 'string' &&
    obj.ciphertextBase64.length > 0
  );
}

export function wrapGenericEncryptedZip(options: {
  envelope: GenericEncryptedEnvelope;
  payloadEntryName?: string;
  readmeTitle?: string;
  restoreHint?: string;
  originalFileNameLabel?: string;
}): Uint8Array {
  const payloadEntry = options.payloadEntryName || 'ENCRYPTED-PAYLOAD.json';
  const title = options.readmeTitle || 'Passphrase-Encrypted Archive';
  const restoreHint =
    options.restoreHint || 'Restore via application backup import with your passphrase.';
  const fileNameLabel = options.originalFileNameLabel ?? options.envelope.originalFileName;

  const readme = [
    title,
    `Created: ${options.envelope.createdAtIso}`,
    `Cipher: ${options.envelope.cipher} (${options.envelope.kdf}, ${options.envelope.iterations.toLocaleString()} iterations)`,
    fileNameLabel ? `Original File: ${fileNameLabel}` : '',
    '',
    restoreHint,
  ]
    .filter(Boolean)
    .join('\n');

  return zipSync({
    [payloadEntry]: [strToU8(JSON.stringify(options.envelope, null, 2)), { level: 6 }],
    'README-ENCRYPTED.txt': [strToU8(readme), { level: 6 }],
  });
}

export function tryParseGenericEncryptedEnvelopeJson(
  text: string,
  expectedFormat?: string
): GenericEncryptedEnvelope | null {
  if (!text) return null;
  if (expectedFormat && !text.includes(expectedFormat)) return null;
  try {
    const parsed: unknown = JSON.parse(text);
    return isGenericEncryptedEnvelope(parsed, expectedFormat) ? parsed : null;
  } catch {
    return null;
  }
}

function isZipMagicHeader(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

export function tryExtractGenericEncryptedEnvelopeFromZip(
  bytes: Uint8Array,
  options?: {
    fileName?: string;
    expectedFormat?: string;
    payloadEntryName?: string;
    maxPayloadBytes?: number;
  }
): GenericEncryptedEnvelope | null {
  if (!isZipMagicHeader(bytes)) return null;
  const payloadEntryName = options?.payloadEntryName || 'ENCRYPTED-PAYLOAD.json';
  const maxPayloadBytes = options?.maxPayloadBytes ?? MAX_JSON_BACKUP_BYTES;
  try {
    const unzipped = safeUnzipArchive(bytes, {
      archiveName: options?.fileName || 'encrypted.zip',
      maxEntries: 16,
      entryFilter: (p) => p.replace(/\\/g, '/').toLowerCase() === payloadEntryName.toLowerCase(),
    });
    const entryBytes = unzipped[payloadEntryName] || Object.values(unzipped)[0];
    if (!entryBytes || entryBytes.byteLength > maxPayloadBytes) {
      return null;
    }
    return tryParseGenericEncryptedEnvelopeJson(strFromU8(entryBytes), options?.expectedFormat);
  } catch {
    return null;
  }
}

export const DEFAULT_GENERIC_PBKDF2_ITERATIONS = 100_000;

export function supportsPassphraseCryptoGeneric(): boolean {
  return (
    typeof globalThis !== 'undefined' &&
    Boolean(globalThis.crypto?.subtle) &&
    typeof globalThis.crypto?.getRandomValues === 'function'
  );
}

function getSubtleCryptoGeneric(): SubtleCrypto {
  if (!supportsPassphraseCryptoGeneric()) {
    throw new Error(
      'Passphrase encryption (Web Crypto AES-GCM) is unavailable in this browser context.'
    );
  }
  return globalThis.crypto.subtle;
}

function toExactArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

async function deriveAesGcmKeyGeneric(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
  usage: 'encrypt' | 'decrypt',
  minPassphraseLength = 4
): Promise<CryptoKey> {
  if (!passphrase || passphrase.length < minPassphraseLength) {
    throw new Error(`Enter a passphrase of at least ${minPassphraseLength} characters.`);
  }
  const subtle = getSubtleCryptoGeneric();
  const baseKey = await subtle.importKey(
    'raw',
    toExactArrayBuffer(utf8StringToBytes(passphrase)),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toExactArrayBuffer(salt),
      iterations,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    [usage]
  );
}

export interface GenericPassphraseEncryptOptions {
  format?: string;
  payloadKind: string;
  originalFileName?: string;
  iterations?: number;
  defaultIterations?: number;
  createdAtIso?: string;
  minPassphraseLength?: number;
}

export interface GenericPassphraseDecryptOptions {
  minPassphraseLength?: number;
  missingPassphraseMessage?: string;
  corruptedHeaderMessage?: string;
  invalidPassphraseMessage?: string;
}

export async function encryptBytesWithPassphraseGeneric(
  bytes: Uint8Array,
  passphrase: string,
  options: GenericPassphraseEncryptOptions
): Promise<GenericEncryptedEnvelope> {
  const subtle = getSubtleCryptoGeneric();
  const baseIterations = options.defaultIterations ?? DEFAULT_GENERIC_PBKDF2_ITERATIONS;
  const iterations = Math.max(10_000, Math.round(options.iterations ?? baseIterations));
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesGcmKeyGeneric(
    passphrase,
    salt,
    iterations,
    'encrypt',
    options.minPassphraseLength
  );

  const cipherBuffer = await subtle.encrypt(
    { name: 'AES-GCM', iv: toExactArrayBuffer(iv) },
    key,
    toExactArrayBuffer(bytes)
  );

  return {
    format: options.format || 'generic-encrypted-envelope-v1',
    cipher: 'AES-256-GCM',
    kdf: 'PBKDF2-SHA256',
    iterations,
    saltBase64: bytesToBase64Pure(salt),
    ivBase64: bytesToBase64Pure(iv),
    payloadKind: options.payloadKind,
    originalFileName: options.originalFileName,
    createdAtIso: options.createdAtIso || new Date().toISOString(),
    ciphertextBase64: bytesToBase64Pure(new Uint8Array(cipherBuffer)),
  };
}

export async function decryptBytesWithPassphraseGeneric(
  envelope: GenericEncryptedEnvelope,
  passphrase: string,
  options?: GenericPassphraseDecryptOptions
): Promise<Uint8Array> {
  if (!passphrase) {
    throw new Error(
      options?.missingPassphraseMessage || 'Passphrase required to unlock encrypted file.'
    );
  }
  const subtle = getSubtleCryptoGeneric();
  const salt = base64ToBytesPure(envelope.saltBase64);
  const iv = base64ToBytesPure(envelope.ivBase64);
  const ciphertext = base64ToBytesPure(envelope.ciphertextBase64);

  if (salt.byteLength < 8 || iv.byteLength !== 12 || ciphertext.byteLength === 0) {
    throw new Error(
      options?.corruptedHeaderMessage || 'Encrypted payload header is damaged or incomplete.'
    );
  }

  const key = await deriveAesGcmKeyGeneric(
    passphrase,
    salt,
    envelope.iterations,
    'decrypt',
    options?.minPassphraseLength
  );

  try {
    const plainBuffer = await subtle.decrypt(
      { name: 'AES-GCM', iv: toExactArrayBuffer(iv) },
      key,
      toExactArrayBuffer(ciphertext)
    );
    return new Uint8Array(plainBuffer);
  } catch {
    throw new Error(
      options?.invalidPassphraseMessage ||
        'Incorrect passphrase or corrupted encrypted archive. Verify the passphrase and try again.'
    );
  }
}

export async function encryptTextWithPassphraseGeneric(
  text: string,
  passphrase: string,
  options: GenericPassphraseEncryptOptions
): Promise<GenericEncryptedEnvelope> {
  return encryptBytesWithPassphraseGeneric(utf8StringToBytes(text), passphrase, options);
}

export async function decryptTextWithPassphraseGeneric(
  envelope: GenericEncryptedEnvelope,
  passphrase: string,
  options?: GenericPassphraseDecryptOptions
): Promise<string> {
  const plainBytes = await decryptBytesWithPassphraseGeneric(envelope, passphrase, options);
  return bytesToUtf8String(plainBytes);
}
