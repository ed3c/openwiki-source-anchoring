<div align="right">

[English](FINDINGS.md) · **繁體中文**

</div>

# Findings

## Pipeline 自己的閘看不見這裡量的這種缺陷

Baseline 通過了官方程序檢查的每一項。三個 review subagent 都跑了、`skeleton_critic` 沒有留下未
解項、`wiki_question_finder` / `wiki_answer_verifier` 迴圈收斂、`finalize` 回報零壞鏈與零降級
圖表，`.last-update.json` 記著 `status: success`。

**它的 53 句敘述與源碼矛盾。**

這不是閘失職，這在它們的量程之外。它們問的是*「wiki 答不答得出這題」*。**一個自信的錯答通過這
個測試**，因為這個測試從不打開那個答案所描述的檔案。完整清單在
[`data/false-claims.json`](data/false-claims.json)。

### 一個誤數傳染到十頁，而「一致」不等於「佐證」

push gate 跑的是 **22** 個 gate。wiki 寫 **23**——在十頁裡，出現在 frontmatter、章節標題，以及
一張 mermaid 圖裡。

原因很平凡：`git_gate.py` 的 `GATES` 是一個中間夾著註解區塊的 list literal，**肉眼數會多算**。
`ast.literal_eval` 給出 22。

真正要緊的是傳播。**pipeline 從不比對兩頁**，所以單一誤數會複製進每一頁提到它的地方——而事後看
起來，**十頁彼此一致像是十份證據**。它是一份，重複了十次。

### 這些錯大多不是筆誤

代表性樣本，每一條都在錨定過程中對源碼查證過：

| wiki 說 | 源碼說 |
|---|---|
| lineage validator 由 commit gate 預設執行 | `git_gate.py` 帶著 `# scripts/validate_molecular_commit_lineage.py is deliberately NOT gated here.`，而該腳本不在 `GATES` 裡 |
| 某個必要 literal 在 `check_openwiki.py:73` | 第 73 行是完全不同的條目；該 literal 在檔案的別處 |
| `final_repo_small_loop_policy: forbidden` 記在 `plan-package.compat.yaml` | **該檔根本沒有這個鍵** |
| policy 鍵在 `openwiki/openwiki.yaml` | **沒有這個檔**；真實路徑深一層 |
| 該 gate 釘住這六個計數 | 它只比對其中四個，另外兩個**從沒被讀** |
| 該 checker 要求兩個 `cases.json` 完全相同 | 它比的是 **parsed JSON**，重排格式照樣通過 |
| ablation checker 驗證表中這五個值 | 它測的是五個*不同的*條件，且**從沒讀過**其中三個被點名的值 |
| 某 skill 的 promotion 狀態在它的 `status.json` | **該 skill 沒有 `status.json`**；狀態在 lifecycle registry |
| 只有分數未變時才會刪掉一行 | 程式碼是 `if current_rate >= baseline:` |

每一條都合情合理、具體，而且**都是 agent 會據以行動的那種東西**。

---

## QA holdout：30.0% → 43.3%

30 題，只跑一次，來自 60 題題庫；出題的四個 agent **只讀源碼**，wiki 與 review 逐字稿明令禁
開。依排序後的 id 機械切分，奇數進 holdout。作答 agent 讀得到一份 wiki、**讀不到源碼**。盲判，
alpha/beta 逐批交替，對照的是出題當下就固定的驗收標準。計分由腳本算術完成。

| | baseline | candidate |
|---|---|---|
| PASS | 9/30（30.0%） | **13/30（43.3%）** |
| PASS + PARTIAL | 50.0% | **66.7%** |
| 回答「wiki 沒寫這個」 | **12** | **6** |

八題判定改變：七題偏向錨定版，一題偏離。

### 最清楚的單一結果，把「更正一句假話」與「更正一個答案」接上

在 `gates-03` 上 baseline 那一臂失敗，而**不知道自己在評哪一臂**的判官寫下：

> *confidently wrong: it denies the question's premise and asserts the script IS gate #21 in
> `git_gate.py`'s GATES list, contradicting the exclusion*

那正是 53 個更正之一——**源碼明文說不被 gate 的那個 validator**。從*一句假話被移除*到*一個
agent 不再自信地答錯*的因果鏈，**在這裡是被觀察到的，不是推論的**。

### 有一題變差，而它的原因會重演

