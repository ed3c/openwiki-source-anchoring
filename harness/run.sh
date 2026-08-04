#!/bin/sh
# run.sh — 沙盒統一調度入口(單發 driver dispatch;迭代/stop-loss 屬 ../engine.sh,不在本檔)
#
# ⬒ canonical 權威指針:形態同構本地 <host-repo>/loop_demo/claude_agy/run.sh(融合版
#   canonical 範例;2026-07-11 從 antigravity 移植)。設計規範衝突時以該範例+本地
#   .claude/skills/loop-harness-standard/modules/harness-spec.md 為權威;指針不抄內容(防雙圖漂移)。
#
# 契約(engine.sh dispatch 介面,pilot 化時不可丟):
#   run.sh <driver> <target> [<feedback>]
#   - $1 driver:claude|agy|subagent|codex(由大迴圈/engine 選定,小迴圈不自選——命令層級見 harness-spec §4
#     D1;subagent=對話內 sub-agent,無獨立執行體,不由本檔啟動,見下方 case 分支說明)
#   - $2 target:整改對象絕對路徑(祈使任務綁 target;餵 PROMPT.md 全文當宣告式合約=已記錄反模式,
#     driver 會讀成規範而不動手,見 antigravity design_governance slice-1.1)
#   - $3 feedback:選配,畢業判官 findings 檔——append 到祈使 prompt 當額外整改要求,
#     判官本身絕不進機械內迴圈每輪跑
#   - 一律先 cd 到本檔所在目錄:driver 從沙盒 CWD 起才載入本沙盒 CLAUDE.md(cascade parent)
#   - 迭代期間(PLAN.md STATUS != done)本目錄禁 git commit(cache prefix 全 miss,
#     見 harness-spec §7 cache 五不變量)
set -u
ROOT=$(cd "$(dirname "$0")" && pwd)
cd "$ROOT"
DRIVER="${1:?用法: run.sh <claude|agy|subagent|codex> <target> [<feedback>]}"
TARGET="${2:?run.sh 需 target(整改對象絕對路徑,由 engine.sh --target 傳入)}"
FEEDBACK="${3:-}"
MODEL="${MODEL:-}"   # 大迴圈按 tier-dispatch 指定(ARCHITECTURE.md §5);空=繼承 default

PROMPT_TEXT="祈使任務:把 ${TARGET} 依本迴圈規範整改到 'sh ${ROOT}/verify.sh ${TARGET}' 回 exit 0。
Claude driver 讀 CLAUDE.md;非 Claude driver 先讀 ${ROOT}/AGENTS.md entry,再依該 entry 指針讀 CLAUDE.md/PROMPT.md。
每改一輪自己跑該指令看真 exit code,iterate-until-pass、全綠即停。只改 target 本身,
不動 checker/契約檔(verify.sh、PROMPT.md、evals 判定式),不 git commit。
判準規範見本沙盒 CLAUDE.md(claude driver 由 host cascade 自動載入;agy/codex 須自行讀取)
+以下 PROMPT.md 合約:
$(cat "$ROOT/PROMPT.md")"
if [ -n "$FEEDBACK" ] && [ -s "$FEEDBACK" ]; then
  PROMPT_TEXT="$PROMPT_TEXT

額外整改要求(iteration_auto_context:本輪由 trigger.sh 生成的未錨 claim 清單,或畢業判官 findings。本輪須一併滿足):
$(cat "$FEEDBACK")"
fi

