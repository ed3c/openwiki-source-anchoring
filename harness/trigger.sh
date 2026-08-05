#!/bin/sh
# Single-page anchoring circuit breaker with bounded retries.
# Exit 0 = page passes; 2 = local retry budget exhausted or preservation guard failed;
# 10 = audit incomplete/global circuit break; 64 = usage or packet contract error.
set -u

ROOT=$(cd "$(dirname "$0")" && pwd)
if [ "$#" -lt 1 ]; then
  echo "usage: trigger.sh <packet.json> [driver]" >&2
  exit 64
fi

PACKET="$1"
DRIVER="${2:-claude}"
TARGET_REPO="${TARGET_REPO:-<target-repo>}"
WIKI="${WIKI:-$ROOT/candidate}"
BASELINE_DIR="${BASELINE_DIR:-$ROOT/baselines/wiki-b8d076a}"
RUNDIR="${RUNDIR:-$ROOT/_engine-run}"
UNRESOLVED="$WIKI/.unresolved.json"

if [ ! -f "$PACKET" ]; then
  echo "trigger: packet does not exist: $PACKET" >&2
  exit 64
fi
if [ ! -d "$WIKI" ]; then
  echo "trigger: wiki directory does not exist: $WIKI" >&2
  exit 64
fi
mkdir -p "$RUNDIR"

PACKET_ID=$(bun -e "console.log((await Bun.file(process.argv[1]).json()).packet_id ?? '')" "$PACKET" 2>/dev/null) || {
  echo "trigger: packet is not valid JSON: $PACKET" >&2
  exit 64
}
PAGE=$(bun -e "console.log((await Bun.file(process.argv[1]).json()).page ?? '')" "$PACKET" 2>/dev/null) || exit 64
K=$(bun -e "console.log((await Bun.file(process.argv[1]).json()).retry_budget ?? 3)" "$PACKET" 2>/dev/null) || exit 64
EMERGENT=$(bun -e "console.log((await Bun.file(process.argv[1]).json()).emergent_prompt_context ?? 'N/A-none')" "$PACKET" 2>/dev/null) || exit 64

if [ -z "$PACKET_ID" ] || [ -z "$PAGE" ]; then
  echo "trigger: packet requires packet_id and page" >&2
  exit 64
fi
case "$PACKET_ID" in
  *[!A-Za-z0-9._-]*)
    echo "trigger: packet_id contains unsafe characters: $PACKET_ID" >&2
    exit 64
    ;;
esac
case "$K" in
  ''|*[!0-9]*)
    echo "trigger: retry_budget must be a positive integer" >&2
    exit 64
    ;;
esac
if [ "$K" -lt 1 ]; then
  echo "trigger: retry_budget must be at least 1" >&2
  exit 64
fi

PAGE_PATH=$(bun -e '
import { isAbsolute, relative, resolve } from "node:path";
const root = resolve(process.argv[1]);
const page = resolve(root, process.argv[2]);
const rel = relative(root, page);
if (!rel || rel.startsWith("..") || isAbsolute(rel)) process.exit(2);
console.log(page);
' "$WIKI" "$PAGE" 2>/dev/null) || {
  echo "trigger: page escapes wiki root: $PAGE" >&2
  exit 64
}
if [ ! -f "$PAGE_PATH" ]; then
  echo "trigger: page does not exist: $PAGE_PATH" >&2
  exit 64
fi

