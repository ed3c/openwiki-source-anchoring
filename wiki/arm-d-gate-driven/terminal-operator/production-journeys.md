---
type: Component
title: Production journeys and the artifacts they leave behind
description: The scripts that exercise the operator end to end under adversarial conditions, which of them can admit writer safety, and an accurate inventory of the 129 files under artifacts/repo-terminal-operator.
tags: [terminal-operator, journeys, receipts, artifacts]
node_kind: RepoDoc
ingest_lane: concept
repo: arm-d/agent-skills-repo
covers: [production-journeys, journey-receipts, packet-fixtures]
libraries: [bun, typescript]
generated_by: claude-code+claude-opus-5
generated_at: null
---

# Production journeys and the artifacts they leave behind

## Which journey may admit what

`SKILL.md` is explicit that only one path counts: active admission evidence must
run through the contained writer profile, the preflight-only profile "remains
available for diagnosis but cannot admit writer safety", and "The older
`production-journey.ts` is legacy-only and MUST NOT be used for admission"
(src: .agents/skills/repo-terminal-operator/SKILL.md `is legacy-only and MUST NOT be used for admission`). Direct host execution
of either journey is also invalid
(src: .agents/skills/repo-terminal-operator/SKILL.md `Direct host execution of either journey is invalid for admission.`).

The three journey scripts differ by declared evidence scope, and the scope is in
the receipt rather than in a comment:

| Script | Receipt schema | Evidence scope |
|---|---|---|
| `production-safety-journey.ts` | (src: .agents/skills/repo-terminal-operator/production-safety-journey.ts `schema_version: "repo-terminal-production-journey-receipt@v1",`) | (src: .agents/skills/repo-terminal-operator/production-safety-journey.ts `evidence_scope: "deterministic-preflight-entrypoint",`) |
| `writer-production-journey.ts` | (src: .agents/skills/repo-terminal-operator/writer-production-journey.ts `schema_version: "repo-terminal-writer-production-journey-receipt@v1",`) | (src: .agents/skills/repo-terminal-operator/writer-production-journey.ts `evidence_scope: "writer-entrypoint"`) |
| `production-journey.ts` (legacy) | (src: .agents/skills/repo-terminal-operator/production-journey.ts `schema_version: "repo-terminal-production-journey-receipt@v1",`) | — |

The preflight journey says in its own receipt that writer behaviour was not
observed (src: .agents/skills/repo-terminal-operator/production-safety-journey.ts `writer_execution_safety: "unobserved-repo-local-agent-boundary",`), even
though it reports the same three safety classes
(src: .agents/skills/repo-terminal-operator/production-safety-journey.ts `safety_coverage: ["race-condition", "silent-failure", "resource-leak"],`).
(inferred) That pair of fields is the whole design: coverage says *which
questions were asked*, evidence scope says *of what*, and only the second one
distinguishes a real writer test from a preflight that merely enumerated the
same categories. The gate consumes both — see
[preflight and small loop](preflight-and-small-loop.md).

## How the journeys observe

`production-journey-observer.ts` runs the adapter under a hard timeout
(src: .agents/skills/repo-terminal-operator/production-journey-observer.ts `{ cwd: outputRepo, encoding: "utf8", timeout: 5_000 }`), captures the
receipt or the parse error, and exposes concurrent and cleanup probes
(src: .agents/skills/repo-terminal-operator/production-journey-observer.ts `export type ConcurrentObservation = PromiseSettledResult<BoundedObservation>[];`).
`production-journey-scenarios.ts` turns those observations into scenario records
carrying the cleanup facts that matter
(src: .agents/skills/repo-terminal-operator/production-journey-scenarios.ts `process_reaped: result.value.processReaped, timer_cleared: result.value.timerCleared,`).
`production-native-escape.ts` deliberately launches a detached, double-forked
child (src: .agents/skills/repo-terminal-operator/production-native-escape.ts `const child = spawn("setsid", [`) and refuses to run without
carrier-owned marker files
(src: .agents/skills/repo-terminal-operator/production-native-escape.ts `production journey requires carrier-owned native escape probe files`) — the
probe for whether a process can escape the carrier at all.

`writer-production-observer.ts` adds writer-specific probes, insisting on a
parsable receipt (src: .agents/skills/repo-terminal-operator/writer-production-observer.ts `writer emitted no JSON receipt`) and
(src: .agents/skills/repo-terminal-operator/writer-production-observer.ts `writer emitted invalid JSON`), plus concurrency
(src: .agents/skills/repo-terminal-operator/writer-production-observer.ts `export function observeConcurrentWriters`) and residue checks
(src: .agents/skills/repo-terminal-operator/writer-production-observer.ts `export function writerResidue`). The writer journey verifies its own
receipt by reopening the file
(src: .agents/skills/repo-terminal-operator/writer-production-journey.ts `writer journey receipt failed physical reopen`) and refuses to run
without a carrier-supplied run id
(src: .agents/skills/repo-terminal-operator/writer-production-journey.ts `writer journey requires a carrier-owned run id`).

Fixtures are generated, not committed by hand
(src: .agents/skills/repo-terminal-operator/production-journey-fixture.ts `const PACKET_BASE = {`), binding the claim set by digest
(src: .agents/skills/repo-terminal-operator/production-journey-fixture.ts `"guided-claim-set@v1"`) and naming the preflight entrypoint
(src: .agents/skills/repo-terminal-operator/production-journey-fixture.ts `"--preflight"`).

## Inventory of `artifacts/repo-terminal-operator/`

129 files, all JSON. They are documented collectively because they are outputs,
but they are **not** one shape:

