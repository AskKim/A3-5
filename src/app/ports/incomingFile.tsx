/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * PART 1 — FOR HUMANS: The single place the UI listens for files another app handed to Pedigree.
 * PART 2 — FOR AI / DEVELOPERS:
 *
 * Incoming-file capability port (`src/app/ports/incomingFile.tsx`).
 *
 * A phone shell can be launched with `ACTION_VIEW` (a tapped `.json`/`.db` link) or `ACTION_SEND`
 * (the system share sheet). Only the shell sees that `Intent`; it forwards one `OPEN_EXTERNAL_FILE`
 * envelope, and this port is the only UI-facing way to hear about it. Parsing stays in the caller:
 * the port hands over raw bytes and never guesses a backup format.
 *
 * Injectable like the other ports: `setIncomingFilePort` / `resetIncomingFilePort` for tests and
 * alternate shells, plus a provider for component-level injection.
 */
import { createContext, useContext, type ReactNode } from 'react';
import { pedigreeBridge, type IncomingExternalFile } from '../../native/pedigreeBridge';

export type { IncomingExternalFile };

export interface IncomingFilePort {
  /** True when the host shell can deliver files from other apps at all (native only). */
  isSupported(): boolean;
  /** Subscribes to incoming files; returns an unsubscribe function. */
  subscribe(listener: (file: IncomingExternalFile) => void): () => void;
  /** Decodes the shell payload, or null when the shell could not attach bytes. */
  readBytes(file: IncomingExternalFile): Uint8Array | null;
}

function decodeBase64(data: string): Uint8Array | null {
  if (typeof atob !== 'function') {
    return null;
  }
  try {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch (_err) {
    return null;
  }
}

/** The native implementation: the singleton bridge's incoming-file channel. */
export const nativeIncomingFilePort: IncomingFilePort = {
  isSupported: () => pedigreeBridge.isNativeWrapper(),
  subscribe: (listener) => pedigreeBridge.onIncomingFile(listener),
  readBytes: (file) => (file.base64Data ? decodeBase64(file.base64Data) : null),
};

let activePort: IncomingFilePort = nativeIncomingFilePort;

export function getIncomingFilePort(): IncomingFilePort {
  return activePort;
}

/** Swaps the port (tests, alternate shells). Returns the previous port for easy restoration. */
export function setIncomingFilePort(next: IncomingFilePort): IncomingFilePort {
  const previous = activePort;
  activePort = next;
  return previous;
}

export function resetIncomingFilePort(): void {
  activePort = nativeIncomingFilePort;
}

const IncomingFilePortContext = createContext<IncomingFilePort | null>(null);

export function useIncomingFilePort(): IncomingFilePort {
  const injected = useContext(IncomingFilePortContext);
  return injected ?? getIncomingFilePort();
}

export function IncomingFilePortProvider({
  value,
  children,
}: {
  value: IncomingFilePort;
  children: ReactNode;
}) {
  return <IncomingFilePortContext.Provider value={value}>{children}</IncomingFilePortContext.Provider>;
}
