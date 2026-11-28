# Changelog

User-visible changes to Community Pedigree, newest first. Versions follow
[Semantic Versioning](https://semver.org/); while the project is pre-1.0, anything may change between
alpha releases. The `v<version>` heading of the newest section is the anchor a preflight run records
in `docs/handoff-state.json`, so keep its wording stable for the whole run.

Earlier alpha releases predate this file; `IMPROVEMENTS.md` carries the full engineering history.

## v0.1.0-alpha.3 - 2026-11-28

### Added

- Device-to-device QR exchange, so a herd can move to a second device without a file transfer.
- Per-species printable exports: pedigree certificates and herd sheets render with each species' own
  terminology instead of the default livestock wording.
- All-day calendar entries, so a breeding, kindling or weaning date no longer shifts by timezone.

### Improved

- Settings and the Import/Export Hub got a polish pass, with clearer warnings before destructive
  actions and a single place to find backup, restore and export.
- Alpha 3 modularity pass: the content-agnostic engine and the reusable feature modules are now
  cleanly separated from the pedigree domain, and layer, cycle, extraction and Android gates fail the
  build if that boundary drifts.
