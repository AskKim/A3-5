import { describe, expect, it, vi } from 'vitest';
import type { CloudSyncClientState } from '../../storage/cloudAppFolderSync';
import {
  cloudSyncProviderLabel,
  connectCloudSyncAccessTokenAction,
  disconnectCloudSyncAction,
  startCloudSyncPkceAction,
  updateCloudSyncSettingsAction,
  type CloudSyncClientPort,
} from '../barnStore/useCloudSyncActions';

const stateWith = (settings: Record<string, unknown>): CloudSyncClientState =>
  ({ settings: { enabled: false, provider: 'onedrive', ...settings } } as unknown as CloudSyncClientState);

function makeDeps(options: { tokenAccepted?: boolean; current?: CloudSyncClientState } = {}) {
  const calls: string[] = [];
  const setCloudSyncState = vi.fn();
  const notify = vi.fn();
  const current = options.current ?? stateWith({ enabled: false });
  const port: CloudSyncClientPort = {
    updatePersistedSettings: vi.fn((patch) => {
      calls.push(`persist:${JSON.stringify(patch)}`);
      return stateWith({ ...current.settings, ...patch });
    }),
    setMemoryToken: vi.fn((provider: string) => {
      calls.push(`token:${provider}`);
      return options.tokenAccepted !== false;
    }),
    clearMemoryToken: vi.fn((provider?: string) => {
      calls.push(`clear:${provider ?? 'all'}`);
    }),
    readClientState: vi.fn(() => current),
    startPkceRedirect: vi.fn(async (provider: string, clientId: string) => {
      calls.push(`redirect:${provider}:${clientId}`);
    }),
  };
  return { deps: { setCloudSyncState, notify, client: port }, port, setCloudSyncState, notify, calls };
}

describe('cloudSyncProviderLabel', () => {
  it('names both providers the way the toasts do', () => {
    expect(cloudSyncProviderLabel('onedrive')).toBe('OneDrive AppRoot');
    expect(cloudSyncProviderLabel('google_drive')).toBe('Google Drive AppFolder');
  });
});

describe('updateCloudSyncSettingsAction', () => {
  it('persists the patch, mirrors the returned state and returns it', () => {
    const { deps, port, setCloudSyncState } = makeDeps();

    const next = updateCloudSyncSettingsAction(deps, { enabled: true, autoBackgroundSync: true });

    expect(port.updatePersistedSettings).toHaveBeenCalledWith({
      enabled: true,
      autoBackgroundSync: true,
    });
    expect(setCloudSyncState).toHaveBeenCalledWith(next);
    expect(next.settings.enabled).toBe(true);
  });

  it('never touches the notifier', () => {
    const { deps, notify } = makeDeps();
    updateCloudSyncSettingsAction(deps, { enabled: true });
    expect(notify).not.toHaveBeenCalled();
  });
});

describe('connectCloudSyncAccessTokenAction', () => {
  it('enables sync and toasts when the token is accepted', () => {
    const { deps, port, notify, setCloudSyncState } = makeDeps();

    const ok = connectCloudSyncAccessTokenAction(deps, 'onedrive', 'tok-123');

    expect(ok).toBe(true);
    expect(port.setMemoryToken).toHaveBeenCalledWith('onedrive', 'tok-123');
    expect(port.updatePersistedSettings).toHaveBeenCalledWith({ provider: 'onedrive', enabled: true });
    expect(setCloudSyncState).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(
      'Connected OneDrive AppRoot (access token held in memory only).'
    );
  });

  it('keeps the previous enabled flag and stays silent when the token is rejected', () => {
    const { deps, port, notify } = makeDeps({
      tokenAccepted: false,
      current: stateWith({ enabled: true, provider: 'google_drive' }),
    });

    const ok = connectCloudSyncAccessTokenAction(deps, 'google_drive', '');

    expect(ok).toBe(false);
    expect(port.updatePersistedSettings).toHaveBeenCalledWith({
      provider: 'google_drive',
      enabled: true,
    });
    expect(notify).not.toHaveBeenCalled();
  });

  it('labels a Google connection correctly', () => {
    const { deps, notify } = makeDeps();
    connectCloudSyncAccessTokenAction(deps, 'google_drive', 'tok');
    expect(notify).toHaveBeenCalledWith(
      'Connected Google Drive AppFolder (access token held in memory only).'
    );
  });
});

describe('disconnectCloudSyncAction', () => {
  it('clears the given provider and always toasts', () => {
    const { deps, port, notify, setCloudSyncState } = makeDeps();

    disconnectCloudSyncAction(deps, 'onedrive');

    expect(port.clearMemoryToken).toHaveBeenCalledWith('onedrive');
    expect(setCloudSyncState).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(
      'Disconnected cloud app-folder access token from memory.'
    );
  });

  it('clears every provider when none is named', () => {
    const { deps, port } = makeDeps();
    disconnectCloudSyncAction(deps);
    expect(port.clearMemoryToken).toHaveBeenCalledWith(undefined);
  });
});

describe('startCloudSyncPkceAction', () => {
  it('persists provider, client id and enabled before redirecting', async () => {
    const { deps, port, notify, calls, setCloudSyncState } = makeDeps();

    await startCloudSyncPkceAction(deps, 'google_drive', 'client-abc');

    expect(port.updatePersistedSettings).toHaveBeenCalledWith({
      provider: 'google_drive',
      customOAuthClientId: 'client-abc',
      enabled: true,
    });
    expect(port.startPkceRedirect).toHaveBeenCalledWith('google_drive', 'client-abc');
    expect(setCloudSyncState).toHaveBeenCalledTimes(1);
    expect(notify).not.toHaveBeenCalled();
    expect(calls[0]).toContain('persist:');
    expect(calls[calls.length - 1]).toBe('redirect:google_drive:client-abc');
  });

  it('propagates a redirect failure to the caller', async () => {
    const { deps, port } = makeDeps();
    (port.startPkceRedirect as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('popup blocked')
    );

    await expect(startCloudSyncPkceAction(deps, 'onedrive', 'client-1')).rejects.toThrow(
      'popup blocked'
    );
  });
});
