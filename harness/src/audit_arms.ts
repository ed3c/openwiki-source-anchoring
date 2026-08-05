#!/usr/bin/env bun
/**
 * Audit every published arm against the vendored target and compare the result to a
 * pinned baseline.
 *
 * The repository's other CI job runs the auditor against two fixtures.  That proves the
 * auditor works; it says nothing about whether the anchors in the published wikis still
 * resolve.  Measured 2026-08-05: eleven anchors across arms B, C and D were invalid purely
 * because publication rewrote the quoted text while the target it quotes was not in the
 * repository at all -- a failure mode that a fixture test cannot see and that reads, to a
 * reader, exactly like a defect in the wiki.
 *
 * Exit 0 = every arm matches its pinned numbers.  Exit 2 = drift.  Exit 64 = usage.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const HARNESS = dirname(new URL(import.meta.url).pathname);
const ROOT = join(HARNESS, "..", "..");
const AUDITOR = join(HARNESS, "audit_wiki.ts");
const TARGET = join(ROOT, "repo-snapshot");
const BASELINE = join(ROOT, "harness", "arms-baseline.json");

const ARMS = [
  "arm-a-baseline",
  "arm-b-retrofit",
  "arm-b-stripped",
  "arm-c-generated",
  "arm-d-gate-driven",
];

/** Only fields whose drift would change a published claim. Resource usage is excluded:
 *  it moves with the runner, not with the evidence. */
function pin(exitCode: number, d: any) {
  return {
    exit_code: exitCode,
    status: d.status,
    pages: d.pages,
    anchors_total: d.anchor?.total,
    anchors_invalid: d.anchor?.invalid,
    anchors_malformed: d.anchor?.malformed,
    anchor_rate: d.anchor?.rate,
    lexical_validity: d.anchor?.lexical_validity,
    claims_c1_shaped: d.claims?.c1_shaped,
    claims_anchored: d.claims?.anchored,
    claims_inferred: d.claims?.inferred,
    entrypoint_coverage: d.entrypoints?.coverage,
    code_refs_missing: d.code_refs?.missing,
    failures: d.failures ?? [],
  };
}

function measure(arm: string) {
  const run = spawnSync(
    "bun",
    ["run", AUDITOR, join(ROOT, "wiki", arm), TARGET, "--exclude", "nonofficial"],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  const text = run.stdout ?? "";
  const brace = text.indexOf("{");
  if (brace < 0) {
    console.error(`audit_arms: auditor produced no JSON for ${arm}`);
    console.error(text.slice(0, 400), run.stderr?.slice(0, 400));
    process.exit(2);
  }
  return pin(run.status ?? -1, JSON.parse(text.slice(brace)));
}

const write = process.argv.includes("--write");
if (process.argv.slice(2).some((a) => a !== "--write")) {
  console.error("usage: audit_arms.ts [--write]");
  process.exit(64);
}

const observed: Record<string, unknown> = {};
for (const arm of ARMS) observed[arm] = measure(arm);

if (write) {
  writeFileSync(
    BASELINE,
    `${JSON.stringify({ note: "Pinned by audit_arms.ts --write. Regenerating hides drift; change it only with the measurement that justifies it.", target: "repo-snapshot", arms: observed }, null, 1)}\n`,
  );
  console.log(`audit_arms: wrote ${BASELINE}`);
  process.exit(0);
}

let baseline: any;
try {
  baseline = JSON.parse(readFileSync(BASELINE, "utf8"));
} catch (error) {
  console.error(`audit_arms: cannot read the pinned baseline: ${String(error)}`);
  process.exit(2);
}

let drifted = 0;
for (const arm of ARMS) {
  const want = baseline.arms?.[arm];
  const got = observed[arm] as Record<string, unknown>;
  if (!want) {
    console.error(`FAIL ${arm}: absent from the pinned baseline`);
    drifted += 1;
    continue;
  }
  const diffs = Object.keys(got).filter(
    (k) => JSON.stringify(want[k]) !== JSON.stringify(got[k]),
  );
  if (diffs.length === 0) {
    console.log(`PASS ${arm}  exit=${got.exit_code} invalid=${got.anchors_invalid}`);
    continue;
  }
  drifted += 1;
  console.error(`FAIL ${arm}`);
  for (const k of diffs) {
    console.error(`  ${k}: pinned ${JSON.stringify(want[k])} -> now ${JSON.stringify(got[k])}`);
  }
}

if (drifted > 0) {
  console.error(`audit_arms: ${drifted} arm(s) drifted from the published numbers`);
  process.exit(2);
}
console.log("audit_arms: all arms match their published numbers");
