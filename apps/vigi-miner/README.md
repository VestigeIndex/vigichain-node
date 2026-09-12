# Vigi Miner Desktop 0.3

Native Mission Control for VigiChain mining, node operation and storage control.

## Implemented

- Tauri 2 + Rust backend and React/TypeScript UI.
- Testnet mining; Mainnet visible but fail-closed until Core launch.
- Verified node installer with release signature, signed SHA-256 manifest, signed provenance/source binding and provenance-bound non-empty CycloneDX SBOM.
- Reward address only; no seed/private-key handling.
- Help Center and EN / ES / DE / FR / PT / AR / ZH locale layer with Arabic RTL.
- Opt-in read-only discovery of cgminer-compatible devices on private LANs.
- Eco / Balanced / Performance / Custom compute profiles.
- OS-constrained miner process with explicit capability reporting.
- Local-only Core telemetry adapter and live Mission Control metrics when Core exposes schema v1.
- Vigi Compact 0.1 storage engine, verified restore flow and disk-pressure advisor.

## Isolation and power control

The node always receives private Vigi data/temp directories and a cleared inherited environment.

On Linux/Unix the launcher additionally applies `PR_SET_NO_NEW_PRIVS`, disables core dumps and uses a restrictive `umask`. On Windows the child process is attached to a Job Object with process-tree lifetime containment and a hard CPU-rate cap corresponding to the selected power percentage. If required containment cannot be attached, Vigi Miner kills the child and refuses to continue.

This capability is reported as `os-constrained`, not `full-sandbox`. Stronger filesystem/network confinement such as AppContainer on Windows or namespace/seccomp-style isolation on Linux remains a separate hardening stage and must not be implied until implemented and validated.

## Core telemetry

`src-tauri/src/telemetry.rs` implements the version-1 read-only adapter described in `TELEMETRY_CONTRACT.md`.

- Default fallback endpoint: `http://127.0.0.1:28720/v1/telemetry`.
- Only loopback hosts are accepted; remote telemetry URLs are rejected.
- Unsupported schemas, unknown networks and malformed sync values fail closed.
- Connection failure is represented as unavailable; Mission Control never fabricates zero values.
- When a valid snapshot exists, the UI shows hashrate, authenticated peers, height, sync progress, node version, uptime, blocks found and storage data.
- If the telemetry network differs from the network selected in Mission Control, live metrics are hidden and a mismatch warning is shown.

The private Core still needs to expose this contract. Unix-domain-socket / Windows named-pipe transport remains preferred over the loopback HTTP compatibility fallback.

## Vigi Compact 0.1

The desktop implementation operates only on canonical regular files explicitly supplied to `~/.vigichain/compact/source`; symbolic links are rejected. Verified objects are content-addressed under `~/.vigichain/compact/objects/<sha256>.vgc`; verified restore output is written to `~/.vigichain/compact/restored`.

Every accepted object records canonical length + SHA-256, uses Zstandard, immediately round-trips, verifies exact bytes/digest and content-addressed filename, fsyncs a pending file and atomically renames it. Crash-leftover `.pending` files are never treated as verified objects. Inputs that do not become smaller are skipped. Safety bounds are 16 GiB per canonical object, bounded container input, and 64 GiB aggregate per desktop inventory/compact/restore operation.

The Storage UI exposes Automatic / Maximum / Off, Compact now, Restore verified, canonical bytes represented, compact bytes stored, saved bytes, candidate count and verified object count. A disk advisor reads real free space and recommends Automatic or Maximum according to storage pressure; the recommendation is never silently applied.

**Production Core database compaction is deliberately not performed from this public controller repository.** The private Core must implement the versioned local IPC contract in `VIGI_COMPACT_CONTRACT.md`. Vigi Miner must never guess or mutate Core persistence internals. Compact is not pruning and never changes consensus.

## Validation

`.github/workflows/vigi-miner-ci.yml` contains frontend build plus Linux and Windows Rust validation with `cargo check` and the unit-test suite. Compact tests cover exact round-trip, corruption, truncation, declared decompression bomb and content-address naming; the storage advisor policy also has deterministic tests.

The workflow has not reported an Actions run through this connector-authored branch session, so this PR remains draft and must not be described as CI-green yet.
