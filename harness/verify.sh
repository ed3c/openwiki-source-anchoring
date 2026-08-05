#!/bin/sh
# T0 mechanical gate wrapper.
# Usage: verify.sh <wiki-dir> [target-repo]
# Exit 0 = complete PASS; 2 = complete threshold failure; 3 = incomplete audit; 64 = usage error.
set -u

ROOT=$(cd "$(dirname "$0")" && pwd)
if [ "$#" -lt 1 ]; then
  echo "usage: verify.sh <wiki-dir> [target-repo]" >&2
  exit 64
fi

WIKI="$1"
TARGET="${2:-<target-repo>}"
mkdir -p "$ROOT/logs"
out="$ROOT/logs/verify-$(date +%Y%m%d-%H%M%S).json"

bun run "$ROOT/src/audit_wiki.ts" "$WIKI" "$TARGET" > "$out" 2>&1
rc=$?
cat "$out"

if [ "$rc" -eq 2 ]; then
  # Compatibility signal for the outer loop. The JSON receipt remains authoritative.
  n=$(grep -c '<' "$out" 2>/dev/null || echo 0)
  echo "PROGRESS: $((3 - n))" >&2
elif [ "$rc" -eq 3 ]; then
  echo "INCOMPLETE: audit did not inspect the full input; human review required" >&2
fi

exit "$rc"
