// @vitest-environment jsdom
/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * External importer panel: the staging -> review -> merge flow a breeder runs when bringing a
 * spreadsheet, HerdBoss archive or OCR scan into the barn. The parser runs off-thread, so this
 * stubs it to keep the test on the panel's own contract: what gets staged, what the review queue
 * promises, and exactly which preview is handed back to the store on merge.
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PlatformImportPreview } from '../../domain/importers/importerTypes';
import type { ConflictSelectionMap } from '../../domain/importers/conflictResolver';
import { buildFullPredefinedSampleSnapshot } from '../../domain/sampleData';
import type { Animal, AnimalPhoto } from '../../domain/models';
import { ExternalImporterPanel } from '../ExternalImporterPanel';

const downloadTextFileMock = vi.fn(
  async (_fileName: string, _content: string, _mimeType?: string) => undefined
);

vi.mock('../../utils/webFileActions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/webFileActions')>();
  return {
    ...actual,
    downloadTextFile: (...args: Parameters<typeof actual.downloadTextFile>) =>
      downloadTextFileMock(...args),
  };
});

const parseExternalImportMock = vi.fn(
  async (..._args: Parameters<typeof import('../../storage/offThreadWorkerClient').parseExternalImportOffThread>): Promise<PlatformImportPreview> => {
    throw new Error('parseExternalImportOffThread mock was not given a preview');
  }
);

vi.mock('../../storage/offThreadWorkerClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../storage/offThreadWorkerClient')>();
  return {
    ...actual,
    parseExternalImportOffThread: (...args: Parameters<typeof actual.parseExternalImportOffThread>) =>
      parseExternalImportMock(...args),
  };
});

afterEach(() => {
  cleanup();
  downloadTextFileMock.mockClear();
  parseExternalImportMock.mockClear();
  vi.restoreAllMocks();
});

function buildPreview(animals: Animal[]): PlatformImportPreview {
  return {
    platformId: 'universal-pedigree',
    platformName: 'Universal Pedigree / Spreadsheet',
    archiveNames: ['herd.csv'],
    diagnostics: [],
    stagedPhotos: [],
    stagedPhotosRawBytes: 0,
    missingPhotoZipRefsCount: 0,
    deferredMediaCount: 0,
    deferredMediaBytes: 0,
    deferredMediaSampleNames: [],
    deferredManifestRowCount: 0,
    animalsWithMultipleImagesCount: 0,
    warnings: [],
    speciesDetected: ['Rabbit'],
    newSpeciesProfiles: [],
    animals,
    matchedExistingAnimalsCount: 0,
    conflicts: [],
    parentLinksResolved: 0,
    placeholderAncestorsCreated: 0,
    cages: [],
    breedings: [],
    tasks: [],
    careLogs: [],
    shows: [],
    schemaDiagnosticReport: 'herd.csv · 1 row · headers: Name, Species',
  };
}

function renderPanel(overrides: Partial<React.ComponentProps<typeof ExternalImporterPanel>> = {}) {
  const snapshot = buildFullPredefinedSampleSnapshot();
  const onCommitImport = vi.fn(
    async (
      _preview: PlatformImportPreview,
      _optimizedPhotos: AnimalPhoto[],
      _conflictSelections: ConflictSelectionMap
    ) => undefined
  );
  const utils = render(
    <ExternalImporterPanel
      snapshot={snapshot}
      activeSpeciesName={snapshot.speciesProfiles[0]?.name ?? 'Rabbit'}
      onCommitImport={onCommitImport}
      {...overrides}
    />
  );
  return { ...utils, snapshot, onCommitImport };
}

describe('ExternalImporterPanel', () => {
  it('mounts with the HerdBoss importer first and its staging controls', () => {
    renderPanel();

    expect(screen.getAllByText(/HerdBoss/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Select HerdBoss \.ZIP File\(s\)/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Download Starter CSV Template/i })).toBeTruthy();
  });

  it('downloads the starter CSV template and confirms the columns it contains', async () => {
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: /Download Starter CSV Template/i }));

    await waitFor(() => expect(downloadTextFileMock).toHaveBeenCalledTimes(1));
    const [fileName, content, mimeType] = downloadTextFileMock.mock.calls[0];
    expect(fileName).toMatch(/\.csv$/i);
    expect(mimeType).toContain('text/csv');
    expect(content.length).toBeGreaterThan(0);
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toMatch(/Downloaded .*\.csv/i)
    );
  });

  it('stages an uploaded file, shows the parsed preview, then merges it into the barn', async () => {
    const snapshot = buildFullPredefinedSampleSnapshot();
    const incoming: Animal = {
      ...snapshot.animals[0],
      id: 'incoming-import-1',
      name: 'Imported Bramble',
      tattoo: 'IMP1',
    };
    parseExternalImportMock.mockResolvedValue(buildPreview([incoming]));

    const { onCommitImport, container } = renderPanel({ snapshot });
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['Name,Species\nImported Bramble,Rabbit\n'], 'herd.csv', {
      type: 'text/csv',
    });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => expect(screen.getByText(/Staged Export Archives \(1\)/i)).toBeTruthy());
    await waitFor(() => expect(parseExternalImportMock).toHaveBeenCalledTimes(1));

    const mergeButton = await screen.findByRole('button', { name: /Merge 1 Animals/i });
    expect(mergeButton.textContent).toMatch(/Records Into Barn/i);

    fireEvent.click(mergeButton);

    await waitFor(() => expect(onCommitImport).toHaveBeenCalledTimes(1));
    const [preview, optimizedPhotos, conflictSelections] = onCommitImport.mock.calls[0];
    expect(preview.animals.map((animal) => animal.id)).toEqual(['incoming-import-1']);
    expect(optimizedPhotos).toEqual([]);
    expect(conflictSelections).toEqual({});
    // Committing clears the staging tray so the same rows cannot be merged twice.
    await waitFor(() =>
      expect(screen.queryByText(/Staged Export Archives/i)).toBeNull()
    );
  });

  it('surfaces an off-thread parse failure instead of offering a merge', async () => {
    parseExternalImportMock.mockRejectedValue(new Error('Unreadable spreadsheet table'));
    const { container } = renderPanel();
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(fileInput, {
      target: { files: [new File(['not,a,table'], 'broken.csv', { type: 'text/csv' })] },
    });

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('Unreadable spreadsheet table')
    );
    expect(screen.queryByRole('button', { name: /Merge 1 Animals/i })).toBeNull();
  });
});