DEGRADED=$(bun -e '
const file = Bun.file(process.argv[1]);
console.log(await file.exists() ? (await file.json()).degraded_pages.length : 0);
' "$UNRESOLVED" 2>/dev/null || echo 0)
if [ "${DEGRADED:-0}" -gt 5 ]; then
  echo "trigger: global circuit break — $DEGRADED degraded pages (>5)" >&2
  exit 10
fi

CLAIM_BASELINE="$RUNDIR/claim-baseline.$PACKET_ID.json"
CLAIM_DISPOSITIONS="$RUNDIR/claim-dispositions.$PACKET_ID.json"
if ! bun -e '
const packet = await Bun.file(process.argv[1]).json();
console.log(JSON.stringify(packet.claim_dispositions ?? [], null, 2));
' "$PACKET" > "$CLAIM_DISPOSITIONS" 2>/dev/null; then
  echo "trigger: invalid claim_dispositions in packet" >&2
  exit 64
fi
if ! bun run "$ROOT/src/claim_guard.ts" inventory "$PAGE_PATH" > "$CLAIM_BASELINE" 2>&1; then
  echo "trigger: baseline claim inventory failed: $CLAIM_BASELINE" >&2
  exit 64
fi

if [ -f "$BASELINE_DIR/$PAGE" ]; then
  BASE_WORDS=$(wc -w < "$BASELINE_DIR/$PAGE" | tr -d ' ')
else
  BASE_WORDS=$(wc -w < "$PAGE_PATH" | tr -d ' ')
fi

run_audit() {
  audit_receipt="$1"
  bun run "$ROOT/src/audit_wiki.ts" "$WIKI" "$TARGET_REPO" > "$audit_receipt" 2>&1
  audit_command_rc=$?
  case "$audit_command_rc" in
    0|2)
      return 0
      ;;
    3)
      echo "trigger: audit incomplete; human review required: $audit_receipt" >&2
      return 10
      ;;
    64)
      echo "trigger: audit usage/path error: $audit_receipt" >&2
      return 64
      ;;
    *)
      echo "trigger: auditor crashed with exit $audit_command_rc: $audit_receipt" >&2
      return 10
      ;;
  esac
}

run_driver() {
  target_page="$1"
  context_file="$2"
  iteration="$3"
  if [ "$DRIVER" = "fixture" ]; then
    if [ "${HARNESS_TEST_MODE:-0}" != "1" ] || [ -z "${HARNESS_TEST_DRIVER:-}" ]; then
      echo "trigger: fixture driver is available only with HARNESS_TEST_MODE=1" >&2
      return 64
    fi
    if [ ! -f "$HARNESS_TEST_DRIVER" ]; then
      echo "trigger: fixture driver does not exist: $HARNESS_TEST_DRIVER" >&2
      return 64
    fi
    HARNESS_FIXTURE_ITERATION="$iteration" \
      sh "$HARNESS_TEST_DRIVER" "$target_page" "$context_file"
    return $?
  fi

  sh "$ROOT/run.sh" "$DRIVER" "$target_page" "$context_file" \
    > "$RUNDIR/run.$PACKET_ID.$iteration.out" \
    2> "$RUNDIR/run.$PACKET_ID.$iteration.err"
  return 0
}

