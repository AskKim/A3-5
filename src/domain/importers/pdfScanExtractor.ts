/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * PART 1 — FOR HUMANS: The older entry point for reading a scanned pedigree, kept so existing code still works.
 * PART 2 — FOR AI / DEVELOPERS:
 *
 * Alpha 2 Compatibility Facade: Offline PDF Scan & Vector Pedigree Extractor
 * (`src/domain/importers/pdfScanExtractor.ts`).
 *
 * Delegates all pure PDF parsing and decompression to the content-agnostic engine in
 * `@engine/primitives/pdfDocumentExtractor.ts`, injecting Pedigree-specific error copy.
 */

export {
  MAX_PDF_SCAN_BYTES,
  MAX_PDF_SCAN_PAGES,
  extractPdfDocumentPages,
  type PdfExtractedTextWord,
  type PdfExtractedPage,
  type PdfExtractionResult,
  type PdfExtractionOptions,
} from '@engine/primitives/pdfDocumentExtractor';

import {
  extractPdfDocumentPages,
  type PdfExtractionResult,
} from '@engine/primitives/pdfDocumentExtractor';

export function extractPedigreePdfPages(pdfBytes: Uint8Array): PdfExtractionResult {
  return extractPdfDocumentPages(pdfBytes, {
    encryptedErrorMessage:
      'This PDF is password-protected or encrypted. Export or screenshot the pedigree page as a JPG/PNG image and scan it here.',
  });
}
