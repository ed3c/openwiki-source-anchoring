---
type: Component
title: Shared primitives
description: bounded-subprocess.ts and anchored-artifact-read.ts — the process-ownership and path-safety boundaries every other terminal-operator subsystem builds on, and why receipt fields like process_reaped are contract terms rather than telemetry.
tags: [terminal-operator, subprocess, path-safety]
node_kind: RepoDoc
ingest_lane: concept
repo: local/agent-skills-repo
commit: 5d3c42f
covers: [bounded-subprocess, anchored-read, process-ownership]
libraries: [bun]
generated_by: claude-code+opus (skill-bettor openwiki port)
generated_at: null
---

# Shared primitives

Two small modules that almost every other file here imports. They define what "the command finished"
and "I read the file I meant to read" mean for the whole operator.

## `bounded-subprocess.ts`

One export (src: .agents/skills/repo-terminal-operator/bounded-subprocess.ts `export async function runBoundedProcess(command: string[], options: BoundedProcessOptions): Promise<BoundedProcessResult> {`)
returning ten fields — exit code, both streams, and six ownership flags
(src: .agents/skills/repo-terminal-operator/bounded-subprocess.ts `cleanupErrors: string[];`).

Preconditions are refused rather than defaulted: an empty argv
(src: .agents/skills/repo-terminal-operator/bounded-subprocess.ts `if (command.length === 0) throw new Error("bounded process requires a non-empty argv");`)
and a non-positive timeout
(src: .agents/skills/repo-terminal-operator/bounded-subprocess.ts `if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) throw new Error("bounded process requires a positive timeout");`).

The body races three promises — natural exit, timeout, cancellation
(src: .agents/skills/repo-terminal-operator/bounded-subprocess.ts `exitCode = await Promise.race([observedExit, timeoutExit, cancellationExit]);`)
— with distinct synthetic codes: 124 for timeout
(src: .agents/skills/repo-terminal-operator/bounded-subprocess.ts `resolveExit(124);`) and 130 for abort
(src: .agents/skills/repo-terminal-operator/bounded-subprocess.ts `resolveExit(130);`).

The `finally` block is the substance. It clears the timer, removes the abort listener, kills any
process that was not reaped, then **awaits the real exit** and records a cleanup error if that fails
(src: .agents/skills/repo-terminal-operator/bounded-subprocess.ts `process-reap: `),
and finally drains both streams with `allSettled`
(src: .agents/skills/repo-terminal-operator/bounded-subprocess.ts `const [stdoutResult, stderrResult] = await Promise.allSettled([stdoutPromise, stderrPromise]);`),
converting a failed drain into a recorded error rather than an exception
(src: .agents/skills/repo-terminal-operator/bounded-subprocess.ts `stderr-drain: `).

Streams are attached *before* the race starts
(src: .agents/skills/repo-terminal-operator/bounded-subprocess.ts `const stdoutPromise = new Response(child.stdout).text();`).

(inferred) That ordering is the bug this module exists to prevent. If you only start reading stdout
after the process exits, a child that fills the pipe buffer blocks forever and your timeout fires on a
process that was working — a "flaky timeout" that is really a deadlock. Attaching the readers first and
draining in `finally` makes the observation independent of how the process ended.

### Why the flags are contract terms

Every consumer requires all six, not just a zero exit
(src: .agents/skills/repo-terminal-operator/small-loop-runner.ts `&& result.timerCleared && result.stdoutConsumed && result.stderrConsumed && result.cleanupErrors.length === 0;`),
and the same set is re-asserted inside the nested receipt
(src: .agents/skills/repo-terminal-operator/small-loop-gate-contract.ts `stdout_consumed: true,`) and per stage
(src: .agents/skills/repo-terminal-operator/task-quality-contract.ts `if (value[field] !== true) errors.push(`). The Forgejo seam collapses
them into one boolean per git call
(src: .agents/skills/repo-terminal-operator/forgejo-git-handoff.ts `const cleanupComplete =`).

(inferred) `exit_code: 0` says the command believed it succeeded. `process_reaped`, `timer_cleared` and
the two drain flags say the *harness* has nothing outstanding — no zombie, no live timer, no unread
buffer. A run that leaks any of those can still produce a green result today and a mysterious hang
tomorrow, so the operator treats them as part of the pass condition rather than as diagnostics.

## `anchored-artifact-read.ts`

Reads a file through an already-open directory handle instead of by path
(src: .agents/skills/repo-terminal-operator/anchored-artifact-read.ts `export function readAnchoredArtifact(`), failing loudly on
four distinct conditions: a busy parent
(src: .agents/skills/repo-terminal-operator/anchored-artifact-read.ts `-parent-busy`), an open failure carrying its
errno (src: .agents/skills/repo-terminal-operator/anchored-artifact-read.ts `-open-failed:`), a target that is not a
bounded regular file (src: .agents/skills/repo-terminal-operator/anchored-artifact-read.ts `-not-bounded-regular-file`),
and a file that changed while being read
(src: .agents/skills/repo-terminal-operator/anchored-artifact-read.ts `-changed-during-read`).

The same changed-during-read check is reimplemented wherever a subsystem reads a request it will hash —
the control plane (src: .agents/skills/repo-terminal-operator/async-control-plane.ts `if (offset !== stat.size) throw new Error(`) and the worker
carrier (src: .agents/skills/repo-terminal-operator/async-worker-carrier.ts `throw new Error("input-changed-during-read");`).

(inferred) Every hash-binding claim in this operator depends on this one property. If a file can change
between the read that produced the digest and the read that produced the bytes, "hash-bound" is a
statement about two different files. Comparing bytes read against the size observed at open time is the
cheapest available detector.

## Related

- [Terminal operator overview](overview.md) — where these flags become pass conditions.
- [Writer publication](writer-publication.md) — the same discipline applied to writing.
- [Async production](async-production.md) · [Evidence cost](evidence-cost.md)
