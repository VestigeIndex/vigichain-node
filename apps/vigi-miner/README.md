# Vigi Miner Desktop

Professional desktop control surface for the VigiChain public testnet miner/node.

## Goals

- One-screen mining for non-technical operators.
- No seed phrase or private key handling; only a testnet reward address.
- Keep the VigiChain node/Core as a separate process.
- Preserve shell/headless operation for servers and advanced operators.
- Never change consensus rules from the desktop application.
- Fail closed when a verified node binary is unavailable.

## Current alpha

The UI provides a modern mining dashboard, reward-address input, CPU thread control, bootnode configuration and start/stop process control.

The backend launches the existing node binary using the established testnet environment contract:

- `VIGI_NETWORK=testnet`
- `VIGI_ENABLE_MINING=true`
- `VIGI_MINING_THREADS=<n>`
- `VIGI_MINER_ADDRESS=<tvigi1...>`
- `VIGI_BOOTNODES=<peer>`

It looks for a VigiChain node under `~/.vigichain`, or an explicit `VIGI_NODE_BINARY` path.

## Deliberately not faked

Hashrate, peer count, block height, storage and temperature currently show placeholders. They must be fed by a stable Core telemetry/RPC contract; the desktop must not scrape logs or invent numbers.

## Next integration contract

Core should expose a local-only status surface with at least:

```json
{
  "network": "testnet",
  "height": 0,
  "peers": 0,
  "mining": {
    "enabled": true,
    "threads": 1,
    "hashrate_hs": 0,
    "blocks_found": 0
  },
  "storage_bytes": 0,
  "sync": { "current": 0, "target": 0 }
}
```

Prefer a versioned loopback RPC or IPC endpoint. Do not expose administrative mining control publicly.

## Development

```bash
npm install
npm run tauri dev
```

The application is testnet-only. Mainnet remains controlled by the Core and must stay impossible to enable from this UI.
