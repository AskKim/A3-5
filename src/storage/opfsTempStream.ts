/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * PART 1 — FOR HUMANS: A scratch area inside the browser file system for streaming large files in chunks.
 * PART 2 — FOR AI / DEVELOPERS:
 *
 * Worker-Safe OPFS `/tmp` Scratchpad & Incremental Chunk Streamer (`src/storage/opfsTempStream.ts`).
 *
 * Thin compatibility facade delegating core OPFS handle/stream orchestration to
 * `@engine/storage/opfsStream` while wiring Pedigree UUID generation and preserving
 * 100% of existing exports for `archiveAndImport.worker.ts`, `opfsStorage.ts`, and `webFileActions.ts`.
 */

import {
  configureOpfsIdGenerator,
  purgeOpfsTmp as purgeOpfsTmpCore,
  readTempOpfsFileAsBlob as readTempOpfsFileAsBlobCore,
  resetOpfsProbesForTests as resetOpfsProbesForTestsCore,
  writeTempOpfsFile as writeTempOpfsFileCore,
  writeTempOpfsFileStreamed as writeTempOpfsFileStreamedCore,
  type StreamedOpfsTempFileResult,
} from '@engine/storage/opfsStream';
import { generateUuid } from '../domain/models';

configureOpfsIdGenerator(generateUuid);

export {
  flushActiveOpfsHandles,
  getActiveOpfsHandleCount,
  getActiveOpfsHandleCountForTests,
  getActiveTempFiles,
  getOpfsRoot,
  getOpfsSubdir,
  isOpfsQuotaError,
  isOpfsSupported,
  isTempOpfsFileActive,
  listDirEntries,
  markTempOpfsFileActive,
  probeOpfsRuntime,
  readOpfsFileBytes,
  readOpfsFileText,
  registerOpfsDiagnosticLogger,
  releaseActiveOpfsHandles,
  removeOpfsEntrySafe,
  removeTempOpfsFile,
  safeAwaitOpfsClose,
  safeAwaitOpfsFlush,
  safeAwaitOpfsGetSize,
  safeAwaitOpfsTruncate,
  setOpfsRootResolverForTest,
  sweepOrphanedOpfsTmpOnBoot,
  trackActiveOpfsHandle,
  unmarkTempOpfsFileActive,
  writeFileToOpfsDir,
  type OpfsCloseableHandle,
  type OpfsDiagnosticLogger,
  type OpfsDirectoryHandle,
  type OpfsFileHandle,
  type OpfsNamespace,
  type OpfsSyncAccessHandle,
  type OpfsWritableStream,
  type StreamedOpfsTempFileResult,
} from '@engine/storage/opfsStream';

export function resetOpfsProbesForTests(): void {
  resetOpfsProbesForTestsCore();
  configureOpfsIdGenerator(generateUuid);
}

export function purgeOpfsTmp(options: { includeActive?: boolean } = {}): Promise<{
  filesRemoved: number;
  bytesFreed: number;
}> {
  return purgeOpfsTmpCore(options);
}

export function writeTempOpfsFileStreamed<T = void>(
  prefix: string,
  extension: string,
  produceChunks: (
    writeChunk: (chunk: string | Uint8Array | Blob) => Promise<void>
  ) => Promise<T>,
  options?: { keepActiveAfterWrite?: boolean }
): Promise<StreamedOpfsTempFileResult<T> | null> {
  return writeTempOpfsFileStreamedCore(prefix, extension, produceChunks, options);
}

export function writeTempOpfsFile(
  prefix: string,
  data: string | Uint8Array | Blob,
  extension = 'tmp',
  options?: { keepActiveAfterWrite?: boolean }
): Promise<{ fileName: string } | null> {
  return writeTempOpfsFileCore(prefix, data, extension, options);
}

export function readTempOpfsFileAsBlob(fileName: string): Promise<Blob | null> {
  return readTempOpfsFileAsBlobCore(fileName);
}
