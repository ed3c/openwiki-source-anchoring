---
type: Component
title: Task-scoped code quality
description: The eight-stage, four-phase static and behaviour profile the operator runs as its code-quality gate, how its receipt is self-describing by profile hash, and why it records coverage as not-selected.
tags: [terminal-operator, static-analysis, receipts]
node_kind: RepoDoc
ingest_lane: concept
repo: arm-d/agent-skills-repo
covers: [task-quality, static-stages, profile-hash]
libraries: [bun, eslint, prettier, typescript]
generated_by: claude-code+claude-opus-5
generated_at: null
---

# Task-scoped code quality

## The claim being made

`SKILL.md` describes the macro-step precisely: four bounded static stages in
parallel, then focused behaviour suites only if all of them pass, and one
disqualifier — "exit code zero without an observed test count is a failure"
(src: .agents/skills/repo-terminal-operator/SKILL.md `exit code zero without an observed`). It also
states what this profile deliberately does *not* claim
(src: .agents/skills/repo-terminal-operator/SKILL.md `records coverage as`).

The receipt carries that scope as a field, not a footnote
(src: .agents/skills/repo-terminal-operator/task-quality-runner.ts `claim_boundary: "task-scoped-code-quality";`), and routes the
unclaimed part elsewhere
(src: .agents/skills/repo-terminal-operator/task-quality-runner.ts `next_mode: "production-use/writer-entrypoint";`).

## The stage table

`TASK_QUALITY_STAGE_DEFINITIONS` is a frozen list of eight stages
(src: .agents/skills/repo-terminal-operator/task-quality-contract.ts `export const TASK_QUALITY_STAGE_DEFINITIONS: readonly TaskQualityStageDefinition[] =`),
each with an id, a phase, a working directory selector and a timeout.

| Phase | Stages | Runs in |
|---|---|---|
| 1 | `typed-eslint`, `format-check` | adapter (src: .agents/skills/repo-terminal-operator/task-quality-contract.ts `id: "typed-eslint",`) |
| 2 | `strict-typecheck`, `dependency-boundaries` | adapter (src: .agents/skills/repo-terminal-operator/task-quality-contract.ts `id: "strict-typecheck",`) |
| 3 | `focused-tests`, `evidence-cache-tests`, `ownership-tests` | workspace (src: .agents/skills/repo-terminal-operator/task-quality-contract.ts `id: "ownership-tests",`) |
| 4 | `forgejo-handoff-tests` | workspace (src: .agents/skills/repo-terminal-operator/task-quality-contract.ts `id: "forgejo-handoff-tests",`) |

The commands are explicit argv arrays over explicit file lists rather than glob
patterns — lint and typecheck run over `typedSources`
(src: .agents/skills/repo-terminal-operator/task-quality-contract.ts `const typedSources = [`), formatting extends that list with profiles and
schemas (src: .agents/skills/repo-terminal-operator/task-quality-contract.ts `const formatSources = [`), and dependency rules are checked from the
CLI entry points only (src: .agents/skills/repo-terminal-operator/task-quality-contract.ts `"./node_modules/.bin/depcruise",`).
(inferred) Enumerating sources instead of globbing is what makes the profile
hashable: a glob would silently change meaning when a file is added, whereas this
list changes the hash and therefore invalidates every receipt that claimed it.

Every stage's tooling lives outside this repository — the binaries are resolved
under the adapter directory (src: .agents/skills/repo-terminal-operator/task-quality-contract.ts `"./node_modules/.bin/eslint",`)
and the test paths are workspace-relative
(src: .agents/skills/repo-terminal-operator/task-quality-contract.ts `"tests/skills/repo-terminal-small-loop-runner.test.ts",`), so none of these
stages can run from this checkout.

## The runner

