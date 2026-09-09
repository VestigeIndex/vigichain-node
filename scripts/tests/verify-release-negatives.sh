#!/usr/bin/env bash
#
# Every way a release package can fail to authorise a binary, tested one at a time.
#
# The audit finding this exists for (IDL-04) was not that a signature check was wrong — it was that
# nothing checked the rest, and no test would have noticed. A verifier that only ever runs against a
# good package proves nothing: it has to REFUSE the bad ones, and each refusal has to be for the
# reason we think it is. Hence one case per condition, each asserting both a non-zero exit and the
# message that names the gate.
#
#   usage: verify-release-negatives.sh [package-directory]
#
# The package directory holds a genuine published release (binary, .sig, SHA256SUMS(+.sig),
# VIGICHAIN-PROVENANCE.json(+.sig), SBOM.cdx.json). Without one, pass nothing and the script
# downloads the current release with `gh`. Signature-level cases need `rsign`; metadata-level cases
# do not, because they exercise check-release-metadata.py directly — that separation is why the
# policy lives in its own file, and it means the binding rules are tested without any signing key.
#
set -euo pipefail

here="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
scripts="$(cd -- "$here/.." && pwd)"
verifier="$scripts/verify-release.sh"
policy="$scripts/check-release-metadata.py"

REPO="${VIGI_NODE_REPO:-VestigeIndex/vigichain-node}"
BINARY_NAME="vigichain-node-linux-x86_64"

pass=0
fail=0

note() { printf '\n== %s\n' "$*"; }
green() { printf '   PASS  %s\n' "$*"; pass=$((pass + 1)); }
red()   { printf '   FAIL  %s\n' "$*" >&2; fail=$((fail + 1)); }

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

# ------------------------------------------------------------------ the genuine package ---------
package="${1:-}"
if [ -z "$package" ]; then
  command -v gh >/dev/null 2>&1 || {
    echo "no package directory given and gh is unavailable; pass one as \$1" >&2
    exit 2
  }
  package="$work/release"
  mkdir -p "$package"
  tag="${VIGI_RELEASE_TAG:-$(gh release list --repo "$REPO" --limit 1 --json tagName --jq '.[0].tagName')}"
  echo "downloading $tag from $REPO into $package"
  gh release download "$tag" --repo "$REPO" --dir "$package" \
    --pattern "$BINARY_NAME" --pattern "$BINARY_NAME.sig" \
    --pattern "SHA256SUMS" --pattern "SHA256SUMS.sig" \
    --pattern "VIGICHAIN-PROVENANCE.json" --pattern "VIGICHAIN-PROVENANCE.json.sig" \
    --pattern "SBOM.cdx.json" >/dev/null
fi
test -s "$package/$BINARY_NAME" || { echo "no $BINARY_NAME in $package" >&2; exit 2; }

digest="$(sha256sum "$package/$BINARY_NAME" | cut -d' ' -f1)"

fresh() {
  # A pristine copy of the package for each case, so one mutation never leaks into the next.
  local dest="$work/case-$1"
  rm -rf "$dest"
  cp -r "$package" "$dest"
  printf '%s' "$dest"
}

# Asserts: the verifier refuses, and says why in the way we expect.
refuses() {
  local case_name="$1" expected="$2" dir="$3"
  local output status
  set +e
  output="$(bash "$verifier" "$dir/$BINARY_NAME" 2>&1)"
  status=$?
  set -e
  if [ "$status" -eq 0 ]; then
    red "$case_name: the verifier ACCEPTED it (exit 0)"
    return
  fi
  if ! printf '%s' "$output" | grep -qi -- "$expected"; then
    red "$case_name: refused, but not for the expected reason (wanted /$expected/):"
    printf '%s\n' "$output" | sed 's/^/         | /' >&2
    return
  fi
  green "$case_name"
}

# Same, one level down: the metadata policy on its own, no signatures involved.
policy_refuses() {
  local case_name="$1" expected="$2" dir="$3"
  local output status
  set +e
  output="$(python3 "$policy" --package "$dir" --artifact "$BINARY_NAME" --digest "$digest" 2>&1)"
  status=$?
  set -e
  if [ "$status" -eq 0 ]; then
    red "$case_name: the metadata check ACCEPTED it (exit 0)"
    return
  fi
  if ! printf '%s' "$output" | grep -qi -- "$expected"; then
    red "$case_name: refused, but not for the expected reason (wanted /$expected/):"
    printf '%s\n' "$output" | sed 's/^/         | /' >&2
    return
  fi
  green "$case_name"
}

