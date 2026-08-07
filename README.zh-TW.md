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
- 將同一份內容中的 citation spans 移除後，aggregate PASS 仍是 **12/30**；但引文內容也一起被刪除，而且其他 outcomes 有變動。
- 這個相同結果**不能證明兩者等效**；目前只有 `n = 30`、單次 stochastic run、沒有 repeats。
- Mechanical gate 驗證的是 **lexical validity**：路徑存在，而且引文確實出現在該檔案；它不能證明引文支持旁邊的 claim。

## 公開結果

| Arm | 流程 | Anchors | 已錨 / claim blocks | Anchor rate | QA PASS | PASS + PARTIAL |
|---|---|---:|---:|---:|---:|---:|
| A | 官方 baseline pipeline | 0 | 0 / 156 | 0% | 7/30 | 17/30 |
| B | 事後 retrofit verification + gate | 312 | 152 / 152 | 100% | 12/30 | 20/30 |
| Bs | 移除 B 的 citation spans | 0 | 0 / 154 | 0% | 12/30 | 17/30 |
| C | Fresh authoring、無 gate——一次 generation | 590 | 64 / 155 | 41.3% | 14/30 | 26/30 |
| D | Fresh authoring、有 gate——另一次 generation | 1,053 | 119 / 119 | 100% | 未量測 | 未量測 |

Anchor rate 使用 `--exclude nonofficial`。`nonofficial/` 會隨每個 arm 一起交付，但不是被測 pipeline 生成的內容。完整 target-dependent audit 會由 [`harness/src/audit_arms.ts`](harness/src/audit_arms.ts) 對 [`repo-snapshot/`](repo-snapshot/) 重算。

### 量測修正：分母也移動了

C 與 D 不是只差一個變因。兩者是各自獨立的 cold-start generations，只重疊 **10 條 page paths**，建立了大幅不同的 page sets，而且 target copies 有兩個 source files 不同。觀察到的 `41.3% → 100%` 同時移動分子與分母：

```text
C = 64 / 155
D = 119 / 119
```

固定使用 C 的分母，D 是 `119/155 = 76.8%`。58.7 個百分點的表面差距中，約 **23.2 點**、也就是約 **40%**，來自被算成 claim 的 blocks 變少，而不是新增的 anchored blocks。D 並沒有變窄：量測頁字數更多、指名更多 source files，entrypoint coverage 也相同。下降的是 claim density，從每千字 **5.93** 變 **4.35**。

完整重測、marker stripping 的限制、成本邊界與第二種 metric 見 [`docs/DENOMINATOR_AND_CONFOUNDING_REVIEW.zh-TW.md`](docs/DENOMINATOR_AND_CONFOUNDING_REVIEW.zh-TW.md)。

## 證據支持與不支持的結論

**目前支持的 observation**

- A → B 的方向有利，值得 replication。
- B 與 Bs 在一次 run 的 aggregate PASS 相同，但 individual verdict 與其他 aggregate outcomes 並不完全相同。
- B 與 D 在各自產生的 claim denominator 上達到 100% anchor rate。
- 在這些 runs 中，anchor rate 比較像 process metric，不是 reader-quality metric。
- 嘗試建立 anchors 時，找到了原始 pipeline checks 沒有測到的 contradictions。
- Vendored target 與 pinned arm baseline 讓 CI 能真正重跑公開 arms，而不是只檢查目錄存在。

**目前未建立的結論**

- Citation markers 的 causal effect 等於零。
- C → D 的差距由 gate 單獨造成；page selection、authoring session 與 metric denominator 都同時改變。
- `100%` anchor rate 能建立 semantic correctness 或 evidentiary correctness。
- 公開的 token 差距能識別 verification 或 gate 的成本。
- 根據四個 single-run arms 宣稱 anchor rate 與 reader quality 正相關或負相關。
- 結果可泛化到 organic repositories、其他 models 或 repeated generations。

下一個 causal design 應比較 retrofit／fresh authoring 與 gate／no gate 的 factorial cells。見 [`experiments/factorial-v1/PROTOCOL.md`](experiments/factorial-v1/PROTOCOL.md) 與 [`docs/NEXT_EXPERIMENT.md`](docs/NEXT_EXPERIMENT.md)。

## 執行 verifier

需求：

- Bun **1.3.13**，固定於 [`.bun-version`](.bun-version)
- POSIX shell

```sh
sh harness/selftest.sh
bun run harness/src/audit_arms.ts
bun run harness/src/check_published_arms.ts
sh reproduction/recompute.sh
```

預期結果包含：

```text
selftest: PASS(...)
PASS: all published arms reproduce their pinned target-dependent measurements.
PASS: target-independent arm figures and denominators match the published data.
reproduction: PASS (protocol, fixtures, and receipts match)
```

直接 audit 一個 wiki：

```sh
bun run harness/src/audit_wiki.ts \
  wiki/arm-d-gate-driven \
  repo-snapshot \
  --exclude nonofficial
```

執行較不依賴 block denominator 的第二種讀法：

```sh
bun run harness/src/audit_anchor_invariant.ts \
  wiki/arm-c-generated repo-snapshot --exclude nonofficial
```

CI 會在 clean Ubuntu runner 上，用固定的 Action revisions 與 Bun version 執行 public self-test、完整 arm audit、denominator/density check、invariant-metric parity 與 adversarial negative controls。

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
| 公開 arm audit | 由 `audit_arms.ts` 對 vendored target 在 CI 重算 |
| Deterministic bundle | 由 `reproduction/recompute.sh` 重算 |
| Reusable | 部分；verifier、target snapshot、fixtures 與 execution infrastructure 公開 |
| Generation reproducible | 否；原始 authoring pipeline 與 exact model execution 未完整固定 |
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
| [`docs/DENOMINATOR_AND_CONFOUNDING_REVIEW.zh-TW.md`](docs/DENOMINATOR_AND_CONFOUNDING_REVIEW.zh-TW.md) | 取代 gate-only 歸因的重測 |
| [`STAGES.md`](STAGES.md) | Measurement failures 與修正歷程 |
| [`THRESHOLDS.md`](THRESHOLDS.md) | Mechanical thresholds 與 provenance |
| [`harness/`](harness/) | Auditor、retry loop、fixtures 與 self-test |
| [`repo-snapshot/`](repo-snapshot/) | 用於 audit 公開 arms 的去識別 target snapshot |
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
- 沒有 repeated production generations、equivalence result 或 inter-rater agreement estimate。
- Target repository 是 synthetic。
- 原始 authoring model 與完整 execution environment 沒有精確固定。
- 53 個 author-reported corrections 中只有 22 個接受 blind adjudication；inventory 是下限，不保證完整。
- 歷史 threshold-freezing commit 位於此公開 repository 之外。
- Legacy claim denominator 是 heuristic，會隨 parser rules 與 authoring structure 移動。
- Alternative invariant metric 是第二種讀法，仍有未封閉的 gaming channels，不是真值替代品。
- Lexical validity 不等於 semantic correctness。

目前結果應被視為 **directional evidence 與 replication 邀請**，不是已確立的 causal conclusion。
