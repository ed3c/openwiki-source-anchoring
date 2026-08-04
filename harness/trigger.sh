#!/bin/sh
# trigger.sh — 單頁錨定的階段熔斷器(phase gate + local retry budget + circuit breaker)。
#
# 用法: trigger.sh <packet.json> [driver]      driver 預設 claude
# exit 0=該頁 PASS / 2=k 耗盡已降級(不是崩潰,是已知缺口) / 10=全局熔斷交人 / 64=用法或契約錯
#
# 三類提示詞在本檔的物理落點(依 loop-harness-standard/modules/production-seed-loop.md):
#   fixed_prompt_context      = 沙盒 CLAUDE.md(driver 從 CWD 自動載入)+ PROMPT.md(指針,不餵全文
#                               ——餵全文是已記錄反模式:driver 會讀成規範而不動手)
#   iteration_auto_context    = 本檔每輪重生的 _engine-run/exchange-context.<packet_id>.md,
#                               內容=該頁當前未錨 claim 清單 + 第幾次重試。經 run.sh $3 通道注入。
#   emergent_prompt_context   = anti/*.md(driver 依 CLAUDE.md 鐵律 8 開工先讀)+ packet 同名欄位。
#
# 為什麼重試要換 fresh 執行體:失敗日誌留在同一個 context 會污染後續頁面。
# 為什麼耗盡不 rollback:wiki 沒有「已知 good 的舊版」可回滾,刪頁會讓錨定率分母變小反而上升、
# 覆蓋率下降 ⇒ 熔斷器會變成「刪掉最難寫的頁來美化指標」。正解是降級標記。
set -u
ROOT=$(cd "$(dirname "$0")" && pwd)
# 不用 ${1:?...}:它在 set -u 下固定 exit 1,和契約的 64(用法/契約錯)對不上。
[ "$#" -ge 1 ] || { echo "用法: trigger.sh <packet.json> [driver]" >&2; exit 64; }
PACKET="$1"
DRIVER="${2:-claude}"
TARGET_REPO="${TARGET_REPO:-<target-repo>}"
# WIKI/BASELINE_DIR 可覆寫:selftest 的耗盡負控必須綁**固定 fixture**,不能綁活頁面——
# 綁活頁面時該頁一旦被錨好,負控就自然失效(實測:molecular-commit-lineage.md 錨完後 selftest 轉紅)。
WIKI="${WIKI:-$ROOT/candidate}"
BASELINE_DIR="${BASELINE_DIR:-$ROOT/baselines/wiki-b8d076a}"
RUNDIR="$ROOT/_engine-run"
UNRESOLVED="$WIKI/.unresolved.json"
[ -f "$PACKET" ] || { echo "trigger: packet 不存在: $PACKET" >&2; exit 64; }
mkdir -p "$RUNDIR"

PACKET_ID=$(bun -e "console.log((await Bun.file(process.argv[1]).json()).packet_id ?? '')" "$PACKET")
PAGE=$(bun -e "console.log((await Bun.file(process.argv[1]).json()).page ?? '')" "$PACKET")
K=$(bun -e "console.log((await Bun.file(process.argv[1]).json()).retry_budget ?? 3)" "$PACKET")
EMERGENT=$(bun -e "console.log((await Bun.file(process.argv[1]).json()).emergent_prompt_context ?? 'N/A-none')" "$PACKET")
[ -n "$PACKET_ID" ] && [ -n "$PAGE" ] || { echo "trigger: packet 缺 packet_id 或 page" >&2; exit 64; }
[ -f "$WIKI/$PAGE" ] || { echo "trigger: 頁不存在: $WIKI/$PAGE" >&2; exit 64; }

