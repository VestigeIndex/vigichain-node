# VigiChain Node — Public Testnet

Run a node on the **VigiChain** public, post-quantum test network. This repository
distributes the **ready-to-run node binary** and the instructions to operate it.
It does **not** contain source code — it is the official node build, published so
anyone can join the testnet and help harden the network toward an honest mainnet.

> **Testnet only.** VIGI on the testnet carries **no real value**. Mainnet is
> **locked** in the software and stays locked until an external security audit and
> sustained burn-in. Running a node today makes you a **founding operator**.

- Website: https://vigichain.org
- VigiScan (block explorer): https://vigichain.org/scan
- Live network view: https://vigichain.org/explorer
- Wallet: https://vigichain.org/wallet

> **Update to `v1.0.6-testnet`.** It is the first release built end to end by the
> pipeline — reproducible container build, signatures, SBOM, and a verification job
> that re-checks every artifact before publishing. v1.0.4 was the first build that
> could join over a direct peer and v1.0.5 the first that could join through the
> **relay**, which is the path anyone behind a home router uses. Every release
> before those could dial a peer, complete a handshake, ask for the chain — and
> then sit at height zero forever without printing a reason. If you tried to run a
> node before 16 August 2026 and gave up, that was not your setup. Replace the
> binary, keep your `VIGI_DATA_DIR`, restart.

## Install in one command

No administrator rights, nothing outside `~/.vigichain`, and the binary's checksum
**and signature** are verified before anything runs:

```bash
# Linux, or Windows inside WSL
curl -fsSL https://vigichain.org/join.sh | bash
```

```powershell
# Windows PowerShell — uses WSL when it is available, which is the supported path
irm https://vigichain.org/join.ps1 | iex
```

Undo it with `rm -rf ~/.vigichain`. No service is installed and nothing starts by
itself at boot. The manual route is below.

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

Download the build for your OS from the **[Releases](../../releases)** page (the
releases are pre-releases, so `/releases/latest` will not show them — open the
list), then verify what you downloaded against `SHA256SUMS.txt`:

```bash
# Linux
sha256sum -c SHA256SUMS.txt
tar xzf vigichain-node-linux-x86_64.tar.gz     # unpacks ./vigichain-node
```

```powershell
# Windows (PowerShell)
Get-FileHash .\vigichain-node-windows-x86_64.exe -Algorithm SHA256
```

### Verify the signature (recommended)

A checksum alone does not prove *who* built the binary. Each release ships a `.sig`
next to every binary, made with the VigiChain release key. Verify it with
[minisign](https://jedisct1.github.io/minisign/) or the compatible
[rsign2](https://github.com/jedisct1/rsign2):

**VigiChain release public key:**
```
RWQItT0J/YGNHI45GYmzWqVLUP+fMp5GXIbKxjp7eH/l7vZLfhv7KUsa
```

```bash
# minisign — save the key line above as vigichain.pub (prefixed with a comment line):
minisign -Vm vigichain-node-linux-x86_64.tar.gz -p vigichain.pub

# or rsign2 (no key file needed — paste the key inline):
rsign verify -P RWQItT0J/YGNHI45GYmzWqVLUP+fMp5GXIbKxjp7eH/l7vZLfhv7KUsa \
  -x vigichain-node-linux-x86_64.tar.gz.sig vigichain-node-linux-x86_64.tar.gz
```

`SHA256SUMS.txt` is signed too, so the checksums themselves can be verified before
you trust them.

A binary is authentic only if verification succeeds against that key. VigiChain is
**sovereign**: releases are signed by a single UTXO Labs key — but you never have to
*trust* that signature. Integrity is meant to be **verified, not trusted**:

- the release key is held **offline / in hardware**, so it cannot be stolen from a
  build host or a compromised account;
- builds are **reproducible** — rebuild from the audited source commit and confirm
  the binary matches bit-for-bit;
- every release states **how it was built** — CI or by hand — so you never have to
  assume it.

GitHub build-provenance attestations are deliberately absent, and it is worth saying
why rather than leaving a gap: GitHub does not offer them for private repositories
owned by a personal account, and the source of a post-quantum chain is not going
public to satisfy a platform restriction. The reproducible build is the stronger
claim in any case — it lets you rebuild the binary yourself and compare, rather than
trusting a third party's statement that someone else did.

Sole authority, zero required trust in a third party.

## Run a testnet node

```bash
# Linux
VIGI_NETWORK=testnet ./vigichain-node start
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

Mining is part of running a node, not a separate command: a node with mining on
validates, produces and persists real blocks. (The old standalone `mine` command is
disabled — it did not produce canonical blocks.)

```bash
VIGI_NETWORK=testnet VIGI_ENABLE_MINING=true \
  VIGI_MINER_ADDRESS=<your tvigi1 address> \
  ./vigichain-node start
```

## Configuration (environment variables)

| Variable | Purpose | Default |
|---|---|---|
| `VIGI_NETWORK` | `testnet` (this repo) / `devnet` (local) | `testnet` |
| `VIGI_NODE_KEY_PATH` | node identity keystore path | `<data_dir>/node_key.json` |
| `VIGI_ENABLE_MINING` | produce blocks as well as validate them | `false` |
| `VIGI_MINING_THREADS` | proof-of-work threads when mining | CPU count |
| `VIGI_MINER_ADDRESS` | `tvigi1…` address that receives mined rewards | node's own |
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