`gates-01` 從 PASS 掉到 PARTIAL：錨定後的改寫丟掉了原版提到的一個分支。**要讓一個句子可查就得
改寫它，而改寫可能丟掉某個原本就是真的東西。** 這是方法的代價，不是異常，而且會再發生。

### 「wiki 沒寫」腰斬，而且沒人要求它這麼做

錨定 pass **從未被指示要增加覆蓋**。它還是把無法回答的題目從 12 降到 6。逼每一條 claim 去面對
它的源碼，似乎會讓周圍的頁面更可回答——**合理、未證實、值得之後單獨隔離量測**。

---

## 這些結果准許與不准許什麼結論

| 觀察 | 准許的結論 |
|---|---|
| 0 → 486 anchor，零無效 | 這份 wiki 的 claim 現在**機械可證偽** |
| 錨定過程中找到 53 句矛盾 | 官方三閘**偵測不到自信的錯誤內容**；一份 wiki 可以三閘全過同時誤導人 |
| holdout 30.0% → 43.3%，盲測 | 錨定版對 agent **在這個 repo 上、n=30、單次**更有用 |
| 「沒寫」12 → 6 | 錨定提升了可回答性，**機制未知** |
| 一題判定退步 | 為了可驗性而改寫**可能丟失訊息** |
| 覆蓋 30/32 → 32/32 | 部分是**免費**得來的（anchor 路徑本身滿足搜尋）——**兩個指標共用證據、並不獨立** |

**這裡的任何東西都不准許下列結論：**

- 錨定既有 wiki 優於重新生成一份。**沒有重生對照臂。** 不重生的約束來自一份在**不同 repo**、用
  **不同錨形**做的舊實測（[`data/prior-anchoring-squeezes-breadth.md`](data/prior-anchoring-squeezes-breadth.md)）。
- 這一切能轉移到有真實歷史的 repo。**靶是合成的**——由同一套系統生成又由它文檔化，自己沒有
  `.git`。
- 輪間攜帶教訓**造成**了改善。24 個 agent 共 189 次引用只顯示教訓**被用了**；沒有未帶教訓的對照
  臂能顯示它**有幫助**。
- 任何關於上游自家 binary 的結論。**它從未安裝**；這整條工作線的存在就是為了在無 API key 的 CLI
  訂閱上跑官方程序。

---

## 形塑設計的那份前科，以及它為何沒有重演

一個月前在這條 pipeline 上做過一次實測 A/B——同 repo、同 pin、單一變因——發現加入 claim contract
使捏造歸零，**同時把 round-1 覆蓋從 6 頁砍到 3 頁**，總分只 +4，作者耗時 +40%。錨定是**每個
claim 的單位成本**，而有界的作者會用**縮小範圍**來吸收成本上升。

因此上了兩項對策：覆蓋門檻與錨定要求**同時**上（而非之後才上）；錨定以 **update over finished
pages** 執行，而非重新生成。

這次覆蓋上升（30/32 → 32/32），也沒有任何一頁掉字。**這與對策有效相符，但不是對策有效的證據**
——對已存在頁面做 update pass **沒有東西可以被砍**，那個失效模式在結構上不可能出現。**在一個不
可能發生擠壓的設定裡沒有發生擠壓，什麼都沒有證明**，本文如實這樣記載。

---

## Arm C:慣例值約 41%，其餘由閘買

| | arm A | arm B，閘驅動 | arm C，只有慣例 |
|---|---|---|---|
| anchor | 0 | 486 | **590** |
| 錨定率 | 0.0% | **100%** | **27.2%** / 剔除繼承頁後 41.3% |
| 無效 | — | 0 | 2，皆循環證據 |
| entrypoint 覆蓋 | 30/32 | 32/32 | **32/32** |
| gate | exit 2 | **exit 0** | exit 2 |
| 成本 | 未紀錄 | ~2.88M tokens | 563K tokens、74 分，含生成 |

arm C 寫了比 arm B 更多的 anchor 卻只到不足一半的比率，**因為它從未跑過那道閘**。它的 checker 數
的是「寫了幾個」；閘回報的是「還有幾條沒錨」。

**這准許的結論**:**arm B 報出來的數字是「閘驅動迴圈」的性質，不是「錨定慣例」的性質。** 只採用
慣例應預期落在 41% 附近。

**不准許的**:arm C **沒有 QA 量測**——holdout 已用在 A 對 B，重用會讓它作廢。保留的 30 題 public
就是為此存在但尚未動用，所以這裡沒有任何東西說 arm C 比 arm A **更有用**，只說它比 arm B **錨得
更少**。

