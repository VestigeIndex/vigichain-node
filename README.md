# VigiChain Node — Public Testnet Distribution

This repository is the binary-distribution surface for the VigiChain public testnet. It contains
operator launchers and verification policy, not the private Core source.

> **TESTNET ONLY — NO REAL VALUE. MAINNET IS LOCKED.** No artifact in this repository enables
> mainnet. The current Core keeps `MAINNET_LAUNCHED=false`.

## Distribution status: open, on a release that satisfies the downloadable gates

`node-v1.0.12-testnet` is the current release, published on 8 September 2026, and it carries
everything a downloader can check: both binaries, a detached signature for each, a signed checksum
manifest, a signed CycloneDX SBOM entry and signed build provenance naming the CI run that
authorised publication. Those signatures were verified again on 9 September 2026 by running
[`scripts/verify-release.sh`](scripts/verify-release.sh) against the downloaded package — the
digests, the source commit it binds to, and the two gates it does **not** satisfy are all in
[`RELEASE_POLICY.md`](RELEASE_POLICY.md). It is built from source commit
`771116e`, which is not the latest state of Core; a release is a frozen commit, not a moving branch.

Releases before it stay unusable on purpose: `v1.0.10-testnet` and earlier carry no signatures,
and older binaries predate the current consensus, persistence, wallet-codec and PQ peer-identity
remediations. Do not downgrade to regain connectivity — in particular, the legacy WebSocket relay
is gone, because a broadcast bus cannot carry the authenticated point-to-point post-quantum
session the protocol now requires.

## Install

One command, no root, nothing outside `~/.vigichain`:

```bash
curl -fsSL https://vigichain.org/join.sh | bash
```

```powershell
irm https://vigichain.org/join.ps1 | iex
```

The two commands are not equally strong, and the difference is stated rather than hidden:

- **Linux, and Windows with WSL** (`join.sh`): the installer refuses to install anything it cannot
  authenticate. It downloads the binary, its detached signature, the signed checksum manifest and
  the signed build provenance; verifies the manifest's and the provenance's signatures **before**
  trusting anything they say; verifies the binary's own signature; checks the SHA-256; and checks
  that the signed provenance names that exact digest and a source commit. Any failure deletes the
  download. **A missing verifier is a failure too, not a warning.**
- **Windows without WSL** (`join.ps1`): there is no `rsign` on a stock Windows machine, so this path
  verifies the SHA-256 against the release's checksum file and reads the provenance to confirm it
  binds that digest and a source commit — but it cannot check any signature. That is what nearly
  every one-command installer in the world does, and it is weaker: a checksum proves the download
  arrived intact, a signature says who built it. The script says so on screen and points at
  `wsl --install -d Ubuntu` as the stronger route.

Undoing it: delete `~/.vigichain`. No service, no administrator rights, nothing else touched.

## Required release contents

A release is eligible to run only when it contains, for the selected platform:

- the node binary;
- a detached `<binary>.sig` signature;
- a checksum manifest covering the exact binary;
- a CycloneDX SBOM;
- signed build-provenance evidence bound to the source commit and artifact digest.

`scripts/verify-release.sh` and `scripts/verify-release.ps1` verify the **package**, not one file
in it: every artifact above must be present, the manifest's and provenance's own signatures are
checked before anything they say is believed, the binary's digest must match the signed manifest,
and the signed provenance must bind that digest to exactly one source commit, a release tag and a
named builder. A missing verifier, a missing signature, an unsigned manifest or metadata that
authorises some other file are all refusals, not warnings. A checksum alone proves download
integrity, not publisher authenticity — and a signature alone proves authorship, not which source
the file was built from.

Until 9 September 2026 both scripts checked only the executable and its signature, so a genuine
binary alone in a directory verified clean with no manifest, inventory or provenance present at all
(external finding IDL-04). That exact case is now the first test in
[`scripts/tests/verify-release-negatives.sh`](scripts/tests/verify-release-negatives.sh), which
exercises 25 refusals one condition at a time plus the positive control.

Verifying a downloaded release, on either platform:

```bash
./scripts/verify-release.sh ./vigichain-node-linux-x86_64
```

```powershell
./scripts/verify-release.ps1 -Binary .igichain-node-windows-x86_64.exe
```

It needs `rsign` (`cargo install rsign2`) and `python3`; both scripts call the same policy file,
`scripts/check-release-metadata.py`, so the two platforms cannot end up enforcing different rules.

VigiChain release public key:

```text
RWQItT0J/YGNHI45GYmzWqVLUP+fMp5GXIbKxjp7eH/l7vZLfhv7KUsa
```

Verifying by hand instead, on Linux:

```bash
rsign verify -P RWQItT0J/YGNHI45GYmzWqVLUP+fMp5GXIbKxjp7eH/l7vZLfhv7KUsa \
  -x SHA256SUMS.sig SHA256SUMS
sha256sum -c SHA256SUMS
rsign verify -P RWQItT0J/YGNHI45GYmzWqVLUP+fMp5GXIbKxjp7eH/l7vZLfhv7KUsa \
  -x vigichain-node-linux-x86_64.sig vigichain-node-linux-x86_64
```

The repository does not claim that the private half is offline or hardware-held without an
independently documented key ceremony. The currently audited Core workflow injects a signing key
from CI secret storage; that is an online signing model and must be described as such until the
owner establishes an offline ceremony.
