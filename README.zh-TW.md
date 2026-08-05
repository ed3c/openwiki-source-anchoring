<div align="right">

[English](README.md) · **繁體中文**

</div>

# 讓生成式 code wiki 變得可查：什麼真的幫到讀者，什麼只是看起來像

生成出來的 wiki 會陳述大量關於某個 codebase 的具體事情，而其中幾乎沒有一句查得了。這裡量的是
「**逼作者去查證**會發生什麼」——更有用的是，**那個逼迫裡的哪一部分在做事**。

四臂、一組題、一位盲判。

| | 錨定率 | **QA PASS** | PASS+PARTIAL | *「wiki 沒寫」* |
|---|---|---|---|---|
| **A** baseline，官方 pipeline | 0% | 23.3% | 56.7% | 10 / 30 |
| **B** 事後錨定，閘驅動到歸零 | **100%** | 40.0% | 66.7% | 6 |
| **Bs** arm B 刪掉所有標記 | 0% | **40.0%** | 56.7% | 5 |
| **C** 寫作當下錨定，無閘 | 27.2% | **46.7%** | **86.7%** | **1** |

兩件事掉了出來，而且都與直覺讀法相反。

**引用標記對答對率的貢獻是零。** 把 arm B 的 486 個 `(src: …)` 標記全部刪除、其餘一字不動，
PASS 率**分毫未動**，仍是 30 題中的 12 題。相對 baseline 的增益，**全部來自錨定過程所補上的
「內容」**，不是它留下的標記。逼一個作者去找逐字引文，會讓他去讀源碼並把讀到的寫下來；**引文本身
是副產物。**

**表現最好的那一臂，錨定率最差。** arm C 的錨定率只有 arm B 的四分之一，卻在每一個面向讀者的指標
上勝過它。**錨定率量的是作者有沒有做查證工作，不是結果有沒有用**——而在這份資料上，兩者方向相反。

> **錨定率是流程指標。它該待在儀表板上，不是頭條上。**

## 逼作者查證，實際上找到了什麼

arm A 通過了官方程序檢查的每一項——三個 review subagent、零壞鏈、`status: success`——而它含有
**53 句與源碼矛盾的敘述**。那條 pipeline 裡沒有任何一步會把句子拿去跟它描述的檔案對質，所以這類
缺陷**在它的量程之外**，不是被它漏掉。

其中一個誤數已擴散到**十頁**，進了 frontmatter、標題與一張 mermaid 圖。**十頁一致不是十份證據，
是一份重複了十次。**

arm C 冷跑、獨立地又找到**七個**前面各臂都沒抓到的——包含一份 22 條的 gate 清單對上一個期待 23 條
的守衛，**代表這個 repo 的快路徑無法接受它自己的 gate 產出的任何 receipt**。

**這 53 條是作者自報的。** 其中 9 條經獨立查證，其餘由同一批 agent 認定並更正。**這是本文最強結論
裡最弱的一環**，明寫在此而非埋著。

## 量測方式

public 30 題出自一個 60 題題庫，由四個**只讀源碼**的 agent 寫出，所有 wiki 與 review 逐字稿明令
禁開。依排序後的 id 機械切分。作答者拿到一份 wiki、**禁讀源碼**。判官每題看四個匿名答案、標籤逐批
輪轉，只回傳 PASS/PARTIAL/FAIL。**總分由腳本計算，判官從未看到任何一個總數。**

更早一次用保留的 30 題只比 A 對 B，結果是 30.0% 對 43.3%，在
[`qa/holdout-result.json`](qa/holdout-result.json)，**已用盡**。

**`n = 30`、單次、無重複。** 一到三題的差異在雜訊範圍內，**不當成效果宣稱**。A→B 的 16.7pp 與
A→C 的 23.4pp 大到值得討論；B 與 Bs 之間 3 題的 PARTIAL/FAIL 差異**不算**。

## 這准許什麼結論

| 觀察 | 准許的結論 |
|---|---|
| B 與 Bs 的 PASS 完全相同 | **標記不驅動正確性，補上的內容才是** |
| C 在每個讀者指標最好、錨定率卻最低 | **錨定率不是品質指標** |
| C 的「沒寫」只有 1，A 是 10 | 查證紀律用在**寫作當下**，比同樣的紀律用在事後，產出的 wiki 完整得多 |
| 53 句矛盾只有靠嘗試錨定才浮現 | 官方三閘**看不見自信的錯誤內容** |

