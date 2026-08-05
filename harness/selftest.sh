#!/bin/sh
# Positive and adversarial controls for the lexical gate, retry loop, and preservation guards.
set -u

ROOT=$(cd "$(dirname "$0")" && pwd)
T="$ROOT/tests/fixtures/target"
P="$ROOT/packets/inbox"
EMPTY_UNRESOLVED='{"schema_version":"wiki-anchor-unresolved@1.1.0","human_gate":"required_before_merge","degraded_pages":[]}'
fail=0
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT HUP INT TERM

expect_json_field() {
  receipt="$1"
  expression="$2"
  message="$3"
  if ! printf '%s' "$receipt" | bun -e "
const data = JSON.parse(await Bun.stdin.text());
if (!($expression)) process.exit(1);
"; then
    echo "selftest: $message" >&2
    fail=1
  fi
}

# ── Core anchor auditor controls ────────────────────────────────────────
if ! bun run "$ROOT/src/audit_wiki.ts" "$ROOT/tests/fixtures/wiki-good" "$T" >/dev/null 2>&1; then
  echo "selftest: good fixture should exit 0" >&2
  fail=1
fi

out=$(bun run "$ROOT/src/audit_wiki.ts" "$ROOT/tests/fixtures/wiki-hollow" "$T" 2>&1)
rc=$?
[ "$rc" -eq 2 ] || { echo "selftest: hollow fixture should exit 2" >&2; fail=1; }
echo "$out" | grep -q "quote not found in that file" || {
  echo "selftest: hollow fixture failed for the wrong reason" >&2
  fail=1
}

mal=$(bun run "$ROOT/src/audit_wiki.ts" "$ROOT/tests/fixtures/wiki-malformed" "$T" 2>&1)
rc=$?
[ "$rc" -eq 2 ] || { echo "selftest: malformed anchor fixture should exit 2" >&2; fail=1; }
echo "$mal" | grep -q "malformed anchor" || {
  echo "selftest: malformed anchor was not reported" >&2
  fail=1
}

# A lexical path inside the target may still escape through a symlink.
mkdir -p "$TMP/symlink/wiki" "$TMP/symlink/target"
cp -R "$T/." "$TMP/symlink/target/"
printf '%s\n' 'outside-only evidence' > "$TMP/symlink/outside.txt"
ln -s ../outside.txt "$TMP/symlink/target/escape.txt"
cat > "$TMP/symlink/wiki/page.md" <<'EOF_SYMLINK'
The source contains external evidence. (src: escape.txt `outside-only evidence`)
EOF_SYMLINK
symlink_out=$(bun run "$ROOT/src/audit_wiki.ts" "$TMP/symlink/wiki" "$TMP/symlink/target" 2>&1)
rc=$?
[ "$rc" -eq 2 ] || { echo "selftest: symlink escape should exit 2" >&2; fail=1; }
echo "$symlink_out" | grep -q "symlink escapes target" || {
  echo "selftest: symlink escape failed for the wrong reason" >&2
  fail=1
}

# Directory symlink cycles are skipped rather than followed.
mkdir -p "$TMP/cycle/wiki" "$TMP/cycle/target"
cat > "$TMP/cycle/target/source.py" <<'EOF_CYCLE_SOURCE'
def answer():
    return "CYCLE_SAFE"

if __name__ == "__main__":
    print(answer())
EOF_CYCLE_SOURCE
ln -s . "$TMP/cycle/target/loop"
cat > "$TMP/cycle/wiki/page.md" <<'EOF_CYCLE_WIKI'
The entrypoint in `source.py` returns a stable value. (src: source.py `CYCLE_SAFE`)
EOF_CYCLE_WIKI
if ! bun run "$ROOT/src/audit_wiki.ts" "$TMP/cycle/wiki" "$TMP/cycle/target" >/dev/null 2>&1; then
  echo "selftest: directory symlink cycle should be skipped safely" >&2
  fail=1
fi

