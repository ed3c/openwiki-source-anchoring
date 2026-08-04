# PROMPT.md — evolve-repo-wiki-converge-anchor 目標規範合約(判定式先於 run 落檔,不得事後改)

> ⬒ canonical 權威指針:形態同構本地 `<host-repo>/loop_demo/claude_agy/PROMPT.md`。
> 本檔=**確定性契約**(目標/成功判準/邊界),不是散文 know-why——散文型 domain 知識放沙盒 CLAUDE.md,
> 狀態與決策帳落 PLAN.md。本檔由 run.sh 以「祈使任務綁 target」形式 append 給 driver,不單獨餵全文。
> 三類提示詞的角色分工(依 `loop-harness-standard/modules/production-seed-loop.md`):
> 本檔＋`anchor-extension.md`＝**fixed_prompt_context**;
> `_engine-run/exchange-context.<packet_id>.md`＝**iteration_auto_context**(每次派工重生);
> `anti/*.md`＋packet 的 `emergent_prompt_context` 欄＝**emergent_prompt_context**。

## Op(一沙盒一 op)
- 類型:refine(對既有 wiki 做錨定 update pass,非重生)
- target:`candidate/`(baseline 快照的可寫副本)。**禁動** `<target-repo>/openwiki`
- 依據:`PLAN.md` 凍結門檻 + `anti/2026-08-04-anchoring-squeezes-breadth.md`

## 任務(每次派工只做一頁)

對 packet 指名的那一頁,把 `iteration_auto_context` 列出的**未錨 claim** 逐條補上源碼錨:

```
(src: <repo 相對路徑> `<該檔中的逐字子串>`)
```

- 引文**必須從檔案複製**,逐字比對;改寫、重打、近似符號名一律 FAIL。
- 錨放在**做出該主張的那個句子裡**,不放腳註或末尾來源清單——脫離主張的錨什麼都沒證明。
- 錨**不帶行號**(官方 `init.system.md` 要求 prefer stable paths over line numbers)。
- 錨不到的主張:**標 `(inferred)` 保留,禁刪句、禁刪頁**。
- **禁錨進 `.openwiki-review/`** —— 那是本 wiki 自己的生成逐字稿,錨到那裡＝循環證據。
- 每頁只改該頁,不動其他頁、不動 `src/`、不動 `verify.sh`。

## Success Criteria(=verify.sh 的 T0 閘,機械可判,不可另立)

- [ ] `sh verify.sh candidate` exit 0,即四條同時成立:
      錨定率 ≥85% ∧ 錨正確率 100% ∧ entrypoint 覆蓋 ≥30/32 ∧ 可驗佔比 ≥40%
- [ ] 該頁 `unanchored_claims` 清空
- [ ] 該頁字數**不得低於** baseline 同頁(禁用刪內容換分數)
- 畢業段(T0 過後,非本沙盒):QA holdout 只跑一次 + Opus fresh 判官

## Guard-Metric(防 Goodhart)

- **禁動**:`src/audit_wiki.ts`、`verify.sh`、`selftest.sh`、`baselines/`、本檔(改判定式＝作弊,一票否決)。
- **禁刪頁、禁刪句換錨定率**:刪掉錨不到的內容會讓分母變小、錨定率**反而上升**,同時覆蓋率下降。
  熔斷的正解是降級標記,不是消失。
- **錨定率與覆蓋率必須同時看**:前者升而後者降 = `anti/` 的擠壓前科正在重演。

## stop-loss(由 trigger.sh 執行,本檔只 pin 數值)

- 單頁 retry 上限 **k=3**;耗盡 → 該頁降級(未錨 claim 標 `(inferred)`,
  frontmatter 記 `anchor_status: degraded`,寫進 `candidate/.unresolved.json`),**不 rollback、不刪頁**。
- 全局:降級頁 **>5** → 整輪中止交人(期望降級數 ≈0.4 頁,>5 代表系統性問題,續跑無資訊價值)。
- no-progress N=2 → SURFACE 交人,不自續。

## Verifier 指派(driver 不需知道——內容在 PLAN.md「§ 迴圈治理事實」)
