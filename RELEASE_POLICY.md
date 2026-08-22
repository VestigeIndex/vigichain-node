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

Current published status as audited on 22 August 2026:

| Release | Result | Evidence |
|---|---|---|
| `v1.0.10-testnet` | **FAIL — DO NOT RUN AS A VERIFIED RC** | binaries + checksum only; signatures, SBOM and provenance absent |

This status changes only when a new immutable release supplies every required artifact. Do not
edit this table to claim PASS before verification has actually run.
