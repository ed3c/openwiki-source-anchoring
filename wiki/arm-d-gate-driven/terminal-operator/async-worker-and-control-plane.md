---
type: Component
title: Async worker carrier and control-plane projection
description: The bounded worker that materialises a sealed candidate, runs a reviewer under OS isolation and publishes a transactional result, and the projection-only control plane whose queue refs and redrive budget are advisory because no dispatcher exists.
tags: [terminal-operator, isolation, worker, projection]
node_kind: RepoDoc
ingest_lane: concept
repo: arm-d/agent-skills-repo
covers: [async-worker, isolation-matrix, control-plane-projection, redrive-budget]
libraries: [bun, typescript]
generated_by: claude-code+claude-opus-5
generated_at: null
---

# Async worker carrier and control-plane projection

## The worker's job contract

A worker request names the run, the CAS version, the seal digest, a worker id, a
fencing token and a lease
(src: .agents/skills/repo-terminal-operator/async-worker-carrier.ts `schema_version: "repo-async-production-worker-request@v1";`). The job it
executes is separately pinned
(src: .agents/skills/repo-terminal-operator/async-worker-carrier.ts `schema_version: "repo-async-production-worker-job@v1";`) and binds both
the executable and the driver by digest
(src: .agents/skills/repo-terminal-operator/async-worker-carrier.ts `executable_sha256: string;`). Those bindings are checked, not trusted:
the executable path must be absolute
(src: .agents/skills/repo-terminal-operator/async-worker-carrier.ts `production-job-executable-must-be-absolute`), must be a regular file
(src: .agents/skills/repo-terminal-operator/async-worker-carrier.ts `executable-not-regular-file`) and must hash correctly
(src: .agents/skills/repo-terminal-operator/async-worker-carrier.ts `executable-hash-mismatch`); the driver may not be smuggled in as an
option (src: .agents/skills/repo-terminal-operator/async-worker-carrier.ts `driver-path-cannot-be-command-option`), may not escape the target
(src: .agents/skills/repo-terminal-operator/async-worker-carrier.ts `driver-path-escaped-target`) and has its own digest check
(src: .agents/skills/repo-terminal-operator/async-worker-carrier.ts `driver-hash-mismatch`).

Leases are not free-form: a finish budget is reserved and documented as a sum of
its parts (src: .agents/skills/repo-terminal-operator/async-worker-carrier.ts `const MIN_LEASE_FINISH_BUDGET_MS = 15_000;`), itemised in the comment
above it (src: .agents/skills/repo-terminal-operator/async-worker-carrier.ts `2.5s process termination/drain + 2s snapshot cleanup + 5s Git reopen +`).

## The isolation matrix

`isolationCapability` probes exactly one mechanism
(src: .agents/skills/repo-terminal-operator/async-worker-carrier.ts `const path = "/usr/bin/sandbox-exec";`) and only on macOS
(src: .agents/skills/repo-terminal-operator/async-worker-carrier.ts `process.platform === "darwin"`), by running a trivial profile first.

| Platform / outcome | Mode | Network | Live-repo writes | Admissible |
|---|---|---|---|---|
| macOS, probe succeeds | `darwin-sandbox` (src: .agents/skills/repo-terminal-operator/async-worker-carrier.ts `mode: "darwin-sandbox" as const,`) | denied (src: .agents/skills/repo-terminal-operator/async-worker-carrier.ts `network_denied: true,`) | denied (src: .agents/skills/repo-terminal-operator/async-worker-carrier.ts `live_repository_write_denied: true,`) | no (src: .agents/skills/repo-terminal-operator/async-worker-carrier.ts `admission_eligible: false,`) |
| anywhere else, `allow_degraded` true | `cwd-only-degraded` (src: .agents/skills/repo-terminal-operator/async-worker-carrier.ts `mode: "cwd-only-degraded" as const,`) | not denied (src: .agents/skills/repo-terminal-operator/async-worker-carrier.ts `network_denied: false,`) | not denied (src: .agents/skills/repo-terminal-operator/async-worker-carrier.ts `live_repository_write_denied: false,`) | refused by the facade (src: .agents/skills/repo-terminal-operator/async-admission-verifier.ts `degraded-worker-not-admissible`) |
| anywhere else, `allow_degraded` false | throws (src: .agents/skills/repo-terminal-operator/async-worker-carrier.ts `darwin-sandbox-unavailable:`) | — | — | — |