# A symlink alias must not make generated output valid source evidence.
mkdir -p "$TMP/circular/wiki" "$TMP/circular/target/openwiki"
cat > "$TMP/circular/target/openwiki/evidence.py" <<'EOF_CIRCULAR_SOURCE'
CIRCULAR_ONLY = True
EOF_CIRCULAR_SOURCE
cat > "$TMP/circular/target/main.py" <<'EOF_CIRCULAR_MAIN'
if __name__ == "__main__":
    print("main")
EOF_CIRCULAR_MAIN
ln -s openwiki/evidence.py "$TMP/circular/target/alias.py"
cat > "$TMP/circular/wiki/page.md" <<'EOF_CIRCULAR_WIKI'
The `main.py` flow is documented by generated evidence. (src: alias.py `CIRCULAR_ONLY = True`)
EOF_CIRCULAR_WIKI
circular_out=$(bun run "$ROOT/src/audit_wiki.ts" "$TMP/circular/wiki" "$TMP/circular/target" 2>&1)
rc=$?
[ "$rc" -eq 2 ] || { echo "selftest: circular symlink alias should exit 2" >&2; fail=1; }
echo "$circular_out" | grep -q "circular evidence through symlink" || {
  echo "selftest: circular symlink alias failed for the wrong reason" >&2
  fail=1
}

# Unicode filenames remain valid when they stay inside the target.
mkdir -p "$TMP/unicode/wiki" "$TMP/unicode/target"
cat > "$TMP/unicode/target/main.py" <<'EOF_UNICODE_MAIN'
if __name__ == "__main__":
    print("main")
EOF_UNICODE_MAIN
printf '%s\n' 'UNICODE_EVIDENCE = True' > "$TMP/unicode/target/unicodé.py"
cat > "$TMP/unicode/wiki/page.md" <<'EOF_UNICODE_WIKI'
The `main.py` entrypoint delegates to a Unicode-named module. (src: unicodé.py `UNICODE_EVIDENCE = True`)
EOF_UNICODE_WIKI
if ! bun run "$ROOT/src/audit_wiki.ts" "$TMP/unicode/wiki" "$TMP/unicode/target" >/dev/null 2>&1; then
  echo "selftest: an internal Unicode anchor path should pass" >&2
  fail=1
fi

# ── Resource-boundary controls (exit 3 = incomplete, never PASS) ───────
mkdir -p "$TMP/limits/wiki" "$TMP/limits/target"
cat > "$TMP/limits/target/source.py" <<'EOF_LIMIT_SOURCE'
def answer():
    return "LIMIT_EVIDENCE"

if __name__ == "__main__":
    print(answer())
EOF_LIMIT_SOURCE
cat > "$TMP/limits/wiki/page.md" <<'EOF_LIMIT_WIKI'
The implementation in `source.py` returns a bounded value. (src: source.py `LIMIT_EVIDENCE`)
EOF_LIMIT_WIKI

page_limit=$(bun run "$ROOT/src/audit_wiki.ts" "$TMP/limits/wiki" "$TMP/limits/target" --max-page-bytes 16 2>&1)
rc=$?
[ "$rc" -eq 3 ] || { echo "selftest: page-byte limit should exit 3" >&2; fail=1; }
expect_json_field "$page_limit" 'data.complete === false && data.status === "incomplete" && data.limit_failure?.key === "max_page_bytes"' "page-byte limit receipt was not incomplete"

file_limit=$(bun run "$ROOT/src/audit_wiki.ts" "$TMP/limits/wiki" "$TMP/limits/target" --max-file-bytes 16 2>&1)
rc=$?
[ "$rc" -eq 3 ] || { echo "selftest: source-file limit should exit 3" >&2; fail=1; }
expect_json_field "$file_limit" 'data.complete === false && data.limit_failure?.key === "max_file_bytes"' "source-file limit reported the wrong boundary"

