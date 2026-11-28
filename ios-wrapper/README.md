# iOS Wrapper (Placeholder)

This directory is reserved for future iOS-specific build and wrapper files for the Community Pedigree Project. Official iOS builds distributed through the Apple App Store may be released under the Apache License 2.0 in accordance with platform requirements.

> **Unified Apple Specs:** The current iOS + macOS `WKWebView` contracts live in
> [`../apple-wrapper/README.md`](../apple-wrapper/README.md),
> [`../apple-wrapper/BRIDGE_CONTRACT.md`](../apple-wrapper/BRIDGE_CONTRACT.md) and
> [`../apple-wrapper/WKWebViewSQLiteContract.md`](../apple-wrapper/WKWebViewSQLiteContract.md).
> This folder is a placeholder; its `BRIDGE_CONTRACT.md` is the superseded iOS-only draft and is kept
> for history only. Implement the Apple wrapper contracts, not the draft.

## Native Storage Eviction Guardrail

All future iOS / macOS `WKWebView` shells MUST implement the native SQLite `WKScriptMessageHandler`
contract in [`../apple-wrapper/WKWebViewSQLiteContract.md`](../apple-wrapper/WKWebViewSQLiteContract.md)
and [`../apple-wrapper/BRIDGE_CONTRACT.md`](../apple-wrapper/BRIDGE_CONTRACT.md) (`Documents/` or
`Application Support/` sandbox persistence). Browser-managed `IndexedDB`, `localStorage`, and transient
WebKit caches must never be trusted as the sole database store on iOS due to WebKit's 7-day ITP
eviction policy.