json_edit() {
  # Rewrite one JSON file in place with a small python expression over `doc`.
  local file="$1" program="$2"
  python3 - "$file" <<PY
import json, sys
path = sys.argv[1]
with open(path) as fh:
    doc = json.load(fh)
$program
with open(path, "w") as fh:
    json.dump(doc, fh, indent=2)
PY
}

have_rsign=1
command -v rsign >/dev/null 2>&1 || have_rsign=0

# ------------------------------------------------------------------ positive control -------------
note "positive control — the genuine package must verify"
if [ "$have_rsign" = "1" ]; then
  if bash "$verifier" "$package/$BINARY_NAME" >/dev/null 2>&1; then
    green "the published release verifies"
  else
    red "the published release does NOT verify — every negative below is meaningless until it does"
    bash "$verifier" "$package/$BINARY_NAME" 2>&1 | sed 's/^/         | /' >&2
  fi
else
  echo "   SKIP  rsign not installed; signature-level cases are skipped"
fi

# ------------------------------------------------------------------ signature-level --------------
if [ "$have_rsign" = "1" ]; then
  note "signature-level refusals"

  # THE AUDIT'S OWN REPRODUCTION: an authentic binary and an authentic signature, alone.
  dir="$(fresh only-binary)"
  rm -f "$dir/SHA256SUMS" "$dir/SHA256SUMS.sig" "$dir/VIGICHAIN-PROVENANCE.json" \
        "$dir/VIGICHAIN-PROVENANCE.json.sig" "$dir/SBOM.cdx.json"
  refuses "a signed binary with no package around it" "checksum manifest is missing" "$dir"

  dir="$(fresh no-manifest-sig)"; rm -f "$dir/SHA256SUMS.sig"
  refuses "a checksum manifest that is not signed" "manifest is not signed" "$dir"

  dir="$(fresh empty-manifest-sig)"; : > "$dir/SHA256SUMS.sig"
  refuses "an empty signature file for the manifest" "manifest is not signed" "$dir"

  dir="$(fresh tampered-manifest)"
  sed -i "s/^$digest/$(printf '%064d' 0)/" "$dir/SHA256SUMS"
  refuses "a manifest whose digests were edited" "signature does not verify" "$dir"

  dir="$(fresh no-provenance)"; rm -f "$dir/VIGICHAIN-PROVENANCE.json"
  refuses "no build provenance in the package" "provenance is missing" "$dir"

  dir="$(fresh no-provenance-sig)"; rm -f "$dir/VIGICHAIN-PROVENANCE.json.sig"
  refuses "provenance that is not signed" "provenance is not signed" "$dir"

  dir="$(fresh tampered-provenance)"
  json_edit "$dir/VIGICHAIN-PROVENANCE.json" 'doc["subject"][0]["digest"]["sha256"] = "0" * 64'
  refuses "provenance edited after signing" "signature does not verify" "$dir"

  dir="$(fresh no-sbom)"; rm -f "$dir/SBOM.cdx.json"
  refuses "no dependency inventory" "inventory (SBOM) is missing" "$dir"

  dir="$(fresh no-binary-sig)"; rm -f "$dir/$BINARY_NAME.sig"
  refuses "the binary's own signature missing" "signature is missing" "$dir"

  dir="$(fresh tampered-binary)"
  printf '\0' >> "$dir/$BINARY_NAME"
  refuses "a binary altered after signing" "signature does not verify" "$dir"

  dir="$(fresh wrong-name)"
  cp "$dir/$BINARY_NAME" "$dir/vigichain-node-something-else"
  cp "$dir/$BINARY_NAME.sig" "$dir/vigichain-node-something-else.sig"
  set +e
  out="$(bash "$verifier" "$dir/vigichain-node-something-else" 2>&1)"; st=$?
  set -e
  if [ "$st" -ne 0 ] && printf '%s' "$out" | grep -qi "names vigichain-node-something-else 0 times"; then
    green "an authentic binary renamed to something the manifest does not list"
  else
    red "a renamed binary was accepted or refused for the wrong reason (exit $st)"
  fi
fi

