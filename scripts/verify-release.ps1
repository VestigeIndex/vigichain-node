<#
.SYNOPSIS
  Verify a published VigiChain node release before running it (Windows).

.DESCRIPTION
  Same gates as scripts/verify-release.sh, and deliberately the same policy code: both call
  scripts/check-release-metadata.py so the two launchers cannot enforce different rules. Until
  2026-09-09 both checked only the executable and its detached signature, and an external audit
  showed the consequence — a genuine binary in an otherwise empty folder verified clean, with no
  checksum manifest, no inventory and no provenance anywhere near it (finding IDL-04).

  Everything is fail-closed: a missing, unreadable or unsigned piece of evidence is a failure.

.PARAMETER Binary
  The artifact you intend to run.

.PARAMETER PackageDirectory
  The directory holding the whole published release. Defaults to the binary's own directory.

.EXAMPLE
  ./scripts/verify-release.ps1 -Binary .\vigichain-node-windows-x86_64.exe
#>
param(
  [Parameter(Mandatory = $true)]
  [string]$Binary,

  [Parameter(Mandatory = $false)]
  [string]$PackageDirectory
)

$ErrorActionPreference = "Stop"

$releasePublicKey = "RWQItT0J/YGNHI45GYmzWqVLUP+fMp5GXIbKxjp7eH/l7vZLfhv7KUsa"
$manifestName = "SHA256SUMS"
$provenanceName = "VIGICHAIN-PROVENANCE.json"
$sbomName = "SBOM.cdx.json"

function Fail { param($m) throw $m }
function Ok { param($m) Write-Host "  ok    $m" }

function Require-File {
  param($Path, $What)
  $item = Get-Item -LiteralPath $Path -ErrorAction SilentlyContinue
  # Zero bytes is not evidence: an empty signature file must fail exactly like an absent one.
  if (-not $item -or $item.PSIsContainer -or $item.Length -le 0) { Fail "$What`: $Path" }
}

$signature = "$Binary.sig"
if (-not $PackageDirectory -or $PackageDirectory -eq "") {
  $parent = Split-Path -Parent $Binary
  $PackageDirectory = if ($parent) { $parent } else { "." }
}
$name = Split-Path -Leaf $Binary
$here = Split-Path -Parent $PSCommandPath

Write-Host "Verifying VigiChain release artifact: $name"
Write-Host "  package directory: $PackageDirectory"

# ------------------------------------------------------------------ tools -----------------------
if (-not (Get-Command rsign -ErrorAction SilentlyContinue)) {
  Fail "rsign is required to authenticate the VigiChain release; refusing to run. (cargo install rsign2)"
}
$python = Get-Command python3 -ErrorAction SilentlyContinue
if (-not $python) { $python = Get-Command python -ErrorAction SilentlyContinue }
if (-not $python) {
  Fail "python3 is required to read the signed provenance and inventory; refusing to run."
}
$policy = Join-Path $here "check-release-metadata.py"
Require-File $policy "the metadata policy check is missing"

# ------------------------------------------------------------------ presence --------------------
Require-File $Binary "release binary is missing"
Require-File $signature "detached release signature is missing"
$manifest = Join-Path $PackageDirectory $manifestName
$provenance = Join-Path $PackageDirectory $provenanceName
$sbom = Join-Path $PackageDirectory $sbomName
Require-File $manifest "checksum manifest is missing from the package"
Require-File "$manifest.sig" "the checksum manifest is not signed"
Require-File $provenance "build provenance is missing from the package"
Require-File "$provenance.sig" "the build provenance is not signed"
Require-File $sbom "the dependency inventory (SBOM) is missing from the package"
Ok "every artifact the release policy requires is present"

# ------------------------------------------------------------------ signatures ------------------
# The metadata is verified before anything in it is believed.
& rsign verify -q -P $releasePublicKey -x "$manifest.sig" $manifest
if ($LASTEXITCODE -ne 0) { Fail "the checksum manifest's signature does not verify" }
Ok "checksum manifest signed by the VigiChain release key"

& rsign verify -q -P $releasePublicKey -x "$provenance.sig" $provenance
if ($LASTEXITCODE -ne 0) { Fail "the provenance statement's signature does not verify" }
Ok "build provenance signed by the VigiChain release key"

& rsign verify -q -P $releasePublicKey -x $signature $Binary
if ($LASTEXITCODE -ne 0) { Fail "VigiChain release signature verification failed" }
Ok "binary signed by the VigiChain release key"

# ------------------------------------------------------------------ digest ----------------------
$actual = (Get-FileHash -LiteralPath $Binary -Algorithm SHA256).Hash.ToLower()

# Exactly one manifest line may name this artifact; none or several means the signed manifest does
# not say unambiguously what this file's digest should be.
$claimed = @()
foreach ($line in Get-Content -LiteralPath $manifest) {
  $parts = $line -split '\s+' | Where-Object { $_ -ne "" }
  if ($parts.Count -lt 2) { continue }
  $file = ($parts[-1] -replace '^\*', '')
  $file = ($file -split '[\\/]')[-1]
  if ($file -eq $name) { $claimed += $parts[0].ToLower() }
}
if ($claimed.Count -ne 1) {
  Fail "the signed manifest names $name $($claimed.Count) times; it must name it exactly once"
}
if ($claimed[0] -ne $actual) {
  Fail "digest mismatch: the signed manifest says $($claimed[0]), this file is $actual"
}
Ok "digest matches the signed manifest: $actual"

# ------------------------------------------------------------------ provenance ------------------
$policyArgs = @($policy, "--package", $PackageDirectory, "--artifact", $name, "--digest", $actual)
if ($env:VIGI_EXPECT_TAG) { $policyArgs += @("--expect-tag", $env:VIGI_EXPECT_TAG) }
$report = & $python.Source @policyArgs
if ($LASTEXITCODE -ne 0) { Fail "the signed metadata does not authorise this file (reason above)" }

$fields = @{}
foreach ($line in $report) {
  if ($line -match '^([a-z_]+)=(.*)$') { $fields[$Matches[1]] = $Matches[2] }
}

Ok "provenance binds this digest to $($fields['repository'])@$($fields['commit'])"
Ok "release tag $($fields['tag']), built by $($fields['builder'])"
Ok "dependency inventory: $($fields['components']) components"
if ($fields['sbom_bound'] -eq "no") {
  Write-Host "  note  this release's provenance carries no digest for $sbomName, so the inventory is"
  Write-Host "        verified as present, parseable and non-empty, but not bound to the build."
  Write-Host "        Releases produced after 2026-09-09 record that binding, and it is then enforced."
}

Write-Host ""
Write-Host "VERIFIED: $name is the artifact $($fields['repository'])@$($fields['commit']) published as $($fields['tag'])."
