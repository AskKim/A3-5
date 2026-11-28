/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * In-memory OPFS directory tree shared by the storage tests and the render-level store harness.
 */
import { vi } from 'vitest';
import type { OpfsDirectoryHandle, OpfsFileHandle, OpfsWritableStream } from '../../opfsStorage';

interface MockFileEntry {
  kind: 'file';
  name: string;
  bytes: Uint8Array;
}

interface MockDirNode {
  kind: 'directory';
  name: string;
  dirs: Map<string, MockDirNode>;
  files: Map<string, MockFileEntry>;
}

export function createInMemoryOpfsMock(options?: {
  onCreateWritable?: (fileName: string, callIndex: number) => {
    failOnceWithQuotaExceeded?: boolean;
    throwOnWrite?: Error;
    spyClose: ReturnType<typeof vi.fn<() => void>>;
  };
}) {
  const rootNode: MockDirNode = {
    kind: 'directory',
    name: '',
    dirs: new Map(),
    files: new Map(),
  };
  let writeCallCounter = 0;

  const toUint8 = async (data: string | Uint8Array | ArrayBuffer | Blob): Promise<Uint8Array> => {
    if (typeof data === 'string') return new TextEncoder().encode(data);
    if (data instanceof Uint8Array) return new Uint8Array(data);
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    const buf = await data.arrayBuffer();
    return new Uint8Array(buf);
  };

  const makeFileHandle = (entry: MockFileEntry): OpfsFileHandle => ({
    kind: 'file',
    name: entry.name,
    async getFile(): Promise<Blob> {
      const copy = new Uint8Array(entry.bytes.byteLength);
      copy.set(entry.bytes);
      if (typeof Blob !== 'undefined') {
        return new Blob([copy], { type: 'application/octet-stream' });
      }
      return {
        size: copy.byteLength,
        type: 'application/octet-stream',
        async text() {
          return new TextDecoder().decode(copy);
        },
        async arrayBuffer() {
          return copy.buffer;
        },
      } as unknown as Blob;
    },
    async createWritable(): Promise<OpfsWritableStream> {
      writeCallCounter += 1;
      const hook = options?.onCreateWritable?.(entry.name, writeCallCounter);
      const stagedChunks: Uint8Array[] = [];
      return {
        async write(data) {
          if (hook?.throwOnWrite) {
            throw hook.throwOnWrite;
          }
          if (hook?.failOnceWithQuotaExceeded) {
            const quotaErr = new Error('Simulated OPFS storage quota exceeded');
            quotaErr.name = 'QuotaExceededError';
            throw quotaErr;
          }
          stagedChunks.push(await toUint8(data));
        },
        async close() {
          hook?.spyClose();
          if (stagedChunks.length > 0) {
            const total = stagedChunks.reduce((sum, c) => sum + c.byteLength, 0);
            const merged = new Uint8Array(total);
            let offset = 0;
            for (const c of stagedChunks) {
              merged.set(c, offset);
              offset += c.byteLength;
            }
            entry.bytes = merged;
          }
        },
      };
    },
  });

  const makeDirHandle = (node: MockDirNode): OpfsDirectoryHandle => ({
    kind: 'directory',
    name: node.name,
    async getDirectoryHandle(name, opts) {
      let child = node.dirs.get(name);
      if (!child) {
        if (!opts?.create) {
          throw new Error(`Directory "${name}" not found`);
        }
        child = {
          kind: 'directory',
          name,
          dirs: new Map(),
          files: new Map(),
        };
        node.dirs.set(name, child);
      }
      return makeDirHandle(child);
    },
    async getFileHandle(name, opts) {
      let file = node.files.get(name);
      if (!file) {
        if (!opts?.create) {
          throw new Error(`File "${name}" not found`);
        }
        file = { kind: 'file', name, bytes: new Uint8Array(0) };
        node.files.set(name, file);
      }
      return makeFileHandle(file);
    },
    async removeEntry(name) {
      if (!node.files.delete(name) && !node.dirs.delete(name)) {
        throw new Error(`Entry "${name}" not found`);
      }
    },
    async *entries() {
      for (const [k, dir] of node.dirs.entries()) {
        yield [k, makeDirHandle(dir)];
      }
      for (const [k, f] of node.files.entries()) {
        yield [k, makeFileHandle(f)];
      }
    },
  });

  return {
    rootNode,
    rootHandle: makeDirHandle(rootNode),
  };
}
