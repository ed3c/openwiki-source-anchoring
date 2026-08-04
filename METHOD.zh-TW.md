<div align="right">

[English](METHOD.md) · **繁體中文**

</div>

# 兩臂各自是怎麼做出來的

兩份 wiki 文檔化的是同一個 repo 的同一個 commit。只有第二份被錨定過。

---

## 這條 pipeline 從哪來

整條工作線起於一道指令：

> 從 `<projects>/openwiki` 取得提示詞與使用方法，把 `kb-ingest` 與 `repo-wiki-converge` skill
> 改回官方版本的設計。研究 openwiki 的正確運用方式，並以 **NO API KEY** 遷移到 Claude Code 與
> Codex CLI 使用。

「NO API KEY」是形塑其餘一切的約束。上游 `openwiki` CLI **從未安裝**，也從未設定任何 provider
key。官方提示詞由生成器從上游 repo 逐位元組抽取，而**執行體就是 host CLI session 本身**——工程
師平常互動使用的同一個訂閱。

代價必須講明白：**這無法顯示兩份 wiki 是否像上游自己的 binary 會產出的東西。** 它只能顯示官方
*程序*在 host session 執行時會產出什麼。

---

## Arm A — baseline（`wiki/baseline/`）

### 提示詞完整性

官方提示詞不是改寫、不是摘要、也不是手抄。生成器把它們從上游源碼逐位元組抽進一個**只放上游位
元組**的目錄——七個資產，沒有任何手寫檔，連筆記都不行。`--check` 模式會重抽再 diff，所以
「提示詞文字與上游逐位元組相同」是一個**可證偽的主張**，而不是一句承諾。

這個 port 增補的東西一律放在另一個目錄當附錄，[`harness/anchor-extension.md`](harness/anchor-extension.md)
的錨定規則就是其中之一。**產出兩臂的過程中沒有動過任何官方位元組。**

曾經有一個「蒸餾版」前身，已退役：它把官方指令壓成「≤8 頁、800–1200 字」——與官方明文
（*"do not target a page count or page length"*）**方向相反**——過程中還丟掉了全部三道 review
閘。這正是為什麼提示詞完整性現在由生成器強制，而不是靠紀律。

### 生成

Session 讀 `init.system.md`、對應的 user prompt、以及本地附錄，然後逐步照官方 Init workflow：

1. 先建地圖；寫任何散文之前先寫 skeleton 檔。
2. 對組件排序；排序決定探索順序，**絕不決定某個東西要不要被覆蓋**。
3. **`skeleton_critic`** — 硬隔離子行程，**必須先獨立 map 完整個 repo，才准讀 skeleton**。在同
   一個 session 內自審行不通：已被自己的 skeleton 錨定的 session，看不見那份 skeleton 漏了什
   麼。每個回傳項開一個 TODO；critic **只准複審一次，絕不第三次**。
4. 填滿每一頁。一筆帶過或列個目錄不算覆蓋。
5. **`wiki_question_finder`** — 獨立子行程，**只讀源碼**、絕不讀 wiki，所以它出的題不可能被塑
   造成迎合「剛好寫了什麼」。
6. **`wiki_answer_verifier`** — 獨立子行程，**只讀 wiki 的快照**、絕不讀源碼，所以它不可能靠源
   碼作答再宣稱 wiki 夠用。每波 2–3 題併發送出；PARTIAL/FAIL 修完該波再重驗，且只重送未過的
   id。
7. 確定性後處理：mermaid 驗證與就地降級、目錄 index 生成、內鏈檢查（**壞鏈就地標記而非移除**）、
   以及一份 run metadata。

第 3、5、6 步的讀取邊界由**行程隔離**保證，不是靠指示。**在一個看得到某個東西的 session 裡，叫
subagent「別看」，那不是邊界。**

### 結果

44 頁。三道閘通過、零壞鏈、零半成品頁、run status success——**以及 53 句與源碼矛盾的敘述**，而
上述任何一步都偵測不到，因為沒有一步會把句子拿去跟它描述的檔案對質。

---

## Arm B — anchored（`wiki/candidate/`）

**Update，不是重生。** Arm B 起始於 arm A 的位元組副本，就地編輯。重生會丟掉一份覆蓋率 93.8%
且已過三道閘的既有資產，也會讓「錨定」與「重擲一次生成骰子」兩個變因混在一起。這條約束來自一
份實測前科：[`data/prior-anchoring-squeezes-breadth.md`](data/prior-anchoring-squeezes-breadth.md)。

### 逐頁程序

每一頁交給一個 agent，它拿到：

| 輸入 | 來源 |
|---|---|
| 該頁，且只有該頁 | 它不得編輯其他任何檔案 |
| **該頁的未錨 claim 清單** | **由 gate 產生，絕不自報** |
| 錨定契約 | [`harness/PROMPT.md`](harness/PROMPT.md) 與 [`harness/anchor-extension.md`](harness/anchor-extension.md)，**以指針傳遞** |
| 累積教訓 | 前幾輪回傳的 discoveries |

契約**用指針傳而不貼全文**。被餵了完整宣告式契約的 driver 會把它讀成規範而不動手——這個失效模
式在本次實驗之前就已記錄在這個 codebase 裡。

Agent 接著改寫每一條錨不上的 claim。若該 claim 只是沒有證據，就補上 anchor。**若該 claim 其實
是錯的，就把句子改寫成真話、再錨到那個真話上**——53 個更正全部是這樣浮出來的。改寫成真話會**增
加**字數，所以永遠不與下面的規則衝突。