The sandbox profile itself denies network and writes to both roots
(src: .agents/skills/repo-terminal-operator/async-worker-carrier.ts `"(deny network*)",`). (inferred) The honest reading is that background
verification has *one* platform where it means anything; everywhere else the
worker can still run, but its result is diagnostic only, and the
[admission facade](async-lifecycle-and-admission.md) is what makes that stick.

## Materialise, review, finish

The worker overlays the sealed candidate files into a snapshot, re-checking each
digest after copy
(src: .agents/skills/repo-terminal-operator/async-worker-carrier.ts `candidate-reopen-hash-mismatch`) and after write
(src: .agents/skills/repo-terminal-operator/async-worker-carrier.ts `candidate-overlay-readback-mismatch`), refusing any path that escapes
(src: .agents/skills/repo-terminal-operator/async-worker-carrier.ts `candidate-path-escaped-snapshot`).

The reviewer's output contract is deliberately unforgiving: exactly one line
terminated by a newline
(src: .agents/skills/repo-terminal-operator/async-worker-carrier.ts `reviewer-final-missing-newline`) and
(src: .agents/skills/repo-terminal-operator/async-worker-carrier.ts `reviewer-final-line-count-invalid`), parsed with exact key sets
(src: .agents/skills/repo-terminal-operator/async-worker-carrier.ts `reviewer-final-contract-invalid`), and every finding typed by severity
(src: .agents/skills/repo-terminal-operator/async-worker-carrier.ts `reviewer-finding-contract-invalid`). (inferred) A single-line contract
is what lets the carrier distinguish "the reviewer produced a verdict" from "the
reviewer printed something"; a permissive parser would let a crash tail be read
as a pass.

Results are published transactionally with readback at each step
(src: .agents/skills/repo-terminal-operator/async-worker-carrier.ts `result-transaction-readback-mismatch`), and a recovery path re-binds an
interrupted publication
(src: .agents/skills/repo-terminal-operator/async-worker-carrier.ts `committed-result-recovery-binding-mismatch`), giving up only with an
explicit exhaustion error
(src: .agents/skills/repo-terminal-operator/async-worker-carrier.ts `committed-result-publication-exhausted`). Snapshot cleanup is bounded
and its failure is recorded rather than swallowed
(src: .agents/skills/repo-terminal-operator/async-worker-carrier.ts `errors.push(`), with the completion reporting all three cleanup facts
(src: .agents/skills/repo-terminal-operator/async-worker-carrier.ts `snapshot_removed: boolean;`).

### Timeout, cancellation and the completion receipt

Before doing any work the carrier tries to recover an already-committed result
and, if one exists, emits the finish progress pair and returns it unchanged
(src: .agents/skills/repo-terminal-operator/async-worker-carrier.ts `const recovered = recoverCommittedResult(stateRoot, request, job);`) — so a
re-run after a crash does not review twice.

Otherwise it claims the run, then starts a **lifecycle watcher** on a short
interval that re-inspects the run and aborts the review the moment the status,
version or fencing token stops matching this worker
(src: .agents/skills/repo-terminal-operator/async-worker-carrier.ts `current.fencingToken !== request.fencing_token`). The reviewer runs under
that abort signal with the job's own timeout
(src: .agents/skills/repo-terminal-operator/async-worker-carrier.ts `{ signal: abort.signal },`), and the interval is cleared in a `finally`
so the timer is released even on throw
(src: .agents/skills/repo-terminal-operator/async-worker-carrier.ts `clearInterval(watcher);`). A watcher that threw is itself fatal
(src: .agents/skills/repo-terminal-operator/async-worker-carrier.ts `throw new Error("lifecycle-watch-failed", { cause: watcherError });`).

