---
type: Reference
title: Production profiles and evidence
description: Which of the three gate profiles is authoritative, the receipt schema ladder and what each level may claim, why two journey scripts are legacy-and-inadmissible, and the provenance of the 129 committed artifacts nothing here regenerates.
tags: [terminal-operator, profiles, receipts, provenance]
node_kind: RepoDoc
ingest_lane: concept
repo: local/agent-skills-repo
commit: 5d3c42f
covers: [production-profiles, receipt-ladder, committed-artifacts]
libraries: [bun]
generated_by: claude-code+opus (skill-bettor openwiki port)
generated_at: null
---

# Production profiles and evidence

Three profile JSON files and six receipt schemas. Getting them confused is how a preflight result gets
read as proof of writer safety, which the operator's own contract forbids
(src: .agents/skills/repo-terminal-operator/SKILL.md `A preflight PASS must emit the next writer-production mode and cannot admit writer safety.`).

## The three profiles

| File | Scope | Timeout | Command |
|---|---|---|---|
| `code-quality.profile.json` | task-scoped static + bounded tests | 90 s | `bun run .agents/.../repo-code-quality.ts` |
| `production-use.profile.json` | `writer-entrypoint` | 60 s | `bun run ../../skills/repo-neural-perception/scripts/writer-contained-production-profile.ts` |
| `evidence-cost-collector.production.profile.json` | `evidence-cost-collector/axis-scoped` | 15 s | `bun test` over two production suites |

The production profile names the three safety properties it must establish
(src: .agents/skills/repo-terminal-operator/production-use.profile.json `"race-condition",`) and its evidence scope
(src: .agents/skills/repo-terminal-operator/production-use.profile.json `"required_evidence_scope": "writer-entrypoint",`). The collector profile
adds three more and is production-only
(src: .agents/skills/repo-terminal-operator/evidence-cost-collector.production.profile.json `"nested-receipt-tamper"`)
(src: .agents/skills/repo-terminal-operator/evidence-cost-collector.production.profile.json `"mode": "production-only",`).

Its command resolves outside this repository — see
[Terminal operator overview](overview.md#why-it-cannot-run-here).

## The receipt ladder

| Schema | Produced by | May claim |
|---|---|---|
| `repo-terminal-preflight-receipt@v1` | `repo-adapter.ts --preflight` | the lease, HEAD, paths and evidence bindings were valid |
| `repo-terminal-code-quality-receipt@v1` | `task-quality-runner.ts` | eight named stages ran clean, with observed test counts |
| `repo-terminal-writer-receipt@v1` | `writer-entrypoint.ts` | one artifact was published or matched, plus recovery outcome |
| `repo-terminal-production-journey-receipt@v1` | `production-journey.ts`, `production-safety-journey.ts` | **preflight behaviour only** |
| `repo-terminal-writer-production-journey-receipt@v2` | the contained writer journey | writer race, silent-failure and leak safety |
| `small-loop-run-receipt@v1` | `small-loop-runner.ts` | the whole run, with per-stage status and typed failures |

The gate contract binds each gate to exactly one schema
(src: .agents/skills/repo-terminal-operator/small-loop-gate-contract.ts `? "repo-terminal-code-quality-receipt@v1"`)
(src: .agents/skills/repo-terminal-operator/small-loop-gate-contract.ts `: "repo-terminal-writer-production-journey-receipt@v2";`), and requires the
production receipt to establish all three safety properties, sorted and complete
(src: .agents/skills/repo-terminal-operator/small-loop-gate-contract.ts `const expectedSafety = ["race-condition", "resource-leak", "silent-failure"];`)
(src: .agents/skills/repo-terminal-operator/small-loop-gate-contract.ts `errors.push("production safety evidence incomplete");`), with the evidence
scope carried through to artifact validation
(src: .agents/skills/repo-terminal-operator/small-loop-gate-contract.ts `requiredEvidenceScope: "writer-entrypoint",`).

(inferred) A version number is doing policy work here. `@v1` and `@v2` of the journey receipt are not
successive releases of one document — they are two different claims, preflight-scope and writer-scope,
and pinning `@v2` in the gate is what makes an old receipt inadmissible rather than merely outdated.

## Active versus legacy

The `@v1` journey scripts still exist and still emit receipts. `production-journey.ts` records its scope
honestly (src: artifacts/repo-terminal-operator/production-journey.receipt.json `"evidence_scope": "deterministic-preflight-entrypoint",`)
and states that writer safety was not observed
(src: artifacts/repo-terminal-operator/production-journey.receipt.json `"writer_execution_safety": "unobserved-repo-local-agent-boundary",`).
`production-safety-journey.ts` refuses to run without a carrier-owned run id
(src: .agents/skills/repo-terminal-operator/production-safety-journey.ts `throw new Error("production journey requires a carrier-owned run id");`),
as does the native escape probe
(src: .agents/skills/repo-terminal-operator/production-native-escape.ts `throw new Error("production journey requires carrier-owned native escape probe files");`).

The operator's contract is explicit about which one may admit
(src: .agents/skills/repo-terminal-operator/SKILL.md `is legacy-only and MUST NOT be used for admission.`)
and that running either journey directly on the host is invalid
(src: .agents/skills/repo-terminal-operator/SKILL.md `Direct host execution of either journey is invalid for admission.`).

(inferred) Keeping the legacy journey rather than deleting it is defensible only because its receipt
names its own limitation in two fields. A receipt that says `deterministic-preflight-entrypoint` cannot
be mistaken for writer evidence by anything that reads the scope — which is precisely why the gate reads
the scope rather than the status.

## The 129 committed artifacts

`artifacts/repo-terminal-operator/` contains 129 JSON files: 66
`writer-production-journey.<uuid>.receipt.json`, 24 `production-journey.*`, and 13 sets of per-run
packet fixtures (`valid-terminal-packet.json`, `stale-terminal-packet.json`,
`malformed-terminal-packet.json`) under UUID directories. The fixtures are the ones
`production-journey-fixture.ts` writes
(src: .agents/skills/repo-terminal-operator/production-journey-fixture.ts `export function writeJourneyFixtures(artifactRoot: string, workspaceRoot: string, outputRepo: string, head: string) {`).

Their status:

- **No script in this repository reads them.** They are not inputs to any gate, test or workflow.
- **No script here can regenerate them** — the code that wrote them cannot execute (see
  [Terminal operator overview](overview.md)).
- **Nothing expires them.** There is no retention rule, and the packet fixtures embed a `head` that is
  stale by construction.
- **`check_plan_package_compat.py` does not require any of them**, so deleting the directory turns no
  gate red — see [Plan-package compatibility](../governance/plan-package-compat.md).

(inferred) They are a historical record of runs made in the authoring workspace, committed with the
vendored source. Treat them as archaeology: useful for seeing the shape a real receipt takes, worthless
as evidence about this checkout. If the operator is ever made runnable here, this directory should be
regenerated rather than trusted — the packet fixtures in particular assert a HEAD that no longer exists.

## Related

- [Code-quality profile](code-quality-profile.md) · [Writer publication](writer-publication.md) · [Evidence cost](evidence-cost.md)
- [Data authority](../architecture/data-authority.md) — the repository-wide artifact ownership table.