### 覆蓋擠壓沒有出現，而這比看起來的份量弱

arm C 覆蓋 32/32 對 arm A 的 30/32、字數多 20%、回報 *"Nothing ran out."*，其六項 `what_was_cut`
是**有理由的延後並記進 Backlog**，不是靜默縮編。

但 arm A 出自更早的 session 與不同世代的 model，**這不是單變因對照**。誠實的說法是
**在 arm C 的條件下沒有觀察到擠壓**——不是前科被推翻。

### 前兩臂漏掉的七個靶內缺陷

arm C 冷跑時記錄了七個 arm A 與錨定 pass 都沒抓到的缺陷。最尖銳的:commit gate 的 `GATES` 有 22
條，而相容性守衛的 `GIT_GATE_ORDER` 有 23 條，所以 receipt 快路徑**無法接受這個 repo 自己的 gate
產出的任何 receipt**。

它還觀察到一個沒人注意過的副作用:建立 `openwiki/quickstart.md` 正是讓靶的 `check_openwiki.py` 由
FAIL 轉 PASS 的原因，連帶解鎖它的 commit gate。**arm A 的靶在本研究全程都處在閘失敗狀態。**

### 兩個獨立確證

arm C 的兩個無效 anchor 都指向 `openwiki/nonofficial/`——wiki 自己的產物。附錄明文把這列為循環
證據，而 arm C 的 checker 沒有這條規則，於是它自報零個壞 anchor。**規則寫在提示詞、缺在工具裡，
最後算數的是工具。**

以及 arm C 的 notes 獨立推導出:checker 必須比較 `(src:` 出現次數與 regex 匹配數，否則畸形 anchor
會靜默消失——**與本研究稍早找到並修掉的是同一個洞，而它是由一個從未看過那個發現的 agent 得出的**。
這使它成為**錨形的性質**，而非一個曾被修好的 bug。

---

## 四臂在 public 題組上:標記不做事,而最好的一臂錨得最少

| | 錨定率 | PASS | PASS+PARTIAL | *「wiki 沒寫」* |
|---|---|---|---|---|
| A baseline | 0% | 23.3% | 56.7% | 10 |
| B 事後錨定、閘驅動 | **100%** | 40.0% | 66.7% | 6 |
| **Bs** B 刪掉標記 | 0% | **40.0%** | 56.7% | 5 |
| C 寫作當下錨定 | 27.2% | **46.7%** | **86.7%** | **1** |

### 剝離臂把機制問題定案了

arm Bs 是 arm B 機械刪除全部 486 個 `(src: …)` 標記、**其餘一字未動**。它的 PASS 數**完全相同**:
30 題中的 12 題。

所以相對 baseline 的增益**不是引用本身**，是作者**在找引用的過程中**寫下的內容——確切的錯誤字串、
實際觀察到的 exit code、閾值。**標記是流程掉出來的東西，不是做事的東西。**

兩臂在 8 個單題上判定不同，淨值使 B 的 PASS+PARTIAL 高 10pp。**在 n=30 且無重複的條件下，三題的
擺盪是雜訊，不當成效果宣稱。**

### 錨定率與有用性在此反向

arm C 的錨定率是 arm B 的四分之一，卻在 PASS、PASS+PARTIAL、以及最尖銳的「wiki 根本答不出來」
（1 對 6）上都勝過它。arm A 留下 10 題答不出來。

合理的機制是:arm C 把查證紀律用在**寫每一頁的當下**，所以每一頁都經過「回去讀源碼」的處理；
arm B 只回頭處理閘標出來的 claim，arm A 其餘的散文原封不動。

**這不准許的結論**:「閘驅動迭代有害」。arm B 與 C **同時差兩件事**——retrofit vs 從頭寫、有閘 vs
無閘——**這裡沒有任何東西能把它們分開**。未測的那一格是**從頭寫 + 有閘**，兩條證據都指向那裡。

### 這對「該怎麼讀這些數字」的後果

**錨定率是流程指標**:作者有沒有做查證工作。它確定性、便宜、可重跑，而它**對「結果有沒有幫到讀者」
一句話都沒說**。在這份資料上它與面向讀者的指標**負相關**。它屬於診斷表，不屬於頭條——
**而這個 repo 的早期版本把兩者放反了。**