Cancellation is then checked from three independent sources — the lifecycle says
cancelled, the process reports cancelled, or the version moved on — and any of
them ends the run as cancelled rather than failed
(src: .agents/skills/repo-terminal-operator/async-worker-carrier.ts `current.version !== request.expected_version + 1`), with the snapshot already
removed and the cleanup facts carried into the completion
(src: .agents/skills/repo-terminal-operator/async-worker-carrier.ts `timerCleared: commandResult.timerCleared && watcherReleased,`). A timeout is
not cancellation: it is recorded as a diagnostic
(src: .agents/skills/repo-terminal-operator/async-worker-carrier.ts `let diagnostic = commandResult.timedOut ? "reviewer timed out" : "";`) and the
reviewer output is not even parsed.

The terminal status is derived, never chosen. HEAD drift wins outright
(src: .agents/skills/repo-terminal-operator/async-worker-carrier.ts `const stale = currentHead !== seal.expectedHead;`); otherwise `verified`
requires a zero exit, no timeout, no cancellation, a passing reviewer final and a
clean run (src: .agents/skills/repo-terminal-operator/async-worker-carrier.ts `final?.status === "passed" &&`), where clean means the process was reaped,
the timer cleared, both streams drained, no cleanup errors, the snapshot removed
and the watcher released
(src: .agents/skills/repo-terminal-operator/async-worker-carrier.ts `snapshotRemoved &&`). A failed status always gets a non-empty diagnostic,
falling back through cleanup errors, stderr and the exit code
(src: .agents/skills/repo-terminal-operator/async-worker-carrier.ts `reviewer failed with exit `).

The immutable result is built with the source binding labelled by that same
derivation (src: .agents/skills/repo-terminal-operator/async-worker-carrier.ts `binding: stale ? "stale" : "current",`), committed transactionally, and —
if the transaction itself observes a cancellation — converted into a cancelled
completion instead
(src: .agents/skills/repo-terminal-operator/async-worker-carrier.ts `if (transaction.status === "cancelled") {`). The returned
`repo-async-production-worker-completion@v1` carries the status, the result
reference and digest, the three cleanup facts and an optional diagnostic
(src: .agents/skills/repo-terminal-operator/async-worker-carrier.ts `result_sha256: immutable.digest,`).

On any thrown error the carrier still removes the snapshot, re-raises if it never
claimed the run, and refuses to invent an isolation receipt it never obtained
(src: .agents/skills/repo-terminal-operator/async-worker-carrier.ts `claimed worker lost its preflight isolation receipt`).

(inferred) The distinction this whole path defends is between *cancelled* and
*failed*. A superseded worker that lost its claim has produced no evidence about
the code under review, and recording it as a failure would poison the run's
history with a verdict nobody measured.

Progress is emitted as a four-stage sequence
(src: .agents/skills/repo-terminal-operator/async-worker-carrier.ts `stage: "materialize" | "claim" | "review" | "finish";`) with monotonic
numbering (src: .agents/skills/repo-terminal-operator/async-worker-carrier.ts `const sequence = stages.indexOf`) and, again, no eligibility
(src: .agents/skills/repo-terminal-operator/async-worker-carrier.ts `admission_eligible: false;`). `async-progress-store.ts` persists each
event through the writer and verifies the readback
(src: .agents/skills/repo-terminal-operator/async-progress-store.ts `progress-readback-mismatch`).

## What the facade requires of a worker result

`assertWorkerResult` is the contract every background result must satisfy before
[admission](async-lifecycle-and-admission.md) is even considered. It first
rejects unknown or missing keys at seven levels — the result itself, `source`,
`command`, `executable`, `driver`, `reviewer_final`, `isolation`, `cleanup` and
each finding (src: .agents/skills/repo-terminal-operator/async-admission-verifier.ts `"worker-result-cleanup",`) — then requires, as one
conjunction (src: .agents/skills/repo-terminal-operator/async-admission-verifier.ts `worker-result-binding-invalid`):

- schema `repo-async-production-worker-result@v1` with status `verified`
  (src: .agents/skills/repo-terminal-operator/async-admission-verifier.ts `result.status !== "verified" ||`);
- run id, seal, candidate, production-job digests and result ref all equal to the
  lifecycle view's (src: .agents/skills/repo-terminal-operator/async-admission-verifier.ts `result.production_job_sha256 !== view.bindings.productionJobSha256 ||`);
