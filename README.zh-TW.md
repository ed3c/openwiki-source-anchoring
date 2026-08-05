<div align="right">

[English](README.md) · **繁體中文**

</div>

# OpenWiki Source Anchoring

一個 evidence-first 實驗：研究如何讓 AI 生成的程式碼文件更容易被驗證。

這個 repository 聚焦一個明確問題：

> 當生成文件被要求引用原始碼路徑與逐字引文時，觀察到的改善有多少來自「查證原始碼的過程」，有多少來自讀者看得到的 citation markers？

目前定位是 **具備可執行 harness 的 research artifact**，不是成熟產品，也不是通用的 Agent 招募 benchmark。

## 十秒結論

- 在一次 public run 中，事後加入 source verification，QA PASS 從 **7/30 提升到 12/30**。
- 將同一份內容中的可見 citation markers 移除後，aggregate PASS 仍是 **12/30**。
- 這個相同結果**不能證明兩者等效**；目前只有 `n = 30`、單次 stochastic run、沒有 repeats。
- Mechanical gate 驗證的是 **lexical validity**：路徑存在，而且引文確實出現在該檔案；它不能證明引文支持旁邊的 claim。

## 公開結果

| Arm | 流程 | Anchors | Anchor rate | QA PASS | PASS + PARTIAL |
|---|---|---:|---:|---:|---:|
| A | 官方 baseline pipeline | 0 | 0% | 7/30 | 17/30 |
| B | 事後 retrofit verification + gate | 312 | 100% | 12/30 | 20/30 |
| Bs | 保留 B 的內容、移除 markers | 0 | 0% | 12/30 | 17/30 |
| C | Fresh authoring 時查證、無 gate | 590 | 41.3% | 14/30 | 26/30 |
| D | Fresh authoring 時查證、有 gate | 1,053 | 100% | 未量測 | 未量測 |

Anchor rate 使用 `--exclude nonofficial`。`nonofficial/` 會隨每個 arm 一起交付，但不是被測 pipeline 生成的內容。衍生數字可由 [`data/arm-comparison.json`](data/arm-comparison.json) 重新計算。

## 證據支持與不支持的結論

**目前支持的 observation**

- A → B 的方向有利，值得 replication。
- B 與 Bs 在一次 run 的 aggregate PASS 相同，但 individual verdict 並不完全相同。
- 在這些 runs 中，anchor rate 比較像 process metric，不是 reader-quality metric。
- 嘗試建立 anchors 時，找到了原始 pipeline checks 沒有測到的 contradictions。
- Gate 可以在公開 fixture 上把目前的 lexical metrics 推到門檻。

**目前未建立的結論**

- Citation markers 的 causal effect 等於零。
- Fresh authoring 的改善是由 gate 單獨造成；B 與 C 同時存在多個差異。
- Quote matching 能建立 semantic correctness 或 evidentiary correctness。
- 結果可泛化到 organic repositories、其他 models 或 repeated generations。

下一個 causal design 應比較 retrofit／fresh authoring 與 gate／no gate 的 factorial cells。見 [`docs/NEXT_EXPERIMENT.md`](docs/NEXT_EXPERIMENT.md)。

## 執行 verifier

需求：

- Bun **1.3.13**，固定於 [`.bun-version`](.bun-version)
- POSIX shell

```sh
sh harness/selftest.sh
```

預期輸出：

```text
selftest: PASS(...)
```

對 target repository 執行 audit：

```sh
bun run harness/src/audit_wiki.ts \
  wiki/arm-d-gate-driven \
  /path/to/target-repository \
  --exclude nonofficial
```

Self-test 包含 valid、hollow、malformed、degraded 與 circuit-breaker 的正負控制。CI 會在 clean Ubuntu runner 上，用固定的 Action revisions 與 Bun version 執行相同測試。

## Gate 真正證明什麼

Anchor 格式：

```text
(src: scripts/git_gate.py `lineage manifest must be staged`)
```

Harness 會檢查：

