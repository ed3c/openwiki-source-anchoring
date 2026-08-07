# 分母與混淆變因重測

本文件保留 PR #22 在 rebase 到目前 `main` 之後仍成立的部分。舊敘事中，凡是把 C → D 的差距單獨歸因於 gate，或把 B → Bs 當成純粹移除 marker 的比較，都由本文件取代。

目前 repository 已將匹配的去識別 target 收進 [`repo-snapshot/`](../repo-snapshot/)，並由 [`harness/src/audit_arms.ts`](../harness/src/audit_arms.ts) 完整重跑五個 arms。PR #22 的較早版本曾說公開 arms 無法完整 re-audit，並報告 1／7／5 個 invalid anchors；那是在 `d337774` 與 `df2f360` 加入匹配 target、修正 publication transformation 之前得到的結果，現在已不成立，因此沒有合併。

## 1. 41.3% → 100% 同時移動分子與分母

Legacy anchor rate 定義為：

```text
已錨 claim blocks / 所有符合 heuristic 的 claim blocks
```

兩個 fresh-authoring arms：

| Arm | 已錨 | Claim blocks | Anchor rate | 每千字 claim blocks |
|---|---:|---:|---:|---:|
| C — fresh、無 gate | 64 | 155 | 41.3% | 5.93 |
| D — fresh、有 gate | 119 | 119 | 100.0% | 4.35 |

固定使用 arm C 的分母，arm D 會是：

```text
119 / 155 = 76.8%
```

58.7 個百分點的表面差距中：

- 約 **35.5 點**來自更多 blocks 被錨定；
- 約 **23.2 點**，也就是約 **40% 的差距**，來自被算成 claim 的 blocks 變少。

這不代表 arm D 的涵蓋變窄。量測集內 arm D 字數更多，`27,357` 對 `26,159`；指名的相異 source files 更多，`114` 對 `107`；entrypoint coverage 同為 `32/32`。改變的是顆粒度：較少 headings 與 table rows 被分別計成 claim blocks。

執行：

```sh
bun run harness/src/check_published_arms.ts
```

輸出會把分子、分母、rate 與 claim density 放在一起，避免分母移動藏在百分比裡。

## 2. C 與 D 不是乾淨的 gate 對照

Arm D 不是 arm C 只切換一個開關。

- 量測集分別有 35 與 37 頁，但只重疊 **10 條 page paths**。
- Arm D 建立了 arm C 沒有的 `ci/`、`evaluation/`、`skills/`、`wiki/` sections。
- Arm C 也建立了 arm D 沒有的其他 sections。
- 兩者是獨立 cold-start authoring sessions。
- Target copies 有兩個 source files 不同；雖然各自對自己的 copy 重跑不會改變公開 counts，但「target 完全相同」仍不成立。

Gate pressure、session-level writing variation、page selection，以及 treatment 移動自身分母的能力因此同時變動。現有資料中沒有任何一對 arms 能單獨識別 gate effect。

真正的 separating design 已固定在 [`experiments/factorial-v1/PROTOCOL.md`](../experiments/factorial-v1/PROTOCOL.md)：同一 pinned target 上的 R0/R1 與 G0/G1、repeated independent runs、blinded evaluation。該實驗尚未執行。

## 3. 不刪字也能操縱 legacy denominator

一個 block 只要含有反引號包住的 code-file reference，就會成為 metric-shaped claim。只移除 arm C 所有未錨 filename 外面的反引號，其他文字與 word count 不變、不新增任何 anchor，legacy rate 就會從 **41.3% 變成 100%**，因為那些 blocks 從分母消失。

Word-floor control 抓不到這件事，因為沒有刪除任何 words。

因此 anchor rate 只能作為 process diagnostic，而且必須同時報告 numerator、denominator，並將 claim inventory 固定在被評分文本之外。

## 4. 第二種讀法

[`harness/src/audit_anchor_invariant.ts`](../harness/src/audit_anchor_invariant.ts) 使用以下單位：

```text
(page, 該頁任何位置指名的 source file)
```

這個單位不依賴 Markdown block boundaries、table pipes、headings 或 backticks，因此拿掉 filename 的反引號、合併 paragraphs 都不會刪除單位。

固定結果：

| Arm | Covered pairs | Named pairs | Rate |
|---|---:|---:|---:|
| C | 90 | 211 | 42.7% |
| D | 125 | 209 | 59.8% |

兩個 denominators 只差約 1%，而不是 legacy metric 的 23%。

這是**第二種讀法，不是真值**。它仍有未封閉的 gaming channels，例如只提到檔案但 evidence 很弱，以及合併 pages。CI 會同時固定它的 legacy-parity block 與目前 C/D output，日後若移動必須提出原因。

## 5. B → Bs 不是 marker-only intervention

B 與 Bs 在一次 run 的 aggregate PASS 都是 `12/30`，這不能建立 equivalence。

移除 `(src: path `quote`)` 時，引文內容也會一起消失，不只是可見 marker。量測集內 stripped arm 約少 1,814 words，claim-block denominator 從 152 變 154，entrypoint coverage 從 `32/32` 變 `31/32`。PASS+PARTIAL 也從 20/30 變 17/30，而 unanswerable count 從 6 變 5。

乾淨的 marker experiment 應保留 quote 作為普通 prose，只移除 citation presentation，再以預先固定的 equivalence margin 重複 answer generations。

## 6. 成本歸因尚未識別

公開的 `2.88M`、`563K`、`590K` token figures 沒有共同且完整記載的 accounting basis，repository 也沒有三者完整的 cost receipts。C 與 D 的 27K 差距是兩個 sessions 的差，不是已識別的 gate cost。

要建立成本主張，必須先統一 accounting definition、保存完整 receipts，並在固定 authoring mode、target、model、page plan 與 execution structure 的條件下只改變 gate。

## 7. 可使用與不可使用的說法

可使用：

- Arm C 是 `64/155`；arm D 是 `119/119`。
- Arm D 錨定更多 blocks，同時寫出更少 metric-shaped claim blocks。
- C 與 D 是不同 generations，不能識別 gate effect。
- B 與 Bs 曾在 aggregate PASS 相同，但其他 outcomes 與 stripped content 不同。
- Anchor rate 是 process metric，而且 denominator 會隨 authoring style 移動。

不可使用：

- 「Gate 解釋了 41% 到 100% 的差距。」
- 「Gate 的成本是 27K tokens。」
- 「Markers 完全沒有作用。」
- 根據四個 single-run arms 宣稱 anchor rate 與 reader quality 正相關或負相關。
- 「100% 代表 semantic correctness。」

## 驗證

```sh
sh harness/selftest.sh
bun run harness/src/audit_arms.ts
bun run harness/src/check_published_arms.ts
bun run harness/src/audit_anchor_invariant.ts \
  wiki/arm-c-generated repo-snapshot --exclude nonofficial
bun run harness/src/audit_anchor_invariant.ts \
  wiki/arm-d-gate-driven repo-snapshot --exclude nonofficial
sh reproduction/recompute.sh
```