- both heads equal to the expected head, and the binding declared current
  (src: .agents/skills/repo-terminal-operator/async-admission-verifier.ts `source.binding !== "current" ||`);
- a passing reviewer final with a non-empty summary, well-formed findings, and
  **no blocker** among them
  (src: .agents/skills/repo-terminal-operator/async-admission-verifier.ts `(finding as Record<string, unknown>).severity === "blocker",`);
- cleanup true on five flags with an empty error list
  (src: .agents/skills/repo-terminal-operator/async-admission-verifier.ts `cleanup.snapshot_removed === true &&`);
- argv identical to the job's, the executable path equal to `argv[0]`, an
  absolute real path, and both executable and driver digests equal to the job's
  (src: .agents/skills/repo-terminal-operator/async-admission-verifier.ts `driver.sha256 === job.driver_sha256;`);
- isolation ineligible for self-admission, live-repository writes denied, and
  either a darwin sandbox with network denied or a degraded mode the job had
  explicitly allowed
  (src: .agents/skills/repo-terminal-operator/async-admission-verifier.ts `isolation?.admission_eligible === false &&`);
- a non-negative integer elapsed time.

Even after all of that, a degraded mode throws
(src: .agents/skills/repo-terminal-operator/async-admission-verifier.ts `if (degraded) throw new Error("degraded-worker-not-admissible");`).
(inferred) The ordering is the point: degraded runs are allowed to be *valid* —
so their diagnostics survive — and are then refused admission separately, which
keeps "this result is well-formed" and "this result may be trusted" as two
different questions.

## The control plane projects; it does not dispatch

A control request is `project-only` by type
(src: .agents/skills/repo-terminal-operator/async-control-plane.ts `mode: "project-only";`). `projectAsyncControl` inspects each run,
classifies it into one of six dispositions
(src: .agents/skills/repo-terminal-operator/async-control-plane.ts `| "foreground-admission"`), attaches the latest progress record, and
writes one projection
(src: .agents/skills/repo-terminal-operator/async-control-plane.ts `schema_version: "repo-async-production-control-projection@v1",`) that is read
back and compared
(src: .agents/skills/repo-terminal-operator/async-control-plane.ts `projection-readback-mismatch`).

The projection ends with four activation flags, all false
(src: .agents/skills/repo-terminal-operator/async-control-plane.ts `workers_executed: false,`), an execution policy naming who is
responsible (src: .agents/skills/repo-terminal-operator/async-control-plane.ts `execution: "external-explicit-dispatch-only",`), and a generated next
prompt that repeats the constraint
(src: .agents/skills/repo-terminal-operator/async-control-plane.ts `Consume explicit queue refs only after the bounded worker gate is enabled; keep admission foreground-only.`).

### How a run is classified

`classify` reads the lifecycle view and returns one of six dispositions
(src: .agents/skills/repo-terminal-operator/async-control-plane.ts `if (view.status === "cancelled") return "closed";`): a cancelled run is
`closed`; a run past its deadline is `repair-or-close`; an unclaimed run or one
whose lease has lapsed is `dispatch`
(src: .agents/skills/repo-terminal-operator/async-control-plane.ts `view.nextAction === "verification-lease-expired-reclaimable"`); a running one is
`await`; and any terminal status is delegated to `terminalDisposition`.

`terminalDisposition` decides between three outcomes by looking at files, not
flags. With no result binding it is `repair-or-close`; if the *public* result
exists and matches its digest the run is
`foreground-admission`; otherwise it needs the fencing token and the recorded
transaction parent identity
(src: .agents/skills/repo-terminal-operator/async-control-plane.ts `view.transactionParentIno === undefined`), verifies that the transaction
directory is still the same inode
(src: .agents/skills/repo-terminal-operator/async-control-plane.ts `transaction-parent-binding-mismatch:`), and returns `recover` only when a
pending result with the right digest is present
(src: .agents/skills/repo-terminal-operator/async-control-plane.ts `? "recover"`).

