<div align="right">

[English](README.md) · **繁體中文**

</div>

# 錨定生成式 code wiki：機制的哪一半在做事？

生成出來的 wiki 會講一大堆關於某個 codebase 的具體事情，而其中幾乎沒有一句查得了。要讓它們可查
需要兩個部分——一個**慣例**告訴作者什麼是 anchor，一個**閘**告訴作者哪些 claim 還沒有。

**三臂把兩者分開了。慣例單獨只到約 41%，閘驅動迴圈才把它推到 100%。** 這個切分就是結論；這個
repo 其餘的部分是「怎麼量的」與「為什麼每個數字可信」。

| | **A · baseline** | **B · retrofit** | **C · 生成時錨定** |
|---|---|---|---|
| 怎麼做出來的 | 官方 pipeline，無錨定 | A 逐頁改寫，**在閘的驅動下** | 改過的 skill **冷跑**，慣例已接、**閘從未跑過** |
| anchor 數 | 0 | 486 | **590** |
| 無效 anchor | — | 0 | 2，皆循環證據 |
| **錨定率** | 0.0% | **100%** | **27.2%**（剔除它繼承的頁面後 41.3%） |
| entrypoint 覆蓋 | 30/32 | 32/32 | **32/32** |
| 頁數 · 字數 | 44 · 29,451 | 44 · 35,113 | 48 · 35,530 |
| gate | exit 2 | **exit 0** | exit 2 |
| 成本 | 未紀錄 | ~2.88M subagent tokens | **563K tokens、74 分**，且含生成 |

**arm C 寫的 anchor 比 arm B 更多，錨定率卻不到一半。差別不在努力。** arm B 每一輪都拿到一份
「哪些 claim 還沒有 anchor」的機械清單，迭代到清單歸零。arm C **從未跑過那道閘**——它自建了一個
checker，而那支**數的是「寫了幾個 anchor」，不是「還有幾條 claim 沒錨」**，所以它無從得知自己漏
了什麼。

> **慣例告訴作者「好長什麼樣」；只有閘會告訴作者「你還差在哪」。只接前者不接後者，買到的大約是
> 41% 的結果。**

## 錨定找到了 pipeline 找不到的東西

arm A 通過了官方程序的每一道閘——三個 review subagent、零壞鏈、`status: success`——而它含有
**53 句與源碼矛盾的敘述**。pipeline 裡沒有任何一步會把一個句子拿去跟它描述的檔案對質，所以那類
缺陷**在它的量程之外**，而不是被它漏掉。

其中一個誤數已經傳染到**十頁**，進了 frontmatter、章節標題、以及一張 mermaid 圖。**十頁一致不是
十份證據，是一份重複了十次。**

arm C 冷跑、獨立地又找到**七個**前兩臂都沒記到的缺陷——包含一份 22 條的 gate 清單對上一個期待
23 條的相容性守衛，**代表這個 repo 的快路徑無法接受它自己的 gate 產出的任何 receipt**。

## 它對讀者有幫助嗎？

一次盲測 holdout，**只跑一次**：30 題由禁止閱讀任何 wiki 的出題者從源碼寫出，由禁止閱讀源碼的
agent 作答，再由看不到來源標籤、也碰不到總分的判官評分。

| | arm A | arm B |
|---|---|---|
| PASS | 9/30（30.0%） | **13/30（43.3%）** |
| PASS + PARTIAL | 50.0% | **66.7%** |
| 回答「wiki 沒寫這個」 | 12 | **6** |

最清楚的單一案例：某題上，不知道自己在評哪一臂的判官把 arm A 的答案判為
*"confidently wrong"*——它宣稱某腳本在某 gate 清單裡，而該腳本自己的源碼註解寫著它**被刻意排除**。
那句話正是 53 個更正之一。**從「一句假話被移除」到「agent 不再自信地答錯」的鏈，在這裡是被觀察到
的，不是推論的。**

**有一題變差了。** 錨定後的改寫丟掉了原版提到的一個分支。**把句子改寫成可查的，可能丟掉某個原本
就是真的東西。**

**arm C 沒有 QA 數字。** holdout 已經用在 A 對 B 的比較上，在第三臂上重跑會讓那個數字失去意義。
[`qa/`](qa/) 裡保留的 30 題 public 就是為此存在的，**尚未動用**。

## 這裡有什麼

