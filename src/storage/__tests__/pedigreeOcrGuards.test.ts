/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Guard coverage for the offline pedigree scanner. OCR itself needs a real page image, but the two
 * paths a user hits most often are pure file validation: an SVG vector upload must be refused with
 * the security message, and a PDF that carries no searchable text or embedded scan must degrade to
 * the manual-entry page instead of throwing. Both run without any OCR engine, worker or network.
 */

import { describe, expect, it, vi } from 'vitest';
import { scanPedigreeDocumentFile } from '../pedigreeOcrScanner';

const textEncoder = new TextEncoder();

describe('scanPedigreeDocumentFile guards', () => {
  it('refuses SVG vector uploads and reports the security reason', async () => {
    const svg = new File(
      ['<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" /></svg>'],
      'pedigree-chart.svg',
      { type: 'image/svg+xml' }
    );
    const onProgress = vi.fn();

    const result = await scanPedigreeDocumentFile(svg, {
      fallbackSpecies: 'Rabbit',
      onProgress,
    });

    expect(result.status).toBe('invalid_file');
    expect(result.isPdf).toBe(false);
    expect(result.pages).toHaveLength(0);
    expect(result.errorMessage).toMatch(/SVG vector files are blocked for security/);
    expect(onProgress).toHaveBeenCalledWith('Reading pedigree document...', 8);
  });

  it('falls back to a manual page when a PDF carries no text or embedded scan', async () => {
    const pdf = new File(
      [textEncoder.encode('%PDF-1.4\n% not a real pdf body\n')],
      'scanned-pedigree.pdf',
      { type: 'application/pdf' }
    );
    const onProgress = vi.fn();

    const result = await scanPedigreeDocumentFile(pdf, {
      fallbackSpecies: 'Rabbit',
      preferredUnit: 'kg',
      onProgress,
    });

    expect(result.status).toBe('pdf_unsupported');
    expect(result.isPdf).toBe(true);
    expect(result.pages).toHaveLength(1);
    const page = result.pages[0];
    expect(page.engine).toBe('none');
    expect(page.parseResult.detectedSpecies).toBe('Rabbit');
    expect(page.parseResult.layoutMode).toBe('manual_empty');
    expect(page.parseResult.populatedSlotCount).toBe(0);
    expect(result.errorMessage).toMatch(/No searchable text or embedded JPEG page scans/);
    expect(onProgress).toHaveBeenCalledWith('Reading pedigree document...', 8);
  });


});
