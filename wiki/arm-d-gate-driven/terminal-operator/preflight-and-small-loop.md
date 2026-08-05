---
type: Component
title: Preflight and the small-loop run
description: How a terminal-slice packet is validated, how the small loop orders preflight, code quality, a second production-admission check and production use, and the exact shape of the small-loop-run-receipt it returns.
tags: [terminal-operator, preflight, receipts, gates]
node_kind: RepoDoc
ingest_lane: concept
repo: arm-d/agent-skills-repo
covers: [preflight, small-loop-run, run-receipt, gate-profile-drift]
libraries: [bun, typescript, git]
generated_by: claude-code+claude-opus-5
generated_at: null
---

# Preflight and the small-loop run

## The entry point

`repo-adapter.ts` exposes four actions and rejects anything else with the usage
line (src: .agents/skills/repo-terminal-operator/repo-adapter.ts `usage: repo-adapter.ts --describe|--selftest|--preflight <packet>|--run <packet>`).
`--describe` reports the contracts and the number of commands in each profile
(src: .agents/skills/repo-terminal-operator/repo-adapter.ts `input_contract: "terminal-slice-packet@v2",`); `--selftest` adds one
assertion, that neither profile is empty
(src: .agents/skills/repo-terminal-operator/repo-adapter.ts `FAIL: both profiles require a real argv command`). Preflight prints a
typed receipt (src: .agents/skills/repo-terminal-operator/repo-adapter.ts `schema_version: "repo-terminal-preflight-receipt@v1"`) and exits 2
on failure; `--run` returns the full loop receipt and exits 2 unless it passed
(src: .agents/skills/repo-terminal-operator/repo-adapter.ts `return receipt.status === "passed" ? 0 : 2;`).

## Preflight checks

`runPreflightChecks` builds a list of `{id, status, detail}` records
(src: .agents/skills/repo-terminal-operator/repo-preflight.ts `export type PreflightCheck = { id: string; status: "passed" | "failed"; detail: string };`).
The first is the schema validation, delegated to a workspace contract script
(src: .agents/skills/repo-terminal-operator/repo-preflight.ts `runtime/contracts/validate-packet.ts`) with the schema chosen from the
packet itself (src: .agents/skills/repo-terminal-operator/repo-preflight.ts `? "terminal-slice-packet@v2"`). Then, per packet:

- **target-repo** — the resolved target must be this repository, not another
  (src: .agents/skills/repo-terminal-operator/repo-preflight.ts `target === outputRepo ? passed`);
- **entrypoint-reachable** — the entrypoint must be `bun run <script>`
  (src: .agents/skills/repo-terminal-operator/repo-preflight.ts `entrypoint must begin with bun run <script>`), must resolve to a real
  file, and must not escape the workspace
  (src: .agents/skills/repo-terminal-operator/repo-preflight.ts `entrypoint escapes workspace`);
- **expected-head** — the packet's head must equal the observed one
  (src: .agents/skills/repo-terminal-operator/repo-preflight.ts `packet.write_lease.expected_head === actualHead`);
- **live-lease** — the lease must parse and still be in the future
  (src: .agents/skills/repo-terminal-operator/repo-preflight.ts `expiresAt > Date.now`);
- **allowed-paths** — no absolute path and nothing outside the repository
  (src: .agents/skills/repo-terminal-operator/repo-preflight.ts `const escaped = packet.allowed_paths.filter`);
- **claim set and TDD receipts** — delegated to `repo-preflight-evidence.ts`
  (src: .agents/skills/repo-terminal-operator/repo-preflight.ts `import { claimSetCheck, tddReceiptCheck } from "./repo-preflight-evidence";`), which
  reads the packet's declared red/green receipts and hash-bound claim set
  (src: .agents/skills/repo-terminal-operator/repo-preflight-evidence.ts `tdd: { red_receipt: string; green_receipt: string; tests_immutable_during_green: boolean };`).

Containment is one shared helper used by every path check
(src: .agents/skills/repo-terminal-operator/repo-preflight.ts `function contained`).

## The loop, in order

`runSmallLoop` is deliberately sequential
(src: .agents/skills/repo-terminal-operator/small-loop-runner.ts `export async function runSmallLoop`):

1. parse the packet, failing loudly on a missing runner field
   (src: .agents/skills/repo-terminal-operator/small-loop-runner.ts `terminal packet is missing runner fields`);
2. observe HEAD before anything runs
   (src: .agents/skills/repo-terminal-operator/small-loop-runner.ts `const initialHead = await dependencies.head`);
3. run preflight and time it;
4. run gates — and if preflight failed, mark both gates blocked and run nothing
   (src: .agents/skills/repo-terminal-operator/small-loop-runner.ts `stages: [blockedStage("code-quality"), blockedStage("production-use")], failures: [],`);
5. re-observe HEAD and record any drift
   (src: .agents/skills/repo-terminal-operator/small-loop-runner.ts `failures.push({ stage: "git-head", kind: "stale"`).

