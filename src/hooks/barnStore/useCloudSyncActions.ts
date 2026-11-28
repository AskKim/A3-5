/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * PART 1 — FOR HUMANS: The cloud sync controls: saving settings, connecting an account, and disconnecting.
 * PART 2 — FOR AI / DEVELOPERS:
 *
 * Cloud app-folder settings and PKCE actions, extracted from `useBarnStore` as a sub-hook.
 *
 * Four user-facing controls: persisting a settings patch, adopting an access token entered by
 * hand, disconnecting, and starting the OAuth PKCE redirect. They share one trait — each writes
 * through the cloud-sync client-state module and then mirrors the result into React state — so the
 * slice takes the setter and notifier, and reaches the client-state module through an injectable
 * port (`CLOUD_SYNC_CLIENT_PORT` by default) that tests replace with fakes.
 *
 * Ownership split: the store keeps `cloudSyncState`/`cloudSyncBusy`, the background schedule and
 * the actual sync run. This slice only decides what a settings or auth action writes.
 */
import {
  useCallback,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type { CloudSyncProvider, CloudSyncSettings } from '../../domain/cloudAppFolderSync';
import {
  clearCloudSyncMemoryToken,
  getCloudSyncClientState,
  setCloudSyncMemoryToken,
  startCloudOAuthPkceRedirect,
  updatePersistedCloudSyncSettings,
  type CloudSyncClientState,
} from '../../storage/cloudAppFolderSync';

/** Human label used in every cloud-sync toast. */
export function cloudSyncProviderLabel(provider: CloudSyncProvider): string {
  return provider === 'onedrive' ? 'OneDrive AppRoot' : 'Google Drive AppFolder';
}

/** The cloud-sync client-state module, narrowed to what these actions call. */
export interface CloudSyncClientPort {
  updatePersistedSettings: typeof updatePersistedCloudSyncSettings;
  setMemoryToken: typeof setCloudSyncMemoryToken;
  clearMemoryToken: typeof clearCloudSyncMemoryToken;
  readClientState: typeof getCloudSyncClientState;
  startPkceRedirect: typeof startCloudOAuthPkceRedirect;
}

export const CLOUD_SYNC_CLIENT_PORT: CloudSyncClientPort = {
  updatePersistedSettings: updatePersistedCloudSyncSettings,
  setMemoryToken: setCloudSyncMemoryToken,
  clearMemoryToken: clearCloudSyncMemoryToken,
  readClientState: getCloudSyncClientState,
  startPkceRedirect: startCloudOAuthPkceRedirect,
};

export interface CloudSyncActionDeps {
  setCloudSyncState: Dispatch<SetStateAction<CloudSyncClientState>>;
  notify: (message: string) => void;
  /** Test seam; production leaves this unset to use the real client-state module. */
  client?: CloudSyncClientPort;
}

const resolveClient = (deps: CloudSyncActionDeps): CloudSyncClientPort =>
  deps.client ?? CLOUD_SYNC_CLIENT_PORT;

export function updateCloudSyncSettingsAction(
  deps: CloudSyncActionDeps,
  patch: Partial<CloudSyncSettings>
): CloudSyncClientState {
  const next = resolveClient(deps).updatePersistedSettings(patch);
  deps.setCloudSyncState(next);
  return next;
}

export function connectCloudSyncAccessTokenAction(
  deps: CloudSyncActionDeps,
  provider: CloudSyncProvider,
  accessToken: string
): boolean {
  const client = resolveClient(deps);
  const ok = client.setMemoryToken(provider, accessToken);
  const next = client.updatePersistedSettings({
    provider,
    enabled: ok ? true : client.readClientState().settings.enabled,
  });
  deps.setCloudSyncState(next);
  if (ok) {
    deps.notify(`Connected ${cloudSyncProviderLabel(provider)} (access token held in memory only).`);
  }
  return ok;
}

export function disconnectCloudSyncAction(
  deps: CloudSyncActionDeps,
  provider?: CloudSyncProvider
): void {
  const client = resolveClient(deps);
  client.clearMemoryToken(provider);
  deps.setCloudSyncState(client.readClientState());
  deps.notify('Disconnected cloud app-folder access token from memory.');
}

export async function startCloudSyncPkceAction(
  deps: CloudSyncActionDeps,
  provider: CloudSyncProvider,
  clientId: string
): Promise<void> {
  const client = resolveClient(deps);
  client.updatePersistedSettings({ provider, customOAuthClientId: clientId, enabled: true });
  deps.setCloudSyncState(client.readClientState());
  await client.startPkceRedirect(provider, clientId);
}

export interface CloudSyncActions {
  updateCloudSyncSettings: (patch: Partial<CloudSyncSettings>) => CloudSyncClientState;
  connectCloudSyncAccessToken: (provider: CloudSyncProvider, accessToken: string) => boolean;
  disconnectCloudSync: (provider?: CloudSyncProvider) => void;
  startCloudSyncPkce: (provider: CloudSyncProvider, clientId: string) => Promise<void>;
}

export function useCloudSyncActions(deps: CloudSyncActionDeps): CloudSyncActions {
  const { setCloudSyncState, notify, client } = deps;

  const updateCloudSyncSettings = useCallback(
    (patch: Partial<CloudSyncSettings>) =>
      updateCloudSyncSettingsAction({ setCloudSyncState, notify, client }, patch),
    [setCloudSyncState, notify, client]
  );

  const connectCloudSyncAccessToken = useCallback(
    (provider: CloudSyncProvider, accessToken: string) =>
      connectCloudSyncAccessTokenAction({ setCloudSyncState, notify, client }, provider, accessToken),
    [setCloudSyncState, notify, client]
  );

  const disconnectCloudSync = useCallback(
    (provider?: CloudSyncProvider) =>
      disconnectCloudSyncAction({ setCloudSyncState, notify, client }, provider),
    [setCloudSyncState, notify, client]
  );

  const startCloudSyncPkce = useCallback(
    (provider: CloudSyncProvider, clientId: string) =>
      startCloudSyncPkceAction({ setCloudSyncState, notify, client }, provider, clientId),
    [setCloudSyncState, notify, client]
  );

  return {
    updateCloudSyncSettings,
    connectCloudSyncAccessToken,
    disconnectCloudSync,
    startCloudSyncPkce,
  };
}
