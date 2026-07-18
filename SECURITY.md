# Security

This is a **test network** build. Testnet VIGI has no real value, and mainnet is
disabled in this binary by design.

## Responsible disclosure

If you find a security issue in the node, please report it **privately** through the
contact channels on https://vigichain.org — do **not** open a public issue for
security matters. We ask for coordinated disclosure so the network and its operators
can be protected first.

## Operator hygiene

- Your node creates a keystore at `node_key.json` (default under the data dir). It is
  written owner-only and the secret key is never printed. **Do not share it.**
- Only run binaries downloaded from this repository's official Releases, and verify
  the checksum against `SHA256SUMS` before running.
- Test VIGI confers no right, claim or entitlement of any kind.