| 路徑 | 內容 |
|---|---|
| [`LICENSE`](LICENSE) | MIT。wiki 描述的是第三方 repo，授權涵蓋的是本 repo 自己的產出 |
| [`THRESHOLDS.md`](THRESHOLDS.zh-TW.md) | 六條門檻，以及在任何數字存在**之前**固定它們的那個 commit |
| [`METHOD.md`](METHOD.zh-TW.md) | 三臂各自怎麼做出來的、哪些 model 被釘死、單靠這裡重現不了什麼 |
| [`STAGES.md`](STAGES.zh-TW.md) | 造成差異的推理階段，以及沒人預料到的那幾件事 |
| [`FINDINGS.md`](FINDINGS.zh-TW.md) | 錯誤主張與各自的源碼反證，以及每個結果准許與不准許什麼結論 |
| [`wiki/arm-a-baseline/`](wiki/arm-a-baseline/) | 官方 pipeline 的產出，未修改 |
| [`wiki/arm-b-retrofit/`](wiki/arm-b-retrofit/) | arm A 經閘驅動的錨定 pass 之後 |
| [`wiki/arm-c-generated/`](wiki/arm-c-generated/) | 改過的 skill 冷跑，生成當下就錨定 |
| [`harness/`](harness/) | gate、engine wrapper、circuit breaker、派工 packet、作者側附錄，以及證明 gate 不是空殼的 fixture |
| [`qa/`](qa/) | 60 題題庫、public/holdout 切分、逐題判定 |
| [`data/`](data/) | 錯誤主張清單、各臂稽核、arm C 的逐頁 receipt、以及形塑設計的那份前科 |

## 什麼是 anchor

```
(src: scripts/git_gate.py `lineage manifest must be staged`)
```

一個 repo 相對路徑，加上一段**從該檔複製出來**的子字串，以字面比對驗證。**刻意不帶行號**：官方
提示詞要求 *"prefer stable paths and symbol names over line numbers"*，而它是對的——行號在下一個
commit 就過期，逐字引文才是證據本體。

作者側規則（包含為何 rationale 豁免、改標 `(inferred)`）在
[`harness/anchor-extension.md`](harness/anchor-extension.md)。它是**附錄**：**沒有動過任何一個官方
提示詞的位元組**。

## 跑這道 gate

```sh
bun run harness/audit_wiki.ts wiki/arm-c-generated <target-repo>   # exit 0 全綠，2 未達門檻
sh harness/selftest.sh                                             # gate 必須抓得到 hollow anchor
```

**最該先讀的是 `selftest.sh`。** 一個分不出 *hollow* anchor——路徑真實、引文卻不在該檔裡——與真
anchor 的 verifier 就是空殼，它印出來的每個數字都只是裝飾。那份 fixture 斷言的是**失敗理由**。

arm C 獨立得到了同一個結論：它的 notes 記載 checker 必須比較 `(src:` 出現次數與 regex 匹配數，
**否則畸形 anchor 會靜默消失**。它從未看過那個發現。**這是這個錨形本身的性質，不是一次性 bug。**

## 限制，寫在前面不寫在最後

- **arm A 與 arm C 不是乾淨的單變因對照。** arm A 出自更早的 session 與不同世代的 model。
  在 arm C 的條件下**沒有觀察到覆蓋擠壓**，這不等於那份前科被推翻。
- **靶是合成的。** 由同一套系統生成又由它文檔化，沒有有機 git 歷史。在真實 repo 上跑過之前不外推。
- **arm C 沒有 QA 量測**，而 holdout 不可重用。
- **題庫是模型寫的。** 四個只讀源碼的 agent 產出，人類沒有逐題稽核。
- **`n = 30`，只跑一次。** 方向性的，不是結論。
- **作者端 model 沒有釘死。** 只有 QA 層有 provenance。見 [`METHOD.md`](METHOD.zh-TW.md#models)。

路徑已脫敏：`<target-repo>`、`<host-repo>`、`<sandbox>`、`<home>`。

## 關於什麼**沒有**被改寫

wiki 內文含有指向「生成該靶的那個 repo」的相對路徑引用。它們在各臂中完全相同、是被研究的
artifact 的一部分，改寫會竄改被量測的對象並讓 diff 失真。**機器特定的路徑**已替換；**wiki 自己在
文檔化的內部目錄名**維持 pipeline 寫出來的原樣。
