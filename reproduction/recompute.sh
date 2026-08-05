#!/bin/sh
# Recompute deterministic auditor receipts and compare them with frozen expected outputs.
set -u

ROOT=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$ROOT/.." && pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT HUP INT TERM

verify_manifest() {
  base="$1"
  manifest="$2"
  bun -e '
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const base = resolve(process.argv[1]);
const manifest = resolve(process.argv[2]);
const lines = readFileSync(manifest, "utf8").split(/\r?\n/).filter(Boolean);
for (const line of lines) {
  const match = line.match(/^([0-9a-f]{64})\s{2}(.+)$/);
  if (!match) {
    console.error(`invalid SHA-256 manifest line: ${line}`);
    process.exit(1);
  }
  const path = resolve(base, match[2]);
  const actual = createHash("sha256").update(readFileSync(path)).digest("hex");
  if (actual !== match[1]) {
    console.error(`SHA-256 mismatch: ${match[2]} expected ${match[1]} got ${actual}`);
    process.exit(1);
  }
}
' "$base" "$manifest"
}

cd "$REPO" || exit 64
verify_manifest "$ROOT" "$ROOT/protocol-v1.sha256" || exit 1
verify_manifest "$ROOT" "$ROOT/fixtures.sha256" || exit 1
verify_manifest "$ROOT" "$ROOT/expected-receipts/manifest.sha256" || exit 1

bun run harness/src/audit_wiki.ts \
  reproduction/wiki-fixture \
  reproduction/target-fixture \
  > "$TMP/good.json"
good_rc=$?
if [ "$good_rc" -ne 0 ]; then
  echo "reproduction: positive fixture returned $good_rc, expected 0" >&2
  exit 1
fi

bun run harness/src/audit_wiki.ts \
  reproduction/wiki-hollow \
  reproduction/target-fixture \
  > "$TMP/hollow.json"
hollow_rc=$?
if [ "$hollow_rc" -ne 2 ]; then
  echo "reproduction: hollow fixture returned $hollow_rc, expected 2" >&2
  exit 1
fi

if ! cmp -s "$ROOT/expected-receipts/good.json" "$TMP/good.json"; then
  echo "reproduction: positive receipt differs from expected output" >&2
  diff -u "$ROOT/expected-receipts/good.json" "$TMP/good.json" >&2 || true
  exit 1
fi
if ! cmp -s "$ROOT/expected-receipts/hollow.json" "$TMP/hollow.json"; then
  echo "reproduction: hollow receipt differs from expected output" >&2
  diff -u "$ROOT/expected-receipts/hollow.json" "$TMP/hollow.json" >&2 || true
  exit 1
fi

echo "reproduction: PASS (protocol, fixtures, and receipts match)"
