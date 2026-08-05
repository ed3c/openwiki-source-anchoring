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

## Arm A — baseline（`wiki/arm-a-baseline/`）

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

## Arm B — anchored（`wiki/arm-b-retrofit/`）

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

## Arm C — 生成當下就錨定（`wiki/arm-c-generated/`）

**改過的 skill 冷跑。** 錨定附錄掛在 skill 的生成步驟上，所以這一臂是**邊寫邊錨**而不是事後補。
**這就是任何人採用這份附錄之後實際會跑的配置。**

### 隔離

靶是這個 repo 的**複本**。開跑前移除了兩條會洩漏 arm A 的路徑：`.openwiki-review/` 底下 42 份
review 逐字稿（內含 arm A 的 skeleton 與它的 QA 題目），以及 arm A 的八個生成章節目錄、
`quickstart.md`、`index.md` 與 run metadata。**`openwiki/nonofficial/` 保留**——那些頁是這個 repo
自有的手寫內容，arm A 當時也有，移除它反而破壞可比性而非保護它。

生成 agent 被禁止讀取 arm A 那份複本與整個沙盒，而且**它的提示詞不含本研究的任何發現**——不含
gate 的數量、不含那 53 個更正、也不含「這個錨形有效」這件事。它拿到的只有 skill、靶、與邊界。

### 它做了什麼

它把整個 Init workflow 跑完了：preflight、evidence gate、skeleton、`skeleton_critic` 兩輪、
26 頁、unknown-unknown pass、`wiki_question_finder` 一次、`wiki_answer_verifier` 四批加三輪重試到
10/10、quickstart、刪除 skeleton、finalize。`stopped_because` 記的是 *"Nothing ran out."*

它寫了 590 個 anchor 與 77 個 `(inferred)` 標記，並用一個自己寫的 checker 在每頁之後重跑驗證。

### 結果，以及它代表什麼

| | arm B，閘驅動的 retrofit | arm C，只有慣例的生成 |
|---|---|---|
| 寫了幾個 anchor | 486 | **590** |
| 錨定率 | **100%** | **27.2%**（剔除繼承頁面後 41.3%） |
| 無效 anchor | 0 | 2 |

**arm C 寫了更多 anchor，卻只到不足一半的比率。** 原因寫在它自己的 notes 裡:它從未跑過那道閘。
它的 checker 數的是「**寫了**幾個 anchor」;閘回報的是「**還有**幾條 claim 沒錨」。**這是兩個不同的
問題,而只有後者會告訴作者「你還沒做完」。**

> **所以附錄買到約 41%，其餘由閘驅動迴圈買。** 改過的 skill 接了作者側慣例、**沒接機械回饋**，
> 因此它是半個機制。**這是 skill 的缺陷，不是這次執行的失誤。**

兩個無效 anchor 都指向 `openwiki/nonofficial/`——wiki 自己的產物，附錄明文禁止的循環證據。
arm C 的 checker 沒有這條規則，因此自報零個壞 anchor。**規則寫在提示詞、檢查不在工具裡，最後算數
的是工具。**

### 獨立地重新發現

arm C 的 notes 記載:checker 必須比較 `(src:` 出現次數與 regex 匹配數，否則畸形 anchor 會靜默消
失。**那正是本研究找到並修掉的同一個靜默通過洞，而它是由一個從未看過那個發現的 agent 得出的**——
這使它成為**這個錨形本身的性質**，而非一次性 bug。

### 關於覆蓋擠壓

前科預測:在生成當下付錨定成本，會讓有界作者縮小範圍。arm C 覆蓋 **32/32** 對 arm A 的 30/32、
字數多 20%、而且跑完了。它 `what_was_cut` 的六項是**有理由的延後並記進 Backlog**，不是靜默縮編。

**這不是乾淨的推翻。** arm A 出自更早的 session 與不同世代的 model，所以誠實的說法是:
**在 arm C 的條件下沒有觀察到擠壓。**

### 值得知道的副作用

建立 `openwiki/quickstart.md` 正是讓靶自己的 `check_openwiki.py` 由 FAIL 轉 PASS 的原因，
連帶解鎖它的 commit gate。**arm A 的靶在本研究全程都處在閘失敗狀態。**

### 成本

563K subagent tokens、74 分鐘，且**同時包含生成與量測**；對照 retrofit 三次 workflow 約 2.88M。
在這個靶上，**邊寫邊錨明顯比事後補錨便宜**——但**達到 100% 的是 retrofit**，所以兩者在同等品質下
並不可互換。
