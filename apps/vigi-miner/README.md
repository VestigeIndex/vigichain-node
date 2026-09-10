# Vigi Miner Desktop 0.3

Native Mission Control for VigiChain mining and node operation.

## Current capabilities

- Tauri 2 + Rust backend and React/TypeScript UI.
- Testnet mining control; Mainnet is visible but hard-locked until Core launch.
- Verified node installer: release signature, signed SHA-256 manifest, signed provenance/source binding and CycloneDX SBOM checks.
- Reward address only; no seed phrase or private key handling.
- Isolated Vigi data/temp directories and cleared inherited environment.
- Eco / Balanced / Performance / Custom compute profiles.
- Opt-in, read-only discovery of external cgminer-compatible mining hardware on private LANs.
- In-app Help Center.
- EN / ES / DE / FR / PT / AR / ZH locale layer with RTL support.
- Vigi Compact storage surface and lossless `.vgc` container prototype.

## Vigi Compact 0.1

The desktop implementation is intentionally conservative. It can compact files explicitly supplied to `~/.vigichain/compact/source`, storing verified content-addressed objects in `~/.vigichain/compact/objects`.

Each object:

1. records canonical length and SHA-256,
2. compresses with Zstandard,
3. is decompressed immediately,
4. must match the original bytes and digest,
5. is activated by atomic rename only after verification.

The UI exposes Automatic / Maximum / Off, Compact now, canonical bytes represented, compact bytes stored, space saved and verified object counts.

**This does not yet compact the private Core database directly.** That requires the versioned Core IPC contract in `VIGI_COMPACT_CONTRACT.md`. Vigi Miner must never guess or scrape the private database format. Compact is not pruning and does not change consensus.

## Security boundaries

- Mainnet is fail-closed in UI and backend.
- External hardware discovery requires an explicit click and is read-only.
- Current process isolation is data/environment isolation, not yet a full kernel sandbox. Platform containment remains required before claiming `Full sandbox`.
- Power percentages currently map to mining-thread allocation; OS-native CPU quotas remain a follow-up.
- Compact input has a canonical-size safety bound and every activated object is round-trip/hash verified.

## Validation

`.github/workflows/vigi-miner-ci.yml` validates the TypeScript/Vite frontend, `cargo check`, and Vigi Compact round-trip/corruption tests. Keep the PR draft until CI has actually executed successfully and the Core telemetry/Compact IPC contracts are implemented by Core.
