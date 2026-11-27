/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Content-Agnostic Worker-Safe OPFS Scratchpad & Chunk Streamer
 * (`@engine/storage/opfsStream.ts`).
 *
 * Pure OPFS directory/handle lifecycle, `try/finally` close guards, Safari 15.2-16.3
 * sync/promise compatibility, and QuotaExceededError `/tmp` purge-and-retry recovery.
 */

import {
  acquireForegroundTransferLease,
  getSafeStorageManager,
  isQuotaExceededError,
  resetForegroundTransferLeasesForTests,
} from './browserProbes';

export type OpfsNamespace = 'tmp' | 'backups' | 'archives';

export interface OpfsWritableStream {
  write(data: string | Uint8Array | ArrayBuffer | Blob): Promise<void>;
  close(): void | Promise<void>;
  flush?: () => void | Promise<void>;
  truncate?: (size: number) => void | Promise<void>;
}

export interface OpfsSyncAccessHandle {
  write(buffer: ArrayBuffer | ArrayBufferView, options?: { at?: number }): number;
  flush(): void | Promise<void>;
  getSize(): number | Promise<number>;
  truncate(newSize: number): void | Promise<void>;
  close(): void | Promise<void>;
}

export type OpfsCloseableHandle = OpfsWritableStream | OpfsSyncAccessHandle;

export interface OpfsFileHandle {
  kind?: 'file';
  name: string;
  getFile(): Promise<File | Blob>;
  createWritable?: () => Promise<OpfsWritableStream>;
  createSyncAccessHandle?: () => Promise<OpfsSyncAccessHandle>;
}

export interface OpfsDirectoryHandle {
  kind?: 'directory';
  name?: string;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<OpfsDirectoryHandle>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<OpfsFileHandle>;
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
  entries?: () => AsyncIterable<[string, OpfsFileHandle | OpfsDirectoryHandle]>;
  values?: () => AsyncIterable<OpfsFileHandle | OpfsDirectoryHandle>;
}

export interface StreamedOpfsTempFileResult<T = void> {
  fileName: string;
  byteSize: number;
  blob: Blob;
  meta: T;
}

export type OpfsDiagnosticLogger = (event: {
  level: 'info' | 'warn' | 'error';
  category: 'storage' | 'memory';
  message: string;
  error?: unknown;
}) => void;

const TEMP_WRITE_CHUNK_BYTES = 256 * 1024;
const TEMP_TEXT_SLICE_CHARS = 128 * 1024;

const activeTempFiles = new Set<string>();
const activeOpfsHandles = new Set<OpfsCloseableHandle>();
const closedOpfsHandles = new WeakSet<object>();
let blockedStorageManagers = new WeakSet<object>();
let testRootResolver: (() => Promise<OpfsDirectoryHandle | null>) | null = null;
let diagnosticLogger: OpfsDiagnosticLogger | null = null;
let customIdGenerator: (() => string) | null = null;

export function registerOpfsDiagnosticLogger(logger: OpfsDiagnosticLogger | null): void {
  diagnosticLogger = logger;
}

export function configureOpfsIdGenerator(generator: (() => string) | null): void {
  customIdGenerator = generator;
}

function emitOpfsLog(event: {
  level: 'info' | 'warn' | 'error';
  category: 'storage' | 'memory';
  message: string;
  error?: unknown;
}): void {
  diagnosticLogger?.(event);
}

function defaultUniqueToken(): string {
  if (customIdGenerator) {
    try {
      return customIdGenerator();
    } catch {
      // Fall back cleanly if custom generator fails
    }
  }
  const c = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function readBlobArrayBufferSafe(blob: Blob): Promise<ArrayBuffer> {
  const candidate = (blob as unknown as { arrayBuffer?: () => Promise<ArrayBuffer> })?.arrayBuffer;
  if (typeof candidate === 'function') {
    try {
      return await Promise.resolve(candidate.call(blob));
    } catch {
      // Fall through cleanly
    }
  }
  if (typeof FileReader === 'function') {
    return await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          resolve(reader.result);
        } else {
          reject(new Error('FileReader did not return an ArrayBuffer.'));
        }
      };
      reader.onerror = () => reject(reader.error || new Error('Failed to read binary blob.'));
      reader.onabort = () => reject(new Error('Binary blob read aborted.'));
      reader.readAsArrayBuffer(blob);
    });
  }
  if (typeof Response === 'function') {
    return await new Response(blob).arrayBuffer();
  }
  throw new Error('Blob binary reader is unavailable in this browser.');
}

