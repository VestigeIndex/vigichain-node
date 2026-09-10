# Vigi Compact — storage contract v0.1

Vigi Compact is a lossless local storage layer for VigiChain. It is **not pruning** and **not consensus**.

## Hard invariants

1. Canonical VigiChain bytes remain authoritative.
2. A compact object restores byte-for-byte before normal Core validation.
3. Compression never changes block hashes, TXIDs, Merkle roots, signatures, PoW inputs or consensus rules.
4. Each object is bound to canonical byte length and SHA-256.
5. The object filename is content-addressed by the same canonical SHA-256 and is verified on stats/restore.
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

## Deliberate Core boundary

The public distribution repository does not contain the private VigiChain Core persistence implementation. Vigi Miner therefore does **not** parse, mutate, rename or compress the private chain database directly.

The prototype only operates on explicitly supplied canonical files. Production integration requires Core to expose immutable canonical objects over a versioned local IPC contract:

- `compact.candidates()`
- `compact.open(id)` -> canonical stream + expected length/digest
- `compact.commit(id, compact-object, manifest)` -> Core-owned atomic transition
- `compact.restore(id)` -> canonical stream
- `compact.stats()`

Core decides when an object is immutable and safe to compact. Vigi Miner remains policy/UI/controller. The compressed representation never becomes a consensus object.

## Validation

Rust tests cover exact round-trip reconstruction, corrupted payload rejection, truncated container rejection and oversized declared-output rejection. `.github/workflows/vigi-miner-ci.yml` runs `cargo check`, Compact tests and the frontend build. Do not claim CI is green until GitHub Actions actually reports success.