# ------------------------------------------------------------------ metadata-level ---------------
# These need no signing key: they ask whether authentic-looking metadata actually authorises this
# artifact. Each one would pass every signature check in the world.
note "metadata-level refusals (policy only, no signatures)"

dir="$(fresh prov-other-artifact)"
json_edit "$dir/VIGICHAIN-PROVENANCE.json" 'doc["subject"] = [s for s in doc["subject"] if s["name"] != "vigichain-node-linux-x86_64"]'
policy_refuses "provenance that never names this artifact" "names .* 0 times" "$dir"

dir="$(fresh prov-duplicate)"
json_edit "$dir/VIGICHAIN-PROVENANCE.json" 'doc["subject"].append(dict(doc["subject"][0]))'
policy_refuses "provenance naming this artifact twice" "2 times" "$dir"

dir="$(fresh prov-wrong-digest)"
json_edit "$dir/VIGICHAIN-PROVENANCE.json" 'doc["subject"][0]["digest"]["sha256"] = "1" * 64'
policy_refuses "provenance binding this name to another digest" "this file is" "$dir"

dir="$(fresh prov-branch)"
json_edit "$dir/VIGICHAIN-PROVENANCE.json" 'doc["predicate"]["buildDefinition"]["externalParameters"]["ref"] = "refs/heads/main"'
policy_refuses "a release built from a moving branch" "does not bind a release tag" "$dir"

dir="$(fresh prov-no-repo)"
json_edit "$dir/VIGICHAIN-PROVENANCE.json" 'doc["predicate"]["buildDefinition"]["externalParameters"]["repository"] = ""'
policy_refuses "provenance with no source repository" "does not name the source repository" "$dir"

dir="$(fresh prov-no-commit)"
json_edit "$dir/VIGICHAIN-PROVENANCE.json" 'doc["predicate"]["buildDefinition"]["resolvedDependencies"] = []'
policy_refuses "provenance resolving no source commit" "exactly one source commit" "$dir"

dir="$(fresh prov-short-commit)"
json_edit "$dir/VIGICHAIN-PROVENANCE.json" 'doc["predicate"]["buildDefinition"]["resolvedDependencies"] = [{"digest": {"gitCommit": "771116e"}, "uri": "git+x"}]'
policy_refuses "an abbreviated source commit" "not a full git object id" "$dir"

dir="$(fresh prov-no-builder)"
json_edit "$dir/VIGICHAIN-PROVENANCE.json" 'doc["predicate"]["runDetails"]["builder"]["id"] = ""'
policy_refuses "provenance with no builder" "does not name the builder" "$dir"

dir="$(fresh prov-wrong-type)"
json_edit "$dir/VIGICHAIN-PROVENANCE.json" 'doc["predicateType"] = "https://example.invalid/whatever/v1"'
policy_refuses "a statement that is not SLSA provenance" "predicate type" "$dir"

dir="$(fresh sbom-empty-list)"
json_edit "$dir/SBOM.cdx.json" 'doc["components"] = []'
policy_refuses "an inventory listing nothing" "lists no components" "$dir"

dir="$(fresh sbom-not-cyclonedx)"
json_edit "$dir/SBOM.cdx.json" 'doc["bomFormat"] = "SomethingElse"'
policy_refuses "an inventory that is not CycloneDX" "not CycloneDX" "$dir"

dir="$(fresh sbom-truncated)"
printf '{ "bomFormat": "Cyclone' > "$dir/SBOM.cdx.json"
policy_refuses "a truncated inventory" "not readable JSON" "$dir"

dir="$(fresh sbom-unbound)"
# A release that DOES bind the inventory, to a digest this file does not have.
json_edit "$dir/VIGICHAIN-PROVENANCE.json" 'doc["predicate"]["runDetails"]["byproducts"] = [{"name": "SBOM.cdx.json", "digest": {"sha256": "2" * 64}}]'
policy_refuses "an inventory swapped after the build bound it" "binds the inventory to" "$dir"

dir="$(fresh tag-mismatch)"
if VIGI_EXPECT_TAG="node-v0.0.0-nope" python3 "$policy" --package "$dir" --artifact "$BINARY_NAME" \
     --digest "$digest" --expect-tag "node-v0.0.0-nope" >/dev/null 2>&1; then
  red "a package for another tag was accepted when a tag was demanded"
else
  green "a package for another tag, when a specific tag was demanded"
fi

# ------------------------------------------------------------------ result ----------------------
printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
