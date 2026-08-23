# VigiChain testnet node launcher (Windows).
# Runs the official binary placed in the repo folder.
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

if (-not $env:VIGI_NETWORK) { $env:VIGI_NETWORK = "testnet" }

# HOW A NODE ACTUALLY FINDS THIS NETWORK.
#
# This used to default to `seed-04.vigichain.org:28719`, the direct TCP route. That hostname
# resolves, and its port is NOT reachable from the Internet — verified from an external vantage
# point. Anyone following these instructions therefore got a node that started cleanly, printed
# nothing alarming, and never found the network. The route that works is the seed's Tor v3 hidden
# service, and it is NAT-independent, so it needs no open port on your side either.
$torOnion = "tor://2k2us2joevlvnja7i74dbfre3krmwmi3cbft5pvz4t3rtguzoha7xzyd.onion:28719"
$direct   = "seed-04.vigichain.org:28719"
if (-not $env:VIGI_BOOTNODES) { $env:VIGI_BOOTNODES = "$torOnion,$direct" }
if (-not $env:VIGI_TOR_SOCKS_ADDR) { $env:VIGI_TOR_SOCKS_ADDR = "127.0.0.1:9050" }

# The Tor route needs a SOCKS proxy on YOUR machine. The node does not ship one and will not
# install one. Say so before the node starts, rather than leaving someone to read a connection
# error and conclude the network is down.
$parts = $env:VIGI_TOR_SOCKS_ADDR.Split(":")
$socksOk = $false
try {
  $probe = New-Object System.Net.Sockets.TcpClient
  $probe.Connect($parts[0], [int]$parts[1])
  $socksOk = $probe.Connected
  $probe.Close()
} catch { $socksOk = $false }

if (-not $socksOk) {
  Write-Host "WARNING: no Tor SOCKS proxy answering on $($env:VIGI_TOR_SOCKS_ADDR)."
  Write-Host ""
  Write-Host "  The Tor route is currently the one that reaches this network from the open Internet."
  Write-Host "  Without it your node will start, look healthy, and never find a peer."
  Write-Host ""
  Write-Host "    Install the Tor Expert Bundle from https://www.torproject.org/download/tor/"
  Write-Host "    and run tor.exe so it listens on 127.0.0.1:9050."
  Write-Host ""
  Write-Host "  Continuing anyway - the direct route is also configured, in case it is open for you."
  Write-Host ""
}

$bin = ".\vigichain-node-windows-x86_64.exe"
if (-not (Test-Path $bin)) {
  Write-Host "Windows binary not found. Download it from the Releases page into this folder."
  exit 1
}
& (Join-Path $PSScriptRoot "verify-release.ps1") -Binary $bin
$cmd = if ($args.Count -gt 0) { $args[0] } else { "start" }
& $bin $cmd