file_count_limit=$(bun run "$ROOT/src/audit_wiki.ts" "$TMP/limits/wiki" "$TMP/limits/target" --max-files 1 2>&1)
rc=$?
[ "$rc" -eq 3 ] || { echo "selftest: filesystem-entry limit should exit 3" >&2; fail=1; }
expect_json_field "$file_count_limit" 'data.complete === false && data.limit_failure?.key === "max_files"' "filesystem-entry limit reported the wrong boundary"

total_bytes_limit=$(bun run "$ROOT/src/audit_wiki.ts" "$TMP/limits/wiki" "$TMP/limits/target" --max-total-bytes 64 2>&1)
rc=$?
[ "$rc" -eq 3 ] || { echo "selftest: total-byte limit should exit 3" >&2; fail=1; }
expect_json_field "$total_bytes_limit" 'data.complete === false && data.limit_failure?.key === "max_total_bytes"' "total-byte limit reported the wrong boundary"

cat > "$TMP/limits/wiki/many-anchors.md" <<'EOF_MANY_ANCHORS'
The `source.py` implementation has evidence. (src: source.py `LIMIT_EVIDENCE`) (src: source.py `LIMIT_EVIDENCE`)
EOF_MANY_ANCHORS
anchor_limit=$(bun run "$ROOT/src/audit_wiki.ts" "$TMP/limits/wiki" "$TMP/limits/target" --max-anchors-per-page 1 2>&1)
rc=$?
[ "$rc" -eq 3 ] || { echo "selftest: anchor-count limit should exit 3" >&2; fail=1; }
expect_json_field "$anchor_limit" 'data.complete === false && data.limit_failure?.key === "max_anchors_per_page"' "anchor-count limit reported the wrong boundary"
rm "$TMP/limits/wiki/many-anchors.md"

cat > "$TMP/limits/wiki/many-claims.md" <<'EOF_MANY_CLAIMS'
The first `source.py` claim has evidence. (src: source.py `LIMIT_EVIDENCE`)

The second `source.py` claim also has evidence. (src: source.py `LIMIT_EVIDENCE`)
EOF_MANY_CLAIMS
claim_limit=$(bun run "$ROOT/src/audit_wiki.ts" "$TMP/limits/wiki" "$TMP/limits/target" --max-claims-per-page 1 2>&1)
rc=$?
[ "$rc" -eq 3 ] || { echo "selftest: claim-count limit should exit 3" >&2; fail=1; }
expect_json_field "$claim_limit" 'data.complete === false && data.limit_failure?.key === "max_claims_per_page"' "claim-count limit reported the wrong boundary"
rm "$TMP/limits/wiki/many-claims.md"

mkdir -p "$TMP/timeout/wiki" "$TMP/timeout/target"
cat > "$TMP/timeout/wiki/page.md" <<'EOF_TIMEOUT_WIKI'
The `source.py` entrypoint is present. (src: source.py `TIMEOUT_EVIDENCE`)
EOF_TIMEOUT_WIKI
cat > "$TMP/timeout/target/source.py" <<'EOF_TIMEOUT_SOURCE'
if __name__ == "__main__":
    print("TIMEOUT_EVIDENCE")
EOF_TIMEOUT_SOURCE
i=0
while [ "$i" -lt 1000 ]; do
  printf '%s\n' "$i" > "$TMP/timeout/target/filler-$i.txt"
  i=$((i + 1))
done
timeout_limit=$(bun run "$ROOT/src/audit_wiki.ts" "$TMP/timeout/wiki" "$TMP/timeout/target" --timeout-ms 1 2>&1)
rc=$?
[ "$rc" -eq 3 ] || { echo "selftest: timeout limit should exit 3" >&2; fail=1; }
expect_json_field "$timeout_limit" 'data.complete === false && data.limit_failure?.key === "timeout_ms"' "timeout limit reported the wrong boundary"