回傳前，agent 自己重跑 gate，確認自己那頁**同時不出現在** `invalid_anchors` 與
`unanchored_claims`。

### 用機制強制、而非用指示要求的約束

- **字數不得下降。** 刪掉一句錨不上的話會讓分母變小、**反而拉高**錨定率——最廉價的作弊路徑，必
  須用機制擋掉而不是勸阻。
- **Rationale 豁免**，標 `(inferred)`，並**移出錨定率分母**。
- **禁止錨進 wiki 自己的產物。** 靶裡同時裝著這份 wiki 的副本與 review 逐字稿；錨到那裡是**循
  環證據**，一律硬失敗。
- **Retry budget 3，耗盡即降級**——頁面保留、未解項目記錄下來交人裁，**絕不刪頁、絕不 rollback**。

### 三輪

| 輪 | 頁數 | 帶入的教訓 | 產出新教訓 | 找到的更正 |
|---|---|---|---|---|
| 1 | 4 | 4 條手寫種子 | 18 | 2 |
| 2 | 剩下最重的 5 頁 | 17 | 5 | 9 |
| 3 | 剩下的 24 頁 | 19 | 67 | 42 |

每一輪的結構是：一個 audit agent → N 個 page agent 併發 → 一個 audit agent。**同一輪內的 page
agent 拿到的是凍結的教訓清單副本**，所以一輪之內沒有順序依賴；教訓在輪與輪之間跨越，不在輪內。

第 2、3 輪開跑前，都先修掉前一輪暴露出來的 gate 缺陷——第 2 輪前修循環證據洞，第 3 輪前修畸形
anchor 與偽 anchor 洞。**gate 只在輪與輪之間修，絕不在輪內修。**

### Models

**誠實的缺口。** Page agent **繼承 session model**（Opus 等級），**未釘死**。只有 QA 層有固定
model 紀錄。任何人要重現都應該把作者端的 model 也釘死；換一個 model，anchor 數與更正數大概都會
不同，而**這個 repo 分不出那是 model 的功勞還是方法的功勞**。

---

## QA 量測

與上面相反，這一層完全釘死。見 [`qa/holdout-result.json`](qa/holdout-result.json)：

```json
{"finder_model":"sonnet","answerer_model":"sonnet","judge_model":"opus",
 "split_rule":"sort by id, even index -> public, odd index -> holdout","holdout_runs":1}
```

四個 finder agent 各從源碼寫 15 題，**wiki 與 review 逐字稿明令禁開**。題庫依排序後的 id 機械
切分——偶數進 [`qa/bank-public.json`](qa/bank-public.json)（留給後續迭代），奇數進
[`qa/bank-holdout.json`](qa/bank-holdout.json)，標 `spent: true`，因為**在迭代過的 wiki 上重跑
會讓那個數字失去意義**。

每題 holdout 被回答兩次，每臂一次，作答 agent 讀得到一份 wiki、讀不到源碼。判官對匿名的
alpha/beta 配對評分，**對應關係逐批交替**，只回傳 PASS/PARTIAL/FAIL。總分由腳本計算，**判官從
未看到任何一個總數**。

---

## 單靠這個 repo 重現不了什麼

- **靶 repo 沒有發佈在這裡。** 兩份 wiki 都在描述它，anchor 也引用它的路徑。沒有它，gate 讀得
  懂但無法對真實內容執行。
- **host pipeline 在別處。** 這個 repo 發佈的是錨定層，不是產出 arm A 的那個 openwiki port。
- **arm A 無法從這裡重生。** 官方提示詞資產屬於上游，由一個不在本次發佈範圍內的生成器抽取。

**可以**從這裡重現的：gate、它的 self-test、circuit breaker、題庫，以及**每一個被報出來的數字**
——全部可由兩份已發佈的 wiki 重算。

---

## Arm C — 這個 repo **不包含**的那個配置

這個 port 的 skill 也被改過：錨定附錄現在被掛在**生成步驟**，與官方 system prompt 和其他附錄並
列。因此，重新跑一次那個 skill，會在**寫的當下**就產出 anchor，而不是事後補上。

**那條路徑一次都沒有被執行過。** 靶的 run metadata 仍然記著 baseline 那次，未變。**這裡量到的
一切都是 arm B——對已完成頁面的 retrofit。**

這個區別不是措辭問題，它**顛倒了本 repo 最重要的那份前科**：

| | arm B（已量測） | arm C（未量測） |
|---|---|---|
| 錨定成本在什麼時候付 | 頁面已經存在**之後** | **決定要寫什麼的當下** |
| 有界作者能拿什麼去換 | 沒有——頁面已經寫好了 | **範圍**，而那正是前科說會發生的事 |
| 可能發生覆蓋擠壓嗎 | **結構上不可能** | **可能，而且實測過一次:6 頁 → 3 頁** |

所以 **arm B 不是撐過了擠壓,它是從未被暴露在擠壓之下**。這裡量到的 +13.3pp 屬於 retrofit，
**不轉移**到由 skill 生成的 wiki。任何人把這份附錄接進自己的生成步驟，就是進入
[`data/prior-anchoring-squeezes-breadth.md`](data/prior-anchoring-squeezes-breadth.md) 警告的那
個配置，而**本 repo 對它零量測**——在相信它產出的任何錨定率數字之前，應該先在旁邊放一道覆蓋率
閘。

要量 arm C，得把改過的 skill 冷跑在同一個靶上，再拿覆蓋率與成本去對 arm A。**這件事沒有做。**
