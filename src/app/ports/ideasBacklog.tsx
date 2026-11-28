/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Offline captured-ideas capability port.
 *
 * The suggestions screen reads and writes the offline idea list straight out of
 * `src/storage/capturedIdeasStore`, which made a screen depend on the storage layer. This port owns
 * that edge: the browser implementation is the default, and a test can inject its own through the
 * provider.
 */
import { createContext, useContext, type ReactNode } from 'react';
import type { CapturedIdeaEntry } from '../../domain/suggestionsBacklog';
import {
  clearCapturedIdeas,
  deleteCapturedIdea,
  loadCapturedIdeas,
  saveCapturedIdea,
} from '../../storage/capturedIdeasStore';

export interface SavedIdeaResult {
  entry: CapturedIdeaEntry;
  ideas: CapturedIdeaEntry[];
  truncated: boolean;
}

/** Everything the suggestions screen needs to persist captured ideas offline. */
export interface IdeasBacklogPort {
  load: () => Promise<CapturedIdeaEntry[]>;
  save: (rawText: string) => Promise<SavedIdeaResult>;
  remove: (id: string) => Promise<CapturedIdeaEntry[]>;
  clear: () => Promise<CapturedIdeaEntry[]>;
}

const browserIdeasBacklog: IdeasBacklogPort = {
  load: loadCapturedIdeas,
  save: saveCapturedIdea,
  remove: deleteCapturedIdea,
  clear: clearCapturedIdeas,
};

const IdeasBacklogContext = createContext<IdeasBacklogPort>(browserIdeasBacklog);

/** Reads the port; the injected provider wins, otherwise the offline browser store is used. */
export function useIdeasBacklogPort(): IdeasBacklogPort {
  return useContext(IdeasBacklogContext);
}

/** Injects a different captured-ideas backlog (tests, alternate host shells). */
export function IdeasBacklogPortProvider({
  value,
  children,
}: {
  value: IdeasBacklogPort;
  children: ReactNode;
}) {
  return <IdeasBacklogContext.Provider value={value}>{children}</IdeasBacklogContext.Provider>;
}
