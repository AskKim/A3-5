/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Install-prompt capability port.
 *
 * `PWAInstallButton` and `OfflineIndicator` are presentational header pieces, but they read the
 * browser install prompt and connectivity straight out of `src/storage/storageProtection`, which made
 * the UI layer depend on the storage layer. This port owns that edge: the app supplies the browser
 * implementation by default, and a test (or a different host shell) can inject its own through the
 * provider without the component knowing where the values come from.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useOnlineStatus, usePWAInstall } from '../../storage/storageProtection';

/** Everything the install/offline UI needs, with no storage import on the component side. */
export interface InstallPromptPort {
  canPromptInstall: boolean;
  isInstalled: boolean;
  isIos: boolean;
  isOnline: boolean;
  /** Resolves with whatever the host reports (accepted / dismissed / unavailable). */
  promptInstall: () => Promise<unknown>;
}

const InstallPromptContext = createContext<InstallPromptPort | null>(null);

/** The browser implementation: the PWA install prompt plus live connectivity. */
export function useBrowserInstallPrompt(): InstallPromptPort {
  const { canPromptInstall, isInstalled, isIos, promptInstall } = usePWAInstall();
  const isOnline = useOnlineStatus();
  return useMemo(
    () => ({ canPromptInstall, isInstalled, isIos, isOnline, promptInstall }),
    [canPromptInstall, isInstalled, isIos, isOnline, promptInstall]
  );
}

/**
 * Reads the port. An injected provider wins; otherwise the browser implementation is used, so the
 * app needs no wiring at its boot entry.
 */
export function useInstallPromptPort(): InstallPromptPort {
  const injected = useContext(InstallPromptContext);
  const browser = useBrowserInstallPrompt();
  return injected ?? browser;
}

/** Injects a different install/offline capability (tests, alternate host shells). */
export function InstallPromptPortProvider({
  value,
  children,
}: {
  value: InstallPromptPort;
  children: ReactNode;
}) {
  return <InstallPromptContext.Provider value={value}>{children}</InstallPromptContext.Provider>;
}
