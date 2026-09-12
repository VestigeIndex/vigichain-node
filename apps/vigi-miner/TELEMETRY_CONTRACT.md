# Vigi Miner ↔ VigiChain Core telemetry contract

Status: desktop adapter implemented; Core producer pending.

Vigi Miner must never infer consensus state by scraping human-readable logs. Core should expose a local-only, versioned telemetry surface intended for operator software.

## Transport

Preferred production order:

1. Unix domain socket on Linux / named pipe on Windows.
2. Loopback-only HTTP/JSON as a compatibility fallback.

The desktop adapter currently implements the fallback at:

`http://127.0.0.1:28720/v1/telemetry`

`VIGI_TELEMETRY_URL` may override the URL, but the desktop client rejects non-HTTP schemes and every non-loopback host. It only accepts `127.0.0.1`, `localhost` or `::1`.

The endpoint MUST NOT bind to a public interface by default.

## Versioning

Every response includes a telemetry schema version independent from consensus:

```json
{ "schemaVersion": 1 }
```

Breaking telemetry changes increment `schemaVersion`; they do not change consensus.

## Snapshot schema v1

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
    "canonicalBytes": 34800000000,
    "compactBytes": 11200000000,
    "ratio": 0.3218,
    "mode": "archive-v1"
  }
}
```

## Desktop validation behavior

The implemented adapter:

- requires `schemaVersion == 1`;
- accepts only `testnet` or `mainnet`;
- requires sync progress within `0.0..=1.0`;
- uses short connection/read timeouts so telemetry cannot stall Mission Control;
- returns `available=false` when Core is absent rather than inventing zero values;
- hides live metrics if the returned network differs from the network selected in the UI.

## Security requirements

- Local-only by default.
- Read-only telemetry must not expose private keys, node identity secrets, seeds or signing material.
- Reward address is public data and may be exposed.
- Mutating commands such as start/stop mining remain process/config controls owned by the desktop supervisor unless Core later defines an authenticated local control API.
- Mainnet activation remains impossible through this interface while `MAINNET_LAUNCHED=false`.
- Telemetry failure must not affect consensus, mining or P2P operation.

## Vigi Compact

Compression telemetry is operator information only. Canonical hashes, transaction IDs, Merkle commitments and consensus validation remain unchanged. Core remains authoritative for canonical storage state and must expose compact statistics through this schema only after the Core-side Vigi Compact IPC contract exists.