Inside `executeGates` the ordering has two safety properties. Code quality runs
first, and a failure blocks production use
(src: .agents/skills/repo-terminal-operator/small-loop-runner.ts `if (codeQuality.stage.status !== "passed") return {`). Then **preflight runs a
second time** before production use, and its failures are attributed to a
distinct stage (src: .agents/skills/repo-terminal-operator/small-loop-runner.ts `...failure, stage: "production-admission"`).
(inferred) That second call is the lease being re-checked after the slowest step
so far — a packet whose write lease expired while the linter ran must not go on
to touch production evidence.

## What counts as a clean gate

A subprocess result is clean only if all eight conditions hold — exit zero, no
timeout, no cancellation, the process reaped, the timer cleared, both streams
drained and no cleanup errors
(src: .agents/skills/repo-terminal-operator/small-loop-runner.ts `return result.exitCode === 0 && !result.timedOut && !result.cancelled && result.processReaped`).
Only then is the emitted receipt inspected. Failure kind is derived rather than
guessed (src: .agents/skills/repo-terminal-operator/small-loop-runner.ts `return result.timedOut || result.cancelled ? "transient" : result.cleanupErrors.length > 0 ? "policy" : "deterministic";`),
which is what makes `retry-transient` a meaningful next action later.

`small-loop-gate-contract.ts` protects the profiles themselves. A profile must
declare exactly one argv command
(src: .agents/skills/repo-terminal-operator/small-loop-gate-contract.ts `must contain exactly one physical argv command`) and must match what the
packet declared (src: .agents/skills/repo-terminal-operator/small-loop-gate-contract.ts `command drift from terminal packet`). It then
grades the inner receipt: code quality must be
`repo-terminal-code-quality-receipt@v1` and production use must be
`repo-terminal-writer-production-journey-receipt@v2`
(src: .agents/skills/repo-terminal-operator/small-loop-gate-contract.ts `: "repo-terminal-writer-production-journey-receipt@v2";`), each `passed`
(src: .agents/skills/repo-terminal-operator/small-loop-gate-contract.ts `typed receipt must pass ${schema}`). Production evidence must cover
exactly three safety classes
(src: .agents/skills/repo-terminal-operator/small-loop-gate-contract.ts `const expectedSafety = ["race-condition", "resource-leak", "silent-failure"];`) at the
declared scope (src: .agents/skills/repo-terminal-operator/small-loop-gate-contract.ts `requiredEvidenceScope: "writer-entrypoint",`), matching the
profile (src: .agents/skills/repo-terminal-operator/production-use.profile.json `"required_evidence_scope": "writer-entrypoint",`).

## The receipt

`small-loop-receipt.ts` defines `small-loop-run-receipt@v1`
(src: .agents/skills/repo-terminal-operator/small-loop-receipt.ts `schema_version: "small-loop-run-receipt@v1";`) with sixteen keys
(src: .agents/skills/repo-terminal-operator/small-loop-receipt.ts `const RECEIPT_KEYS = [`). Status is derived — head drift wins over
everything (src: .agents/skills/repo-terminal-operator/small-loop-receipt.ts `if (input.actualHead !== input.expectedHead) return "stale";`) — and the
next action follows from it
(src: .agents/skills/repo-terminal-operator/small-loop-receipt.ts `? "retry-transient"`).

`assertPassingSmallLoopReceipt` is the strict reader used by the async facade.
It requires exact key sets, a 40-hex head
(src: .agents/skills/repo-terminal-operator/small-loop-receipt.ts `/^[a-f0-9]{40}$/u.test`), a passed code-quality stage *and* a
passed production-use stage
(src: .agents/skills/repo-terminal-operator/small-loop-receipt.ts `object(stage)?.purpose === "production-use" &&`), an empty failure list
(src: .agents/skills/repo-terminal-operator/small-loop-receipt.ts `receipt.failures.length === 0 &&`) and a next action of open-pr
(src: .agents/skills/repo-terminal-operator/small-loop-receipt.ts `nextAction?.kind === "open-pr" &&`), throwing one opaque error otherwise
(src: .agents/skills/repo-terminal-operator/small-loop-receipt.ts `passing-small-loop-receipt-invalid`).

## Fixtures

Three packet fixtures ship in `artifacts/repo-terminal-operator/`: a valid one, a
stale one and a malformed one, generated by
(src: .agents/skills/repo-terminal-operator/production-journey-fixture.ts `const PACKET_BASE = {`) with the claim set hash bound
(src: .agents/skills/repo-terminal-operator/production-journey-fixture.ts `"guided-claim-set@v1"`). See
[production journeys](production-journeys.md).

## Validation

```sh
bun run .agents/skills/repo-terminal-operator/repo-adapter.ts --selftest   # local profiles only
```

`--preflight` and `--run` additionally require the enclosing workspace; see
[overview](overview.md).
