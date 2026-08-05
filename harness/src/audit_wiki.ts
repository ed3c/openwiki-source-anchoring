#!/usr/bin/env bun
// audit_wiki.ts — T0 機械閘:對一份 openwiki 量錨定(A 方向)與 entrypoint 覆蓋(B 方向)。
// 零 LLM、零網路。exit 0=全部門檻達標 / 2=至少一項未達標 / 64=用法或路徑錯。
//
// 錨格式(唯一合法形式,見 PLAN.md「凍結門檻」):
//   (src: <target 相對路徑> `<該檔中的逐字子串>`)
// 引文是強制的,行號則刻意不要:
//   - 官方 init.system.md:57「Prefer stable paths and symbol names over line numbers」——
//     baseline 的 0 個行號錨是在服從這條,不是疏漏;不變量 1 禁改官方文字,故錨要遷就它。
//   - 行號下一個 commit 就過期,逐字引文才是證據本體,行號只是它的脆弱代理。
//   - 可證偽性不靠行號:捏造的敘述生不出目標檔案裡真實存在的逐字字串。
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const CIRCULAR = [".openwiki-review", "openwiki"];  // wiki 自己的產物,不得當證據
const CODE_EXT = /\.(py|ts|tsx|js|mjs|sh|yaml|yml|json|toml)$/;

function walk(dir: string, keep: (p: string) => boolean, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === ".git" || name === "node_modules") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, keep, out);
    else if (keep(p)) out.push(p);
  }
  return out;
}

/** B 方向分母:有 gate 語義的可執行點。數量固定 ⇒ 天然抗灌水。 */
// ponytail: python __main__ + git hooks only; add per-language rules when a non-python target lands.
function entrypoints(target: string): string[] {
  const py = walk(target, (p) => p.endsWith(".py"))
    .filter((p) => !relative(target, p).startsWith("tests/"))
    .filter((p) => readFileSync(p, "utf8").includes("__main__"));
  const hooks = existsSync(join(target, ".githooks"))
    ? walk(join(target, ".githooks"), () => true)
    : [];
  return [...py, ...hooks].map((p) => relative(target, p)).sort();
}

type Anchor = { page: string; path: string; quote: string };
type Bad = Anchor & { reason: string };

