#!/bin/sh
# selftest.sh — positive and negative controls for the lexical gate and circuit breaker.
set -u
ROOT=$(cd "$(dirname "$0")" && pwd)
T="$ROOT/tests/fixtures/target"
P="$ROOT/packets/inbox"
EMPTY_UNRESOLVED='{"schema_version":"wiki-anchor-unresolved@1.0.0","human_gate":"required_before_merge","degraded_pages":[]}'
fail=0
TMP=$(mktemp -d)
cleanup() {
  rm -rf "$TMP"
}
trap cleanup EXIT HUP INT TERM

# ── Anchor auditor ──────────────────────────────────────────────────────
bun run "$ROOT/src/audit_wiki.ts" "$ROOT/tests/fixtures/wiki-good" "$T" >/dev/null 2>&1
[ $? -eq 0 ] || { echo "selftest: good fixture should exit 0" >&2; fail=1; }

out=$(bun run "$ROOT/src/audit_wiki.ts" "$ROOT/tests/fixtures/wiki-hollow" "$T" 2>&1)
[ $? -eq 2 ] || { echo "selftest: hollow fixture should exit 2" >&2; fail=1; }
echo "$out" | grep -q "quote not found in that file" || {
  echo "selftest: hollow fixture failed for the wrong reason" >&2
  fail=1
}

# Malformed anchors must be reported rather than disappearing from both totals.
mal=$(bun run "$ROOT/src/audit_wiki.ts" "$ROOT/tests/fixtures/wiki-malformed" "$T" 2>&1)
[ $? -eq 2 ] || { echo "selftest: malformed anchor fixture should exit 2" >&2; fail=1; }
echo "$mal" | grep -q "malformed anchor" || {
  echo "selftest: malformed anchor was not reported" >&2
  fail=1
}

# A path that is lexically inside the target but resolves through a symlink to an external file
# must fail. resolve()+relative() alone does not protect this boundary.
mkdir -p "$TMP/wiki" "$TMP/target"
cp -R "$T/." "$TMP/target/"
printf '%s\n' 'outside-only evidence' > "$TMP/outside.txt"
ln -s ../outside.txt "$TMP/target/escape.txt"
cat > "$TMP/wiki/symlink-escape.md" <<'EOF'
The source contains external evidence. (src: escape.txt `outside-only evidence`)
EOF
symlink_out=$(bun run "$ROOT/src/audit_wiki.ts" "$TMP/wiki" "$TMP/target" 2>&1)
[ $? -eq 2 ] || { echo "selftest: symlink escape should exit 2" >&2; fail=1; }
echo "$symlink_out" | grep -q "symlink escapes target" || {
  echo "selftest: symlink escape failed for the wrong reason" >&2
  fail=1
}

# ── Circuit breaker (trigger.sh) ───────────────────────────────────────
sh "$ROOT/trigger.sh" >/dev/null 2>&1
[ $? -eq 64 ] || { echo "selftest: trigger without arguments should exit 64" >&2; fail=1; }

# Bind controls to fixed fixtures rather than mutable candidate output.
WIKI="$ROOT/tests/fixtures/wiki-anchored" TARGET_REPO="$ROOT/tests/fixtures/target" \
  sh "$ROOT/trigger.sh" "$P/fixture-anchored.json" >/dev/null 2>&1
[ $? -eq 0 ] || { echo "selftest: anchored page should exit 0 without dispatch" >&2; fail=1; }

DEG="$ROOT/tests/fixtures/wiki-degrade"
PAGE="$DEG/unanchorable.md"
before=$(wc -w < "$PAGE" | tr -d ' ')
WIKI="$DEG" TARGET_REPO="$ROOT/tests/fixtures/target" \
  sh "$ROOT/trigger.sh" "$P/fixture-degrade.json" subagent >/dev/null 2>&1
rc=$?
after=$(wc -w < "$PAGE" | tr -d ' ')
[ "$rc" -eq 2 ] || { echo "selftest: exhausted retry budget should exit 2, got $rc" >&2; fail=1; }
[ "$after" -ge "$before" ] || {
  echo "selftest: degraded page lost content ($before -> $after words)" >&2
  fail=1
}
[ -f "$DEG/.unresolved.json" ] || {
  echo "selftest: degraded page must produce .unresolved.json" >&2
  fail=1
}
printf '%s\n' "$EMPTY_UNRESOLVED" > "$DEG/.unresolved.json"

[ "$fail" -eq 0 ] && echo "selftest: PASS(valid/hollow/malformed/symlink and breaker controls)"
exit "$fail"