`executeTaskQuality` iterates phases in sorted order
(src: .agents/skills/repo-terminal-operator/task-quality-runner.ts `for (const phase of [`) and applies one rule between them: if
anything so far is not `passed`, the remaining stages are recorded as blocked
rather than executed
(src: .agents/skills/repo-terminal-operator/task-quality-runner.ts `receipts.push(...definitions.map(blocked));`). Within a phase, stages run
concurrently and a rejected promise becomes a failed stage rather than an
exception (src: .agents/skills/repo-terminal-operator/task-quality-runner.ts `diagnostic: "stage runner rejected",`).

A stage passes only when the subprocess result is clean on seven axes
(src: .agents/skills/repo-terminal-operator/task-quality-runner.ts `result.processReaped &&`) **and**, for a test stage, an executed test
count was actually parsed from the output
(src: .agents/skills/repo-terminal-operator/task-quality-runner.ts `const passed = clean(result) && (!testStage || observedTestCases !== null);`). The count is
extracted by regex (src: .agents/skills/repo-terminal-operator/task-quality-runner.ts `pass\s*`) and its absence is
diagnosed in words
(src: .agents/skills/repo-terminal-operator/task-quality-runner.ts `test command reported no executed tests`). This is the mechanical form
of the SKILL.md rule above.

Every stage emits a progress line to stderr before and after
(src: .agents/skills/repo-terminal-operator/task-quality-runner.ts `schema_version: "repo-terminal-task-quality-progress@v1",`), and stdout and
stderr are recorded by digest rather than in full
(src: .agents/skills/repo-terminal-operator/task-quality-runner.ts `stdout_sha256: sha256(result.stdout),`), with the diagnostic truncated
to its tail (src: .agents/skills/repo-terminal-operator/task-quality-runner.ts `.slice(-2_000)`).

## The receipt and its verifier

The receipt is `repo-terminal-code-quality-receipt@v1`
(src: .agents/skills/repo-terminal-operator/task-quality-runner.ts `schema_version: "repo-terminal-code-quality-receipt@v1";`) and carries the
profile digest (src: .agents/skills/repo-terminal-operator/task-quality-contract.ts `export function taskQualityProfileSha256`), computed over the
stage definitions themselves
(src: .agents/skills/repo-terminal-operator/task-quality-contract.ts `.update(JSON.stringify(TASK_QUALITY_STAGE_DEFINITIONS))`).

`taskQualityReceiptErrors` re-derives that digest and rejects a mismatch
(src: .agents/skills/repo-terminal-operator/task-quality-contract.ts `errors.push("inner profile_sha256");`), requires the coverage routing to
be intact (src: .agents/skills/repo-terminal-operator/task-quality-contract.ts `errors.push("inner coverage routing");`), requires exactly as many
stages as definitions
(src: .agents/skills/repo-terminal-operator/task-quality-contract.ts `value.stages.length !== TASK_QUALITY_STAGE_DEFINITIONS.length`), and then
compares each stage field by field including its argv
(src: .agents/skills/repo-terminal-operator/task-quality-contract.ts `errors.push(`) with a positive test count required for test stages
(src: .agents/skills/repo-terminal-operator/task-quality-contract.ts `typeof value.test_cases !== "number" || value.test_cases < 1`).

(inferred) The effect is that a code-quality receipt is not a claim of success but
a claim about *which specific commands* succeeded — you cannot re-use a receipt
after changing the stage list, and you cannot fabricate one without reproducing
every argv exactly.

The thin CLI resolves the adapter path and exits on the receipt status
(src: .agents/skills/repo-terminal-operator/repo-code-quality.ts `process.exitCode = receipt.status === "passed" ? 0 : 2;`), and the gate
profile names exactly that entry point
(src: .agents/skills/repo-terminal-operator/code-quality.profile.json `repo-terminal-operator/repo-code-quality.ts`) with a timeout
(src: .agents/skills/repo-terminal-operator/code-quality.profile.json `"command_timeout_ms": 90000,`).

Related: [preflight and small loop](preflight-and-small-loop.md) for the caller,
[validation matrix](../ci/validation-matrix.md) for what cannot run here.
