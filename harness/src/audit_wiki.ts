#!/usr/bin/env bun
// T0 mechanical gate for source-anchored generated documentation.
// Exit 0 = all thresholds pass; 2 = one or more thresholds fail; 64 = usage/path error.
//
// The gate establishes path and lexical validity. It does not establish semantic entailment.
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
} from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";

const CIRCULAR = [".openwiki-review", "openwiki"];
const CODE_EXT = /\.(py|ts|tsx|js|mjs|sh|yaml|yml|json|toml)$/;
const ANCHOR_RE = /\(src:\s*([^\s`]+)\s+`([^`]+)`\s*\)/g;
const CODE_REF_RE = /`([A-Za-z0-9_][A-Za-z0-9_/.-]*\.[A-Za-z]+)`/g;

type Anchor = { page: string; path: string; quote: string };
type Bad = Anchor & { reason: string };

function isInside(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

/**
 * Walk a repository without following symlinks.
 *
 * Following directory symlinks can escape the supplied root, traverse an untrusted tree, or
 * recurse through a cycle. Explicit anchor paths are handled separately and may point through an
 * internal symlink only when realpath still resolves inside the target root.
 */
function walk(dir: string, keep: (p: string) => boolean, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === ".git" || name === "node_modules") continue;
    const p = join(dir, name);
    const stat = lstatSync(p);
    if (stat.isSymbolicLink()) continue;
    if (stat.isDirectory()) walk(p, keep, out);
    else if (stat.isFile() && keep(p)) out.push(p);
  }
  return out;
}

function entrypoints(target: string): string[] {
  const py = walk(target, (p) => p.endsWith(".py"))
    .filter((p) => !relative(target, p).startsWith("tests/"))
    .filter((p) => readFileSync(p, "utf8").includes("__main__"));
  const hooks = existsSync(join(target, ".githooks"))
    ? walk(join(target, ".githooks"), () => true)
    : [];
  return [...py, ...hooks].map((p) => relative(target, p)).sort();
}

function hasWellFormedAnchor(block: string): boolean {
  return new RegExp(ANCHOR_RE.source).test(block);
}

function auditPage(target: string, targetReal: string, page: string, text: string) {
  const anchors: Anchor[] = [];
  const bad: Bad[] = [];

  // A source-looking token without the required opening parenthesis must not look verified.
  for (const match of text.matchAll(/(^|[^(])src:\s*[^\s`]+\s+`[^`]+`/g)) {
    bad.push({
      page,
      path: "(unparsed)",
      quote: match[0]!.trim().slice(0, 120),
      reason:
        "anchor missing its opening parenthesis: must start with `(src:` and not nest inside another parenthesis",
    });
  }

  // A malformed `(src:` token must never vanish from both the numerator and invalid count.
  const tokens = [...text.matchAll(/\(src:/g)].length;
  const parsed = [...text.matchAll(new RegExp(ANCHOR_RE.source, "g"))];
  if (tokens > parsed.length) {
    for (const match of text.matchAll(/\(src:[^)]*\)?/g)) {
      const fragment = match[0]!;
      if (!new RegExp(`^${ANCHOR_RE.source}$`).test(fragment)) {
        bad.push({
          page,
          path: "(unparsed)",
          quote: fragment.slice(0, 120),
          reason: "malformed anchor: expected one `(src: <path> `quote`)` per parenthesis",
        });
      }
    }
  }

  for (const match of text.matchAll(ANCHOR_RE)) {
    const anchor: Anchor = { page, path: match[1]!, quote: match[2]! };
    anchors.push(anchor);

    const lexicalPath = resolve(target, anchor.path);
    const lexicalRel = relative(target, lexicalPath);

    if (!isInside(target, lexicalPath)) {
      bad.push({ ...anchor, reason: "path escapes target" });
      continue;
    }

    if (CIRCULAR.some((dir) => lexicalRel === dir || lexicalRel.startsWith(`${dir}/`))) {
      bad.push({
        ...anchor,
        reason: `circular evidence: ${lexicalRel.split("/")[0]} is generated wiki output, not source`,
      });
      continue;
    }

    if (!existsSync(lexicalPath)) {
      bad.push({ ...anchor, reason: "file does not exist" });
      continue;
    }

    let actualPath: string;
    try {
      actualPath = realpathSync(lexicalPath);
    } catch {
      bad.push({ ...anchor, reason: "file cannot be resolved" });
      continue;
    }

    if (!isInside(targetReal, actualPath)) {
      bad.push({ ...anchor, reason: "symlink escapes target" });
      continue;
    }

    if (!lstatSync(actualPath).isFile()) {
      bad.push({ ...anchor, reason: "anchor target is not a regular file" });
      continue;
    }

    try {
      if (!readFileSync(actualPath, "utf8").includes(anchor.quote)) {
        bad.push({ ...anchor, reason: "quote not found in that file" });
      }
    } catch {
      bad.push({ ...anchor, reason: "file is not readable as UTF-8 text" });
    }
  }

  // A C1-shaped claim is a Markdown block containing a code-file reference.
  const refs = new Set<string>();
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

  const withRef = blocks.filter((block) => {
    let hasReference = false;
    for (const match of block.matchAll(CODE_REF_RE)) {
      if (!CODE_EXT.test(match[1]!)) continue;
      refs.add(match[1]!);
      hasReference = true;
    }
    return hasReference;
  });

  const inferred = withRef.filter((block) => block.includes("(inferred"));
  const claims = withRef.filter((block) => !block.includes("(inferred"));
  return { anchors, bad, claims, inferred, refs };
}

function main(argv: string[]): number {
  const exclusions: string[] = [];
  const positional: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--exclude") {
      exclusions.push(...(argv[++index] ?? "").split(",").filter(Boolean));
    } else {
      positional.push(argv[index]!);
    }
  }

  const wiki = positional[0] ? resolve(positional[0]) : "";
  const target = positional[1] ? resolve(positional[1]) : "";
  if (!wiki || !target) {
    console.error("usage: audit_wiki.ts <wiki-dir> <target-repo-dir> [--exclude a,b]");
    return 64;
  }

  for (const [label, dir] of [
    ["wiki", wiki],
    ["target", target],
  ] as const) {
    if (!existsSync(dir) || !lstatSync(dir).isDirectory()) {
      console.error(`audit_wiki: ${label} directory does not exist: ${dir}`);
      return 64;
    }
  }

  const targetReal = realpathSync(target);
  const excluded = (rel: string) =>
    exclusions.some((entry) => rel === entry || rel.startsWith(`${entry}/`));
  const pages = walk(wiki, (p) => p.endsWith(".md")).filter(
    (p) => !excluded(relative(wiki, p)),
  );

  let anchorCount = 0;
  let badAnchors: Bad[] = [];
  let claimCount = 0;
  let anchoredClaimCount = 0;
  let inferredCount = 0;
  const unanchored: { page: string; block: string }[] = [];
  const allRefs = new Set<string>();

  for (const pagePath of pages) {
    const page = relative(wiki, pagePath);
    const result = auditPage(target, targetReal, page, readFileSync(pagePath, "utf8"));
    anchorCount += result.anchors.length;
    badAnchors.push(...result.bad);
    claimCount += result.claims.length;
    inferredCount += result.inferred.length;
    anchoredClaimCount += result.claims.filter(hasWellFormedAnchor).length;

    for (const block of result.claims) {
      if (!hasWellFormedAnchor(block)) unanchored.push({ page, block: block.slice(0, 400) });
    }
    for (const ref of result.refs) allRefs.add(ref);
  }

  const allFiles = walk(target, () => true).map((p) => relative(target, p));
  const exactFiles = new Set(allFiles);
  const filesByBase = new Map<string, string[]>();
  for (const file of allFiles) {
    const base = file.split("/").pop()!;
    filesByBase.set(base, [...(filesByBase.get(base) ?? []), file]);
  }

  const resolvedExact: string[] = [];
  const resolvedLoose: string[] = [];
  const missingRefs: string[] = [];
  for (const ref of [...allRefs].sort()) {
    if (exactFiles.has(ref)) resolvedExact.push(ref);
    else if (
      allFiles.some((file) => file.endsWith(`/${ref}`)) ||
      filesByBase.has(ref.split("/").pop()!)
    ) {
      resolvedLoose.push(ref);
    } else {
      missingRefs.push(ref);
    }
  }

  const eps = entrypoints(target);
  const wikiText = pages.map((p) => readFileSync(p, "utf8")).join("\n");
  const uncovered = eps.filter((entrypoint) => !wikiText.includes(entrypoint));

  const anchorRate = claimCount === 0 ? 0 : anchoredClaimCount / claimCount;
  const verifiableShare =
    claimCount + inferredCount === 0 ? 0 : claimCount / (claimCount + inferredCount);
  const invalidParsed = badAnchors.filter((anchor) => anchor.path !== "(unparsed)").length;
  const malformed = badAnchors.length - invalidParsed;
  const lexicalValidity =
    anchorCount === 0 ? 0 : Math.max(0, (anchorCount - invalidParsed) / anchorCount);
  const coverage = eps.length === 0 ? 0 : (eps.length - uncovered.length) / eps.length;

  const failures: string[] = [];
  if (anchorRate < 0.85) failures.push(`anchor_rate ${(anchorRate * 100).toFixed(1)}% < 85%`);
  if (badAnchors.length > 0 || (anchorCount > 0 && lexicalValidity < 1)) {
    failures.push(
      `anchor_lexical_validity ${(lexicalValidity * 100).toFixed(1)}% < 100% ` +
        `(${badAnchors.length} invalid/malformed)`,
    );
  }

  const COVERAGE_FLOOR = 30 / 32;
  if (coverage < COVERAGE_FLOOR) {
    failures.push(
      `entrypoint_coverage ${(coverage * 100).toFixed(2)}% < ` +
        `${(COVERAGE_FLOOR * 100).toFixed(2)}% (baseline 30/32)`,
    );
  }
  if (claimCount + inferredCount > 0 && verifiableShare < 0.4) {
    failures.push(`verifiable_share ${(verifiableShare * 100).toFixed(1)}% < 40%`);
  }

  console.log(
    JSON.stringify(
      {
        schema_version: "wiki-anchor-audit@v3",
        measured_set: exclusions.length
          ? `all pages except ${exclusions.join(", ")}`
          : "all pages",
        excluded: exclusions,
        status: failures.length === 0 ? "passed" : "failed",
        pages: pages.length,
        anchor: {
          total: anchorCount,
          invalid: badAnchors.length,
          malformed,
          rate: anchorRate,
          lexical_validity: lexicalValidity,
          // Deprecated compatibility alias. Consumers should migrate to lexical_validity.
          correctness: lexicalValidity,
        },
        claims: {
          c1_shaped: claimCount,
          anchored: anchoredClaimCount,
          inferred: inferredCount,
          verifiable_share: verifiableShare,
        },
        code_refs: {
          total: allRefs.size,
          resolved_exact: resolvedExact.length,
          resolved_loose: resolvedLoose.length,
          missing: missingRefs.length,
          missing_paths: missingRefs,
          loose_paths: resolvedLoose,
        },
        entrypoints: {
          total: eps.length,
          uncovered: uncovered.length,
          coverage,
          uncovered_paths: uncovered,
        },
        invalid_anchors: badAnchors,
        unanchored_claims: unanchored,
        failures,
      },
      null,
      2,
    ),
  );

  return failures.length > 0 ? 2 : 0;
}

process.exit(main(process.argv.slice(2)));
