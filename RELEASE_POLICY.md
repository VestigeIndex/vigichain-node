# VigiChain Node Release Policy

Every release is fail-closed. Publication or execution is blocked unless all gates below have
reproducible evidence for the exact tag and artifact digest.

| Gate | Required evidence |
|---|---|
| Source binding | immutable source commit and tag |
| Reproducibility | pinned compiler, dependencies and Linux image digest; independent rebuild comparison |
| Integrity | SHA-256 manifest covering every artifact |
| Authenticity | detached signature for every executable and for provenance/checksum metadata |
| Dependency inventory | non-empty CycloneDX SBOM |
| Provenance | signed in-toto/SLSA-compatible statement binding builder, source and artifact digest |
| Verification | separate job re-checks hashes and signatures before publication |
| Network safety | `MAINNET_LAUNCHED=false`; no mainnet activation; authenticated direct/Tor P2P only |

Current published status, re-checked on **9 September 2026** by running
[`scripts/verify-release.sh`](scripts/verify-release.sh) against the downloaded package:

| Release | Result | Evidence |
|---|---|---|
| `v1.0.10-testnet` and earlier | **FAIL — DO NOT RUN AS A VERIFIED RC** | binaries + checksum only; signatures, SBOM and provenance absent |
| `node-v1.0.12-testnet` | **PASS for every gate a downloader can check** | see below |

For `node-v1.0.12-testnet`, verified locally rather than asserted:

```text
vigichain-node-linux-x86_64      0502382b96523e8506c19d2451758e0733426224198d0cfe3e12a2249526d222
vigichain-node-windows-x86_64.exe ec1dc5d74fd20be22cca8a467cd766fdae8f43f9d3fdcec4bcc8fccd69eca827
```

- both binaries, `SHA256SUMS`, `VIGICHAIN-PROVENANCE.json` and their detached signatures verify
  against the release public key below;
- the provenance binds those digests to `VestigeIndex/Vi@771116eba6c4769fa008736f6fb2ca54cc77e2b1`,
  tag `node-v1.0.12-testnet`, builder `.github/workflows/release.yml`;
- the CycloneDX inventory parses and lists 132 components.

**What that PASS does not say.** Two gates in the table above are not satisfied by this release, and
saying so here is the difference between a policy and a badge:

1. *Reproducibility — independent rebuild.* The release workflow rebuilds the Linux artifact a
   second time with `--no-cache` **inside the same self-hosted job**. That defends against a stale
   cache; it does not make the second build an independent one. Until a second operator on a second
   machine rebuilds the tag and publishes the digest they got, `independentRebuildCompared` in the
   provenance must be read as *rebuilt twice by the same builder* (external finding IDL-08).
2. *Dependency inventory binding.* The SBOM ships beside the artifacts but no digest for it appears
   in the signed provenance, so it can be verified as present, parseable and non-empty, and not as
   the inventory of this build. Releases produced after 9 September 2026 record it as a byproduct,
   and `verify-release.sh` enforces the binding as soon as one is present.

Nor is the signing model stronger than it is: the key is injected from CI secret storage, which is
online signing. No offline ceremony is claimed.

**The verifier checks the package, not one file.** Until 9 September 2026 `verify-release.sh` and
`verify-release.ps1` checked the executable and its signature only, so a genuine binary sitting
alone in a directory verified clean — with no manifest, inventory or provenance anywhere near it
(external finding IDL-04). Both now refuse unless the whole package is present, the metadata's own
signatures verify *before* their contents are believed, the digest matches the signed manifest, and
the signed provenance binds that digest to one source commit, a tag and a named builder. Every one
of those refusals is tested, one condition at a time, by
[`scripts/tests/verify-release-negatives.sh`](scripts/tests/verify-release-negatives.sh) — including
the audit's own reproduction, which is now case one.

This status changes only when a new immutable release supplies every required artifact and the
verification has actually run. Do not edit this table to claim PASS before it has.
