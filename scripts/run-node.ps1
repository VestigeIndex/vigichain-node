# VigiChain testnet node launcher (Windows).
# Runs the official binary placed in the repo folder.
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
if (-not $env:VIGI_NETWORK) { $env:VIGI_NETWORK = "testnet" }
$bin = ".\vigichain-node-windows-x86_64.exe"
if (-not (Test-Path $bin)) {
  Write-Host "Windows binary not found. Download it from the Releases page into this folder."
  exit 1
}
$cmd = if ($args.Count -gt 0) { $args[0] } else { "start" }
& $bin $cmd
