/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * PART 1 — FOR HUMANS: Encrypts and decrypts with a passphrase, using the cryptography built into the browser.
 * PART 2 — FOR AI / DEVELOPERS:
 *
 * Web Crypto Passphrase Encryption & Decryption (PBKDF2-SHA256 + AES-256-GCM)
 * (`src/storage/passphraseCrypto.ts`).
 *
 * Delegates PBKDF2 + AES-256-GCM primitives to `@engine/primitives/crypto`
 * while injecting Pedigree envelope constants and clock-skew-adjusted UTC timestamps.
 */

import {
  decryptBytesWithPassphraseGeneric,
  decryptTextWithPassphraseGeneric,
  encryptBytesWithPassphraseGeneric,
  encryptTextWithPassphraseGeneric,
  supportsPassphraseCryptoGeneric,
} from '@engine/primitives/crypto';
import {
  DEFAULT_PBKDF2_ITERATIONS,
  ENCRYPTED_ENVELOPE_FORMAT,
  EncryptedPayloadEnvelope,
  EncryptedPayloadKind,
} from '../domain/encryptedExport';
import { nowIsoUtc } from '../domain/models';

export function supportsPassphraseCrypto(): boolean {
  return supportsPassphraseCryptoGeneric();
}

export async function encryptBytesWithPassphrase(
  bytes: Uint8Array,
  passphrase: string,
  options: {
    payloadKind: EncryptedPayloadKind;
    originalFileName?: string;
    iterations?: number;
  }
): Promise<EncryptedPayloadEnvelope> {
  const genericEnvelope = await encryptBytesWithPassphraseGeneric(bytes, passphrase, {
    format: ENCRYPTED_ENVELOPE_FORMAT,
    payloadKind: options.payloadKind,
    originalFileName: options.originalFileName,
    iterations: options.iterations,
    defaultIterations: DEFAULT_PBKDF2_ITERATIONS,
    createdAtIso: nowIsoUtc(),
  });
  return {
    ...genericEnvelope,
    format: ENCRYPTED_ENVELOPE_FORMAT,
    payloadKind: options.payloadKind,
  };
}

export async function decryptBytesWithPassphrase(
  envelope: EncryptedPayloadEnvelope,
  passphrase: string
): Promise<Uint8Array> {
  return decryptBytesWithPassphraseGeneric(envelope, passphrase, {
    missingPassphraseMessage: 'Passphrase required to unlock encrypted Pedigree file.',
  });
}

export async function encryptTextWithPassphrase(
  text: string,
  passphrase: string,
  options: {
    payloadKind: EncryptedPayloadKind;
    originalFileName?: string;
    iterations?: number;
  }
): Promise<EncryptedPayloadEnvelope> {
  const genericEnvelope = await encryptTextWithPassphraseGeneric(text, passphrase, {
    format: ENCRYPTED_ENVELOPE_FORMAT,
    payloadKind: options.payloadKind,
    originalFileName: options.originalFileName,
    iterations: options.iterations,
    defaultIterations: DEFAULT_PBKDF2_ITERATIONS,
    createdAtIso: nowIsoUtc(),
  });
  return {
    ...genericEnvelope,
    format: ENCRYPTED_ENVELOPE_FORMAT,
    payloadKind: options.payloadKind,
  };
}

export async function decryptTextWithPassphrase(
  envelope: EncryptedPayloadEnvelope,
  passphrase: string
): Promise<string> {
  return decryptTextWithPassphraseGeneric(envelope, passphrase, {
    missingPassphraseMessage: 'Passphrase required to unlock encrypted Pedigree file.',
  });
}
