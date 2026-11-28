/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * PART 1 — FOR HUMANS: The front door for the file-format readers and writers.
 * PART 2 — FOR AI / DEVELOPERS:
 *
 * Modular Core — Pure Codecs Barrel (`@engine/codecs`).
 *
 * Strictly depends only on `@engine/binaryEncoding`, `@engine/primitives/*`, and `fflate`.
 * Zero DOM globals, zero domain terms, zero feature/app imports.
 */

export * from '../binaryEncoding';
export * from '../primitives/qrCodec';
export * from '../primitives/pdfDocumentExtractor';
export * from './archiveAndCsvUtils';
export * from './textFormats';
