# 多 OpenWiki Repository 理解度評測

本目錄定義如何把多份 OpenWiki 文檔樹，對照它們聲稱描述的固定 source repository snapshot。

主要問題不是文檔是否好看，而是：

> 只允許讀取一份 wiki、不能讀 source 的 Agent，能否更準確地回答 repository 問題、找到正確檔案與 symbol、推理變更影響，並在控制條件下完成工程任務？

一筆樣本必須包含：

```text
source repository + exact source commit + OpenWiki tree + generation run + prompt/config provenance
```

頂層 experimental unit 是 **repository × generation run**。頁面、claim、題目與 judge 判定都是 nested observations，不能當成互相獨立的實驗。

## 快速驗證

```sh
bun run evaluation/src/validate_manifest.mjs evaluation/manifest.example.json
sh evaluation/selftest.sh
```

建立本地 manifest 後，再檢查所有引用路徑與 symlink boundary：

```sh
bun run evaluation/src/validate_manifest.mjs \
  evaluation/manifest.local.json \
  --root . \
  --check-paths
```

評測流程、統計要求、污染控制與 scorecard 詳見 [`README.md`](README.md)。角色隔離提示詞位於 [`prompts/OPENWIKI_EVALUATION_PROMPTS.md`](prompts/OPENWIKI_EVALUATION_PROMPTS.md)。

## 核心原則

- task author 只讀固定 source snapshot；
- answerer 只讀一份匿名 wiki；
- judge 只看匿名答案與預先凍結的 source-derived criteria；
- implementation task 對所有候選使用相同 source、工具、模型與 budget，唯一差異是 wiki；
- lexical quote validity 不等於 semantic support；
- `anchor_rate` 是流程診斷，不是主要 reader outcome；
- 單次相同總分不等於 equivalence；
- LLM evaluator 是可替換分析層，不能取代 deterministic source/test oracle 與 human calibration。