case "$DRIVER" in
  claude)
    # 授權走 CLI 旗標,不落 .claude/settings.json(基座2;acceptEdits+全局 hook 把關)
    exec claude -p "$PROMPT_TEXT" ${MODEL:+--model "$MODEL"} \
      --permission-mode acceptEdits --add-dir "$(dirname "$TARGET")" \
      --output-format json < /dev/null ;;
  agy)
    # 命門=--add-dir(agy 不吃 shell CWD);quota 耗盡=零輸出 exit 0,可用性看產物非 exit code;
    # agy 讀沙盒 AGENTS.md(檔名綁家族)——同構可 symlink;有 host-specific 邊界時用薄 wrapper
    # 2026-07-17 實測修正(antigravity 同日發現同一錯字,見 loop-harness-standard harness-spec.md
    # Gotchas):本機 agy 現在拒絕 slug 形式 `gemini-3.1-pro`("invalid --model...not recognized")，
    # 須用完整顯示名(含空格/括號)。是否所有既有 op 的 agy 分支都曾真的踩過這行、或當初 agy 版本較舊
    # 接受 slug 形式，未逐一回溯查證——只確定「現在」的 agy 二進位需要這個格式，故修正本模板與
    # `_template_dr`（未來新 op 起點）；既有 `loop_wiki/dr-*`/`spawn-cases-*` 等已存在沙盒的同一行
    # 尚未逐一修正，是否要補是使用者判斷（不是本次自動一併改掉）。
    exec agy --mode accept-edits --add-dir "$ROOT" --add-dir "$(dirname "$TARGET")" \
      --model "Gemini 3.1 Pro (High)" -p "$PROMPT_TEXT" < /dev/null ;;
  subagent)
    # ③ 對話內 sub-agent(輕量)— 無獨立沙盒執行體,不由 run.sh 啟動;由主 session 用 Agent tool 讀
    # 本沙盒 CLAUDE.md/PROMPT.md 後直接分發。本分支只留說明,防止誤讀成「漏了第三態」(同
    # loop_demo/claude_agy/run.sh canonical)。
    echo "此 driver(對話內 subagent)無獨立執行體,不由 run.sh 啟動;由主 session 以 Agent tool" >&2
    echo "讀本沙盒 CLAUDE.md/PROMPT.md 後直接分發,適合 prune 等輕量 op。" >&2
    exit 2 ;;
  codex)
    # ④ 第三家族(2026-07-17 新增,OpenAI GPT，經官方 codex-companion.mjs)——禁手刻 codex exec，
    # 一律走官方 runtime(同 codex:codex-rescue subagent 內部呼叫的同一支腳本)。codex 不讀
    # CLAUDE.md/AGENTS.md 被動上下文，明確指示先讀本沙盒 AGENTS.md(若存在)取得治理規範。
    # 絕對路徑版本升級會變，需同步；antigravity 側已驗證見 loop_wiki/codex_demo/run.sh。
    CODEX_COMPANION="<home>/.claude/plugins/cache/openai-codex/codex/1.0.6/scripts/codex-companion.mjs"
    if [ ! -f "$CODEX_COMPANION" ]; then
      echo "run.sh: 官方 codex plugin 不存在於 $CODEX_COMPANION(版本升級後路徑會變)" >&2; exit 64
    fi
    # 2026-07-25:原本本分支自建 CODEX_PROMPT,造成兩個缺陷——(a) 它不含 $FEEDBACK,
    # 判官 findings 與 engine 自動提示對 codex 全程靜默丟棄(實測 MARKER 出現 0 次);
    # (b) 它把 PROMPT_TEXT 已有的 3 條硬約束與雙跳指針又抄一份,同檔第二份規則副本比跨檔複述更難防漂移。
    # 改用共用的 $PROMPT_TEXT 一併解決:該變數 L28 已明寫「非 Claude driver 先讀 AGENTS.md entry,
    # 再依該 entry 指針讀 CLAUDE.md/PROMPT.md」(兩跳一次講完),L29-30 已含三條硬約束,
    # L33-38 已 append feedback。codex 不吃被動上下文的差異由 L31 那句條件化承接。
    exec node "$CODEX_COMPANION" task --write "$PROMPT_TEXT" ;;
  *) echo "未知 driver: $DRIVER(須 claude|agy|subagent|codex)" >&2; exit 64 ;;
esac