# 全局熔斷前置斷言:已降級頁數超標就不再開新頁——系統性問題下續跑無資訊價值。
DEGRADED=$(bun -e "
const f=Bun.file(process.argv[1]); console.log(await f.exists()? (await f.json()).degraded_pages.length : 0)" "$UNRESOLVED" 2>/dev/null || echo 0)
if [ "${DEGRADED:-0}" -gt 5 ]; then
  echo "trigger: 全局熔斷 — 已降級 $DEGRADED 頁(>5),整輪中止交人" >&2
  exit 10
fi

if [ -f "$BASELINE_DIR/$PAGE" ]; then
  BASE_WORDS=$(wc -w < "$BASELINE_DIR/$PAGE" | tr -d ' ')
else
  # 沒有 baseline 對照(fixture 或新頁)⇒ 地板取當前字數,仍然禁止本輪把內容改少。
  BASE_WORDS=$(wc -w < "$WIKI/$PAGE" | tr -d ' ')
fi
i=1
while [ "$i" -le "$K" ]; do
  # ── 後置斷言的輸入:該頁當前未錨 claim(由 T0 閘生成,不是 driver 自報)
  bun run "$ROOT/src/audit_wiki.ts" "$WIKI" "$TARGET_REPO" > "$RUNDIR/audit.$PACKET_ID.json" 2>&1
  LEFT=$(bun -e "
const d=await Bun.file(process.argv[1]).json();
const p=process.argv[2];
const u=d.unanchored_claims.filter(x=>x.page===p);
const bad=d.invalid_anchors.filter(x=>x.page===p);
console.log(JSON.stringify({n:u.length+bad.length,u,bad}));" "$RUNDIR/audit.$PACKET_ID.json" "$PAGE")
  N=$(printf '%s' "$LEFT" | bun -e "console.log(JSON.parse(await Bun.stdin.text()).n)")
  if [ "$N" -eq 0 ]; then
    echo "trigger: $PAGE PASS(iter $((i-1)) 後無未錨 claim、無無效錨)"
    exit 0
  fi

  # ── iteration_auto_context:每輪重生,只講這一頁這一輪
  CTX="$RUNDIR/exchange-context.$PACKET_ID.md"
  {
    echo "# iteration_auto_context — $PACKET_ID (retry $i/$K)"
    echo
    echo "只改這一頁:\`candidate/$PAGE\`。不動其他頁、不動 src/、不動 verify.sh。"
    echo
    echo "## 本輪必須解決($N 項,由 T0 閘機械產生,非自報)"
    printf '%s' "$LEFT" | bun -e "
const d=JSON.parse(await Bun.stdin.text());
for(const x of d.bad) console.log('- 無效錨(' + x.reason + '):路徑 ' + x.path + ' 引文 \`' + x.quote + '\`');
for(const x of d.u) console.log('- 未錨 claim:' + x.block);"
    echo
    echo "## 硬約束"
    echo "- 錨形 \`(src: <路徑> \\\`<該檔逐字子串>\\\`)\`,引文必須從檔案複製,不帶行號。"
    # ${} 界定必要:緊接其後的全形標點會被 shell 併進變數名(實測 \$BASE_WORDS。→ unbound variable)
    echo "- 錨不到就標 \`(inferred)\` 保留;**禁刪句、禁刪頁**。本頁字數不得低於 ${BASE_WORDS} 字。"
    echo "- 禁錨進 \`.openwiki-review/\`(那是本 wiki 自己的生成逐字稿＝循環證據)。"
    echo "- target repo 根目錄:$TARGET_REPO"
    echo
    echo "## emergent_prompt_context"
    echo "$EMERGENT"
    echo
    echo "開工前先讀 $ROOT/anti/(禁回退前科),以及 $ROOT/PROMPT.md 的任務與 Guard-Metric 節。"
  } > "$CTX"

  # ── 派工:fresh 執行體,失敗日誌不進主 context
  sh "$ROOT/run.sh" "$DRIVER" "$WIKI/$PAGE" "$CTX" \
    > "$RUNDIR/run.$PACKET_ID.$i.out" 2> "$RUNDIR/run.$PACKET_ID.$i.err"

  # ── 刪內容換分數的機械防線(前科:錨定成本擠壓廣度)
  NOW_WORDS=$(wc -w < "$WIKI/$PAGE" | tr -d ' ')
  if [ "$NOW_WORDS" -lt "$BASE_WORDS" ]; then
    echo "trigger: $PAGE 字數 $NOW_WORDS < baseline $BASE_WORDS — 刪內容換錨定率,該輪作廢" >&2
  fi
  i=$((i+1))
done

# ── 熔斷:降級不刪頁。未錨 claim 記入 .unresolved.json 交人裁,頁面原樣保留。
bun -e "
const p=process.argv[1], page=process.argv[2], auditPath=process.argv[3];
const d=await Bun.file(auditPath).json();
const f=Bun.file(p); const cur=await f.exists()? await f.json() : {degraded_pages:[]};
const left=d.unanchored_claims.filter(x=>x.page===page);
const bad=d.invalid_anchors.filter(x=>x.page===page);
cur.degraded_pages=cur.degraded_pages.filter(x=>x.page!==page);
cur.degraded_pages.push({page,unanchored:left,invalid_anchors:bad,reason:'retry budget exhausted'});
cur.schema_version='wiki-anchor-unresolved@1.0.0';
cur.human_gate='required_before_merge';
await Bun.write(p, JSON.stringify(cur,null,2)+'\n');
console.error('trigger: '+page+' 降級 — '+(left.length+bad.length)+' 項未解,已記入 .unresolved.json(頁面保留,未刪)');
" "$UNRESOLVED" "$PAGE" "$RUNDIR/audit.$PACKET_ID.json"
exit 2
