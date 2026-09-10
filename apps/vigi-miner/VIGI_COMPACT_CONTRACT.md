# Vigi Compact — storage contract v0.1

Vigi Compact is a lossless local storage layer for VigiChain. It is not pruning and it is not consensus.

## Invariants

1. The canonical VigiChain bytes remain authoritative.
2. A compacted object MUST restore byte-for-byte to its canonical representation before normal Core validation.
3. Compression MUST NOT change block hashes, transaction IDs, Merkle roots, signatures, PoW inputs or consensus rules.
4. Every compact object is bound to network, object kind, canonical length and SHA-256 digest.
5. Decompression is bounded by the manifest's canonical length to prevent decompression bombs.
6. A compact object is activated atomically only after round-trip verification succeeds.
7. Failure is fail-closed: retain the canonical source and report the error.
8. Compact != prune. The first implementation never deletes historical information.

## v0.1 scope

The desktop controller exposes a real, conservative compact engine for files explicitly placed in the Vigi Compact staging/source directory. This proves the container, integrity, atomic activation, restore and UX without guessing the private Core database format.

Core integration later supplies canonical block segments / snapshots through a versioned local IPC contract.

## Container

`VGC1` container:

- magic: `VGC1`
- format version: `1`
- codec: `zstd`
- network
- object kind
- canonical byte length
- canonical SHA-256
- compressed payload

The implementation verifies decompressed length and SHA-256 before activation or restore.

## Modes

- Automatic: background candidates selected by Core policy.
- Maximum: higher zstd level, intended for disk-constrained nodes.
- Off: no new compaction; existing compact objects remain readable.

## Core IPC target

Core should eventually expose local-only operations equivalent to:

- `compact.candidates()` -> canonical immutable objects safe to compact
- `compact.open(id)` -> canonical byte stream + expected digest/length
- `compact.commit(id, container, manifest)` -> atomic storage swap
- `compact.restore(id)` -> canonical stream
- `compact.stats()` -> source/stored/saved bytes, objects, verification state

Vigi Miner must never parse the private chain database directly.
