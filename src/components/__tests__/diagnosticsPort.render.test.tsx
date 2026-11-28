// @vitest-environment jsdom
/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * The crash surfaces must reach diagnostics through the injected port, not the storage module, so a
 * test can feed them a notice list without IndexedDB.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getDiagnosticsPort,
  resetDiagnosticsPort,
  setDiagnosticsPort,
  type AsyncErrorNotice,
  type DiagnosticsPort,
} from '../../app/ports/diagnostics';
import { AsyncErrorToastHost } from '../AsyncErrorToastHost';

const NOTICE: AsyncErrorNotice = {
  id: 'toast-1',
  title: 'Storage write failed',
  detail: 'The barn snapshot could not be written.',
  timestampMs: 1_764_000_000_000,
  severity: 'error',
  sticky: true,
  category: 'storage',
};

const buildPort = (over: Partial<DiagnosticsPort> = {}): DiagnosticsPort => ({
  ...getDiagnosticsPort(),
  getActiveAsyncErrorToasts: vi.fn(() => [NOTICE]),
  subscribeAsyncErrorToasts: vi.fn(() => () => {}),
  subscribePausedBackgroundJobs: vi.fn(() => () => {}),
  getPausedBackgroundJobs: vi.fn(() => []),
  dismissAsyncErrorToast: vi.fn(),
  resumePausedBackgroundJob: vi.fn(async () => true),
  ...over,
});

afterEach(() => {
  cleanup();
  resetDiagnosticsPort();
});

describe('diagnostics port', () => {
  it('swaps and restores the active port', () => {
    const browser = getDiagnosticsPort();
    const fake = buildPort();
    setDiagnosticsPort(fake);
    expect(getDiagnosticsPort()).toBe(fake);
    resetDiagnosticsPort();
    expect(getDiagnosticsPort()).toBe(browser);
  });

  it('renders the toast host from the injected notice list and dismisses through the port', async () => {
    const port = buildPort();
    setDiagnosticsPort(port);

    render(
      <AsyncErrorToastHost onOpenDiagnostics={() => {}} isOnSettingsRoute={false} />
    );

    expect(await screen.findByText('Storage write failed')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /dismiss storage write failed/i }));
    await waitFor(() => expect(port.dismissAsyncErrorToast).toHaveBeenCalledWith(NOTICE.id));
  });
});