mkdir -p "$TMP/depth/wiki" "$TMP/depth/target/a/b"
cat > "$TMP/depth/target/a/b/source.py" <<'EOF_DEPTH_SOURCE'
if __name__ == "__main__":
    print("DEPTH_EVIDENCE")
EOF_DEPTH_SOURCE
cat > "$TMP/depth/wiki/page.md" <<'EOF_DEPTH_WIKI'
The entrypoint `a/b/source.py` is nested. (src: a/b/source.py `DEPTH_EVIDENCE`)
EOF_DEPTH_WIKI
depth_limit=$(bun run "$ROOT/src/audit_wiki.ts" "$TMP/depth/wiki" "$TMP/depth/target" --max-depth 1 2>&1)
rc=$?
[ "$rc" -eq 3 ] || { echo "selftest: depth limit should exit 3" >&2; fail=1; }
expect_json_field "$depth_limit" 'data.complete === false && data.limit_failure?.key === "max_depth"' "depth limit reported the wrong boundary"

mkdir -p "$TMP/utf8/wiki" "$TMP/utf8/target"
printf '\377\376\375' > "$TMP/utf8/target/binary.py"
cat > "$TMP/utf8/wiki/page.md" <<'EOF_UTF8_WIKI'
The `binary.py` input is text. (src: binary.py `not-present`)
EOF_UTF8_WIKI
utf8_out=$(bun run "$ROOT/src/audit_wiki.ts" "$TMP/utf8/wiki" "$TMP/utf8/target" 2>&1)
rc=$?
[ "$rc" -eq 3 ] || { echo "selftest: invalid UTF-8 target should exit 3" >&2; fail=1; }
expect_json_field "$utf8_out" 'data.complete === false && data.input_failure?.key === "invalid_utf8"' "invalid UTF-8 did not produce an incomplete receipt"

# ── Circuit breaker baseline controls ──────────────────────────────────
sh "$ROOT/trigger.sh" >/dev/null 2>&1
rc=$?
[ "$rc" -eq 64 ] || { echo "selftest: trigger without arguments should exit 64" >&2; fail=1; }

if ! WIKI="$ROOT/tests/fixtures/wiki-anchored" TARGET_REPO="$ROOT/tests/fixtures/target" \
  RUNDIR="$TMP/run-anchored" \
  sh "$ROOT/trigger.sh" "$P/fixture-anchored.json" >/dev/null 2>&1; then
  echo "selftest: anchored page should exit 0 without dispatch" >&2
  fail=1
fi

DEG="$ROOT/tests/fixtures/wiki-degrade"
PAGE="$DEG/unanchorable.md"
before=$(wc -w < "$PAGE" | tr -d ' ')
WIKI="$DEG" TARGET_REPO="$ROOT/tests/fixtures/target" RUNDIR="$TMP/run-degrade" \
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

# ── Deterministic final-retry controls ─────────────────────────────────
mkdir -p "$TMP/retry-target"
cat > "$TMP/retry-target/source.py" <<'EOF_RETRY_SOURCE'
def answer():
    return "FINAL_RETRY_EVIDENCE"

if __name__ == "__main__":
    print(answer())
EOF_RETRY_SOURCE

