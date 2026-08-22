#!/usr/bin/env bash
set -euo pipefail

readonly VIGICHAIN_RELEASE_PUBLIC_KEY="RWQItT0J/YGNHI45GYmzWqVLUP+fMp5GXIbKxjp7eH/l7vZLfhv7KUsa"
binary="${1:?usage: verify-release.sh <binary>}"
signature="${binary}.sig"

test -f "$binary" || { echo "Release binary is missing: $binary" >&2; exit 1; }
test -s "$signature" || { echo "Detached release signature is missing: $signature" >&2; exit 1; }
command -v rsign >/dev/null 2>&1 || {
  echo "rsign is required to authenticate the VigiChain release; refusing to run." >&2
  exit 1
}

rsign verify -P "$VIGICHAIN_RELEASE_PUBLIC_KEY" -x "$signature" "$binary"
