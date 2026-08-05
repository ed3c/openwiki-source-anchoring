---
type: Component
title: Writer publication — the durability primitive
description: The FFI-backed anchored-directory writer that every durable artifact in the operator passes through, its pending-then-link publication protocol, crash recovery, lock discipline and typed failure receipts.
tags: [terminal-operator, durability, ffi, concurrency]
node_kind: RepoDoc
ingest_lane: concept
repo: arm-d/agent-skills-repo
covers: [writer-publication, anchored-directory, crash-recovery, file-locking]
libraries: [bun, typescript]
generated_by: claude-code+claude-opus-5
generated_at: null
---

# Writer publication — the durability primitive

Every durable artifact the operator produces — seals, lifecycle events, progress
records, cache entries, admissions — is written by one function. This page is
therefore load-bearing for the whole subsystem.

## Layer 1 — the syscall surface

`writer-native-library.ts` loads four POSIX calls through Bun's FFI
(src: .agents/skills/repo-terminal-operator/writer-native-library.ts `import { dlopen, FFIType, read, type FFIFunction, type Pointer } from "bun:ffi";`):
`openat`, `linkat`, `unlinkat` and `flock`
(src: .agents/skills/repo-terminal-operator/writer-native-library.ts `const COMMON_DEFINITIONS = {`). Because `errno` is not a symbol,
each platform exposes it differently — macOS through one accessor
(src: .agents/skills/repo-terminal-operator/writer-native-library.ts `/usr/lib/libSystem.B.dylib`) and Linux through another
(src: .agents/skills/repo-terminal-operator/writer-native-library.ts `dlopen("libc.so.6"`), selected at load time
(src: .agents/skills/repo-terminal-operator/writer-native-library.ts `process.platform === "darwin" ? darwinLibrary`).
A null errno pointer is a typed failure, not a crash
(src: .agents/skills/repo-terminal-operator/writer-native-library.ts `failure_kind=errno-pointer symbol=`).

## Layer 2 — the anchored directory

`writer-native.ts` opens the destination directory by walking down from a root
descriptor, one component at a time, with `O_NOFOLLOW` and `O_DIRECTORY`
(src: .agents/skills/repo-terminal-operator/writer-native.ts `constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,`). Escaping the
root is refused before any syscall
(src: .agents/skills/repo-terminal-operator/writer-native.ts `writer parent escapes root`), a refused component names itself and its
errno (src: .agents/skills/repo-terminal-operator/writer-native.ts `writer directory component refused:`), and the opened root and
parent are confirmed by device and inode identity
(src: .agents/skills/repo-terminal-operator/writer-native.ts `writer root changed before open`) and
(src: .agents/skills/repo-terminal-operator/writer-native.ts `writer parent changed before anchored open`). File names may not contain
separators or NULs (src: .agents/skills/repo-terminal-operator/writer-native.ts `unsafe writer name:`).

**Lock discipline.** Writers take an exclusive lock, readers a shared one, both
non-blocking with three attempts
(src: .agents/skills/repo-terminal-operator/writer-native.ts `for (let attempt = 1; attempt <= 3; attempt += 1)`) and a growing wait
(src: .agents/skills/repo-terminal-operator/writer-native.ts `Atomics.wait`). The default intent is the stricter one so that a new
caller cannot weaken exclusion by omission
(src: .agents/skills/repo-terminal-operator/writer-native.ts `intent: "read" | "write" = "write",`). The comment above the constants
records why the shared mode exists at all: an exclusive lock on a read path "made
four identical collectors serialise" and the loser failed with a busy error
rather than converging
(src: .agents/skills/repo-terminal-operator/writer-native.ts `retry budget failed with `). `anchored-artifact-read.ts` repeats the
reasoning at the call site
(src: .agents/skills/repo-terminal-operator/anchored-artifact-read.ts `Read intent: a shared lock.`). (inferred, and worth remembering when
adding a new reader) reader-versus-reader is the *only* exclusion that was
relaxed; writer-versus-anything is unchanged.

Errors during open dispose of every descriptor and aggregate the failures
(src: .agents/skills/repo-terminal-operator/writer-native.ts `writer directory open and cleanup failed`), and closing returns a list of
cleanup failures rather than throwing
(src: .agents/skills/repo-terminal-operator/writer-native.ts `export function closeWriterDirectory`).

## Layer 3 — the publication protocol

`publishWriterArtifact` implements create-then-link
(src: .agents/skills/repo-terminal-operator/writer-publication.ts `export function publishWriterArtifact`):