const ANCHOR_RE = /\(src:\s*([^\s`]+)\s+`([^`]+)`\s*\)/g;
const CODE_REF_RE = /`([A-Za-z0-9_][A-Za-z0-9_/.-]*\.[A-Za-z]+)`/g;

/** 一個區塊是否帶「格式正確」的錨。禁用 `includes("(src:")`:畸形錨會被算成已錨卻永不受檢。 */
function hasWellFormedAnchor(block: string): boolean {
  return new RegExp(ANCHOR_RE.source).test(block);
}

function auditPage(target: string, page: string, text: string) {
  const anchors: Anchor[] = [];
  const bad: Bad[] = [];
  // 畸形錨偵測:`(src:` 出現次數 > 合法匹配數 ⇒ 有錨寫壞了。
  // 實測失效模式:同一括號塞兩個錨 `(src: a \`x\`, src: b \`y\`)` → ANCHOR_RE 零匹配,
  // 但區塊含 "(src:" 於是被算成已錨定 ⇒ anchors=0 / invalid=0 / rate=1 / status=passed。
  // 靜默通過是本設計最不該有的失效類型,故畸形一律計為無效錨。
  // 缺左括號的偽錨:`... (see src: path \`quote\`)`。閘會把該區塊算成未錨(所以不是靜默通過),
  // 但它對人類讀者長得像證據,且若同區塊另有合法錨就完全隱形——不驗證的東西不得長得像證據。
  for (const m of text.matchAll(/(^|[^(])src:\s*[^\s`]+\s+`[^`]+`/g)) {
    bad.push({ page, path: "(unparsed)", quote: m[0]!.trim().slice(0, 120),
      reason: "anchor missing its opening parenthesis: must start with `(src:` and not nest inside another parenthesis" });
  }
  const tokens = [...text.matchAll(/\(src:/g)].length;
  if (tokens > [...text.matchAll(new RegExp(ANCHOR_RE.source, "g"))].length) {
    for (const m of text.matchAll(/\(src:[^)]*\)?/g)) {
      const frag = m[0]!;
      if (!new RegExp(`^${ANCHOR_RE.source}$`).test(frag)) {
        bad.push({ page, path: "(unparsed)", quote: frag.slice(0, 120),
          reason: "malformed anchor: expected exactly one `(src: <path> `quote`)` per parenthesis" });
      }
    }
  }
  for (const m of text.matchAll(ANCHOR_RE)) {
    const a = { page, path: m[1]!, quote: m[2]! };
    anchors.push(a);
    const abs = resolve(target, a.path);
    const rel = relative(target, abs);
    if (rel.startsWith("..") || rel === "") bad.push({ ...a, reason: "path escapes target" });
    // 循環證據:target 底下的 `.openwiki-review/`(本 wiki 的生成逐字稿)與 `openwiki/`
    // (同一份 wiki 的舊副本)都是 wiki 自己的產物。錨到那裡等於拿自己的話當自己的證據,
    // 稽核會全綠而什麼都沒被證明。第一輪 agent 實測遇到後回報,故升級為硬失敗。
    else if (CIRCULAR.some((d) => rel === d || rel.startsWith(`${d}/`))) {
      bad.push({ ...a, reason: `circular evidence: ${rel.split("/")[0]} is this wiki's own output, not source` });
    }
    else if (!existsSync(abs)) bad.push({ ...a, reason: "file does not exist" });
    else if (!readFileSync(abs, "utf8").includes(a.quote)) {
      bad.push({ ...a, reason: "quote not found in that file" });
    }
  }
  // C1-shaped claim 的機械代理 = 含 code ref 的 markdown **區塊**。
  // 行粒度會系統性低估:markdown 折行讓錨落在 claim 的下一行,實測第一頁 22.2% vs 真實值。
  // 區塊 = 連續非空行;表格每列自成一塊(語意上各是獨立主張);fenced code 與 frontmatter 不算主張。
  const refs = new Set<string>();
  const blocks: string[] = [];
  let cur: string[] = [];
  let inFence = false, inFm = false;
  const lines = text.split("\n");
  const flush = () => { if (cur.length) { blocks.push(cur.join(" ")); cur = []; } };
  for (const [i, line] of lines.entries()) {
    if (i === 0 && line.trim() === "---") { inFm = true; continue; }
    if (inFm) { if (line.trim() === "---") inFm = false; continue; }
    if (line.trimStart().startsWith("```")) { flush(); inFence = !inFence; continue; }
    if (inFence) continue;
    if (line.trim() === "") { flush(); continue; }
    if (line.trimStart().startsWith("|")) { flush(); blocks.push(line); continue; }
    cur.push(line);
  }
  flush();
  const withRef = blocks.filter((b) => {
    let has = false;
    for (const m of b.matchAll(CODE_REF_RE)) {
      if (!CODE_EXT.test(m[1]!)) continue;
      refs.add(m[1]!);
      has = true;
    }
    return has;
  });
  // C5 豁免必須反映在分母上:`(inferred)` 標的區塊不進錨定率,否則門檻 1 會逼作者去錨設計理由,
  // 也就是本 op 明列的 Goodhart 落點。它們改由門檻 6(可驗佔比)獨立約束。
  const inferred = withRef.filter((b) => b.includes("(inferred"));
  const claims = withRef.filter((b) => !b.includes("(inferred"));
  return { anchors, bad, claims, inferred, refs };
}

function main(argv: string[]): number {
  // --exclude:把「交付但非本 pipeline 產出」的頁排出**量測集合**。
  // 為什麼需要:被量測的集合 ≠ 被交付的集合。讀者拿到 `nonofficial/`(repo 自有手寫頁,
  // 且 check_openwiki.py 等 5 支硬性要求它存在),但那 14 頁不是官方 pipeline 寫的,
  // 拿它們進分母去評 pipeline 的產出是範疇錯誤。實測後果:同一批 wiki 含/不含 nonofficial
  // 會得到兩組不可比的錨定率(B 曾錨它 174 個、C/D 被要求 preserve 故 0)。
  // 排除的頁**仍留在磁碟上**——這個旗標只改量測範圍,不改交付內容。
  const excl: string[] = [];
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--exclude") { excl.push(...(argv[++i] ?? "").split(",").filter(Boolean)); }
    else rest.push(argv[i]!);
  }
  const wiki = rest[0] ? resolve(rest[0]) : "";
  const target = rest[1] ? resolve(rest[1]) : "";
  if (!wiki || !target) {
    console.error("usage: audit_wiki.ts <wiki-dir> <target-repo-dir> [--exclude a,b]");
    return 64;
  }
  const excluded = (rel: string) => excl.some((e) => rel === e || rel.startsWith(`${e}/`));
  for (const [label, d] of [["wiki", wiki], ["target", target]] as const) {
    if (!existsSync(d)) { console.error(`audit_wiki: ${label} 不存在: ${d}`); return 64; }
  }

  const pages = walk(wiki, (p) => p.endsWith(".md")).filter((p) => !excluded(relative(wiki, p)));
  let anchors = 0, badAnchors: Bad[] = [], claims = 0, anchoredClaims = 0, inferredBlocks = 0;
  const unanchored: { page: string; block: string }[] = [];
  const allRefs = new Set<string>();
  for (const p of pages) {
    const text = readFileSync(p, "utf8");
    const r = auditPage(target, relative(wiki, p), text);
    anchors += r.anchors.length;
    badAnchors.push(...r.bad);
    claims += r.claims.length;
    inferredBlocks += r.inferred.length;
    // 必須用 hasWellFormedAnchor 而非 includes("(src:"):子字串檢查會把畸形錨算成已錨定,
    // 於是它既拉高錨定率、又因 ANCHOR_RE 不匹配而永不受檢(實測 status=passed 的靜默通過)。
    anchoredClaims += r.claims.filter(hasWellFormedAnchor).length;
    // 熔斷器的修復迴圈需要「哪些 claim 沒錨」才有修的目標;沒這份清單 retry 就是盲改。
    for (const b of r.claims) {
      if (!hasWellFormedAnchor(b)) unanchored.push({ page: relative(wiki, p), block: b.slice(0, 400) });
    }
    for (const ref of r.refs) allRefs.add(ref);
  }

  // 引用了 target 裡根本不存在的檔 = 直接的捏造證據,不需要行號錨就抓得到。
  // 但 wiki 常寫裸檔名(`git_gate.py`)指的是 `scripts/git_gate.py`——只從 target 根解析會把
  // 這類全判成 missing,那是量測 bug 不是捏造。故三分類:精確路徑 / 尾綴或 basename 可解 / 真的不存在。
  const allFiles = walk(target, () => true).map((p) => relative(target, p));
  const bySuffix = new Set(allFiles);
  const byBase = new Map<string, string[]>();
  for (const f of allFiles) {
    const b = f.split("/").pop()!;
    byBase.set(b, [...(byBase.get(b) ?? []), f]);
  }
  const resolvedExact: string[] = [], resolvedLoose: string[] = [], missingRefs: string[] = [];
  for (const r of [...allRefs].sort()) {
    if (bySuffix.has(r)) resolvedExact.push(r);
    else if (allFiles.some((f) => f.endsWith(`/${r}`)) || byBase.has(r.split("/").pop()!)) resolvedLoose.push(r);
    else missingRefs.push(r);
  }

  const eps = entrypoints(target);
  const wikiText = pages.map((p) => readFileSync(p, "utf8")).join("\n");
  const uncovered = eps.filter((e) => !wikiText.includes(e));

  const anchorRate = claims === 0 ? 0 : anchoredClaims / claims;
  // 門檻 6:可驗 claim 佔比 = 需錨區塊 /(需錨 + 已標 inferred)。防 wiki 退化成只剩解釋、無可驗事實。
  const verifiableShare = claims + inferredBlocks === 0 ? 0 : claims / (claims + inferredBlocks);
  const anchorCorrect = anchors === 0 ? 0 : (anchors - badAnchors.length) / anchors;
  const coverage = eps.length === 0 ? 0 : (eps.length - uncovered.length) / eps.length;

  // 門檻:PLAN.md 凍結表 1/2/3。未達標 → exit 2。
  const fails: string[] = [];
  if (anchorRate < 0.85) fails.push(`anchor_rate ${(anchorRate * 100).toFixed(1)}% < 85%`);
  // badAnchors 也含畸形錨(ANCHOR_RE 零匹配那種),它們 anchors 計數為 0,
  // 只看 anchorCorrect 會漏判 ⇒ 必須獨立以 badAnchors.length 觸發。
  if (badAnchors.length > 0 || (anchors > 0 && anchorCorrect < 1)) {
    fails.push(`anchor_correctness ${(anchorCorrect * 100).toFixed(1)}% < 100% (${badAnchors.length} invalid/malformed)`);
  }
  // 門檻 3 = baseline 實測值 30/32,寫成精確分數。
  // 曾硬編 0.938(從四捨五入後的顯示值抄回),而真值 0.9375 < 0.938 ⇒ baseline 過不了自己的門檻,
  // 訊息還印成自相矛盾的「93.8% < 93.8%」。顯示值不可回填成門檻值。
  const COVERAGE_FLOOR = 30 / 32;
  if (coverage < COVERAGE_FLOOR) {
    fails.push(`entrypoint_coverage ${(coverage * 100).toFixed(2)}% < ${(COVERAGE_FLOOR * 100).toFixed(2)}% (baseline 30/32)`);
  }
  if (claims + inferredBlocks > 0 && verifiableShare < 0.4) {
    fails.push(`verifiable_share ${(verifiableShare * 100).toFixed(1)}% < 40%`);
  }

  console.log(JSON.stringify({
    schema_version: "wiki-anchor-audit@v2",
    measured_set: excl.length ? `all pages except ${excl.join(", ")}` : "all pages",
    excluded: excl,
    status: fails.length === 0 ? "passed" : "failed",
    pages: pages.length,
    anchor: { total: anchors, invalid: badAnchors.length, rate: anchorRate, correctness: anchorCorrect },
    claims: { c1_shaped: claims, anchored: anchoredClaims, inferred: inferredBlocks, verifiable_share: verifiableShare },
    code_refs: {
      total: allRefs.size,
      resolved_exact: resolvedExact.length,
      resolved_loose: resolvedLoose.length,   // 裸檔名/尾綴可解:檔案真的存在,但 wiki 沒給可直達的路徑
      missing: missingRefs.length,            // target 裡完全找不到同名檔 = 捏造或跨 repo 引用
      missing_paths: missingRefs,
      loose_paths: resolvedLoose,
    },
    entrypoints: { total: eps.length, uncovered: uncovered.length, coverage, uncovered_paths: uncovered },
    invalid_anchors: badAnchors,
    unanchored_claims: unanchored,
    failures: fails,
  }, null, 2));

  // stdout 只放收據 JSON(必須可 parse)。engine.sh 契約的 PROGRESS 行由 verify.sh 產生。
  return fails.length > 0 ? 2 : 0;
}

process.exit(main(process.argv.slice(2)));
