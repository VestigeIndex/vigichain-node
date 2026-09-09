#!/usr/bin/env python3
"""The release policy's metadata gates, in one place.

`verify-release.sh` and `verify-release.ps1` both call this. That is the point: the two launchers
already drifted once — each checked the binary and its signature and neither checked the package
around it — and two independent implementations of a policy are two chances to check different
things. Signatures stay in the launchers (they are `rsign`'s job); everything that has to be READ
and cross-checked lives here.

What it enforces, given a directory holding one release and the artifact you intend to run:

  * the provenance is an in-toto/SLSA statement that names this artifact exactly once,
  * and binds it to the digest you computed,
  * and binds that to one full source commit, a release tag and a named builder,
  * and the dependency inventory is CycloneDX, parseable and not empty,
  * and, when the provenance carries a digest for that inventory, the inventory matches it.

It never reads a signature: the caller must have verified the signatures over these files first.
This script assumes the files are authentic and asks whether they actually AUTHORISE the artifact.

  usage: check-release-metadata.py --package DIR --artifact NAME --digest SHA256 [--expect-tag TAG]

Exit status is 0 only when every gate passes; the failing gate is printed to stderr.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys

PROVENANCE_NAME = "VIGICHAIN-PROVENANCE.json"
SBOM_NAME = "SBOM.cdx.json"

STATEMENT_TYPE = "https://in-toto.io/Statement/v1"
PREDICATE_PREFIX = "https://slsa.dev/provenance/"


def die(message: str) -> None:
    print(message, file=sys.stderr)
    raise SystemExit(1)


def load_json(path: str, what: str):
    try:
        with open(path, "rb") as handle:
            raw = handle.read()
    except OSError as exc:
        die("the %s is missing or unreadable: %s" % (what, exc))
    if not raw.strip():
        die("the %s is empty" % what)
    try:
        return raw, json.loads(raw)
    except ValueError as exc:
        die("the %s is not readable JSON: %s" % (what, exc))


def check_provenance(package: str, artifact: str, digest: str, expect_tag: str) -> dict:
    _, doc = load_json(os.path.join(package, PROVENANCE_NAME), "build provenance")

    if doc.get("_type") != STATEMENT_TYPE:
        die("unexpected provenance statement type: %r" % doc.get("_type"))
    if not str(doc.get("predicateType", "")).startswith(PREDICATE_PREFIX):
        die("unexpected provenance predicate type: %r" % doc.get("predicateType"))

    subjects = doc.get("subject") or []
    mine = [s for s in subjects if s.get("name") == artifact]
    if len(mine) != 1:
        # Zero means this package's provenance is for some other release; more than one means it
        # says two different things about the same name and neither can be trusted.
        die("the provenance names %s %d times; it must name it exactly once" % (artifact, len(mine)))
    claimed = (mine[0].get("digest") or {}).get("sha256")
    if not claimed:
        die("the provenance names %s without a sha256 digest" % artifact)
    if claimed.lower() != digest.lower():
        die("the provenance binds %s to %s, this file is %s" % (artifact, claimed, digest))

    predicate = doc.get("predicate") or {}
    build = predicate.get("buildDefinition") or {}
    external = build.get("externalParameters") or {}

    ref = external.get("ref") or ""
    if not ref.startswith("refs/tags/"):
        # A release built from a moving branch cannot be re-fetched and re-checked later.
        die("the provenance does not bind a release tag (ref=%r)" % ref)
    tag = ref[len("refs/tags/"):]
    if expect_tag and tag != expect_tag:
        die("the provenance is for %s, not the expected tag %s" % (tag, expect_tag))

    repository = external.get("repository") or ""
    if not repository:
        die("the provenance does not name the source repository")

    commits = set()
    for dependency in build.get("resolvedDependencies") or []:
        commit = (dependency.get("digest") or {}).get("gitCommit")
        if commit:
            commits.add(commit.lower())
    if len(commits) != 1:
        die("the provenance must resolve exactly one source commit, it resolves %d" % len(commits))
    commit = commits.pop()
    if len(commit) != 40 or any(c not in "0123456789abcdef" for c in commit):
        die("the provenance's source commit is not a full git object id: %r" % commit)

    builder = ((predicate.get("runDetails") or {}).get("builder") or {}).get("id") or ""
    if not builder:
        die("the provenance does not name the builder that produced this artifact")

    return {
        "doc": doc,
        "predicate": predicate,
        "subjects": subjects,
        "tag": tag,
        "repository": repository,
        "commit": commit,
        "builder": builder,
    }


def check_inventory(package: str, provenance: dict) -> tuple[int, str]:
    raw, sbom = load_json(os.path.join(package, SBOM_NAME), "dependency inventory")
    if sbom.get("bomFormat") != "CycloneDX":
        die("the dependency inventory is not CycloneDX (bomFormat=%r)" % sbom.get("bomFormat"))
    components = sbom.get("components") or []
    if len(components) < 1:
        # An inventory with no components satisfies a checklist and inventories nothing.
        die("the dependency inventory lists no components")

    actual = hashlib.sha256(raw).hexdigest()

    # A release MAY bind the inventory by digest. Up to node-v1.0.12-testnet none did, so a missing
    # binding is reported rather than treated as a forgery — and enforced the moment one appears.
    bound = None
    run_details = provenance["predicate"].get("runDetails") or {}
    for byproduct in run_details.get("byproducts") or []:
        if byproduct.get("name") == SBOM_NAME:
            bound = (byproduct.get("digest") or {}).get("sha256")
    for subject in provenance["subjects"]:
        if subject.get("name") == SBOM_NAME:
            bound = (subject.get("digest") or {}).get("sha256")

    if bound is not None and bound.lower() != actual:
        die("the provenance binds the inventory to %s, this file is %s" % (bound, actual))

    return len(components), "yes" if bound is not None else "no"


def main() -> int:
    parser = argparse.ArgumentParser(add_help=True, description=__doc__)
    parser.add_argument("--package", required=True, help="directory holding one published release")
    parser.add_argument("--artifact", required=True, help="file name of the artifact to run")
    parser.add_argument("--digest", required=True, help="sha256 of that artifact, as computed")
    parser.add_argument("--expect-tag", default=os.environ.get("VIGI_EXPECT_TAG", ""))
    args = parser.parse_args()

    provenance = check_provenance(args.package, args.artifact, args.digest, args.expect_tag)
    components, bound = check_inventory(args.package, provenance)

    print("tag=%s" % provenance["tag"])
    print("repository=%s" % provenance["repository"])
    print("commit=%s" % provenance["commit"])
    print("builder=%s" % provenance["builder"])
    print("components=%d" % components)
    print("sbom_bound=%s" % bound)
    return 0


if __name__ == "__main__":
    sys.exit(main())
