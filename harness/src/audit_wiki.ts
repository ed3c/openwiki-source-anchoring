#!/usr/bin/env bun
// T0 mechanical gate for source-anchored generated documentation.
// Exit 0 = all thresholds pass; 2 = one or more evidence thresholds fail;
// 3 = audit incomplete because an input/resource boundary was reached; 64 = usage/path error.
//
// The gate establishes path and lexical validity. It does not establish semantic entailment.
import {
  existsSync,
  lstatSync,
  opendirSync,
  readFileSync,
  realpathSync,
} from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";

const CIRCULAR = [".openwiki-review", "openwiki"];
const CODE_EXT = /\.(py|ts|tsx|js|mjs|sh|yaml|yml|json|toml)$/;
const ANCHOR_RE = /\(src:\s*([^\s`]+)\s+`([^`]+)`\s*\)/g;
const CODE_REF_RE = /`([A-Za-z0-9_][A-Za-z0-9_/.-]*\.[A-Za-z]+)`/g;

const EXIT_FAILED = 2;
const EXIT_INCOMPLETE = 3;
const EXIT_USAGE = 64;

const DEFAULT_LIMITS = {
  max_files: 50_000,
  max_file_bytes: 8 * 1024 * 1024,
  max_total_bytes: 256 * 1024 * 1024,
  max_page_bytes: 2 * 1024 * 1024,
  max_anchors_per_page: 10_000,
  max_claims_per_page: 10_000,
  max_depth: 64,
  timeout_ms: 30_000,
} as const;

type ResourceLimits = {
  max_files: number;
  max_file_bytes: number;
  max_total_bytes: number;
  max_page_bytes: number;
  max_anchors_per_page: number;
  max_claims_per_page: number;
  max_depth: number;
  timeout_ms: number;
};

type ResourceUsage = {
  filesystem_entries_seen: number;
  regular_files_seen: number;
  directories_seen: number;
  bytes_read: number;
  pages_read: number;
  anchors_seen: number;
  claim_blocks_seen: number;
  max_depth_seen: number;
};

type Anchor = { page: string; path: string; quote: string };
type Bad = Anchor & { reason: string };

type ParsedArgs = {
  wiki: string;
  target: string;
  exclusions: string[];
  limits: ResourceLimits;
};

class UsageError extends Error {}

class IncompleteAuditError extends Error {
  readonly category: "limit" | "input";
  readonly key: string;
  readonly path?: string;
  readonly limit?: number;
  readonly observed?: number;

  constructor(options: {
    category: "limit" | "input";
    key: string;
    message: string;
    path?: string;
    limit?: number;
    observed?: number;
  }) {
    super(options.message);
    this.name = "IncompleteAuditError";
    this.category = options.category;
    this.key = options.key;
    this.path = options.path;
    this.limit = options.limit;
    this.observed = options.observed;
  }
}

function parsePositiveInteger(name: string, raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new UsageError(`${name} must be a positive integer, got: ${raw}`);
  }
  return value;
}

function parseArgs(argv: string[]): ParsedArgs {
  const exclusions: string[] = [];
  const positional: string[] = [];
  const cli: Partial<Record<keyof ResourceLimits, string>> = {};
  const limitFlags: Record<string, keyof ResourceLimits> = {
    "--max-files": "max_files",
    "--max-file-bytes": "max_file_bytes",
    "--max-total-bytes": "max_total_bytes",
    "--max-page-bytes": "max_page_bytes",
    "--max-anchors-per-page": "max_anchors_per_page",
    "--max-claims-per-page": "max_claims_per_page",
    "--max-depth": "max_depth",
    "--timeout-ms": "timeout_ms",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg === "--exclude") {
      const value = argv[++index];
      if (value === undefined) throw new UsageError("--exclude requires a comma-separated value");
      exclusions.push(...value.split(",").filter(Boolean));
      continue;
    }
    const limitKey = limitFlags[arg];
    if (limitKey !== undefined) {
      const value = argv[++index];
      if (value === undefined) throw new UsageError(`${arg} requires a value`);
      cli[limitKey] = value;
      continue;
    }
    if (arg.startsWith("--")) throw new UsageError(`unknown option: ${arg}`);
    positional.push(arg);
  }

  if (positional.length !== 2) {
    throw new UsageError(
      "usage: audit_wiki.ts <wiki-dir> <target-repo-dir> [--exclude a,b] " +
        "[--max-files N] [--max-file-bytes N] [--max-total-bytes N] " +
        "[--max-page-bytes N] [--max-anchors-per-page N] " +
        "[--max-claims-per-page N] [--max-depth N] [--timeout-ms N]",
    );
  }

  const environment: Record<keyof ResourceLimits, string | undefined> = {
    max_files: process.env.OPENWIKI_MAX_FILES,
    max_file_bytes: process.env.OPENWIKI_MAX_FILE_BYTES,
    max_total_bytes: process.env.OPENWIKI_MAX_TOTAL_BYTES,
    max_page_bytes: process.env.OPENWIKI_MAX_PAGE_BYTES,
    max_anchors_per_page: process.env.OPENWIKI_MAX_ANCHORS_PER_PAGE,
    max_claims_per_page: process.env.OPENWIKI_MAX_CLAIMS_PER_PAGE,
    max_depth: process.env.OPENWIKI_MAX_DEPTH,
    timeout_ms: process.env.OPENWIKI_TIMEOUT_MS,
  };

  const limits = Object.fromEntries(
    (Object.keys(DEFAULT_LIMITS) as (keyof ResourceLimits)[]).map((key) => [
      key,
      parsePositiveInteger(key, cli[key] ?? environment[key], DEFAULT_LIMITS[key]),
    ]),
  ) as ResourceLimits;

  return {
    wiki: resolve(positional[0]!),
    target: resolve(positional[1]!),
    exclusions,
    limits,
  };
}

class ResourceBudget {
  readonly limits: ResourceLimits;
  readonly usage: ResourceUsage = {
    filesystem_entries_seen: 0,
    regular_files_seen: 0,
    directories_seen: 0,
    bytes_read: 0,
    pages_read: 0,
    anchors_seen: 0,
    claim_blocks_seen: 0,
    max_depth_seen: 0,
  };

  private readonly startedAt = Date.now();
  private readonly textCache = new Map<string, string>();

  constructor(limits: ResourceLimits) {
    this.limits = limits;
  }

  checkTime(path?: string): void {
    const elapsed = Date.now() - this.startedAt;
    if (elapsed > this.limits.timeout_ms) {
      throw new IncompleteAuditError({
        category: "limit",
        key: "timeout_ms",
        message: `audit exceeded timeout_ms (${elapsed} > ${this.limits.timeout_ms})`,
        path,
        limit: this.limits.timeout_ms,
        observed: elapsed,
      });
    }
  }

  observeEntry(path: string, kind: "file" | "directory" | "symlink", depth: number): void {
    this.checkTime(path);
    this.usage.filesystem_entries_seen += 1;
    this.usage.max_depth_seen = Math.max(this.usage.max_depth_seen, depth);
    if (kind === "file") this.usage.regular_files_seen += 1;
    if (kind === "directory") this.usage.directories_seen += 1;

    if (this.usage.filesystem_entries_seen > this.limits.max_files) {
      throw new IncompleteAuditError({
        category: "limit",
        key: "max_files",
        message:
          `filesystem entry budget exceeded ` +
          `(${this.usage.filesystem_entries_seen} > ${this.limits.max_files})`,
        path,
        limit: this.limits.max_files,
        observed: this.usage.filesystem_entries_seen,
      });
    }
    if (depth > this.limits.max_depth) {
      throw new IncompleteAuditError({
        category: "limit",
        key: "max_depth",
        message: `repository depth exceeded (${depth} > ${this.limits.max_depth})`,
        path,
        limit: this.limits.max_depth,
        observed: depth,
      });
    }
  }

  readText(path: string, kind: "page" | "source"): string {
    this.checkTime(path);
    const cached = this.textCache.get(path);
    if (cached !== undefined) return cached;

    let stat;
    try {
      stat = lstatSync(path);
    } catch {
      throw new IncompleteAuditError({
        category: "input",
        key: "unreadable_file",
        message: "file metadata cannot be read",
        path,
      });
    }
    if (!stat.isFile()) {
      throw new IncompleteAuditError({
        category: "input",
        key: "not_regular_file",
        message: "input is not a regular file",
        path,
      });
    }

    const perFileLimit = kind === "page" ? this.limits.max_page_bytes : this.limits.max_file_bytes;
    const limitKey = kind === "page" ? "max_page_bytes" : "max_file_bytes";
    if (stat.size > perFileLimit) {
      throw new IncompleteAuditError({
        category: "limit",
        key: limitKey,
        message: `${limitKey} exceeded (${stat.size} > ${perFileLimit})`,
        path,
        limit: perFileLimit,
        observed: stat.size,
      });
    }
    if (this.usage.bytes_read + stat.size > this.limits.max_total_bytes) {
      throw new IncompleteAuditError({
        category: "limit",
        key: "max_total_bytes",
        message:
          `max_total_bytes exceeded ` +
          `(${this.usage.bytes_read + stat.size} > ${this.limits.max_total_bytes})`,
        path,
        limit: this.limits.max_total_bytes,
        observed: this.usage.bytes_read + stat.size,
      });
    }

    let bytes: Buffer;
    try {
      bytes = readFileSync(path);
    } catch {
      throw new IncompleteAuditError({
        category: "input",
        key: "unreadable_file",
        message: "file contents cannot be read",
        path,
      });
    }
    this.usage.bytes_read += bytes.byteLength;

    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new IncompleteAuditError({
        category: "input",
        key: "invalid_utf8",
        message: "file is not valid UTF-8 text",
        path,
      });
    }

    this.textCache.set(path, text);
    if (kind === "page") this.usage.pages_read += 1;
    return text;
  }

  observeAnchors(page: string, count: number): void {
    this.usage.anchors_seen += count;
    if (count > this.limits.max_anchors_per_page) {
      throw new IncompleteAuditError({
        category: "limit",
        key: "max_anchors_per_page",
        message:
          `anchor count on ${page} exceeded ` +
          `(${count} > ${this.limits.max_anchors_per_page})`,
        path: page,
        limit: this.limits.max_anchors_per_page,
        observed: count,
      });
    }
  }

  observeClaimBlocks(page: string, count: number): void {
    this.usage.claim_blocks_seen += count;
    if (count > this.limits.max_claims_per_page) {
      throw new IncompleteAuditError({
        category: "limit",
        key: "max_claims_per_page",
        message:
          `claim-block count on ${page} exceeded ` +
          `(${count} > ${this.limits.max_claims_per_page})`,
        path: page,
        limit: this.limits.max_claims_per_page,
        observed: count,
      });
    }
  }
}

function isInside(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

/** Walk without following symlinks. max_files counts traversed filesystem entries. */
function walk(root: string, budget: ResourceBudget): string[] {
  const files: string[] = [];

  const visit = (dir: string, depth: number): void => {
    budget.checkTime(dir);
    let directory;
    try {
      directory = opendirSync(dir);
    } catch {
      throw new IncompleteAuditError({
        category: "input",
        key: "unreadable_directory",
        message: "directory cannot be read",
        path: dir,
      });
    }

    try {
      for (;;) {
        const entry = directory.readSync();
        if (entry === null) break;
        const name = entry.name;
        if (name === ".git" || name === "node_modules") continue;
        const path = join(dir, name);
        let stat;
        try {
          stat = lstatSync(path);
        } catch {
          throw new IncompleteAuditError({
            category: "input",
            key: "unreadable_entry",
            message: "filesystem entry cannot be inspected",
            path,
          });
        }

        if (stat.isSymbolicLink()) {
          budget.observeEntry(path, "symlink", depth);
          continue;
        }
        if (stat.isDirectory()) {
          budget.observeEntry(path, "directory", depth + 1);
          visit(path, depth + 1);
          continue;
        }
        if (stat.isFile()) {
          budget.observeEntry(path, "file", depth);
          files.push(path);
        }
      }
    } finally {
      try {
        directory.closeSync();
      } catch {
        // A directory can already be closed after exhaustion; no audit result depends on this.
      }
    }
  };

  visit(root, 0);
  return files.sort();
}

function entrypoints(target: string, targetFiles: string[], budget: ResourceBudget): string[] {
  const python = targetFiles
    .filter((path) => path.endsWith(".py"))
    .filter((path) => !relative(target, path).startsWith("tests/"))
    .filter((path) => budget.readText(path, "source").includes("__main__"));
  const hooks = targetFiles.filter((path) => relative(target, path).startsWith(".githooks/"));
  return [...python, ...hooks].map((path) => relative(target, path)).sort();
}

function hasWellFormedAnchor(block: string): boolean {
  return new RegExp(ANCHOR_RE.source).test(block);
}

function auditPage(
  target: string,
  targetReal: string,
  page: string,
  text: string,
  budget: ResourceBudget,
) {
  const anchors: Anchor[] = [];
  const bad: Bad[] = [];

  const anchorTokens = [...text.matchAll(/\(src:/g)].length;
  budget.observeAnchors(page, anchorTokens);

  for (const match of text.matchAll(/(^|[^(])src:\s*[^\s`]+\s+`[^`]+`/g)) {
    bad.push({
      page,
      path: "(unparsed)",
      quote: match[0]!.trim().slice(0, 120),
      reason:
        "anchor missing its opening parenthesis: must start with `(src:` and not nest inside another parenthesis",
    });
  }

  const parsed = [...text.matchAll(new RegExp(ANCHOR_RE.source, "g"))];
  if (anchorTokens > parsed.length) {
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
    budget.checkTime(page);
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

    const actualRel = relative(targetReal, actualPath);
    if (CIRCULAR.some((dir) => actualRel === dir || actualRel.startsWith(`${dir}/`))) {
      bad.push({
        ...anchor,
        reason: `circular evidence through symlink: ${actualRel.split("/")[0]} is generated output`,
      });
      continue;
    }

    let actualStat;
    try {
      actualStat = lstatSync(actualPath);
    } catch {
      bad.push({ ...anchor, reason: "anchor target cannot be inspected" });
      continue;
    }
    if (!actualStat.isFile()) {
      bad.push({ ...anchor, reason: "anchor target is not a regular file" });
      continue;
    }

    if (!budget.readText(actualPath, "source").includes(anchor.quote)) {
      bad.push({ ...anchor, reason: "quote not found in that file" });
    }
  }

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
  budget.observeClaimBlocks(page, withRef.length);

  const inferred = withRef.filter((block) => block.includes("(inferred"));
  const claims = withRef.filter((block) => !block.includes("(inferred"));
  return { anchors, bad, claims, inferred, refs };
}

function measuredSet(exclusions: string[]): string {
  return exclusions.length ? `all pages except ${exclusions.join(", ")}` : "all pages";
}

function printIncomplete(args: ParsedArgs, budget: ResourceBudget, error: IncompleteAuditError): void {
  console.log(
    JSON.stringify(
      {
        schema_version: "wiki-anchor-audit@v4",
        complete: false,
        status: "incomplete",
        measured_set: measuredSet(args.exclusions),
        excluded: args.exclusions,
        pages: budget.usage.pages_read,
        resource_limits: budget.limits,
        resource_usage: budget.usage,
        limit_failure:
          error.category === "limit"
            ? {
                key: error.key,
                path: error.path ?? null,
                limit: error.limit ?? null,
                observed: error.observed ?? null,
                message: error.message,
              }
            : null,
        input_failure:
          error.category === "input"
            ? { key: error.key, path: error.path ?? null, message: error.message }
            : null,
        invalid_anchors: [],
        unanchored_claims: [],
        failures: [`audit incomplete: ${error.message}`],
      },
      null,
      2,
    ),
  );
}

function audit(args: ParsedArgs, budget: ResourceBudget): number {
  for (const [label, dir] of [
    ["wiki", args.wiki],
    ["target", args.target],
  ] as const) {
    if (!existsSync(dir) || !lstatSync(dir).isDirectory()) {
      throw new UsageError(`audit_wiki: ${label} directory does not exist: ${dir}`);
    }
  }

  const targetReal = realpathSync(args.target);
  const excluded = (rel: string) =>
    args.exclusions.some((entry) => rel === entry || rel.startsWith(`${entry}/`));
  const wikiFiles = walk(args.wiki, budget);
  const targetFiles = walk(args.target, budget);
  const pages = wikiFiles.filter((path) => path.endsWith(".md") && !excluded(relative(args.wiki, path)));

  let anchorCount = 0;
  const badAnchors: Bad[] = [];
  let claimCount = 0;
  let anchoredClaimCount = 0;
  let inferredCount = 0;
  const unanchored: { page: string; block: string }[] = [];
  const allRefs = new Set<string>();
  const pageTexts = new Map<string, string>();

  for (const pagePath of pages) {
    budget.checkTime(pagePath);
    const page = relative(args.wiki, pagePath);
    const text = budget.readText(pagePath, "page");
    pageTexts.set(pagePath, text);
    const result = auditPage(args.target, targetReal, page, text, budget);
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

  const allFiles = targetFiles.map((path) => relative(args.target, path));
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

  const eps = entrypoints(args.target, targetFiles, budget);
  const wikiText = pages.map((path) => pageTexts.get(path)!).join("\n");
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

  budget.checkTime();
  console.log(
    JSON.stringify(
      {
        schema_version: "wiki-anchor-audit@v4",
        complete: true,
        status: failures.length === 0 ? "passed" : "failed",
        measured_set: measuredSet(args.exclusions),
        excluded: args.exclusions,
        pages: pages.length,
        resource_limits: budget.limits,
        resource_usage: budget.usage,
        limit_failure: null,
        input_failure: null,
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

  return failures.length > 0 ? EXIT_FAILED : 0;
}

function main(argv: string[]): number {
  let args: ParsedArgs;
  try {
    args = parseArgs(argv);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return EXIT_USAGE;
  }

  const budget = new ResourceBudget(args.limits);
  try {
    return audit(args, budget);
  } catch (error) {
    if (error instanceof UsageError) {
      console.error(error.message);
      return EXIT_USAGE;
    }
    if (error instanceof IncompleteAuditError) {
      printIncomplete(args, budget, error);
      return EXIT_INCOMPLETE;
    }
    throw error;
  }
}

process.exit(main(process.argv.slice(2)));
