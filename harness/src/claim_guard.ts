#!/usr/bin/env bun
// Stable claim-ID preservation guard for mutation loops.
//
// A claim block may carry an explicit marker:
//   <!-- claim-id: stable-id -->
//
// `inventory` snapshots those IDs and block hashes. `check` then classifies each original claim as
// preserved, corrected (same ID, changed block), or explicitly withdrawn with a reason. A missing
// ID without an approved withdrawal exits 2. Pages without claim IDs remain compatible and rely
// on the existing word-floor fallback.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const CLAIM_ID_RE = /<!--\s*claim-id:\s*([A-Za-z0-9][A-Za-z0-9._:-]{0,127})\s*-->/g;
const EXIT_FAILED = 2;
const EXIT_USAGE = 64;

type ClaimRecord = {
  id: string;
  block_hash: string;
  block_preview: string;
};

type Inventory = {
  schema_version: "claim-inventory@1.0.0";
  page: string;
  enforced: boolean;
  status: "passed" | "failed";
  claims: ClaimRecord[];
  duplicate_ids: string[];
  failures: string[];
};

type Disposition = {
  claim_id: string;
  disposition: "withdrawn";
  reason: string;
};

function usage(): never {
  console.error(
    "usage: claim_guard.ts inventory <page> | " +
      "claim_guard.ts check <before-inventory.json> <page> <dispositions.json>",
  );
  process.exit(EXIT_USAGE);
}

function readUtf8(path: string): string {
  const bytes = readFileSync(path);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`not valid UTF-8: ${path}`);
  }
}

function markdownBlocks(text: string): string[] {
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

function normalizeBlock(block: string): string {
  return block.replace(/\s+/g, " ").trim();
}

function hashBlock(block: string): string {
  return createHash("sha256").update(normalizeBlock(block), "utf8").digest("hex");
}

function inventory(pagePath: string): Inventory {
  const claims: ClaimRecord[] = [];
  const seen = new Set<string>();
  const duplicateIds = new Set<string>();

  for (const block of markdownBlocks(readUtf8(pagePath))) {
    const ids = [...block.matchAll(new RegExp(CLAIM_ID_RE.source, "g"))].map((match) => match[1]!);
    for (const id of ids) {
      if (seen.has(id)) duplicateIds.add(id);
      seen.add(id);
      claims.push({
        id,
        block_hash: hashBlock(block),
        block_preview: normalizeBlock(block).slice(0, 240),
      });
    }
  }

  const failures = [...duplicateIds]
    .sort()
    .map((id) => `duplicate claim-id: ${id}`);
  return {
    schema_version: "claim-inventory@1.0.0",
    page: pagePath,
    enforced: claims.length > 0,
    status: failures.length === 0 ? "passed" : "failed",
    claims: claims.sort((a, b) => a.id.localeCompare(b.id)),
    duplicate_ids: [...duplicateIds].sort(),
    failures,
  };
}

function loadDispositions(path: string): Disposition[] {
  if (!existsSync(path)) return [];
  const raw = JSON.parse(readUtf8(path)) as unknown;
  if (!Array.isArray(raw)) throw new Error("claim dispositions must be a JSON array");

  return raw.map((item, index) => {
    if (typeof item !== "object" || item === null) {
      throw new Error(`claim disposition ${index} must be an object`);
    }
    const record = item as Record<string, unknown>;
    if (
      typeof record.claim_id !== "string" ||
      record.disposition !== "withdrawn" ||
      typeof record.reason !== "string" ||
      record.reason.trim() === ""
    ) {
      throw new Error(
        `claim disposition ${index} requires claim_id, disposition=withdrawn, and a non-empty reason`,
      );
    }
    return {
      claim_id: record.claim_id,
      disposition: "withdrawn",
      reason: record.reason.trim(),
    };
  });
}

function check(beforePath: string, pagePath: string, dispositionsPath: string): number {
  const before = JSON.parse(readUtf8(beforePath)) as Inventory;
  if (before.schema_version !== "claim-inventory@1.0.0" || before.status !== "passed") {
    throw new Error("baseline claim inventory is missing, invalid, or failed");
  }

  const after = inventory(pagePath);
  const dispositionList = loadDispositions(dispositionsPath);
  const dispositions = new Map(dispositionList.map((item) => [item.claim_id, item]));
  const afterById = new Map(after.claims.map((claim) => [claim.id, claim]));

  const preserved: string[] = [];
  const corrected: string[] = [];
  const withdrawn: { claim_id: string; reason: string }[] = [];
  const missing: string[] = [];
  const failures = [...after.failures];

  for (const claim of before.claims) {
    const current = afterById.get(claim.id);
    if (current !== undefined) {
      if (current.block_hash === claim.block_hash) preserved.push(claim.id);
      else corrected.push(claim.id);
      continue;
    }

    const disposition = dispositions.get(claim.id);
    if (disposition !== undefined) {
      withdrawn.push({ claim_id: claim.id, reason: disposition.reason });
    } else {
      missing.push(claim.id);
      failures.push(`claim-id missing without disposition: ${claim.id}`);
    }
  }

  for (const disposition of dispositionList) {
    if (!before.claims.some((claim) => claim.id === disposition.claim_id)) {
      failures.push(`disposition references unknown baseline claim-id: ${disposition.claim_id}`);
    }
    if (afterById.has(disposition.claim_id)) {
      failures.push(`withdrawn claim-id is still present: ${disposition.claim_id}`);
    }
  }

  const receipt = {
    schema_version: "claim-preservation@1.0.0",
    status: failures.length === 0 ? "passed" : "failed",
    enforced: before.enforced,
    baseline_count: before.claims.length,
    current_count: after.claims.length,
    preserved: preserved.sort(),
    corrected: corrected.sort(),
    withdrawn: withdrawn.sort((a, b) => a.claim_id.localeCompare(b.claim_id)),
    missing: missing.sort(),
    duplicate_ids: after.duplicate_ids,
    failures,
  };
  console.log(JSON.stringify(receipt, null, 2));
  return failures.length === 0 ? 0 : EXIT_FAILED;
}

function main(argv: string[]): number {
  const mode = argv[0];
  try {
    if (mode === "inventory" && argv.length === 2) {
      const page = resolve(argv[1]!);
      const result = inventory(page);
      console.log(JSON.stringify(result, null, 2));
      return result.status === "passed" ? 0 : EXIT_FAILED;
    }
    if (mode === "check" && argv.length === 4) {
      return check(resolve(argv[1]!), resolve(argv[2]!), resolve(argv[3]!));
    }
    usage();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return EXIT_USAGE;
  }
}

process.exit(main(process.argv.slice(2)));
