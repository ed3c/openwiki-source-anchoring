# 開源專案審查提示詞 v2 使用方式

完整、可直接複製的英文提示詞位於 [`OPEN_SOURCE_REVIEW_PROMPT_V2.md`](OPEN_SOURCE_REVIEW_PROMPT_V2.md)。英文版保留固定欄位與 machine-readable 術語，降低不同 Agent 執行時的語意漂移。

建議呼叫方式：

```text
使用 docs/OPEN_SOURCE_REVIEW_PROMPT_V2.md 深度審查 <repo URL>。
商用依賴須為 MIT、Apache-2.0、BSD，或另行清楚說明限制。
自動尋找 OpenWiki、generated wiki 與 AI-generated code documentation。
允許寫入：branch_and_draft_pr。
不得直接修改 main，不得 merge。
```

提示詞會執行七個獨立角色：

1. User / YC-style product partner
2. Technical co-founder
3. Experiment and causal-inference reviewer
4. Reproducibility engineer
5. Open-source maintainer
6. Security and supply-chain reviewer
7. Agent recruiter / portfolio reviewer

遇到 generated code documentation 時，會額外要求：

- 每份文檔對應 exact source SHA 與 generation run；
- source-only task author、wiki-only answerer、blind judge 隔離；
- repository QA、file/symbol navigation、change-impact、implementation task；
- lexical validity 與 semantic support 分開；
- repository × generation run 作為頂層 experimental unit；
- repeated paired runs、human calibration 與 cluster-aware uncertainty。

輸出必須包含 evidence table、P0/P1/P2 roadmap、實驗可支持與不可支持的結論、YC-style decision memo、Agent portfolio assessment，以及 issue / draft PR 執行計畫。
