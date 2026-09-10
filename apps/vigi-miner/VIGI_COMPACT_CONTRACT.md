# Vigi Compact — storage contract v0.1

Vigi Compact is a lossless local storage layer for VigiChain. It is **not pruning** and **not consensus**.

## Hard invariants

1. Canonical VigiChain bytes remain authoritative.
2. A compact object restores byte-for-byte before normal Core validation.
3. Compression never changes block hashes, TXIDs, Merkle roots, signatures, PoW inputs or consensus rules.
4. Each object is bound to canonical byte length and SHA-256.
5. The object filename is content-addressed by the same canonical SHA-256 and verified on stats/restore.
6. Decompression is bounded: 16 GiB per object and 64 GiB per desktop operation in v0.1.
7. Activation uses pending file + fsync + atomic rename only after immediate round-trip verification.
8. Corruption, truncation, digest mismatch and oversized declared output fail closed.
9. Objects that would become larger after compression are skipped.
10. Compact != prune. v0.1 deletes no historical information.

## Implemented desktop prototype

`src-tauri/src/compact.rs` implements the `VGC1` container using Zstandard and content-addressed filenames.

- Source candidates: `~/.vigichain/compact/source`
- Verified objects: `~/.vigichain/compact/objects/<canonical-sha256>.vgc`
- Verified restore output: `~/.vigichain/compact/restored/<canonical-sha256>.canonical`

Mission Control exposes Automatic / Maximum / Off, Compact now, Restore verified, canonical bytes represented, compact bytes stored, bytes saved, verified objects and candidate count.

## Post-quantum authentication boundary

Compression itself is not post-quantum cryptography. VGC1 currently provides local canonical integrity through SHA-256 and exact reconstruction. When Compact objects become distributable snapshots/archive segments, authentication belongs in a **signed manifest envelope**, not inside the compression algorithm.

The future network/archive manifest should bind network, object kind, canonical digest/length, chunk/Merkle root, codec/version and source block height/hash, then be authenticated with the standardized post-quantum signature policy selected by VigiChain Core (for example ML-DSA or SLH-DSA if adopted by Core). Vigi Miner must consume Core's versioned signature policy rather than invent a new cryptosystem or hard-code a separate consensus trust root.

## Deliberate Core boundary

The public distribution repository does not contain the private VigiChain Core persistence implementation. Vigi Miner therefore does **not** parse, mutate, rename or compress the private chain database directly.

Production integration requires Core to expose immutable canonical objects over versioned local IPC:

- `compact.candidates()`
- `compact.open(id)` -> canonical stream + expected length/digest
- `compact.commit(id, compact-object, manifest)` -> Core-owned atomic transition
- `compact.restore(id)` -> canonical stream
- `compact.stats()`

Core decides when an object is immutable and safe to compact. Vigi Miner remains policy/UI/controller. The compressed representation never becomes a consensus object.

## Validation

Rust tests cover exact round-trip reconstruction, corruption rejection, truncation rejection, oversized declared-output rejection and content-address naming. `.github/workflows/vigi-miner-ci.yml` runs `cargo check`, Compact tests and the frontend build. Do not claim CI is green until GitHub Actions actually reports success.
