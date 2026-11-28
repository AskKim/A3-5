# `src/storage/` — Browser Storage, Sync and Diagnostics

The browser-side implementation layer. It talks to `@engine/storage/*` contracts and to the pedigree
domain; UI and hooks talk only to this layer, never to IndexedDB, OPFS or `sql.js` directly.

## SQLite (the primary store)

| File | Owns |
| --- | --- |
| `webSqliteAdapter.ts` | The adapter: executes `sql.js` WASM against `PEDIGREE_SQLITE_SCHEMA`, persists the raw `.sqlite` bytes, exposes export/import of the file. |
| `sqliteSchema.ts` | The canonical DDL, shared 1:1 with native `expo-sqlite`, Apple `WKWebView` and Android SQLite containers. Change the schema here or not at all. |
| `sqliteIdbPersistence.ts` | IndexedDB persistence of the database image, quota recovery and browser cache cleanup. |
| `sqliteRowMappers.ts` | Row → domain mappers and numeric/enum sanitizers. |
| `sqliteRowWriters.ts` | Domain → row upsert writers. |
| `storageAdapter.ts` | The `BarnStorageAdapter` contract the UI consumes. |

`applySchemaMigrations` and `readSqliteUserVersion` are exported from `webSqliteAdapter.ts` for
diagnostics and upgrade gating. Persistence may be delegated to an injected `IStorageAdapter`
(`backingStore`) so native shells route SQLite bytes through the iOS/desktop bridge instead of
evictable IndexedDB.

## OPFS, workers and archives

| File | Owns |
| --- | --- |
| `opfsStorage.ts` | OPFS detection, `/tmp`, `/backups` and `/archives` namespaces, vault snapshots. |
| `opfsTempStream.ts` | Worker-safe `/tmp` scratchpad and incremental chunk streaming (engine-delegated). |
| `archiveAndImport.worker.ts` | Off-thread ZIP compression/extraction, large external pedigree parsing, support-bundle packaging. |
| `offThreadWorkerClient.ts` | Client bridge to that worker, with a main-thread fallback. |
| `backgroundFreezeCoordinator.ts` | Mobile background-freeze pause/resume facade over `@engine/storage/lifecycleCoordinator`. |

## Sync

| File | Owns |
| --- | --- |
| `localSyncChannels.ts` | `device_id`, monotonic `logical_counter`, `sync_outbox`, `sync_conflicts`, file-based and P2P delta transport. |
| `p2pLanChannel.ts` | LAN WebRTC data channel facade (`@engine/storage/lanWebRtcTransport`) with the `CP-LAN1:` signalling prefix. |
| `cloudAppFolderSync.ts` | Optional cloud app-folder transport with a memory-only OAuth token store. |

## Protection, updates and device state

| File | Owns |
| --- | --- |
| `storageProtection.ts` | Persistent-storage requests, quota guardrails, rolling local backups, PWA install state. |
| `storageProbes.ts` | Restricted-browser probes and the lifecycle resource registry (engine-delegated). |
| `pwaUpdateManager.ts` | Manual service-worker update governor (`auto` / `notify` / `pinned`), uncached upgrade gate, single-reload handshake. |
| `deviceCapabilityDetector.ts` | Hardware/feature signal collection and per-device dismissal state. |
| `crashLogger.ts` | Uncaught-error capture, diagnostic ring buffer, memory logging, retention. |
| `vetDocsFolder.ts` | Read-only File System Access folder pointer plus external-backup reminder state. |
| `weatherForecast.ts` | Opt-in, offline-safe, keyless forecast client with a bounded timeout. |

## Media and capture

| File | Owns |
| --- | --- |
| `webImageOptimizer.ts` | Photo compression and thumbnail generation. |
| `photoHydration.ts` | Bounded LRU full-resolution photo cache; snapshot state keeps thumbnails only. |
| `pedigreeOcrScanner.ts` | Offline paper-pedigree OCR and scanned-PDF pipeline. |
| `feedTagOcr.ts` | Pre-compression feed-tag/receipt OCR capture. |

## Rules

- **One schema.** Native wrappers execute the same `sqliteSchema.ts`; a browser-only column breaks
  them silently.
- **Short transactions.** IndexedDB transactions stay atomic and `readonly` where possible; migrations
  are version-gated with `try/catch` and a pre-reset dump.
- **Close handles, revoke URLs.** OPFS handles go in `try/finally`; every temporary object URL is
  revoked after use.
- **Quota failures are recoverable.** Catch `QuotaExceededError`, purge `/tmp` and non-essential
  caches, then retry once.
- **Never trust browser storage on iOS.** `WKWebView` evicts IndexedDB and `localStorage` after 7 days
  under ITP; persistence routes through `@engine/storage/nativeBridgeStorageAdapter`.

## Verification

```bash
npm test -- src/storage/__tests__   # adapters, retention, quota recovery, restore paths
npm run verify:layers               # no import from components/hooks into storage
npm run verify:chunks               # after a build; catches circular chunk imports
```

`src/storage/__tests__/` covers the adapter round-trips, OPFS retention, encrypted export framing and
destructive-restore behaviour; a change to the SQLite split should add or update a test there.