1. **Recover** any leftover pending file first
   (src: .agents/skills/repo-terminal-operator/writer-publication.ts `const recoveryOutcome = recoverPending`). A pending inode with one link
   means the previous run died before linking; two links mean it died after, and
   the recovery then proves the output is the same inode
   (src: .agents/skills/repo-terminal-operator/writer-publication.ts `failure_kind=recovery-link-mismatch`). Anything else is unsafe
   (src: .agents/skills/repo-terminal-operator/writer-publication.ts `failure_kind=unsafe-recovery-pending`).
2. **Short-circuit** if the output already exists with identical content
   (src: .agents/skills/repo-terminal-operator/writer-publication.ts `const existing = existingWriterOutcome`).
3. **Write** the pending file exclusively, chmod it, and fsync it
   (src: .agents/skills/repo-terminal-operator/writer-publication.ts `fsyncSync(descriptor);`), refusing a pending file that is not a fresh
   single-link regular file
   (src: .agents/skills/repo-terminal-operator/writer-publication.ts `failure_kind=unsafe-pending`).
4. **Link** pending to output. `EEXIST` is not an error — it is a concurrent
   writer, so the existing output is compared instead
   (src: .agents/skills/repo-terminal-operator/writer-publication.ts `if (errorNumber === EEXIST) {`), and a vanished output is
   (src: .agents/skills/repo-terminal-operator/writer-publication.ts `output disappeared after conflict`).
5. **Prove it.** fsync the directory, re-assert root and parent identity
   (src: .agents/skills/repo-terminal-operator/writer-publication.ts `failure_kind=boundary-drift root or parent changed`), then reopen the
   output and compare bytes
   (src: .agents/skills/repo-terminal-operator/writer-publication.ts `failure_kind=publication-mismatch`) with the expected two links
   (src: .agents/skills/repo-terminal-operator/writer-publication.ts `failure_kind=unsafe-published-link`).
6. **Clean up** the pending name whether or not step 4 succeeded
   (src: .agents/skills/repo-terminal-operator/writer-publication.ts `unlink(directory, pending, true);`).

Failing to acquire the lock is itself a typed outcome carrying its budget
(src: .agents/skills/repo-terminal-operator/writer-publication.ts `failure_kind=busy retry_budget=3 wait_budget_ms=600`). Removal is
symmetric and content-checked
(src: .agents/skills/repo-terminal-operator/writer-publication.ts `failure_kind=remove-content-mismatch`). Two probe hooks let tests pause
or fail at named points
(src: .agents/skills/repo-terminal-operator/writer-publication.ts `pauseWriterAt("output-linked");`), which is how the race scenarios in
[production journeys](production-journeys.md) are made deterministic.

## How failures are combined and never lost

Publication never throws a raw error. Every path funnels through one collector
(src: .agents/skills/repo-terminal-operator/writer-publication.ts `return publicationResult`) that keeps the primary error first and appends
the cleanup failures (src: .agents/skills/repo-terminal-operator/writer-publication-lifecycle.ts `const failures = primary === undefined ? cleanupFailures : [primary, ...cleanupFailures];`).
One failure is re-thrown as itself; several become an aggregate
(src: .agents/skills/repo-terminal-operator/writer-publication-lifecycle.ts `new AggregateError(failures, "writer publication and cleanup failed")`), and both are
wrapped in a typed error class that also carries whether an artifact was created
(src: .agents/skills/repo-terminal-operator/writer-publication-lifecycle.ts `export class WriterPublicationFailure extends Error {`) with the original
as the cause (src: .agents/skills/repo-terminal-operator/writer-publication-lifecycle.ts `super("writer publication failed", { cause });`). Even a silent
success with no value is turned into a failure
(src: .agents/skills/repo-terminal-operator/writer-publication-lifecycle.ts `new Error("publication returned no result")`).

(inferred) The `artifactCreated` flag is the field that makes crash recovery
decidable by the caller rather than guessable: a failure *after* the link is a
different situation from a failure before it, and this is how that distinction
survives the throw. `writer-entrypoint.ts` reads it straight into its failure
receipt (src: .agents/skills/repo-terminal-operator/writer-entrypoint.ts `error instanceof WriterPublicationFailure && error.artifactCreated,`).

The typed failure paths a caller can expect, all discoverable from the
`failure_kind=` token: `busy`, `lock`, `temp-open`, `unsafe-pending`, `link`,
`reopen`, `unsafe-published-link`, `publication-mismatch`, `boundary-drift`,
`cleanup`, `recovery-open`, `recovery-output`, `recovery-link-mismatch`,
`unsafe-recovery-pending`, `remove-open`, `unsafe-remove-target`,
`remove-content-mismatch`, and `parent-identity-mismatch`
(src: .agents/skills/repo-terminal-operator/writer-publication.ts `failure_kind=parent-identity-mismatch`) — the last raised when a caller
pinned the parent's device and inode in advance and it changed.

