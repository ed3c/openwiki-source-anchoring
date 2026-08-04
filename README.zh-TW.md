<div align="right">

[English](README.md) · **繁體中文**

</div>

# Source anchoring：生成式 code wiki 能不能變得可證偽，變了有沒有用？

生成出來的 wiki 會講一大堆關於某個 codebase 的具體事情，而其中幾乎沒有一句查得了。這個 repo 放
的是一組 before/after、把兩者分開的那道機械 gate，以及一次盲測——量的是這個差異對讀 wiki 的
agent 到底有沒有意義。

起點是一份 44 頁的 wiki，由 [langchain-ai/openwiki](https://github.com/langchain-ai/openwiki)
`code`-mode pipeline 的 host-native port 產出，**NO API KEY**：官方提示詞與官方三個 review
subagent（`skeleton_critic`、`wiki_question_finder`、`wiki_answer_verifier`）都在 CLI 訂閱
session 內執行，不經由上游 binary。那份 wiki 通過了官方全部三道閘：零壞鏈、零半成品頁、
`status: success`。

它同時含有 **53 句與源碼矛盾的敘述**，而 pipeline 的任何一環都不可能發現——因為裡面沒有任何
一步會把一個句子拿去跟它描述的那個檔案對質。

兩份 wiki 的完整製作程序在 [`METHOD.md`](METHOD.zh-TW.md)。

## 結果

| | baseline | anchored | |
|---|---|---|---|
| 帶可查證據的 claim | 0 / 233 | **233 / 233** | |
| anchor 數 | 0 | **486**，零無效 | |
| 有 gate 語義的 entrypoint 被寫到 | 30 / 32 | **32 / 32** | |
| 與源碼矛盾的敘述 | **無從得知** | 找出並更正 53 句 | |
| 盲測 QA holdout，PASS | **30.0%** | **43.3%** | +13.3pp |
| 回答「wiki 沒寫這個」 | 12 / 30 | **6 / 30** | 腰斬 |
| 字數 | 29,451 | 35,113 | +19.2% |

QA holdout **只跑一次**，30 題由禁止閱讀任何 wiki 的出題者從源碼寫出，由禁止閱讀源碼的 agent
作答，再由看不到來源標籤、也碰不到總分的判官盲判。全部在 [`qa/`](qa/)。

**有一題變差了**：錨定後的改寫丟掉了原版有提到的一個分支。錨定會改寫句子，改寫就可能丟訊息。
這是方法的代價，如實記錄，不粉飾。

## 這裡有什麼

| 路徑 | 內容 |
|---|---|
| [`LICENSE`](LICENSE) | MIT。wiki 描述的是第三方 repo,授權涵蓋的是本 repo 自己的產出 |
| [`THRESHOLDS.md`](THRESHOLDS.zh-TW.md) | 六條門檻,以及在任何數字存在**之前**固定它們的那個 commit |
| [`METHOD.md`](METHOD.zh-TW.md) | 兩臂各自怎麼做出來的：提示詞完整性、三個隔離的 review subagent、錨定各輪、哪些 model 被釘死 |
| [`STAGES.md`](STAGES.zh-TW.md) | 造成差異的推理階段、每階段的代價，以及四件沒人預料到的事 |
| [`FINDINGS.md`](FINDINGS.zh-TW.md) | 53 句錯誤主張與各自的源碼反證，以及 QA 結果准許與不准許的結論 |
| [`wiki/baseline/`](wiki/baseline/) | 官方 pipeline 產出的原始 44 頁 |
| [`wiki/candidate/`](wiki/candidate/) | 同一份 wiki 經錨定 pass 之後 |
| [`harness/`](harness/) | gate、它的 engine wrapper、circuit breaker、它派工用的三類 context packet、作者側附錄，以及證明 gate 不是空殼的 fixture |
| [`qa/`](qa/) | 60 題題庫、public/holdout 切分、逐題判定 |
| [`data/`](data/) | 錯誤主張清單、逐頁 anchor 數，以及約束了整個設計的那份實測前科 |

## 什麼是 anchor

```
(src: scripts/git_gate.py `lineage manifest must be staged`)
```

一個 repo 相對路徑，加上一段**從該檔複製出來**的子字串，以字面比對驗證。**刻意不帶行號**：官方
提示詞要求 *"prefer stable paths and symbol names over line numbers"*，而且它是對的——行號在下
一個 commit 就過期，逐字引文才是證據本體。

設計理由（包含為何 rationale 句子被豁免、改標 `(inferred)`）在
[`harness/anchor-extension.md`](harness/anchor-extension.md)。它是**附錄**：**沒有動過任何一個
官方提示詞的位元組**。

## 跑這道 gate

```sh
bun run harness/audit_wiki.ts wiki/candidate <target-repo>   # exit 0 全綠，2 未達門檻
sh harness/selftest.sh                                       # gate 必須抓得到 hollow anchor
```

**最該先讀的是 `selftest.sh`。** 一個分不出 *hollow* anchor——路徑真實、引文卻不在該檔裡——與真
anchor 的 verifier 就是空殼，它印出來的每個數字都只是裝飾。那份 fixture 斷言的是**失敗理由**，
不只是 exit code。

## 限制，寫在前面不寫在最後

- **單臂。** 沒有重生（regeneration）對照組，所以這裡沒有任何東西證明「錨定既有 wiki 優於重新
  生成一份」。
- **靶是合成的。** 它是由同一套系統生成、又由同一套系統文檔化的 repo，沒有有機的 git 歷史。在
  真實 repo（十年 commit、死代碼、三種語言）上跑過之前，這裡的結論不外推。
- **題庫是模型寫的。** 60 題與其驗收標準由四個只讀源碼的 agent 產出，人類沒有逐題稽核。
- **`n = 30`，只跑一次。** 方向性的，不是結論。
- **「生成當下就錨定」那個版本從未被跑過。** skill 現在在生成步驟引用了錨定附錄，但那條路徑一次
  都沒執行。這裡的一切都是對已完成頁面的 retrofit，而 retrofit **結構上不可能**發生前科警告的
  覆蓋擠壓——所以這個結果**不轉移**到「生成時就開錨定」產出的 wiki。見
  [`METHOD.md`](METHOD.zh-TW.md#arm-c--這個-repo-不包含的那個配置)。
- **作者端 model 沒有釘死。** 只有 QA 層有 model provenance；page agent 繼承 session model。
  見 [`METHOD.md`](METHOD.zh-TW.md#models)。

路徑已脫敏：`<target-repo>`、`<host-repo>`、`<sandbox>`、`<home>`。

## 關於什麼**沒有**被改寫

wiki 內文含有指向「生成該靶的那個 repo」的相對路徑引用（`loop_wiki/...`）。它們在兩臂中完全相
同、是被研究的 artifact 的一部分，改寫它們會竄改被量測的對象並讓 diff 失真。**機器特定的路徑**
——家目錄、使用者名、絕對位置——已替換；**wiki 自己在文檔化的內部目錄名**維持 pipeline 寫出來
的原樣。
