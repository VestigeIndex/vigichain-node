# Vigi Miner ↔ VigiChain Core telemetry contract

Status: proposed for testnet integration.

The desktop miner must never infer consensus state by scraping human-readable logs. Core should expose a local-only, versioned telemetry surface intended for operator software.

## Transport

Preferred order:

1. Unix domain socket on Linux / named pipe on Windows.
2. Loopback-only HTTP/JSON as a compatibility fallback.

The endpoint MUST NOT bind to a public interface by default.

## Versioning

Every response must include a telemetry schema version independent from the consensus version.

```json
{
  "schemaVersion": 1
}
```

Breaking telemetry changes increment `schemaVersion`; they do not change consensus.

## Snapshot

Suggested snapshot payload:

```json
{
  "schemaVersion": 1,
  "network": "testnet",
  "nodeVersion": "1.0.12-testnet",
  "uptimeSeconds": 4182,
  "sync": {
    "height": 184932,
    "targetHeight": 184932,
    "progress": 1.0
  },
  "p2p": {
    "authenticatedPeers": 17,
    "inboundPeers": 4,
    "outboundPeers": 13
  },
  "mining": {
    "enabled": true,
    "threads": 12,
    "hashrateHs": 2849321,
    "blocksFoundSession": 3,
    "rewardAddress": "tvigi1…"
  },
  "storage": {
    "chainBytes": 12823910343,
    "stateBytes": 1432201024,
    "compactBytes": null
  }
}
```

## Security requirements

- Local-only by default.
- Read-only telemetry must not expose private keys, node identity secrets, seeds or signing material.
- Reward address is public data and may be exposed.
- Mutating commands such as start/stop mining should remain process/config controls owned by the desktop supervisor unless Core later defines an authenticated local control API.
- Mainnet activation must remain impossible through this interface while `MAINNET_LAUNCHED=false`.
- Telemetry failure must not affect consensus, mining or P2P operation.

## Vigi Miner behavior

Vigi Miner should:

- poll the snapshot at a modest cadence (1–2 seconds for desktop display);
- display stale/unknown instead of fabricating zero values;
- keep the node running if the UI exits unexpectedly, once service mode is introduced;
- tolerate a newer telemetry schema by refusing unsupported fields rather than affecting the node;
- never parse human-readable log text as a consensus source.

## Future Vigi Compact fields

When Vigi Compact exists, extend `storage` without changing canonical block/state semantics:

```json
{
  "storage": {
    "canonicalBytes": 34800000000,
    "compactBytes": 11200000000,
    "ratio": 0.3218,
    "mode": "archive-v1"
  }
}
```

Compression metadata is operator telemetry only. Canonical hashes, transaction IDs, Merkle commitments and consensus validation remain unchanged.