async function readBlobTextSafe(blob: Blob): Promise<string> {
  const candidate = (blob as unknown as { text?: () => Promise<string> })?.text;
  if (typeof candidate === 'function') {
    try {
      return await Promise.resolve(candidate.call(blob));
    } catch {
      // Fall through cleanly
    }
  }
  if (typeof FileReader === 'function') {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => reject(reader.error || new Error('Failed to read text blob.'));
      reader.onabort = () => reject(new Error('Text blob read aborted.'));
      reader.readAsText(blob, 'utf-8');
    });
  }
  if (typeof Response === 'function') {
    return await new Response(blob).text();
  }
  const buf = await readBlobArrayBufferSafe(blob);
  if (typeof TextDecoder === 'function') {
    return new TextDecoder('utf-8').decode(new Uint8Array(buf));
  }
  const bytes = new Uint8Array(buf);
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    out += String.fromCharCode(bytes[i]);
  }
  return out;
}

export function isOpfsQuotaError(err: unknown): boolean {
  return isQuotaExceededError(err);
}

export async function safeAwaitOpfsClose(handle: OpfsCloseableHandle | null | undefined): Promise<void> {
  if (!handle) return;
  activeOpfsHandles.delete(handle);
  if (typeof handle === 'object' && closedOpfsHandles.has(handle)) {
    return;
  }
  if (typeof handle === 'object') {
    closedOpfsHandles.add(handle);
  }
  if (typeof handle.close === 'function') {
    await Promise.resolve(handle.close());
  }
}

export async function safeAwaitOpfsFlush(
  handle: { flush?: () => void | Promise<void> } | null | undefined
): Promise<void> {
  if (!handle || typeof handle.flush !== 'function') return;
  await Promise.resolve(handle.flush());
}

export async function safeAwaitOpfsGetSize(
  handle: { getSize?: () => number | Promise<number> } | null | undefined
): Promise<number> {
  if (!handle || typeof handle.getSize !== 'function') return 0;
  const size = await Promise.resolve(handle.getSize());
  return Number.isFinite(Number(size)) ? Number(size) : 0;
}

export async function safeAwaitOpfsTruncate(
  handle: { truncate?: (newSize: number) => void | Promise<void> } | null | undefined,
  newSize: number
): Promise<void> {
  if (!handle || typeof handle.truncate !== 'function') return;
  await Promise.resolve(handle.truncate(newSize));
}

export function trackActiveOpfsHandle<T extends OpfsCloseableHandle>(handle: T): () => void {
  activeOpfsHandles.add(handle);
  return () => {
    activeOpfsHandles.delete(handle);
  };
}

export async function flushActiveOpfsHandles(): Promise<number> {
  const handles = Array.from(activeOpfsHandles);
  let flushed = 0;
  for (const handle of handles) {
    try {
      await safeAwaitOpfsFlush(handle);
      flushed++;
    } catch {
      // Ignore flush failures on already-closed or invalidated handles
    }
  }
  return flushed;
}

export async function releaseActiveOpfsHandles(): Promise<number> {
  const handles = Array.from(activeOpfsHandles);
  let released = 0;
  for (const handle of handles) {
    try {
      await safeAwaitOpfsClose(handle);
      released++;
    } catch {
      // Ignore release failures on already-closed or invalidated handles
    }
  }
  return released;
}

export function getActiveOpfsHandleCount(): number {
  return activeOpfsHandles.size;
}

export function getActiveOpfsHandleCountForTests(): number {
  return activeOpfsHandles.size;
}

export function getActiveTempFiles(): string[] {
  return Array.from(activeTempFiles.values());
}

export function markTempOpfsFileActive(fileName: string): void {
  if (fileName) activeTempFiles.add(fileName);
}

export function unmarkTempOpfsFileActive(fileName: string): void {
  if (fileName) activeTempFiles.delete(fileName);
}

export function isTempOpfsFileActive(fileName: string): boolean {
  return Boolean(fileName && activeTempFiles.has(fileName));
}

