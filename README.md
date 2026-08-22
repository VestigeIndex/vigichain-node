# VigiChain Node — Public Testnet Distribution

This repository is the binary-distribution surface for the VigiChain public testnet. It contains
operator launchers and verification policy, not the private Core source.

> **TESTNET ONLY — NO REAL VALUE. MAINNET IS LOCKED.** No artifact in this repository enables
> mainnet. The current Core keeps `MAINNET_LAUNCHED=false`.

## Distribution status: frozen pending a remediated RC

The latest published release visible during the 22 August 2026 audit,
`v1.0.10-testnet`, has only two binaries and `SHA256SUMS.txt`. It does **not** include detached
signatures, an SBOM or provenance. It therefore fails this repository's release policy and must
not be presented as a verified pre-mainnet RC.

Older releases do not contain the current Core security remediations. In particular, the legacy
WebSocket relay is a broadcast bus and cannot provide the authenticated point-to-point PQ session
that the current protocol requires. Do not downgrade to regain relay connectivity.

Installation and one-line download instructions remain suspended until a new release passes every
gate in [`RELEASE_POLICY.md`](RELEASE_POLICY.md). This is deliberate fail-closed behaviour.

## Required release contents

A release is eligible to run only when it contains, for the selected platform:

- the node binary;
- a detached `<binary>.sig` signature;
- a checksum manifest covering the exact binary;
- a CycloneDX SBOM;
- signed build-provenance evidence bound to the source commit and artifact digest.

The launchers in `scripts/` verify the detached binary signature before execution. They refuse a
missing signature, missing verifier or invalid signature. A checksum alone proves download
integrity, not publisher authenticity.

VigiChain release public key:

```text
RWQItT0J/YGNHI45GYmzWqVLUP+fMp5GXIbKxjp7eH/l7vZLfhv7KUsa
```

Linux verification example for a conforming future release:

```bash
sha256sum -c SHA256SUMS
rsign verify -P RWQItT0J/YGNHI45GYmzWqVLUP+fMp5GXIbKxjp7eH/l7vZLfhv7KUsa \
  -x vigichain-node-linux-x86_64.sig vigichain-node-linux-x86_64
```

The repository does not claim that the private half is offline or hardware-held without an
independently documented key ceremony. The currently audited Core workflow injects a signing key
from CI secret storage; that is an online signing model and must be described as such until the
owner establishes an offline ceremony.

## Network operation after the next verified RC

The remediated transport supports authenticated direct TCP peers and Tor v3 peers. The automatic
legacy relay path is disabled fail-closed. Operators behind NAT may make outbound direct or Tor
connections; they must not bypass PQ authentication to restore the old relay.

Default testnet settings:

| Variable | Purpose | Default |
|---|---|---|
| `VIGI_NETWORK` | `testnet` or isolated `devnet` | `testnet` |
| `VIGI_NODE_KEY_PATH` | persistent PQ node identity | `<data_dir>/node_key.json` |
| `VIGI_ENABLE_MINING` | validate and produce testnet blocks | `false` |
| `VIGI_MINING_THREADS` | proof-of-work threads | CPU count |
| `VIGI_MINER_ADDRESS` | `tvigi1…` reward address | node identity address |
| `VIGI_BOOTNODES` | comma-separated direct peers, or `local` | `seed-04.vigichain.org:28719` |
| `VIGI_RELAY_URL` | legacy relay selector | unset / `off` only |
| `VIGI_DATA_DIR` | chain and keystore storage | platform data dir |

Once a conforming RC exists, place its binary and adjacent `.sig` file in this checkout and use:

```bash
scripts/run-node.sh start
```

```powershell
.\scripts\run-node.ps1 start
```

The node identity keystore is persistent, owner-only and must never be shared. Preserve
`VIGI_DATA_DIR` across upgrades. Mainnet startup remains refused by the binary.

## Security and license

Report vulnerabilities privately as described in [`SECURITY.md`](SECURITY.md). Testnet VIGI has no
monetary value or entitlement. The binary distribution license is in [`LICENSE`](LICENSE).