# The second and final mutation fixes the claim. Only a fresh post-loop audit can return 0.
mkdir -p "$TMP/final-success/wiki" "$TMP/final-success/run"
cat > "$TMP/final-success/wiki/page.md" <<'EOF_FINAL_SUCCESS_BEFORE'
The implementation in `source.py` returns final evidence. <!-- claim-id: final-success-1 -->
EOF_FINAL_SUCCESS_BEFORE
cat > "$TMP/final-success/replacement.md" <<'EOF_FINAL_SUCCESS_AFTER'
The implementation in `source.py` returns final evidence. <!-- claim-id: final-success-1 --> (src: source.py `FINAL_RETRY_EVIDENCE`)
EOF_FINAL_SUCCESS_AFTER
cat > "$TMP/final-success/packet.json" <<'EOF_FINAL_SUCCESS_PACKET'
{
  "packet_id": "fixture-final-success",
  "page": "page.md",
  "retry_budget": 2,
  "emergent_prompt_context": "deterministic final-retry positive control"
}
EOF_FINAL_SUCCESS_PACKET
HARNESS_TEST_MODE=1 \
HARNESS_TEST_DRIVER="$ROOT/tests/fake_driver.sh" \
HARNESS_FIXTURE_STATE="$TMP/final-success/state" \
HARNESS_FIXTURE_MUTATE_ON=2 \
HARNESS_FIXTURE_REPLACEMENT="$TMP/final-success/replacement.md" \
WIKI="$TMP/final-success/wiki" \
TARGET_REPO="$TMP/retry-target" \
BASELINE_DIR="$TMP/no-baseline" \
RUNDIR="$TMP/final-success/run" \
  sh "$ROOT/trigger.sh" "$TMP/final-success/packet.json" fixture > "$TMP/final-success/out" 2>&1
rc=$?
[ "$rc" -eq 0 ] || { echo "selftest: final successful retry should exit 0" >&2; fail=1; }
grep -q "fresh audit" "$TMP/final-success/out" || {
  echo "selftest: final successful retry did not report a fresh final audit" >&2
  fail=1
}
expect_json_field "$(cat "$TMP/final-success/run/audit.fixture-final-success.json")" 'data.complete === true && data.status === "passed" && data.invalid_anchors.length === 0' "final-success receipt is not from the passing filesystem state"

# The final mutation introduces a hollow anchor. The final receipt must include that new failure.
mkdir -p "$TMP/final-invalid/wiki" "$TMP/final-invalid/run"
cat > "$TMP/final-invalid/wiki/page.md" <<'EOF_FINAL_INVALID_BEFORE'
The implementation in `source.py` returns final evidence. <!-- claim-id: final-invalid-1 -->
EOF_FINAL_INVALID_BEFORE
cat > "$TMP/final-invalid/replacement.md" <<'EOF_FINAL_INVALID_AFTER'
The implementation in `source.py` returns final evidence. <!-- claim-id: final-invalid-1 --> (src: source.py `NOT_IN_SOURCE`)
EOF_FINAL_INVALID_AFTER
cat > "$TMP/final-invalid/packet.json" <<'EOF_FINAL_INVALID_PACKET'
{
  "packet_id": "fixture-final-invalid",
  "page": "page.md",
  "retry_budget": 2,
  "emergent_prompt_context": "deterministic final-retry negative control"
}
EOF_FINAL_INVALID_PACKET
HARNESS_TEST_MODE=1 \
HARNESS_TEST_DRIVER="$ROOT/tests/fake_driver.sh" \
HARNESS_FIXTURE_STATE="$TMP/final-invalid/state" \
HARNESS_FIXTURE_MUTATE_ON=2 \
HARNESS_FIXTURE_REPLACEMENT="$TMP/final-invalid/replacement.md" \
WIKI="$TMP/final-invalid/wiki" \
TARGET_REPO="$TMP/retry-target" \
BASELINE_DIR="$TMP/no-baseline" \
RUNDIR="$TMP/final-invalid/run" \
  sh "$ROOT/trigger.sh" "$TMP/final-invalid/packet.json" fixture >/dev/null 2>&1
rc=$?
[ "$rc" -eq 2 ] || { echo "selftest: invalid final retry should exit 2" >&2; fail=1; }
grep -q "quote not found in that file" "$TMP/final-invalid/wiki/.unresolved.json" || {
  echo "selftest: final invalid anchor was absent from the unresolved receipt" >&2
  fail=1
}
expect_json_field "$(cat "$TMP/final-invalid/run/audit.fixture-final-invalid.json")" 'data.complete === true && data.status === "failed" && data.invalid_anchors.some((item) => item.reason === "quote not found in that file")' "final-invalid receipt is stale"

