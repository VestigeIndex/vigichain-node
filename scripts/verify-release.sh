#!/usr/bin/env bash
#
# Verify a published VigiChain node release before running it.
#
# WHAT CHANGED AND WHY (2026-09-09, finding IDL-04):
# this script used to check the executable and its detached signature, and nothing else. That is a
# real check — a signature says who built the file — but RELEASE_POLICY.md requires more before a
# binary may be PUBLISHED *or EXECUTED*: a checksum manifest covering every artifact, a signature
# over that manifest, a dependency inventory, and signed provenance binding the artifact digest to
# a source commit and a build. An external audit reproduced the gap in one line: put the genuine
# Linux binary and its genuine signature in an otherwise empty directory, run this script, and it
# exited 0 — reporting success for a package that carried none of its own evidence. An operator
# could then run an authentic binary while believing they had checked where it came from.
#
# So this verifies the PACKAGE, not one file in it. Every gate is fail-closed: a missing, unreadable
# or unsigned piece of evidence is a failure, never a warning.
#
#   usage: verify-release.sh <binary> [release-directory]
#
# The release directory defaults to the binary's own directory: the artifacts of one release are
# published together and have to be downloaded together.
#
set -euo pipefail

readonly VIGICHAIN_RELEASE_PUBLIC_KEY="RWQItT0J/YGNHI45GYmzWqVLUP+fMp5GXIbKxjp7eH/l7vZLfhv7KUsa"

readonly MANIFEST_NAME="SHA256SUMS"
readonly PROVENANCE_NAME="VIGICHAIN-PROVENANCE.json"
readonly SBOM_NAME="SBOM.cdx.json"

binary="${1:?usage: verify-release.sh <binary> [release-directory]}"
dir="${2:-$(dirname -- "$binary")}"
name="$(basename -- "$binary")"
here="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

fail() { echo "  FAIL  $*" >&2; exit 1; }
ok()   { echo "  ok    $*"; }

require_file() {
  # A zero-byte signature or manifest is not evidence; -s rather than -f throughout.
  test -s "$1" || fail "${2:-missing or empty}: $1"
}

echo "Verifying VigiChain release artifact: $name"
echo "  package directory: $dir"

# ---------------------------------------------------------------------------- tools -------------
command -v rsign >/dev/null 2>&1 || fail \
  "rsign is required to authenticate the VigiChain release; refusing to run. (cargo install rsign2)"
command -v python3 >/dev/null 2>&1 || fail \
  "python3 is required to read the signed provenance and inventory; refusing to run."
require_file "$here/check-release-metadata.py" "the metadata policy check is missing"
if command -v sha256sum >/dev/null 2>&1; then
  digest_of() { sha256sum -- "$1" | cut -d' ' -f1; }
elif command -v shasum >/dev/null 2>&1; then
  digest_of() { shasum -a 256 -- "$1" | cut -d' ' -f1; }
else
  fail "no sha256sum/shasum available to compute digests; refusing to run."
fi

# ---------------------------------------------------------------------------- presence ----------
require_file "$binary" "release binary is missing"
require_file "${binary}.sig" "detached release signature is missing"
require_file "$dir/$MANIFEST_NAME" "checksum manifest is missing from the package"
require_file "$dir/$MANIFEST_NAME.sig" "the checksum manifest is not signed"
require_file "$dir/$PROVENANCE_NAME" "build provenance is missing from the package"
require_file "$dir/$PROVENANCE_NAME.sig" "the build provenance is not signed"
require_file "$dir/$SBOM_NAME" "the dependency inventory (SBOM) is missing from the package"
ok "every artifact the release policy requires is present"

# ---------------------------------------------------------------------------- signatures --------
# The metadata is verified BEFORE anything in it is believed. A checksum manifest whose signature
# has not been checked is a list of numbers an attacker could have written.
rsign verify -q -P "$VIGICHAIN_RELEASE_PUBLIC_KEY" -x "$dir/$MANIFEST_NAME.sig" "$dir/$MANIFEST_NAME" \
  || fail "the checksum manifest's signature does not verify"
ok "checksum manifest signed by the VigiChain release key"

rsign verify -q -P "$VIGICHAIN_RELEASE_PUBLIC_KEY" -x "$dir/$PROVENANCE_NAME.sig" "$dir/$PROVENANCE_NAME" \
  || fail "the provenance statement's signature does not verify"
ok "build provenance signed by the VigiChain release key"

rsign verify -q -P "$VIGICHAIN_RELEASE_PUBLIC_KEY" -x "${binary}.sig" "$binary" \
  || fail "the binary's signature does not verify"
ok "binary signed by the VigiChain release key"

# ---------------------------------------------------------------------------- digest ------------
actual="$(digest_of "$binary")"

# Exactly one line of the manifest may name this artifact. Two lines naming it, or none, means the
# manifest does not say unambiguously what this file's hash should be.
manifest_digests="$(awk -v want="$name" '{ f=$NF; sub(/^[*]/, "", f); sub(".*/", "", f); if (f == want) print $1 }' "$dir/$MANIFEST_NAME")"
count="$(printf '%s\n' "$manifest_digests" | grep -c . || true)"
[ "$count" = "1" ] || fail "the signed manifest names $name $count times; it must name it exactly once"
[ "$manifest_digests" = "$actual" ] || fail \
  "digest mismatch: the signed manifest says $manifest_digests, this file is $actual"
ok "digest matches the signed manifest: $actual"

# ---------------------------------------------------------------------------- provenance --------
# The signed metadata is now read and required to BIND this exact digest to a source commit, a tag
# and a builder. Without that binding a signature says the file is authentic, not what it was built
# from. The gates live in check-release-metadata.py so this script and the PowerShell one cannot
# enforce different policies.
report="$(python3 "$here/check-release-metadata.py" \
  --package "$dir" --artifact "$name" --digest "$actual" \
  ${VIGI_EXPECT_TAG:+--expect-tag "$VIGI_EXPECT_TAG"})" \
  || fail "the signed metadata does not authorise this file (reason above)"

field() { printf '%s\n' "$report" | sed -n "s/^$1=//p"; }
prov_tag="$(field tag)"
prov_repository="$(field repository)"
prov_commit="$(field commit)"
prov_builder="$(field builder)"
prov_components="$(field components)"
prov_sbom_bound="$(field sbom_bound)"

ok "provenance binds this digest to ${prov_repository}@${prov_commit}"
ok "release tag ${prov_tag}, built by ${prov_builder}"
ok "dependency inventory: ${prov_components} components"
if [ "${prov_sbom_bound}" = "no" ]; then
  echo "  note  this release's provenance carries no digest for $SBOM_NAME, so the inventory is"
  echo "        verified as present, parseable and non-empty, but not bound to the build."
  echo "        Releases produced after 2026-09-09 record that binding, and it is then enforced."
fi

echo
echo "VERIFIED: $name is the artifact ${prov_repository}@${prov_commit} published as ${prov_tag}."