| Group | Count | Note |
|---|---|---|
| `writer-production-journey.<uuid>.receipt.json` | 66 | schema (src: .agents/skills/repo-terminal-operator/writer-production-journey.ts `repo-terminal-writer-production-journey-receipt@v1`) in source, `@v2` on disk; all `passed` |
| `production-journey.<uuid>.receipt.json`, `@v2` | 19 | all `passed` |
| `production-journey*.receipt.json`, `@v1` | 5 | 3 `passed`, 2 `failed` — retained history |
| valid / stale terminal packets | 26 | parse as (src: .agents/skills/repo-terminal-operator/production-journey-fixture.ts `schema_version: "terminal-slice-packet@v2",`) |
| malformed terminal packets | 13 | deliberately unparseable negative inputs |

Twelve of the packet fixtures sit in per-run UUID directories next to a
`production-journey.receipt.json`, because the fixture writer builds its
directory from the run id
(src: .agents/skills/repo-terminal-operator/production-journey-fixture.ts `import { mkdirSync, writeFileSync } from "node:fs";`); the rest are at the
top level.

### Which scenario covers which writer failure path

The writer journey emits three scenarios, and they divide the
[writer's](writer-publication.md) failure paths as follows:

| Writer path | Scenario | How it is asserted |
|---|---|---|
| conflict on link, convergence | `race-condition` | one publication, three matched-existing, one output hash (src: .agents/skills/repo-terminal-operator/writer-production-race-scenario.ts `outcomes.filter((value) => value === "matched-existing").length === 3`) |
| crash after link → `post-link` recovery | `race-condition` rollback probe (src: .agents/skills/repo-terminal-operator/writer-production-race-scenario.ts `injected_stage: "post-link",`) | recovery outcome, zero residue, output preserved |
| crash before link → `pre-link` recovery | `race-condition` cancellation probe (src: .agents/skills/repo-terminal-operator/writer-production-race-scenario.ts `injected_stage: "pending-written",`) | recovery outcome, output absent beforehand, zero residue |
| any typed failure surfacing as a receipt rather than a crash | `silent-failure` | exit 2 with a typed failure receipt and the original error preserved (src: .agents/skills/repo-terminal-operator/writer-production-scenarios.ts `receipt.original_error_preserved === true && typeof receipt.diagnostic === "string";`) |
| **cleanup failure** — the writer's `cleanupErrors`, descriptor and timer paths | `resource-leak` | twelve clean lifecycle runs plus a timeout probe at exit 124 and a cancellation probe at exit 130, each reaped, cleared and drained with no cleanup errors (src: .agents/skills/repo-terminal-operator/writer-production-scenarios.ts `&& cancellation.exitCode === 130 && cancellation.cancelled && cleanProbe(timeout) && cleanProbe(cancellation);`) |

Two writer paths have **no dedicated journey probe**: `publication-mismatch`
(the reopen-and-compare failure, called candidate mismatch) and
`parent-identity-mismatch` (boundary drift). Nothing in
`writer-production-race-scenario.ts` injects either; they are reachable only
through `publishWriterArtifact`'s own assertions
(src: .agents/skills/repo-terminal-operator/writer-publication.ts `failure_kind=publication-mismatch`) and
(src: .agents/skills/repo-terminal-operator/writer-publication.ts `failure_kind=parent-identity-mismatch`). What the journey *does* prove
about them is generic: whichever kind occurs, the entrypoint turns it into a
typed failure receipt with the original error preserved rather than an
unhandled crash — that is what the `silent-failure` scenario asserts, and the
kind itself is extracted from the diagnostic
(src: .agents/skills/repo-terminal-operator/writer-entrypoint.ts `function failureKind(detail: string): string {`).

(inferred) Recording this gap is more useful than implying full coverage: a
future scenario that wants to prove candidate mismatch has to corrupt the output
between link and reopen, and one that wants parent drift has to swap the parent
directory mid-publication — neither of which the current probes do.

A tracked writer receipt carries the scope and the observation
(src: artifacts/repo-terminal-operator/writer-production-journey.004757e9-6a02-4578-898d-64b1eea4a01a.receipt.json `"writer_execution_safety": "observed-writer-entrypoint",`), a source
binding by digest
(src: artifacts/repo-terminal-operator/writer-production-journey.004757e9-6a02-4578-898d-64b1eea4a01a.receipt.json `"source_manifest_ref": "sources/manifests/user-production-safety-20260731.json",`), and
per-scenario detail. The race scenario is the most informative record in the
directory: four bounded concurrent writers, shared mutation genuinely observed,
identical outputs but non-identical receipts, and exactly one publication with
three matches (src: artifacts/repo-terminal-operator/writer-production-journey.004757e9-6a02-4578-898d-64b1eea4a01a.receipt.json `"published_count": 1,`).

(inferred) That one-and-three split is the empirical proof of the
[writer's](writer-publication.md) `EEXIST` convergence branch: three racing
processes did not fail, they observed an identical artifact and agreed. It also
explains why `deterministic_receipts` is false while `deterministic_outputs` is
true — the artifact converges, the per-process narrative does not.

## Version note

The writer journey in this checkout emits `@v1`, the tracked receipts are `@v2`,
and the small-loop gate accepts only `@v2`
(src: .agents/skills/repo-terminal-operator/small-loop-gate-contract.ts `: "repo-terminal-writer-production-journey-receipt@v2";`). The `@v2`
producer is the contained profile in the enclosing workspace, not the local
script; running the local journey directly would therefore produce evidence the
gate rejects — which is exactly what `SKILL.md` means by requiring the contained
profile for admission. See [overview](overview.md) for the runtime boundary.
