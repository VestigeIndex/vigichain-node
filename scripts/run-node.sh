#!/usr/bin/env bash
# VigiChain testnet node launcher (Linux/macOS).
# Runs the official binary placed next to this repo folder.
set -euo pipefail
cd "$(dirname "$0")/.."
export VIGI_NETWORK="${VIGI_NETWORK:-testnet}"
BIN="./vigichain-node-linux-x86_64"
if [ ! -x "$BIN" ]; then
  echo "Binary not found or not executable."
  echo "Download it from the Releases page, place it here, then: chmod +x $BIN"
  exit 1
fi
exec "$BIN" "${1:-start}"