`projectRecovery` then writes a *recovery* worker request rather than a fresh
one: it rewinds two lifecycle versions
(src: .agents/skills/repo-terminal-operator/async-control-plane.ts `const expectedVersion = view.version - 2;`), reuses the original fencing token,
derives a deterministic worker id from the seal, version and token
(src: .agents/skills/repo-terminal-operator/async-control-plane.ts `:recover`), refuses a lease shorter than the sealed minimum
(src: .agents/skills/repo-terminal-operator/async-control-plane.ts `worker-lease-insufficient:`), and requires the terminal binding to exist
(src: .agents/skills/repo-terminal-operator/async-control-plane.ts `terminal-recovery-binding-missing:`). Requests are published under a
predictable queue name
(src: .agents/skills/repo-terminal-operator/async-control-plane.ts `.recover.v`).

### Orphans and progress records are validated, not trusted

`classifyOrphans` walks each run's transaction directory and rejects anything
irregular before deciding it is an orphan: non-files
(src: .agents/skills/repo-terminal-operator/async-control-plane.ts `orphan-transaction-not-regular-file:`), unparseable JSON
(src: .agents/skills/repo-terminal-operator/async-control-plane.ts `orphan-transaction-json-invalid:`), non-objects
(src: .agents/skills/repo-terminal-operator/async-control-plane.ts `orphan-transaction-contract-invalid:`) and results whose `run_id` does not
match the directory they sit in
(src: .agents/skills/repo-terminal-operator/async-control-plane.ts `orphan-transaction-run-binding-invalid:`). What remains is whatever is not
the expected pending result — reported, never removed.

`loadProgressRecords` reads each progress file bounded and regular
(src: .agents/skills/repo-terminal-operator/async-control-plane.ts `progress-record-not-regular-file:`) and `parseProgress` re-derives the
sequence number from the stage and state and requires the file to agree
(src: .agents/skills/repo-terminal-operator/async-control-plane.ts `sequence !== expectedSequence ||`), requires `started` events to carry no
status and `finished` events to carry one
(src: .agents/skills/repo-terminal-operator/async-control-plane.ts `? input.status !== undefined`), requires ineligibility
(src: .agents/skills/repo-terminal-operator/async-control-plane.ts `input.admission_eligible !== false ||`), and finally requires the **file
name** to encode the fencing token and zero-padded sequence
(src: .agents/skills/repo-terminal-operator/async-control-plane.ts `progress-record-name-mismatch:`). Records are then bound to a view only
when run id, seal digest and fencing token all match
(src: .agents/skills/repo-terminal-operator/async-control-plane.ts `if (event.run_id !== view.runId || event.seal_sha256 !== view.sealSha256)`).

(inferred) Encoding identity in the filename as well as the body is what stops a
stale worker's progress from being attributed to its replacement — the two write
to different names, so the projection can tell them apart without trusting
either.

**The redrive budget is advisory.** `max_redrives` is range-validated to 1–3
(src: .agents/skills/repo-terminal-operator/async-control-plane.ts `boundedInteger(input.max_redrives, "max-redrives", 1, 3)`) and then echoed
straight into the policy block
(src: .agents/skills/repo-terminal-operator/async-control-plane.ts `max_redrives: request.max_redrives,`). Nothing counts redrives and
nothing blocks one; `SKILL.md` rule 10 says who would
(src: .agents/skills/repo-terminal-operator/SKILL.md `A separately activated local dispatcher owns the projected retry budget`).
(inferred) So the queue directory is a suggestion written to disk. That is a
deliberate stopping point rather than an oversight — the component publishes what
*should* happen and refuses to be the thing that makes it happen.

Orphan transactions are classified, never deleted
(src: .agents/skills/repo-terminal-operator/SKILL.md `classify but never delete orphan transactions`), and the counts are
summarised in the projection
(src: .agents/skills/repo-terminal-operator/async-control-plane.ts `orphan: orphans.length,`).

## CLIs

Both CLIs require a request path and a state root from the environment
(src: .agents/skills/repo-terminal-operator/async-control-plane-cli.ts `const stateRoot = process.env.REPO_ASYNC_STATE_ROOT;`), and the worker CLI
additionally needs a source root
(src: .agents/skills/repo-terminal-operator/async-worker-carrier-cli.ts `const sourceRoot = process.env.REPO_ASYNC_SOURCE_ROOT;`).