i=1
while [ "$i" -le "$K" ]; do
  AUDIT_RECEIPT="$RUNDIR/audit.$PACKET_ID.json"
  run_audit "$AUDIT_RECEIPT"
  audit_status=$?
  if [ "$audit_status" -ne 0 ]; then
    exit "$audit_status"
  fi

  LEFT=$(bun -e '
const data = await Bun.file(process.argv[1]).json();
const page = process.argv[2];
const unanchored = data.unanchored_claims.filter((item) => item.page === page);
const invalid = data.invalid_anchors.filter((item) => item.page === page);
console.log(JSON.stringify({ n: unanchored.length + invalid.length, u: unanchored, bad: invalid }));
' "$AUDIT_RECEIPT" "$PAGE")
  N=$(printf '%s' "$LEFT" | bun -e "console.log(JSON.parse(await Bun.stdin.text()).n)")
  if [ "$N" -eq 0 ]; then
    echo "trigger: $PAGE PASS (after $((i - 1)) retries)"
    exit 0
  fi

  CTX="$RUNDIR/exchange-context.$PACKET_ID.md"
  {
    echo "# iteration_auto_context — $PACKET_ID (retry $i/$K)"
    echo
    echo "Only modify: $PAGE_PATH"
    echo
    echo "## Mechanical findings ($N)"
    printf '%s' "$LEFT" | bun -e '
const data = JSON.parse(await Bun.stdin.text());
for (const item of data.bad) console.log(`- invalid anchor (${item.reason}): ${item.path} :: ${item.quote}`);
for (const item of data.u) console.log(`- unanchored claim: ${item.block}`);
'
    echo
    echo "## Hard constraints"
    echo "- Keep explicit <!-- claim-id: ... --> markers on tracked claims."
    echo "- Do not delete claims or pages to improve a metric."
    echo "- The page must remain at or above ${BASE_WORDS} words."
    echo "- Use (src: <path> \`<verbatim source substring>\`) for lexical evidence."
    echo "- Do not cite generated wiki output as source evidence."
    echo "- Target repository: $TARGET_REPO"
    echo
    echo "## emergent_prompt_context"
    echo "$EMERGENT"
  } > "$CTX"

  SNAP="$RUNDIR/snap.$PACKET_ID.$i.md"
  cp "$PAGE_PATH" "$SNAP"

  run_driver "$PAGE_PATH" "$CTX" "$i"
  driver_status=$?
  if [ "$DRIVER" = "fixture" ] && [ "$driver_status" -ne 0 ]; then
    cp "$SNAP" "$PAGE_PATH"
    echo "trigger: fixture driver failed with exit $driver_status" >&2
    exit 64
  fi

  NOW_WORDS=$(wc -w < "$PAGE_PATH" | tr -d ' ')
  if [ "$NOW_WORDS" -lt "$BASE_WORDS" ]; then
    echo "trigger: $PAGE word count $NOW_WORDS < $BASE_WORDS; restoring retry" >&2
    cp "$SNAP" "$PAGE_PATH"
    exit 2
  fi

  CLAIM_RECEIPT="$RUNDIR/claim-preservation.$PACKET_ID.$i.json"
  bun run "$ROOT/src/claim_guard.ts" check \
    "$CLAIM_BASELINE" "$PAGE_PATH" "$CLAIM_DISPOSITIONS" \
    > "$CLAIM_RECEIPT" 2>&1
  claim_status=$?
  if [ "$claim_status" -ne 0 ]; then
    echo "trigger: claim preservation failed; restoring retry: $CLAIM_RECEIPT" >&2
    cp "$SNAP" "$PAGE_PATH"
    exit 2
  fi

  i=$((i + 1))
done

AUDIT_RECEIPT="$RUNDIR/audit.$PACKET_ID.json"
run_audit "$AUDIT_RECEIPT"
audit_status=$?
if [ "$audit_status" -ne 0 ]; then
  exit "$audit_status"
fi

FINAL=$(bun -e '
const data = await Bun.file(process.argv[1]).json();
const page = process.argv[2];
console.log(
  data.unanchored_claims.filter((item) => item.page === page).length +
  data.invalid_anchors.filter((item) => item.page === page).length,
);
' "$AUDIT_RECEIPT" "$PAGE")
if [ "$FINAL" -eq 0 ]; then
  echo "trigger: $PAGE PASS after final retry and fresh audit"
  exit 0
fi

bun -e '
const unresolvedPath = process.argv[1];
const page = process.argv[2];
const auditPath = process.argv[3];
const data = await Bun.file(auditPath).json();
const file = Bun.file(unresolvedPath);
const current = await file.exists() ? await file.json() : { degraded_pages: [] };
const unanchored = data.unanchored_claims.filter((item) => item.page === page);
const invalid = data.invalid_anchors.filter((item) => item.page === page);
current.degraded_pages = current.degraded_pages.filter((item) => item.page !== page);
current.degraded_pages.push({
  page,
  unanchored,
  invalid_anchors: invalid,
  reason: "retry budget exhausted",
  final_audit_complete: data.complete === true,
});
current.schema_version = "wiki-anchor-unresolved@1.1.0";
current.human_gate = "required_before_merge";
await Bun.write(unresolvedPath, JSON.stringify(current, null, 2) + "\n");
console.error(
  `trigger: ${page} degraded — ${unanchored.length + invalid.length} unresolved findings`,
);
' "$UNRESOLVED" "$PAGE" "$AUDIT_RECEIPT"
exit 2
