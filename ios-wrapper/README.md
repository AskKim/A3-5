# iOS Wrapper (Placeholder)

This directory is reserved for future iOS-specific build and wrapper files for the Community Pedigree Project. Official iOS builds distributed through the Apple App Store may be released under the Apache License 2.0 in accordance with platform requirements.

> **Unified Apple Specs:** See [`../apple-wrapper/README.md`](../apple-wrapper/README.md), [`../apple-wrapper/BRIDGE_CONTRACT.md`](../apple-wrapper/BRIDGE_CONTRACT.md), and [`../apple-wrapper/WKWebViewSQLiteContract.md`](../apple-wrapper/WKWebViewSQLiteContract.md) for the current iOS + macOS `WKWebView` contracts that supersede this early iOS-only placeholder.

## Native Storage Eviction Guardrail

All future iOS / macOS `WKWebView` shells MUST implement the native SQLite `WKScriptMessageHandler` contract documented in [`BRIDGE_CONTRACT.md`](./BRIDGE_CONTRACT.md) and [`../apple-wrapper/WKWebViewSQLiteContract.md`](../apple-wrapper/WKWebViewSQLiteContract.md) (`Documents/` or `Application Support/` sandbox persistence). Browser-managed `IndexedDB`, `localStorage`, and transient WebKit caches must never be trusted as the sole database store on iOS due to WebKit's 7-day ITP eviction policy.