Removal has the same discipline: a primary error plus cleanup failures becomes
an aggregate (src: .agents/skills/repo-terminal-operator/writer-publication.ts `writer removal and cleanup failed`), and cleanup failures alone
still throw (src: .agents/skills/repo-terminal-operator/writer-publication.ts `writer removal cleanup failed`).

## Which production checks prove each path

`writer-production-race-scenario.ts` maps the paths above onto four observed
probes, and passes only if all four hold
(src: .agents/skills/repo-terminal-operator/writer-production-race-scenario.ts `const passed = concurrent.passed && conflictPassed && rollbackPassed(input) && cancellationPassed(input);`):

| Probe | Proves | Assertion |
|---|---|---|
| four concurrent writers | one publication, three convergences, one output hash | (src: .agents/skills/repo-terminal-operator/writer-production-race-scenario.ts `outcomes.filter((value) => value === "published").length === 1`) |
| conflict | the distinct conflict exit code and typed kind | (src: .agents/skills/repo-terminal-operator/writer-production-race-scenario.ts `input.conflict.receipt?.failure_kind === "conflict";`) |
| kill after link | `post-link` recovery, zero residue, output preserved | (src: .agents/skills/repo-terminal-operator/writer-production-race-scenario.ts `input.rollbackRecovery.receipt?.recovery_outcome === "post-link"`) |
| kill before link | `pre-link` recovery, output absent beforehand, zero residue | (src: .agents/skills/repo-terminal-operator/writer-production-race-scenario.ts `input.cancellationRecovery.receipt?.recovery_outcome === "pre-link"`) |

Each killed stage must additionally be clean on six axes
(src: .agents/skills/repo-terminal-operator/writer-production-race-scenario.ts `return stage.stageReady && stage.killed && stage.processReaped && stage.timerCleared`), and each
probe records the error-preservation fields from the receipt itself
(src: .agents/skills/repo-terminal-operator/writer-production-race-scenario.ts `original_error_preserved: observation.receipt?.original_error_preserved,`). The resulting
scenario block is what appears in the tracked receipts — see
[production journeys](production-journeys.md).

## Reading back

`readAnchoredArtifact` is the mirror image: shared lock, `O_NOFOLLOW` open, a
size bound (src: .agents/skills/repo-terminal-operator/anchored-artifact-read.ts `-not-bounded-regular-file`), and a re-check that the
file did not change under it
(src: .agents/skills/repo-terminal-operator/anchored-artifact-read.ts `-changed-during-read`). Absence is `null` rather than an error
(src: .agents/skills/repo-terminal-operator/anchored-artifact-read.ts `if (directory.errno`), and cleanup failures are aggregated with any
primary error (src: .agents/skills/repo-terminal-operator/anchored-artifact-read.ts `-read-cleanup-failed`).

## The CLI seam

`writer-entrypoint.ts` is the process-level entry used by the production journey.
It validates ids against a pattern
(src: .agents/skills/repo-terminal-operator/writer-entrypoint.ts `if (!/^[a-z0-9][a-z0-9._-]{2,127}$/u.test(value))`), keeps output and
candidate inside the root
(src: .agents/skills/repo-terminal-operator/writer-entrypoint.ts `--output must stay inside --root`) and refuses a symlinked parent
(src: .agents/skills/repo-terminal-operator/writer-entrypoint.ts `--output parent must not resolve through a symlink`). Success prints a
typed receipt (src: .agents/skills/repo-terminal-operator/writer-entrypoint.ts `schema_version: "repo-terminal-writer-receipt@v1",`); failure prints a
typed failure with the whole error chain preserved
(src: .agents/skills/repo-terminal-operator/writer-entrypoint.ts `original_error_preserved: true,`) and the extracted failure kind
(src: .agents/skills/repo-terminal-operator/writer-entrypoint.ts `failure_kind=`), exiting 1 for a conflict and 2 otherwise
(src: .agents/skills/repo-terminal-operator/writer-entrypoint.ts `return kind === "conflict" ? 1 : 2;`).

(inferred) The distinct exit code for a conflict is what allows a caller to treat
"someone else already published this" as a converged outcome rather than a
failure — the same idea as the `EEXIST` branch, surfaced at process level.
