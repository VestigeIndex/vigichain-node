# Vigi Compact — storage contract v0.1

Vigi Compact is a lossless local storage layer for VigiChain. It is **not pruning** and **not consensus**.

## Hard invariants

1. Canonical VigiChain bytes remain authoritative.
2. A compact object restores byte-for-byte before normal Core validation.
3. Compression never changes block hashes, TXIDs, Merkle roots, signatures, PoW inputs or consensus rules.
4. Each object is bound to canonical byte length and SHA-256.
5. Decompression is bounded by declared canonical length (16 GiB safety ceiling in the desktop prototype).
6. Activation uses a pending file + fsync + atomic rename only after immediate round-trip verification.
7. Corruption fails closed.
8. Objects that would become larger after compression are skipped.
9. Compact != prune. v0.1 deletes no historical information.

## Implemented desktop prototype

`src-tauri/src/compact.rs` implements the `VGC1` container using Zstandard and content-addressed filenames.

Current explicit source path:

`~/.vigichain/compact/source`

Verified compact objects:

`~/.vigichain/compact/objects/<canonical-sha256>.vgc`

Verified restore output:

`~/.vigichain/compact/restored/<canonical-sha256>.canonical`

The Mission Control Storage surface exposes:

- Automatic / Maximum / Off policy
- Compact now
- Restore verified
- canonical bytes represented
- compact bytes stored
- bytes saved
- verified object count
- candidate count

Automatic uses a balanced Zstandard level; Maximum uses a higher compression level. These names describe local storage policy, not consensus behavior.

## Deliberate Core boundary

The public distribution repository does not contain the private VigiChain Core persistence implementation. Therefore Vigi Miner **does not parse, mutate, rename or compress the private chain database directly**.

The prototype only operates on explicitly supplied canonical files. Production integration requires Core to provide immutable canonical objects through a versioned local IPC contract.

Target operations:

- `compact.candidates()`
- `compact.open(id)` -> canonical stream + expected length/digest
- `compact.commit(id, compact-object, manifest)` -> Core-owned atomic storage transition
- `compact.restore(id)` -> canonical stream
- `compact.stats()`

Core remains responsible for deciding when an object is immutable and safe to compact. Vigi Miner remains the policy/UI/controller layer.

## Validation

The Rust module contains tests for exact round-trip reconstruction and corruption rejection. `.github/workflows/vigi-miner-ci.yml` runs `cargo check`, these Compact tests and the frontend build. Do not claim the build is green until GitHub Actions has actually reported success.