1. anchor syntax 是否正確；
2. path 是否留在 target repository 內；
3. referenced file 是否存在；
4. quote 是否逐字出現在該檔案；
5. measured claim、coverage 與 verifiable-share thresholds 是否通過。

Harness **不會**執行 claim segmentation、claim-to-anchor entailment 或 semantic adjudication。請一致使用以下名詞：

| 名詞 | 定義 |
|---|---|
| Path validity | Referenced file 可安全解析於 target repository 內 |
| Lexical validity | Quote 逐字存在於 referenced file |
| Semantic support | Evidence 支持旁邊的 claim |
| Human adjudication | 獨立 reviewers 對 claim 與 evidence 達成一致 |

詳見 [`METRICS.md`](METRICS.md) 與 [`EXPERIMENT_REVIEW.md`](EXPERIMENT_REVIEW.md)。

## Reproducibility 狀態

| 分類 | 狀態 |
|---|---|
| Available | 是 |
| Licensed | 是，MIT |
| Harness functional | 由 CI 執行 `harness/selftest.sh` |
| Reusable | 部分；verifier 與 fixtures 公開 |
| Generation reproducible | 否；原始 target 與 host pipeline 未完整公開 |
| Adjudication reproducible | 部分；verdict files 公開，但完整 model environment 未固定 |
| Independently reproduced | 尚未 |

完整限制見 [`METHOD.md`](METHOD.md)、[`THRESHOLDS.md`](THRESHOLDS.md) 與 [`REPRODUCE.md`](REPRODUCE.md)。

## Agent portfolio evidence

Repository 將能力主張與驗證證據分開：

- [`PROJECT_EVIDENCE.yaml`](PROJECT_EVIDENCE.yaml)：machine-readable claim-to-evidence manifest
- [`AUTHORSHIP.md`](AUTHORSHIP.md)：human decisions 與 agent-assisted work
- [`REVIEWER_GUIDE.md`](REVIEWER_GUIDE.md)：十分鐘獨立審查流程
- [`docs/AGENT_REVIEW_PROMPT.md`](docs/AGENT_REVIEW_PROMPT.md)：可重複使用的 multi-role review protocol

建議使用以下 evaluation chain：

```text
skill claim → repository evidence → verification command → observed result → limitation
```

Stars、commit 數量與生成文字長度不應作為主要能力證據。

## Repository map

| Path | 用途 |
|---|---|
| [`METHOD.md`](METHOD.md) | Experiment procedure 與 provenance limits |
| [`FINDINGS.md`](FINDINGS.md) | Contradiction inventory 與 adjudication notes |
| [`STAGES.md`](STAGES.md) | Measurement failures 與修正歷程 |
| [`THRESHOLDS.md`](THRESHOLDS.md) | Mechanical thresholds 與 provenance |
| [`harness/`](harness/) | Auditor、retry loop、fixtures 與 self-test |
| [`qa/`](qa/) | Question bank、splits 與 per-question verdicts |
| [`data/`](data/) | Audit receipts 與 derived comparisons |
| [`wiki/`](wiki/) | Arms A、B、Bs、C、D 的公開 outputs |

## 貢獻與安全性

提交 change 前請閱讀：

- [`CONTRIBUTING.md`](CONTRIBUTING.md)
- [`SECURITY.md`](SECURITY.md)
- [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md)
- [`GOVERNANCE.md`](GOVERNANCE.md)

Contribution 應包含 falsifiable claim、verification command、expected result，以及適用時的 negative control。

## 主要限制

- `n = 30`，每個公開比較只有一次 generation 與一次 judge run。
- 沒有 repeated generations、equivalence margin 或 inter-rater agreement estimate。
- Target repository 是 synthetic。
- Authoring model 與完整 execution environment 沒有精確固定。
- 53 個 author-reported corrections 中只有 22 個接受 blind adjudication。
- Threshold-freezing commit 位於此公開 repository 之外。
- Auditor 的 claim denominator 是 heuristic；parser 改變時 rate 也會改變。
- Lexical validity 不等於 semantic correctness。

目前結果應被視為 **directional evidence 與 replication 邀請**，不是已確立的 causal conclusion。
