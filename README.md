# VigiChain Node — Public Testnet

Run a node on the **VigiChain** public, post-quantum test network. This repository
distributes the **ready-to-run node binary** and the instructions to operate it.
It does **not** contain source code — it is the official node build, published so
anyone can join the testnet and help harden the network toward an honest mainnet.

> **Testnet only.** VIGI on the testnet carries **no real value**. Mainnet is
> **locked** in the software and stays locked until an external security audit and
> sustained burn-in. Running a node today makes you a **founding operator**.

- Website: https://vigichain.org
- Explorer: https://vigichain.org/explorer
- Wallet: https://vigichain.org/wallet

---

## What you get

- A single self-contained binary that mines and validates VigiChain testnet blocks.
- **Post-quantum consensus** end to end (ML-DSA-65 / SLH-DSA) — your node verifies
  every block for itself.
- **Zero premint, no allowlist.** Testnet VIGI is only mined, from block zero, on the
  same terms for everyone.

## Requirements

- 64-bit Linux or Windows (x86-64), a modern CPU, ~1 GB free disk to start.
- Outbound internet. For inbound peering, allow TCP **28719** (or run behind the
  free relay — see *Peering behind NAT*).

## Download & verify

Download the binary for your OS from the **[Releases](../../releases)** page, then
verify its checksum against `SHA256SUMS`:

```bash
# Linux
sha256sum -c SHA256SUMS 2>/dev/null | grep vigichain-node-linux
chmod +x vigichain-node-linux-x86_64
```

```powershell
# Windows (PowerShell)
Get-FileHash .\vigichain-node-windows-x86_64.exe -Algorithm SHA256
```

## Run a testnet node

```bash
# Linux
VIGI_NETWORK=testnet ./vigichain-node-linux-x86_64 start
```

```powershell
# Windows
$env:VIGI_NETWORK = "testnet"
.\vigichain-node-windows-x86_64.exe start
```

Your node creates a persistent identity once at `<data_dir>/node_key.json`
(owner-only permissions; the secret key is **never printed**). Testnet addresses
start with `tvigi1`.

### Mine testnet VIGI

```bash
VIGI_NETWORK=testnet VIGI_MINER_ADDRESS=<your tvigi1 address> \
  ./vigichain-node-linux-x86_64 mine
```

## Configuration (environment variables)

| Variable | Purpose | Default |
|---|---|---|
| `VIGI_NETWORK` | `testnet` (this repo) / `devnet` (local) | `testnet` |
| `VIGI_NODE_KEY_PATH` | node identity keystore path | `<data_dir>/node_key.json` |
| `VIGI_MINER_ADDRESS` | `tvigi1…` address that receives mined rewards | none |
| `VIGI_BOOTNODES` | comma-separated peers, or `local` for a private lab | network default |
| `VIGI_DATA_DIR` | chain + keystore storage | platform data dir |

Mainnet will not start: it is refused at compile time until launch, by design.

## Peering behind NAT

Home operators behind a router can peer without opening ports by pointing the node
at the public WebSocket relay published at `p2p.vigichain.org` (a transport relay
only — every node still validates all blocks locally). See the website for the
current relay endpoint and status.

## Updating

Download the newer release, verify its checksum, and restart with the same
`VIGI_DATA_DIR`. Your chain data and identity are preserved.

## Support & security

Questions and vulnerability reports: see [`SECURITY.md`](SECURITY.md).

## License

Proprietary — see [`LICENSE`](LICENSE). You may **run** this binary to operate a
VigiChain node. You may **not** reverse engineer, modify, or redistribute it.
© UTXO Labs. All rights reserved.
