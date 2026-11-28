// @vitest-environment jsdom
/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Install-prompt port: the header install button and the offline banner must render from an injected
 * capability instead of reaching into the storage layer themselves.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InstallPromptPortProvider, type InstallPromptPort } from '../../app/ports/installPrompt';
import { OfflineIndicator, PWAInstallButton } from '../PWAInstallButton';

const basePort = (over: Partial<InstallPromptPort> = {}): InstallPromptPort => ({
  canPromptInstall: false,
  isInstalled: false,
  isIos: false,
  isOnline: true,
  promptInstall: vi.fn(async () => {}),
  ...over,
});

const renderWithPort = (ui: ReactElement, port: InstallPromptPort) =>
  render(<InstallPromptPortProvider value={port}>{ui}</InstallPromptPortProvider>);

afterEach(cleanup);

describe('install prompt port', () => {
  it('renders nothing once the app is installed', () => {
    const { container } = renderWithPort(<PWAInstallButton />, basePort({ isInstalled: true }));
    expect(container.innerHTML).toBe('');
  });

  it('prompts install through the injected capability', () => {
    const port = basePort({ canPromptInstall: true });
    renderWithPort(<PWAInstallButton />, port);

    fireEvent.click(screen.getByRole('button', { name: /install app/i }));

    expect(port.promptInstall).toHaveBeenCalledTimes(1);
  });

  it('offers the iOS instructions when the port reports iOS', () => {
    renderWithPort(<PWAInstallButton />, basePort({ isIos: true }));

    expect(screen.getByRole('button', { name: /install on ios/i })).toBeTruthy();
  });

  it('shows the offline banner only while the port reports offline', () => {
    const { rerender } = renderWithPort(<OfflineIndicator />, basePort({ isOnline: false }));
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText(/offline mode/i)).toBeTruthy();

    rerender(
      <InstallPromptPortProvider value={basePort({ isOnline: true })}>
        <OfflineIndicator />
      </InstallPromptPortProvider>
    );

    expect(screen.queryByRole('status')).toBeNull();
  });
});
