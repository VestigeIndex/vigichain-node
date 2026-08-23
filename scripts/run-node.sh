#!/usr/bin/env bash
# VigiChain testnet node launcher (Linux/macOS).
# Runs the official binary placed next to this repo folder.
set -euo pipefail
cd "$(dirname "$0")/.."

export VIGI_NETWORK="${VIGI_NETWORK:-testnet}"

# HOW A NODE ACTUALLY FINDS THIS NETWORK.
#
# This used to default to `seed-04.vigichain.org:28719`, the direct TCP route. That hostname
# resolves, and its port is NOT reachable from the Internet — verified from an external vantage
# point. Anyone following these instructions therefore got a node that started cleanly, printed
# nothing alarming, and never found the network. The route that works is the seed's Tor v3 hidden
# service, and it is NAT-independent, so it needs no open port on your side either.
#
# Both are listed: the .onion first because it is the one that connects today, the DNS name second
# so a node picks it up automatically if that port is ever opened.
VIGI_TOR_ONION="tor://2k2us2joevlvnja7i74dbfre3krmwmi3cbft5pvz4t3rtguzoha7xzyd.onion:28719"
VIGI_DIRECT="seed-04.vigichain.org:28719"
export VIGI_BOOTNODES="${VIGI_BOOTNODES:-$VIGI_TOR_ONION,$VIGI_DIRECT}"
export VIGI_TOR_SOCKS_ADDR="${VIGI_TOR_SOCKS_ADDR:-127.0.0.1:9050}"

# The Tor route needs a SOCKS proxy on YOUR machine. The node does not ship one and will not
# install one. Say so before the node starts, rather than leaving someone to read a
# "Connection refused (os error 111)" and conclude the network is down.
socks_host="${VIGI_TOR_SOCKS_ADDR%%:*}"
socks_port="${VIGI_TOR_SOCKS_ADDR##*:}"
if ! (exec 3<>"/dev/tcp/$socks_host/$socks_port") 2>/dev/null; then
  echo "WARNING: no Tor SOCKS proxy answering on $VIGI_TOR_SOCKS_ADDR."
  echo
  echo "  The Tor route is currently the one that reaches this network from the open Internet."
  echo "  Without it your node will start, look healthy, and never find a peer."
  echo
  echo "    Debian/Ubuntu : sudo apt install tor && sudo systemctl enable --now tor"
  echo "    Fedora        : sudo dnf install tor && sudo systemctl enable --now tor"
  echo "    macOS         : brew install tor && brew services start tor"
  echo
  echo "  Then check it is listening:  ss -tln | grep 9050"
  echo "  Continuing anyway — the direct route is also configured, in case it is open for you."
  echo
fi

BIN="./vigichain-node-linux-x86_64"
if [ ! -x "$BIN" ]; then
  echo "Binary not found or not executable."
  echo "Download it from the Releases page, place it here, then: chmod +x $BIN"
  exit 1
fi
"./scripts/verify-release.sh" "$BIN"
exec "$BIN" "${1:-start}"
