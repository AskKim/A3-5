// @vitest-environment jsdom
/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Captured-ideas port: the suggestions screen must load, save and clear offline ideas through the
 * injected capability instead of importing the storage module itself.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IdeasBacklogPortProvider, type IdeasBacklogPort } from '../../app/ports/ideasBacklog';
import type { CapturedIdeaEntry } from '../../domain/suggestionsBacklog';
import { SuggestionsBacklogScreen } from '../SuggestionsBacklogScreen';

const IDEA: CapturedIdeaEntry = {
  id: 'idea-1',
  text: 'Port the diagnostics panel off the storage singletons',
  createdAtIso: '2026-11-28T00:00:00.000Z',
};

const buildPort = (over: Partial<IdeasBacklogPort> = {}): IdeasBacklogPort => ({
  load: vi.fn(async () => [IDEA]),
  save: vi.fn(async () => ({ entry: IDEA, ideas: [IDEA], truncated: false })),
  remove: vi.fn(async () => []),
  clear: vi.fn(async () => []),
  ...over,
});

const renderScreen = (port: IdeasBacklogPort) =>
  render(
    <IdeasBacklogPortProvider value={port}>
      <SuggestionsBacklogScreen onBackToDevelopment={() => {}} />
    </IdeasBacklogPortProvider>
  );

afterEach(cleanup);

describe('captured ideas port', () => {
  it('renders the offline pending list from the injected load', async () => {
    const port = buildPort();
    renderScreen(port);

    expect(await screen.findByText(IDEA.text)).toBeTruthy();
    expect(port.load).toHaveBeenCalledTimes(1);
  });

  it('removes an idea through the injected port', async () => {
    const port = buildPort();
    renderScreen(port);

    fireEvent.click(await screen.findByRole('button', { name: /remove captured idea/i }));

    await waitFor(() => expect(port.remove).toHaveBeenCalledWith(IDEA.id));
    expect(await screen.findByText(/removed idea from offline pending list/i)).toBeTruthy();
  });

  it('clears the list through the injected port', async () => {
    const port = buildPort();
    renderScreen(port);

    fireEvent.click(await screen.findByRole('button', { name: /clear all|captured ideas/i }));

    await waitFor(() => expect(port.clear).toHaveBeenCalledTimes(1));
  });
});
