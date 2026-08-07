#!/usr/bin/env bun
// Invariant anchor coverage: a denominator the wiki's own markup cannot move.
//
// UNIT = the distinct pair (page P, target source file F that P NAMES anywhere in its bytes).
// No block, blank line, table pipe, heading marker, fence or backtick participates in the unit,
// so the three measured gaming moves — de-tick a filename, merge two qualifying paragraphs,
// move a filename out of a heading — are no-ops BY CONSTRUCTION, not by an added rule.
//
// numerator: pairs where P carries an anchor that (a) resolves to F and (b) whose quote is
// verbatim in F. A fabricated quote earns nothing, unlike legacy anchor_rate.
//
// LEGACY PARITY IS COMPUTED IN THE SAME RUN. The `legacy` block is a verbatim port of
// audit_wiki.ts's block splitter and claim filter. If it does not reproduce the deployed
// auditor's counts, two things changed at once and the new number is worthless — check it first.
//
// exit 0 = reported (or >= --min-rate); 2 = below --min-rate; 64 = usage.
import { existsSync, lstatSync, opendirSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";

// --- constants copied from harness/src/audit_wiki.ts; do not diverge ---
const CIRCULAR = [".openwiki-review", "openwiki"];
const CODE_EXT = /\.(py|ts|tsx|js|mjs|sh|yaml|yml|json|toml)$/;
const ANCHOR_SRC = /\(src:\s*([^\s`]+)\s+`([^`]+)`\s*\)/.source;
const CODE_REF_SRC = /`([A-Za-z0-9_][A-Za-z0-9_/.-]*\.[A-Za-z]+)`/.source;
// --- new: the mention tokenizer. A backtick is NOT in the class, so `foo.py` and foo.py
// tokenize to the same string. There is no "also match the unbackticked form" branch to drift.
const MENTION_SRC = /[A-Za-z0-9_.][A-Za-z0-9_./-]*/.source;

const EXIT_FAILED = 2;
const EXIT_USAGE = 64;
// A quote of " " is verbatim in every file, so `includes(quote)` passed tautologically and an
// anchor cost literally nothing to fabricate. 8 non-blank characters is the floor at which the
// author has to have opened the file. Measured cost on real anchors: 0/485 arm B, 0/590 arm C,
// 4/1053 arm D. This does NOT close anchor spam (see anchors.per_covered_pair).
const MIN_QUOTE = 8;

class UsageError extends Error {}

function walk(root: string): string[] {
  const out: string[] = [];
  const visit = (dir: string): void => {
    const d = opendirSync(dir);
    try {
      for (;;) {
        const e = d.readSync();
        if (e === null) break;
        if (e.name === ".git" || e.name === "node_modules") continue;
        const p = join(dir, e.name);
        const st = lstatSync(p);
        if (st.isSymbolicLink()) continue;
        if (st.isDirectory()) visit(p);
        else if (st.isFile()) out.push(p);
      }
    } finally {
      d.closeSync();
    }
  };
  visit(root);
  return out.sort();
}

const sourceCache = new Map<string, string>();
function readSource(path: string): string {
  let text = sourceCache.get(path);
  if (text === undefined) {
    text = readFileSync(path, "utf8");
    sourceCache.set(path, text);
  }
  return text;
}

function inside(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

function circular(rel: string): boolean {
  return CIRCULAR.some((dir) => rel === dir || rel.startsWith(`${dir}/`));
}

// ===================== legacy parity block (verbatim behaviour) =====================

/** audit_wiki.ts lines 533-571: blank-line blocks, each table row its own block, fences and
 *  frontmatter skipped. */
function legacyBlocks(text: string): string[] {
  const blocks: string[] = [];
  let current: string[] = [];
  let inFence = false;
  let inFrontmatter = false;
  const flush = () => {
    if (current.length > 0) {
      blocks.push(current.join(" "));
      current = [];
    }
  };
  for (const [index, line] of text.split("\n").entries()) {
    if (index === 0 && line.trim() === "---") {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter) {
      if (line.trim() === "---") inFrontmatter = false;
      continue;
    }
    if (line.trimStart().startsWith("```")) {
      flush();
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (line.trim() === "") {
      flush();
      continue;
    }
    if (line.trimStart().startsWith("|")) {
      flush();
      blocks.push(line);
      continue;
    }
    current.push(line);
  }
  flush();
  return blocks;
}

function hasWellFormedAnchor(block: string): boolean {
  return new RegExp(ANCHOR_SRC).test(block);
}

function legacyPage(text: string): { claims: number; anchored: number; inferred: number } {
  const withRef = legacyBlocks(text).filter((block) => {
    for (const match of block.matchAll(new RegExp(CODE_REF_SRC, "g"))) {
      if (CODE_EXT.test(match[1]!)) return true;
    }
    return false;
  });
  const claims = withRef.filter((block) => !block.includes("(inferred"));
  return {
    claims: claims.length,
    anchored: claims.filter(hasWellFormedAnchor).length,
    inferred: withRef.length - claims.length,
  };
}

// ===================== invariant metric =====================

/** Candidate token -> target-relative unit path. Exact path, else unique path suffix,
 *  else unique basename. Ambiguous or unknown -> null, which is what keeps "e.g." and
 *  "3.11" out of the denominator. */
function makeResolver(unitFiles: string[]) {
  const exact = new Set(unitFiles);
  const byBase = new Map<string, string[]>();
  for (const file of unitFiles) {
    const base = file.split("/").pop()!;
    byBase.set(base, [...(byBase.get(base) ?? []), file]);
  }
  const memo = new Map<string, string | null>();
  return (raw: string): string | null => {
    const c = raw.replace(/^\.\//, "").replace(/[.,;:)\]]+$/, "");
    if (c === "") return null;
    const cached = memo.get(c);
    if (cached !== undefined) return cached;
    let unit: string | null = null;
    if (exact.has(c)) unit = c;
    else if (c.includes("/")) {
      const hits = unitFiles.filter((file) => file.endsWith(`/${c}`));
      if (hits.length === 1) unit = hits[0]!;
    } else {
      const hits = byBase.get(c);
      if (hits !== undefined && hits.length === 1) unit = hits[0]!;
    }
    memo.set(c, unit);
    return unit;
  };
}

type Resolver = ReturnType<typeof makeResolver>;

/** Anchor -> the unit it proves, or null if it proves nothing (escapes target, circular,
 *  missing file, not a regular file, or the quote is not verbatim in that file). */
function anchorUnit(
  target: string,
  targetReal: string,
  path: string,
  quote: string,
  resolveUnit: Resolver,
): string | null {
  if (quote.trim().length < MIN_QUOTE) return null;
  const lexical = resolve(target, path);
  if (!inside(target, lexical)) return null;
  const rel = relative(target, lexical);
  if (circular(rel)) return null;
  if (!existsSync(lexical)) return null;
  let real: string;
  try {
    real = realpathSync(lexical);
  } catch {
    return null;
  }
  if (!inside(targetReal, real)) return null;
  if (circular(relative(targetReal, real))) return null;
  if (!lstatSync(real).isFile()) return null;
  if (!readSource(real).includes(quote)) return null;
  return resolveUnit(rel);
}

/** Drop fenced code and frontmatter. Only used to report how much of the denominator lives
 *  inside fences; the metric itself scans them, which is what makes fence-hiding a no-op. */
function proseOnly(text: string): string {
  const keep: string[] = [];
  let inFence = false;
  let inFrontmatter = false;
  for (const [index, line] of text.split("\n").entries()) {
    if (index === 0 && line.trim() === "---") {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter) {
      if (line.trim() === "---") inFrontmatter = false;
      continue;
    }
    if (line.trimStart().startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    keep.push(line);
  }
  return keep.join("\n");
}

const NAMED_ENTITY: Record<string, string> = { period: ".", sol: "/", lowbar: "_", commat: "@" };

/** Collapse markup a markdown renderer makes invisible, so the reader's page and the measured
 *  page name the same files. Closes the silent de-naming channels: `git_gate\.py`,
 *  `git_gate<zero-width>.py`, `git_gate&#46;py` and `git_gate<!---->.py` all render as
 *  `git_gate.py` to a human but tokenize into two nonsense halves, which deleted the pair
 *  without costing a single word. Invariant scan only — the legacy block still reads raw bytes,
 *  or parity would break. */
function normalize(text: string): string {
  return text
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/[­​-‏⁠﻿]/g, "")
    .replace(/&(?:#(\d{1,7})|#[xX]([0-9a-fA-F]{1,6})|([a-zA-Z]+));/g, (full, dec, hex, name) => {
      if (dec !== undefined) return String.fromCodePoint(Number(dec));
      if (hex !== undefined) return String.fromCodePoint(Number.parseInt(hex, 16));
      return NAMED_ENTITY[name] ?? full;
    })
    .replace(/\\([\\`*_{}[\]()#+\-.!/])/g, "$1");
}

function mentionsIn(text: string, resolveUnit: Resolver, unresolved: Set<string>): Set<string> {
  const units = new Set<string>();
  for (const match of text.matchAll(new RegExp(MENTION_SRC, "g"))) {
    const token = match[0]!;
    if (!token.includes("/") && !token.includes(".")) continue;
    const unit = resolveUnit(token);
    if (unit !== null) units.add(unit);
    else if (CODE_EXT.test(token.replace(/[.,;:)\]]+$/, ""))) unresolved.add(token);
  }
  return units;
}

function parseArgs(argv: string[]) {
  const exclusions: string[] = [];
  const positional: string[] = [];
  let minRate: number | null = null;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === "--exclude") {
      const value = argv[++i];
      if (value === undefined) throw new UsageError("--exclude requires a comma-separated value");
      exclusions.push(...value.split(",").filter(Boolean));
      continue;
    }
    if (arg === "--min-rate") {
      const value = Number(argv[++i]);
      if (!Number.isFinite(value) || value < 0 || value > 1) {
        throw new UsageError("--min-rate requires a number in [0,1]");
      }
      minRate = value;
      continue;
    }
    if (arg.startsWith("--")) throw new UsageError(`unknown option: ${arg}`);
    positional.push(arg);
  }
  if (positional.length !== 2) {
    throw new UsageError(
      "usage: audit_anchor_invariant.ts <wiki-dir> <target-repo-dir> [--exclude a,b] [--min-rate R]",
    );
  }
  return { wiki: resolve(positional[0]!), target: resolve(positional[1]!), exclusions, minRate };
}

function main(argv: string[]): number {
  let args: ReturnType<typeof parseArgs>;
  try {
    args = parseArgs(argv);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return EXIT_USAGE;
  }

  for (const [label, dir] of [
    ["wiki", args.wiki],
    ["target", args.target],
  ] as const) {
    if (!existsSync(dir) || !lstatSync(dir).isDirectory()) {
      console.error(`audit_anchor_invariant: ${label} directory does not exist: ${dir}`);
      return EXIT_USAGE;
    }
  }

  const targetReal = realpathSync(args.target);
  const excluded = (rel: string) =>
    args.exclusions.some((entry) => rel === entry || rel.startsWith(`${entry}/`));

  const targetFiles = walk(args.target).map((path) => relative(args.target, path));
  // Unit dictionary: the same extension whitelist the legacy metric uses, so the two metrics
  // argue about the same population of files. Wiki-internal .md links resolve to nothing.
  const unitFiles = targetFiles.filter((file) => CODE_EXT.test(file) && !circular(file));
  const resolveUnit = makeResolver(unitFiles);

  const pages = walk(args.wiki)
    .filter((path) => path.endsWith(".md") && !excluded(relative(args.wiki, path)))
    .sort();

  let legacyClaims = 0;
  let legacyAnchored = 0;
  let legacyInferred = 0;
  let pairs = 0;
  let covered = 0;
  let anchorsTotal = 0;
  let anchorsProving = 0;
  let fenceOnlyPairs = 0;
  const namedFiles = new Set<string>();
  const unresolved = new Set<string>();
  const uncoveredPairs: { page: string; file: string }[] = [];

  for (const pagePath of pages) {
    const page = relative(args.wiki, pagePath);
    const raw = readFileSync(pagePath, "utf8");

    const legacy = legacyPage(raw);
    legacyClaims += legacy.claims;
    legacyAnchored += legacy.anchored;
    legacyInferred += legacy.inferred;

    const text = normalize(raw);
    const proven = new Set<string>();

    // Masking is why an anchor cannot enrol the unit it satisfies. It removes EXACTLY the
    // anchor's own path token, and only when the anchor proves something. Masking the whole
    // span was a denominator hole: `(src: bogus/x.py `<any prose>`)` is anchor-shaped markup
    // that proves nothing, yet it swallowed every mention inside it — measured 202 -> 99 pairs
    // on arm C with the numerator frozen at 85. Quote text stays in the mention scan; if a page
    // quotes a line that names another file, the page does talk about that file.
    const masked = text.replace(new RegExp(ANCHOR_SRC, "g"), (full, path: string, quote: string) => {
      anchorsTotal += 1;
      const unit = anchorUnit(args.target, targetReal, path, quote, resolveUnit);
      if (unit === null) return full;
      anchorsProving += 1;
      proven.add(unit);
      const at = full.indexOf(path, "(src:".length);
      return at < 0 ? full : full.slice(0, at) + " ".repeat(path.length) + full.slice(at + path.length);
    });
    const mentioned = mentionsIn(masked, resolveUnit, unresolved);
    const inProse = mentionsIn(proseOnly(masked), resolveUnit, new Set());

    for (const unit of mentioned) {
      pairs += 1;
      namedFiles.add(unit);
      if (!inProse.has(unit)) fenceOnlyPairs += 1;
      if (proven.has(unit)) covered += 1;
      else uncoveredPairs.push({ page, file: unit });
    }
  }

  const legacyRate = legacyClaims === 0 ? 0 : legacyAnchored / legacyClaims;
  const rate = pairs === 0 ? 0 : covered / pairs;
  const failures: string[] = [];
  if (args.minRate !== null && rate < args.minRate) {
    failures.push(
      `invariant_coverage ${(rate * 100).toFixed(1)}% < ${(args.minRate * 100).toFixed(1)}%`,
    );
  }

  console.log(
    JSON.stringify(
      {
        schema_version: "anchor-invariant@v1",
        status: args.minRate === null ? "reported" : failures.length === 0 ? "passed" : "failed",
        measured_set: args.exclusions.length
          ? `all pages except ${args.exclusions.join(", ")}`
          : "all pages",
        excluded: args.exclusions,
        pages: pages.length,
        // Positive control. Must equal the deployed auditor's claims.c1_shaped / claims.anchored.
        legacy: {
          claims: legacyClaims,
          anchored: legacyAnchored,
          inferred: legacyInferred,
          anchor_rate: legacyRate,
        },
        invariant: {
          pairs,
          covered,
          rate,
          distinct_files_named: namedFiles.size,
          units_available: unitFiles.length,
          // Gate these two against a frozen baseline as well as the rate: de-naming is the
          // residual channel and it only shows here.
          fence_only_pairs: fenceOnlyPairs,
        },
        // Anchor spam is the channel this metric does NOT close: one valid quote per uncovered
        // pair buys 100% with no verification. It cannot hide here — spam shows as
        // per_covered_pair collapsing toward 1.0 while `pairs` stays put. Floor it against a
        // frozen baseline, do not read the rate alone.
        anchors: {
          total: anchorsTotal,
          proving: anchorsProving,
          per_covered_pair: covered === 0 ? 0 : anchorsProving / covered,
        },
        unresolved_mentions: {
          total: unresolved.size,
          tokens: [...unresolved].sort(),
        },
        uncovered_pairs: uncoveredPairs,
        failures,
      },
      null,
      2,
    ),
  );

  return failures.length > 0 ? EXIT_FAILED : 0;
}

process.exit(main(process.argv.slice(2)));
