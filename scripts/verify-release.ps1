param(
  [Parameter(Mandatory = $true)]
  [string]$Binary
)

$ErrorActionPreference = "Stop"
$releasePublicKey = "RWQItT0J/YGNHI45GYmzWqVLUP+fMp5GXIbKxjp7eH/l7vZLfhv7KUsa"
$signature = "$Binary.sig"

if (-not (Test-Path -LiteralPath $Binary -PathType Leaf)) { throw "Release binary is missing: $Binary" }
if (-not (Test-Path -LiteralPath $signature -PathType Leaf)) { throw "Detached release signature is missing: $signature" }
if (-not (Get-Command rsign -ErrorAction SilentlyContinue)) {
  throw "rsign is required to authenticate the VigiChain release; refusing to run."
}

& rsign verify -P $releasePublicKey -x $signature $Binary
if ($LASTEXITCODE -ne 0) { throw "VigiChain release signature verification failed" }