# Same-or-higher word count is not enough: removing an explicit claim ID must fail and restore.
mkdir -p "$TMP/claim-delete/wiki" "$TMP/claim-delete/run"
cat > "$TMP/claim-delete/wiki/page.md" <<'EOF_CLAIM_DELETE_BEFORE'
The implementation in `source.py` returns tracked evidence. <!-- claim-id: delete-1 -->
EOF_CLAIM_DELETE_BEFORE
cp "$TMP/claim-delete/wiki/page.md" "$TMP/claim-delete/original.md"
cat > "$TMP/claim-delete/replacement.md" <<'EOF_CLAIM_DELETE_AFTER'
This replacement deliberately contains many harmless filler words so its word count stays higher while the tracked technical claim disappears completely from the page.
EOF_CLAIM_DELETE_AFTER
cat > "$TMP/claim-delete/packet.json" <<'EOF_CLAIM_DELETE_PACKET'
{
  "packet_id": "fixture-claim-delete",
  "page": "page.md",
  "retry_budget": 1,
  "emergent_prompt_context": "same-word-count claim deletion negative control"
}
EOF_CLAIM_DELETE_PACKET
HARNESS_TEST_MODE=1 \
HARNESS_TEST_DRIVER="$ROOT/tests/fake_driver.sh" \
HARNESS_FIXTURE_STATE="$TMP/claim-delete/state" \
HARNESS_FIXTURE_MUTATE_ON=1 \
HARNESS_FIXTURE_REPLACEMENT="$TMP/claim-delete/replacement.md" \
WIKI="$TMP/claim-delete/wiki" \
TARGET_REPO="$TMP/retry-target" \
BASELINE_DIR="$TMP/no-baseline" \
RUNDIR="$TMP/claim-delete/run" \
  sh "$ROOT/trigger.sh" "$TMP/claim-delete/packet.json" fixture >/dev/null 2>&1
rc=$?
[ "$rc" -eq 2 ] || { echo "selftest: missing claim-id should exit 2" >&2; fail=1; }
if ! cmp -s "$TMP/claim-delete/original.md" "$TMP/claim-delete/wiki/page.md"; then
  echo "selftest: claim deletion was not restored" >&2
  fail=1
fi
grep -q "claim-id missing without disposition: delete-1" \
  "$TMP/claim-delete/run/claim-preservation.fixture-claim-delete.1.json" || {
  echo "selftest: claim deletion failed for the wrong reason" >&2
  fail=1
}

# Explicit, reasoned withdrawal is the only supported way for a tracked ID to disappear.
mkdir -p "$TMP/withdrawal"
cat > "$TMP/withdrawal/before.md" <<'EOF_WITHDRAW_BEFORE'
The implementation in `source.py` exposes a retired behavior. <!-- claim-id: withdraw-1 -->
EOF_WITHDRAW_BEFORE
bun run "$ROOT/src/claim_guard.ts" inventory "$TMP/withdrawal/before.md" > "$TMP/withdrawal/inventory.json"
cat > "$TMP/withdrawal/after.md" <<'EOF_WITHDRAW_AFTER'
The retired behavior is no longer claimed here.
EOF_WITHDRAW_AFTER
cat > "$TMP/withdrawal/dispositions.json" <<'EOF_WITHDRAW_DISPOSITIONS'
[
  {
    "claim_id": "withdraw-1",
    "disposition": "withdrawn",
    "reason": "the source behavior was removed"
  }
]
EOF_WITHDRAW_DISPOSITIONS
if ! bun run "$ROOT/src/claim_guard.ts" check \
  "$TMP/withdrawal/inventory.json" \
  "$TMP/withdrawal/after.md" \
  "$TMP/withdrawal/dispositions.json" >/dev/null; then
  echo "selftest: explicit claim withdrawal should pass" >&2
  fail=1
fi

[ "$fail" -eq 0 ] && echo "selftest: PASS(valid/hollow/malformed/symlink/limits/final-retry/claim-preservation/breaker controls)"
exit "$fail"
