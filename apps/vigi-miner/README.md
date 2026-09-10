# Vigi Miner Desktop 0.3

Native Mission Control for VigiChain mining, node operation and storage control.

## Current capabilities

- Tauri 2 + Rust backend and React/TypeScript UI.
- Testnet mining control; Mainnet visible but hard-locked until Core launch.
- Verified node installer: release signature, signed SHA-256 manifest, signed provenance/source binding and CycloneDX SBOM checks.
- Reward address only; no seed phrase/private-key handling.
- Isolated Vigi data/temp directories and cleared inherited environment.
- Eco / Balanced / Performance / Custom compute profiles.
- Opt-in read-only discovery of cgminer-compatible hardware on private LANs.
- In-app Help Center.
- EN / ES / DE / FR / PT / AR / ZH locale layer with Arabic RTL.
- Vigi Compact storage surface and lossless `.vgc` container engine.

## Vigi Compact 0.1

The desktop implementation is intentionally conservative. It operates only on canonical files explicitly supplied to `~/.vigichain/compact/source`, storing verified content-addressed objects in `~/.vigichain/compact/objects`.

Every activated object records canonical length + SHA-256, compresses with Zstandard, immediately round-trips, verifies exact bytes/digest, fsyncs a pending file and atomically renames it. Inputs that do not become smaller are skipped. Declared output length is bounded to mitigate decompression bombs.

The Storage UI exposes Automatic / Maximum / Off, Compact now, Restore verified, canonical bytes represented, compact bytes stored, saved bytes, candidate count and verified object count. Verified restores are written under `~/.vigichain/compact/restored`.

**This does not yet mutate the private Core database.** Production chain compaction requires the versioned Core IPC contract in `VIGI_COMPACT_CONTRACT.md`; Vigi Miner must never guess the Core persistence format. Compact is not pruning and does not change consensus.

## Security boundaries

- Mainnet fail-closed in UI and backend.
- Hardware discovery requires explicit user action and is read-only.
- Current process isolation is data/environment isolation, not yet a full kernel sandbox.
- Power percentage currently maps to mining-thread allocation; OS-native quotas remain a follow-up.
- Compact has canonical-size bounds, atomic activation and exact restore/hash verification.

## Validation

`.github/workflows/vigi-miner-ci.yml` validates the frontend, `cargo check`, and Compact tests. Compact tests cover exact round-trip, corrupted payload rejection, truncated container rejection and oversized declared-output rejection. Keep the PR draft until GitHub Actions actually reports success and the Core telemetry/Compact IPC contracts are implemented by Core.