**不准許的：** 「把閘迭代到歸零有害」。arm B 與 C 差**兩件事**——事後 retrofit vs 從頭寫、有閘 vs
無閘——而這份證據**兩者都分不開**。未測的那一格是**從頭寫 + 有閘**，那正是兩條證據共同指向的地方，
而這裡沒有跑過它。

同樣不准許：任何關於「有真實歷史的 repo」的結論。**靶是合成的**，由同一套系統生成又由它文檔化。

## 這裡有什麼

| 路徑 | 內容 |
|---|---|
| [`LICENSE`](LICENSE) | MIT。wiki 描述的是第三方 repo，授權涵蓋本 repo 自己的產出 |
| [`THRESHOLDS.md`](THRESHOLDS.zh-TW.md) | 六條門檻，與在任何數字存在**之前**固定它們的那個 commit |
| [`METHOD.md`](METHOD.zh-TW.md) | 各臂怎麼做出來的、哪些 model 釘死、單靠這裡重現不了什麼 |
| [`STAGES.md`](STAGES.zh-TW.md) | 推理階段，與沒人預料到的那幾件事 |
| [`FINDINGS.md`](FINDINGS.zh-TW.md) | 錯誤主張與各自的源碼反證，以及逐結果的限制 |
| [`wiki/arm-a-baseline/`](wiki/arm-a-baseline/) | 官方 pipeline 的產出，未修改 |
| [`wiki/arm-b-retrofit/`](wiki/arm-b-retrofit/) | arm A 經閘驅動錨定 pass 之後 |
| [`wiki/arm-b-stripped/`](wiki/arm-b-stripped/) | arm B 機械刪除全部標記 |
| [`wiki/arm-c-generated/`](wiki/arm-c-generated/) | 冷跑，生成當下就錨定 |
| [`harness/`](harness/) | gate、wrapper、circuit breaker、派工 packet、作者側附錄、fixtures |
| [`qa/`](qa/) | 題庫、切分、兩次執行的逐題判定 |
| [`data/`](data/) | 錯誤主張清單、各臂稽核、arm C 的 receipt、形塑設計的前科 |

## 什麼是 anchor

```
(src: scripts/git_gate.py `lineage manifest must be staged`)
```

一個 repo 相對路徑，加上一段**從該檔複製出來**的子字串，以字面比對驗證。**不帶行號**：官方提示詞
要求 stable paths 優於行號，而它是對的——行號在下一個 commit 就過期，**逐字引文才是證據本體**。

作者側規則（含為何 rationale 豁免、改標 `(inferred)`）在
[`harness/anchor-extension.md`](harness/anchor-extension.md)。它是**附錄**：**沒有動過任何一個官方
提示詞的位元組**。

```sh
bun run harness/audit_wiki.ts wiki/arm-c-generated <target-repo>   # exit 0 全綠，2 未達門檻
sh harness/selftest.sh                                             # gate 必須抓得到 hollow anchor
```

**最該先讀 `selftest.sh`。** 分不出 *hollow* anchor——路徑真實、引文卻不在該檔——與真 anchor 的
verifier 就是空殼，它印的每個數字都只是裝飾。那份 fixture 斷言的是**失敗理由**。

arm C 獨立得到同一結論：checker 必須比較 `(src:` 出現次數與 regex 匹配數，**否則畸形 anchor 會靜默
消失**。它從未看過那個發現——**這是錨形的性質，不是一次性 bug**。

## 限制

- **`n = 30`、單次、無重複。** 方向性的。無變異估計、無判官一致性量測。
- **53 條更正多為作者自報**，僅 9 條經獨立查證。
- **題庫是模型寫的**，連驗收標準也是。人類沒有逐題稽核全部 60 題。
- **arm A 早於其餘各臂**一個 session 與一個 model 世代，所以 A 對 C **不是乾淨的單變因對照**。
- **靶是合成的**，沒有有機 git 歷史。
- **作者端 model 沒有釘死**，只有 QA 層有 provenance。
- **閘自己定義自己的分母。** 什麼算一條 claim 是 `audit_wiki.ts` 裡的啟發式，**改掉它，本頁每一個
  比率都會變**。

路徑已脫敏：`<target-repo>`、`<host-repo>`、`<sandbox>`、`<home>`。wiki 對其生成 repo 的相對引用
維持原樣——**它們是被研究的 artifact 的一部分**，改寫會竄改被量測的東西。