export function resetOpfsProbesForTests(): void {
  blockedStorageManagers = new WeakSet<object>();
  activeOpfsHandles.clear();
  activeTempFiles.clear();
  diagnosticLogger = null;
  customIdGenerator = null;
  resetForegroundTransferLeasesForTests();
}

export function setOpfsRootResolverForTest(
  resolver: (() => Promise<OpfsDirectoryHandle | null>) | null
): void {
  testRootResolver = resolver;
  if (!resolver) {
    activeTempFiles.clear();
    activeOpfsHandles.clear();
  }
}

export function isOpfsSupported(): boolean {
  if (testRootResolver) return true;
  const storage = getSafeStorageManager();
  if (!storage) return false;
  if (blockedStorageManagers.has(storage)) return false;
  try {
    return typeof storage.getDirectory === 'function';
  } catch {
    return false;
  }
}

export async function probeOpfsRuntime(): Promise<{
  supported: boolean;
  reason?: string;
}> {
  if (testRootResolver) {
    try {
      const root = await testRootResolver();
      return { supported: Boolean(root) };
    } catch (err) {
      return { supported: false, reason: err instanceof Error ? err.message : String(err) };
    }
  }
  const storage = getSafeStorageManager();
  if (!storage || typeof storage.getDirectory !== 'function') {
    return { supported: false, reason: 'navigator.storage.getDirectory is unavailable' };
  }
  try {
    const root = (await storage.getDirectory()) as OpfsDirectoryHandle | null;
    if (!root) {
      blockedStorageManagers.add(storage);
      return { supported: false, reason: 'OPFS root directory returned null' };
    }
    return { supported: true };
  } catch (err) {
    blockedStorageManagers.add(storage);
    return { supported: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

export async function getOpfsRoot(): Promise<OpfsDirectoryHandle | null> {
  if (testRootResolver) {
    try {
      return await testRootResolver();
    } catch (err) {
      emitOpfsLog({
        level: 'warn',
        category: 'storage',
        message: 'OPFS root resolver rejected — using fallback storage',
        error: err,
      });
      return null;
    }
  }
  const storage = getSafeStorageManager();
  if (!storage) return null;
  if (blockedStorageManagers.has(storage)) return null;
  let getDirFn: (() => Promise<unknown>) | undefined;
  try {
    getDirFn = typeof storage.getDirectory === 'function' ? storage.getDirectory : undefined;
  } catch {
    blockedStorageManagers.add(storage);
    return null;
  }
  if (!getDirFn) {
    return null;
  }
  try {
    return (await getDirFn.call(storage)) as unknown as OpfsDirectoryHandle;
  } catch (err) {
    blockedStorageManagers.add(storage);
    emitOpfsLog({
      level: 'warn',
      category: 'storage',
      message: 'Could not open Origin Private File System root directory — using fallback storage',
      error: err,
    });
    return null;
  }
}

export async function getOpfsSubdir(
  namespace: OpfsNamespace,
  create = true
): Promise<OpfsDirectoryHandle | null> {
  const root = await getOpfsRoot();
  if (!root) return null;
  try {
    return await root.getDirectoryHandle(namespace, { create });
  } catch {
    return null;
  }
}

export async function listDirEntries(
  dir: OpfsDirectoryHandle
): Promise<Array<{ name: string; handle: OpfsFileHandle | OpfsDirectoryHandle }>> {
  const results: Array<{ name: string; handle: OpfsFileHandle | OpfsDirectoryHandle }> = [];
  if (typeof dir.entries === 'function') {
    for await (const [name, handle] of dir.entries()) {
      results.push({ name, handle });
    }
    return results;
  }
  if (typeof dir.values === 'function') {
    for await (const handle of dir.values()) {
      if (handle && typeof handle.name === 'string') {
        results.push({ name: handle.name, handle });
      }
    }
  }
  return results;
}

export async function readOpfsFileText(
  dir: OpfsDirectoryHandle,
  fileName: string
): Promise<string | null> {
  try {
    const fh = await dir.getFileHandle(fileName, { create: false });
    const file = await fh.getFile();
    return await readBlobTextSafe(file);
  } catch {
    return null;
  }
}

export async function readOpfsFileBytes(
  dir: OpfsDirectoryHandle,
  fileName: string
): Promise<Uint8Array | null> {
  try {
    const fh = await dir.getFileHandle(fileName, { create: false });
    const file = await fh.getFile();
    const buf = await readBlobArrayBufferSafe(file);
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

export async function removeOpfsEntrySafe(dir: OpfsDirectoryHandle, name: string): Promise<boolean> {
  try {
    await dir.removeEntry(name);
    return true;
  } catch {
    return false;
  }
}

function sliceUtf16Safe(
  text: string,
  start: number,
  maxChars: number
): { slice: string; nextOffset: number } {
  let end = Math.min(text.length, start + maxChars);
  if (end < text.length && end > start) {
    const lastCode = text.charCodeAt(end - 1);
    if (lastCode >= 0xd800 && lastCode <= 0xdbff) {
      end = Math.min(text.length, end + 1);
    }
  }
  return { slice: text.slice(start, end), nextOffset: end };
}

async function writeChunkedDataToWritable(
  writable: OpfsWritableStream,
  data: string | Uint8Array | Blob
): Promise<void> {
  if (typeof data === 'string') {
    if (data.length <= TEMP_TEXT_SLICE_CHARS) {
      await writable.write(data);
      return;
    }
    let offset = 0;
    while (offset < data.length) {
      const { slice, nextOffset } = sliceUtf16Safe(data, offset, TEMP_TEXT_SLICE_CHARS);
      if (slice.length > 0) {
        await writable.write(slice);
      }
      offset = nextOffset;
    }
    return;
  }

  if (data instanceof Uint8Array) {
    if (data.byteLength <= TEMP_WRITE_CHUNK_BYTES) {
      await writable.write(data);
      return;
    }
    for (let offset = 0; offset < data.byteLength; offset += TEMP_WRITE_CHUNK_BYTES) {
      const slice = data.subarray(offset, Math.min(data.byteLength, offset + TEMP_WRITE_CHUNK_BYTES));
      await writable.write(slice);
    }
    return;
  }

  await writable.write(data);
}

async function chunkDataToUint8Arrays(data: string | Uint8Array | Blob): Promise<Uint8Array[]> {
  if (typeof data === 'string') {
    if (data.length === 0) return [];
    const encoder = typeof TextEncoder === 'function' ? new TextEncoder() : null;
    const chunks: Uint8Array[] = [];
    let offset = 0;
    while (offset < data.length) {
      const { slice, nextOffset } = sliceUtf16Safe(data, offset, TEMP_TEXT_SLICE_CHARS);
      if (slice.length > 0) {
        if (encoder) {
          chunks.push(encoder.encode(slice));
        } else {
          const buf = await readBlobArrayBufferSafe(new Blob([slice]));
          chunks.push(new Uint8Array(buf));
        }
      }
      offset = nextOffset;
    }
    return chunks;
  }

  if (data instanceof Uint8Array) {
    if (data.byteLength <= TEMP_WRITE_CHUNK_BYTES) return [data];
    const chunks: Uint8Array[] = [];
    for (let offset = 0; offset < data.byteLength; offset += TEMP_WRITE_CHUNK_BYTES) {
      chunks.push(
        data.subarray(offset, Math.min(data.byteLength, offset + TEMP_WRITE_CHUNK_BYTES))
      );
    }
    return chunks;
  }

  const buf = await readBlobArrayBufferSafe(data);
  const bytes = new Uint8Array(buf);
  return chunkDataToUint8Arrays(bytes);
}

async function openOpfsHandleSink(fh: OpfsFileHandle): Promise<{
  handle: OpfsCloseableHandle;
  writeChunk: (chunk: string | Uint8Array | Blob) => Promise<void>;
  flushAndSize: () => Promise<number | null>;
}> {
  if (typeof fh.createWritable === 'function') {
    const writable = await fh.createWritable().catch((err) => {
      emitOpfsLog({
        level: 'error',
        category: 'storage',
        message: 'Failed to create OPFS writable stream — falling back to sync handle',
        error: err,
      });
      throw err;
    });
    trackActiveOpfsHandle(writable);
    return {
      handle: writable,
      writeChunk: (chunk) => writeChunkedDataToWritable(writable, chunk),
      flushAndSize: async () => {
        await safeAwaitOpfsFlush(writable);
        return null;
      },
    };
  }

  if (typeof fh.createSyncAccessHandle === 'function') {
    const syncHandle = await fh.createSyncAccessHandle();
    trackActiveOpfsHandle(syncHandle);
    await safeAwaitOpfsTruncate(syncHandle, 0);
    let cursor = 0;
    return {
      handle: syncHandle,
      writeChunk: async (chunk) => {
        const byteSlices = await chunkDataToUint8Arrays(chunk);
        for (const slice of byteSlices) {
          if (slice.byteLength === 0) continue;
          const written = syncHandle.write(slice, { at: cursor });
          cursor += Number(written) > 0 ? Number(written) : slice.byteLength;
        }
      },
      flushAndSize: async () => {
        await safeAwaitOpfsFlush(syncHandle);
        return safeAwaitOpfsGetSize(syncHandle);
      },
    };
  }

  throw new Error('OPFS file handle supports neither createWritable nor createSyncAccessHandle.');
}

export async function writeFileToOpfsDir(
  dir: OpfsDirectoryHandle,
  fileName: string,
  data: string | Uint8Array | Blob
): Promise<void> {
  const releaseLease = acquireForegroundTransferLease();
  const runWrite = async () => {
    const fh = await dir.getFileHandle(fileName, { create: true });
    const sink = await openOpfsHandleSink(fh);
    let bodySucceeded = false;
    try {
      await sink.writeChunk(data);
      await sink.flushAndSize();
      bodySucceeded = true;
    } finally {
      if (bodySucceeded) {
        await safeAwaitOpfsClose(sink.handle);
      } else {
        try {
          await safeAwaitOpfsClose(sink.handle);
        } catch {
          // Preserve primary write error so QuotaExceededError recovery runs cleanly
        }
      }
    }
  };

  try {
    try {
      await runWrite();
    } catch (err) {
      if (isOpfsQuotaError(err)) {
        const purged = await purgeOpfsTmp();
        emitOpfsLog({
          level: 'warn',
          category: 'memory',
          message: `Corrective action: QuotaExceededError during OPFS write "${fileName}" — purged ${purged.filesRemoved} /tmp file(s) and retrying once`,
          error: err,
        });
        await runWrite();
        return;
      }
      throw err;
    }
  } finally {
    releaseLease();
  }
}

export async function purgeOpfsTmp(options: { includeActive?: boolean } = {}): Promise<{
  filesRemoved: number;
  bytesFreed: number;
}> {
  const includeActive = Boolean(options.includeActive);
  const tmpDir = await getOpfsSubdir('tmp', false);
  if (!tmpDir) return { filesRemoved: 0, bytesFreed: 0 };

  let filesRemoved = 0;
  let bytesFreed = 0;
  try {
    const entries = await listDirEntries(tmpDir);
    for (const item of entries) {
      if (item.handle.kind === 'directory') continue;
      if (!includeActive && activeTempFiles.has(item.name)) continue;
      try {
        const file = await (item.handle as OpfsFileHandle).getFile();
        bytesFreed += Number(file.size) || 0;
      } catch {
        // Ignore size inspect failure
      }
      if (await removeOpfsEntrySafe(tmpDir, item.name)) {
        filesRemoved++;
      }
    }
  } catch {
    // Non-fatal purge failure
  }
  return { filesRemoved, bytesFreed };
}

export async function sweepOrphanedOpfsTmpOnBoot(): Promise<{
  filesRemoved: number;
  bytesFreed: number;
}> {
  const res = await purgeOpfsTmp({ includeActive: false });
  if (res.filesRemoved > 0) {
    emitOpfsLog({
      level: 'info',
      category: 'storage',
      message: `Corrective action: Boot orphan sweep removed ${res.filesRemoved} stale /tmp OPFS file(s) (${res.bytesFreed} bytes reclaimed)`,
    });
  }
  return res;
}

function buildTempOpfsFileName(prefix: string, extension: string): string {
  const cleanPrefix = (prefix || 'export')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .slice(0, 32);
  const cleanExt = (extension || 'tmp').replace(/[^a-z0-9]/gi, '') || 'tmp';
  return `${cleanPrefix}-${Date.now().toString(36)}-${defaultUniqueToken().slice(0, 8)}.${cleanExt}`;
}

export async function writeTempOpfsFileStreamed<T = void>(
  prefix: string,
  extension: string,
  produceChunks: (
    writeChunk: (chunk: string | Uint8Array | Blob) => Promise<void>
  ) => Promise<T>,
  options?: { keepActiveAfterWrite?: boolean }
): Promise<StreamedOpfsTempFileResult<T> | null> {
  const releaseLease = acquireForegroundTransferLease();
  try {
    const tmpDir = await getOpfsSubdir('tmp', true);
    if (!tmpDir) return null;

    const fileName = buildTempOpfsFileName(prefix, extension);
    markTempOpfsFileActive(fileName);
    let writeSucceeded = false;

    const runAttempt = async (): Promise<StreamedOpfsTempFileResult<T>> => {
      const fh = await tmpDir.getFileHandle(fileName, { create: true });
      const sink = await openOpfsHandleSink(fh);
      let bodySucceeded = false;
      let meta: T;
      let flushedSize: number | null = null;
      try {
        meta = await produceChunks(async (chunk) => {
          if (typeof chunk === 'string' && chunk.length === 0) return;
          if (chunk instanceof Uint8Array && chunk.byteLength === 0) return;
          await sink.writeChunk(chunk);
        });
        flushedSize = await sink.flushAndSize();
        bodySucceeded = true;
      } finally {
        if (bodySucceeded) {
          await safeAwaitOpfsClose(sink.handle);
        } else {
          try {
            await safeAwaitOpfsClose(sink.handle);
          } catch {
            // Preserve primary write error so QuotaExceededError recovery triggers cleanly
          }
        }
      }
      const file = await fh.getFile();
      return {
        fileName,
        byteSize: Number(file.size) || flushedSize || 0,
        blob: file,
        meta,
      };
    };

    try {
      let result: StreamedOpfsTempFileResult<T>;
      try {
        result = await runAttempt();
      } catch (err) {
        if (isOpfsQuotaError(err)) {
          await removeOpfsEntrySafe(tmpDir, fileName);
          const purged = await purgeOpfsTmp({ includeActive: false });
          emitOpfsLog({
            level: 'warn',
            category: 'memory',
            message: `Corrective action: QuotaExceededError during streamed OPFS export "${fileName}" — purged ${purged.filesRemoved} /tmp file(s) and retrying once`,
            error: err,
          });
          result = await runAttempt();
        } else {
          throw err;
        }
      }
      writeSucceeded = true;
      return result;
    } finally {
      if (!writeSucceeded) {
        unmarkTempOpfsFileActive(fileName);
        await removeOpfsEntrySafe(tmpDir, fileName);
      } else if (!options?.keepActiveAfterWrite) {
        unmarkTempOpfsFileActive(fileName);
      }
    }
  } finally {
    releaseLease();
  }
}

export async function writeTempOpfsFile(
  prefix: string,
  data: string | Uint8Array | Blob,
  extension = 'tmp',
  options?: { keepActiveAfterWrite?: boolean }
): Promise<{ fileName: string } | null> {
  const releaseLease = acquireForegroundTransferLease();
  try {
    const tmpDir = await getOpfsSubdir('tmp', true);
    if (!tmpDir) return null;
    const fileName = buildTempOpfsFileName(prefix, extension);
    markTempOpfsFileActive(fileName);
    let writeSucceeded = false;
    try {
      await writeFileToOpfsDir(tmpDir, fileName, data);
      writeSucceeded = true;
      return { fileName };
    } finally {
      if (!writeSucceeded || !options?.keepActiveAfterWrite) {
        unmarkTempOpfsFileActive(fileName);
      }
    }
  } finally {
    releaseLease();
  }
}

export async function readTempOpfsFileAsBlob(fileName: string): Promise<Blob | null> {
  const tmpDir = await getOpfsSubdir('tmp', false);
  if (!tmpDir) return null;
  try {
    const fh = await tmpDir.getFileHandle(fileName, { create: false });
    return await fh.getFile();
  } catch {
    return null;
  }
}

export async function removeTempOpfsFile(fileName: string): Promise<void> {
  unmarkTempOpfsFileActive(fileName);
  const tmpDir = await getOpfsSubdir('tmp', false);
  if (!tmpDir) return;
  await removeOpfsEntrySafe(tmpDir, fileName);
}
