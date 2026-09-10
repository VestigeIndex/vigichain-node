# Vigi Miner Desktop 0.3

Native Mission Control for VigiChain mining, node operation and storage control.

## Implemented

- Tauri 2 + Rust backend and React/TypeScript UI.
- Testnet mining; Mainnet visible but fail-closed until Core launch.
- Verified node installer with release signature, signed SHA-256 manifest, signed provenance/source binding and provenance-bound non-empty CycloneDX SBOM.
- Reward address only; no seed/private-key handling.
- Isolated Vigi data/temp directories and cleared inherited process environment.
- Eco / Balanced / Performance / Custom compute profiles.
- Opt-in read-only discovery of cgminer-compatible devices on private LANs.
- Help Center and EN / ES / DE / FR / PT / AR / ZH locale layer with Arabic RTL.
- Vigi Compact 0.1 storage engine and dedicated Mission Control Storage surface.

## Vigi Compact 0.1

The desktop implementation operates only on canonical regular files explicitly supplied to `~/.vigichain/compact/source`; symbolic links are rejected. Verified objects are content-addressed under `~/.vigichain/compact/objects/<sha256>.vgc`; verified restore output is written to `~/.vigichain/compact/restored`.

Every accepted object records canonical length + SHA-256, uses Zstandard, immediately round-trips, verifies exact bytes/digest and content-addressed filename, fsyncs a pending file and atomically renames it. Crash-leftover `.pending` files are never treated as verified objects and are cleaned before replacement. Inputs that do not become smaller are skipped. Safety bounds are 16 GiB per canonical object, a bounded container size, and 64 GiB aggregate per desktop inventory/compact/restore operation.

The Storage UI exposes Automatic / Maximum / Off, Compact now, Restore verified, canonical bytes represented, compact bytes stored, saved bytes, candidate count and verified object count.

**Production Core database compaction is deliberately not performed from this public controller repository.** The private Core must implement the versioned local IPC contract in `VIGI_COMPACT_CONTRACT.md`. Vigi Miner must never guess or mutate Core persistence internals. Compact is not pruning and never changes consensus.

## Security boundaries

- Mainnet fail-closed in UI and Rust backend.
- Hardware discovery requires explicit user action and is read-only.
- Current node isolation is data/environment isolation, not yet a full kernel sandbox.
- Power percentage maps to mining-thread allocation until native OS quotas are implemented.
- Compact rejects corrupt, truncated, oversized, wrongly content-addressed and symlinked objects.

## Validation

`.github/workflows/vigi-miner-ci.yml` contains frontend build, `cargo check` and Compact tests. Compact tests cover exact round-trip, corruption, truncation, declared decompression bomb and content-address naming. The workflow has not yet reported a run through the connector, so this PR remains draft and must not be described as CI-green yet.
