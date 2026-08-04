#!/bin/sh
# verify.sh — T0 機械閘(零 LLM,真 exit code)。
# 用法: verify.sh <wiki-dir> [target-repo]   exit 0=全綠 / 2=至少一門檻未達 / 64=用法錯
# 收據 JSON 落 logs/ 且 stdout 保持可 parse;engine.sh 契約的 PROGRESS 行由本檔補。
set -u
ROOT=$(cd "$(dirname "$0")" && pwd)
WIKI="${1:?用法: verify.sh <wiki-dir> [target-repo]}"
TARGET="${2:-<target-repo>}"
mkdir -p "$ROOT/logs"
out="$ROOT/logs/verify-$(date +%Y%m%d-%H%M%S).json"
bun run "$ROOT/src/audit_wiki.ts" "$WIKI" "$TARGET" > "$out" 2>&1
rc=$?    # 先取真 exit code——pipe 會吃掉 rc(POSIX sh 無 pipefail)
cat "$out"
if [ "$rc" -eq 2 ]; then
  # PROGRESS = 已達標的門檻數(共 3 條機械門檻:錨定率/錨正確率/entrypoint 覆蓋)
  n=$(grep -c '<' "$out" 2>/dev/null || echo 0)
  echo "PROGRESS: $((3 - n))" >&2
fi
exit $rc
