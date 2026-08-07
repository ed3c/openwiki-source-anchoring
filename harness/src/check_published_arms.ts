#!/usr/bin/env bun
/**
 * Re-derive the target-independent half of every published arm figure and compare it with
 * data/arm-comparison.json.
 *
 * `audit_arms.ts` is the authoritative full re-audit against the vendored target. This
 * companion check makes a different failure mode visible: an anchor rate can rise because the
 * author wrote fewer blocks that match the claim heuristic. It therefore prints the numerator,
 * denominator, and claim density beside every rate.
 *
 * Usage: bun run harness/src/check_published_arms.ts [comparison.json]
 * Exit 0 = every target-independent field matches. Exit 2 = drift.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CODE_EXT = /\.(py|ts|tsx|js|mjs|sh|yaml|yml|json|toml)$/;
const ANCHOR_RE = /\(src:\s*([^\s`]+)\s+`([^`]+)`\s*\)/g;
const CODE_REF_RE = /`([A-Za-z0-9_][A-Za-z0-9_/.-]*\.[A-Za-z]+)`/g;

const ARMS: Record<string, string> = {
  A: "wiki/arm-a-baseline",
  B: "wiki/arm-b-retrofit",
  Bs: "wiki/arm-b-stripped",
  C: "wiki/arm-c-generated",
  D: "wiki/arm-d-gate-driven",
};

function markdownPages(dir: string): string[] {
  const output: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current)) {
      const path = join(current, entry);
      const stat = statSync(path);
      if (stat.isDirectory()) walk(path);
      else if (path.endsWith(".md")) output.push(path);
    }
  };
  walk(dir);
  return output
    .filter((path) => !relative(dir, path).split("/").includes("nonofficial"))
    .sort();
}

function markdownBlocks(text: string): string[] {
  const output: string[] = [];
  let current: string[] = [];
  let inFence = false;
  let inFrontmatter = false;
  const flush = (): void => {
    if (current.length > 0) {
      output.push(current.join(" "));
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
      output.push(line);
      continue;
    }
    current.push(line);
  }
  flush();
  return output;
}

function measure(dir: string) {
  const pages = markdownPages(dir);
  let anchors = 0;
  let claims = 0;
  let anchored = 0;
  let inferred = 0;
  let words = 0;

  for (const page of pages) {
    const text = readFileSync(page, "utf8");
    words += text.split(/\s+/).filter(Boolean).length;
    anchors += [...text.matchAll(new RegExp(ANCHOR_RE.source, "g"))].length;

    for (const block of markdownBlocks(text)) {
      const qualifies = [...block.matchAll(new RegExp(CODE_REF_RE.source, "g"))].some(
        (match) => CODE_EXT.test(match[1]!),
      );
      if (!qualifies) continue;
      if (block.includes("(inferred")) {
        inferred += 1;
        continue;
      }
      claims += 1;
      if (new RegExp(ANCHOR_RE.source).test(block)) anchored += 1;
    }
  }

  return { pages: pages.length, anchors, claims, anchored, inferred, words };
}

const comparisonPath = process.argv[2] ?? join(ROOT, "data/arm-comparison.json");
const recorded = JSON.parse(readFileSync(comparisonPath, "utf8")).arms;
const failures: string[] = [];

console.log(
  `${"arm".padEnd(4)}${"pages".padStart(7)}${"anchors".padStart(9)}` +
    `${"anchored".padStart(10)}${"claims".padStart(8)}${"rate".padStart(9)}` +
    `${"claims/1k words".padStart(17)}`,
);

for (const [arm, relativeDir] of Object.entries(ARMS)) {
  const got = measure(join(ROOT, relativeDir));
  const want = recorded[arm];
  const rate = got.claims === 0 ? 0 : got.anchored / got.claims;
  const density = got.words === 0 ? 0 : (got.claims / got.words) * 1000;

  console.log(
    `${arm.padEnd(4)}${String(got.pages).padStart(7)}${String(got.anchors).padStart(9)}` +
      `${String(got.anchored).padStart(10)}${String(got.claims).padStart(8)}` +
      `${(rate * 100).toFixed(1).padStart(8)}%${density.toFixed(2).padStart(17)}`,
  );

  for (const [field, actual] of [
    ["pages", got.pages],
    ["anchors", got.anchors],
    ["anchored", got.anchored],
    ["claims", got.claims],
    ["inferred", got.inferred],
  ] as const) {
    if (want[field] !== actual) {
      failures.push(`arm ${arm}: ${field} recorded ${want[field]}, measured ${actual}`);
    }
  }
  if (Math.abs(want.anchor_rate - rate) > 1e-4) {
    failures.push(
      `arm ${arm}: anchor_rate recorded ${want.anchor_rate}, measured ${rate.toFixed(4)}`,
    );
  }
}

console.log(
  "\nScope: this check validates figures derived from wiki text and exposes denominator movement. " +
    "Run `bun run harness/src/audit_arms.ts` for the full target-dependent re-audit, including " +
    "lexical validity and exit status.",
);

if (failures.length > 0) {
  console.error(`\nFAIL: ${failures.length} published figure(s) drifted:`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(2);
}

console.log("\nPASS: target-independent arm figures and denominators match the published data.");
