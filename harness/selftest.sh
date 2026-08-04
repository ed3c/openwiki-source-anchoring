#!/bin/sh
# selftest.sh — 正控/負控:證明 T0 閘與熔斷器都不是空殼。
#
# 錨驗證器  good  = 錨真實存在且引文逐字符合           → exit 0
#           hollow= 錨指向真實檔案,但引文不在該檔中     → exit 2(最難抓的那類)
# 熔斷器    無參數→64 / 已錨定頁→0 且不派工 / k 耗盡→2 且降級不刪頁 + 落交人裁紀錄
set -u
ROOT=$(cd "$(dirname "$0")" && pwd)
T="$ROOT/tests/fixtures/target"
P="$ROOT/packets/inbox"
EMPTY_UNRESOLVED='{"schema_version":"wiki-anchor-unresolved@1.0.0","human_gate":"required_before_merge","degraded_pages":[]}'
fail=0

# ── 錨驗證器 ────────────────────────────────────────────────────────────
bun run "$ROOT/src/audit_wiki.ts" "$ROOT/tests/fixtures/wiki-good" "$T" >/dev/null 2>&1
[ $? -eq 0 ] || { echo "selftest: good fixture 應為 exit 0" >&2; fail=1; }

out=$(bun run "$ROOT/src/audit_wiki.ts" "$ROOT/tests/fixtures/wiki-hollow" "$T" 2>&1)
[ $? -eq 2 ] || { echo "selftest: hollow fixture 應為 exit 2" >&2; fail=1; }
echo "$out" | grep -q "quote not found in that file" || {
  echo "selftest: hollow 被判 FAIL 但理由不是引文不符 — 驗證器抓錯東西" >&2; fail=1; }

# ── 熔斷器(trigger.sh)──────────────────────────────────────────────────
sh "$ROOT/trigger.sh" >/dev/null 2>&1
[ $? -eq 64 ] || { echo "selftest: trigger 無參數應 exit 64" >&2; fail=1; }

sh "$ROOT/trigger.sh" "$P/architecture-data-authority.json" >/dev/null 2>&1
[ $? -eq 0 ] || { echo "selftest: 已錨定頁應 exit 0(且不派工)" >&2; fail=1; }

# 耗盡負控綁**固定 fixture**,不綁活頁面:活頁面一旦被錨好,這個負控就自然失效而無人察覺
# (實測發生過——molecular-commit-lineage.md 錨完後本檢查轉紅)。
DEG="$ROOT/tests/fixtures/wiki-degrade"
PAGE="$DEG/unanchorable.md"
before=$(wc -w < "$PAGE" | tr -d ' ')
# driver=subagent 無獨立執行體(run.sh 契約),等價於「driver 什麼都沒做」——正是要驗的耗盡路徑
WIKI="$DEG" TARGET_REPO="$ROOT/tests/fixtures/target" \
  sh "$ROOT/trigger.sh" "$P/fixture-degrade.json" subagent >/dev/null 2>&1
rc=$?
after=$(wc -w < "$PAGE" | tr -d ' ')
[ "$rc" -eq 2 ] || { echo "selftest: k 耗盡應 exit 2(降級),得到 $rc" >&2; fail=1; }
[ "$after" -ge "$before" ] || { echo "selftest: 降級不得刪內容($before → $after 字)" >&2; fail=1; }
[ -f "$DEG/.unresolved.json" ] || { echo "selftest: 降級須落 .unresolved.json 交人裁" >&2; fail=1; }
# 覆寫而非刪除:留下的是 no-op driver 造成的假紀錄,不是真實嘗試結果
printf '%s\n' "$EMPTY_UNRESOLVED" > "$DEG/.unresolved.json"

# 畸形錨(同一括號兩個)必須被抓——它曾靜默通過:anchors=0/invalid=0/rate=1/status=passed
mal=$(bun run "$ROOT/src/audit_wiki.ts" "$ROOT/tests/fixtures/wiki-malformed" "$T" 2>&1)
[ $? -eq 2 ] || { echo "selftest: 畸形錨頁應 exit 2" >&2; fail=1; }
echo "$mal" | grep -q "malformed anchor" || { echo "selftest: 畸形錨未被標記" >&2; fail=1; }

[ $fail -eq 0 ] && echo "selftest: PASS(錨驗證器 good=0/hollow=2 理由正確;熔斷器 64/0/2 三路,降級不刪頁)"
exit $fail
