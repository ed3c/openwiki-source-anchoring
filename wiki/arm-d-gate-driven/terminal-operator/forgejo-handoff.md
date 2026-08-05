---
type: Component
title: Forgejo git handoff — the narrow publication seam
description: The only component that publishes Git state, its two request shapes, the fixed sequence of bounded git stages with readback verification, credential redaction and remote rollback, and the operations it deliberately cannot perform.
tags: [terminal-operator, git, publication, forgejo]
node_kind: RepoDoc
ingest_lane: concept
repo: arm-d/agent-skills-repo
covers: [forgejo-handoff, git-publication, pr-branch-create-only]
libraries: [bun, typescript, git]
generated_by: claude-code+claude-opus-5
generated_at: null
---

# Forgejo git handoff — the narrow publication seam

## What it may and may not do

`SKILL.md` rule 14 states the boundary in one sentence: the seam "publishes Git
state but does not create repositories, issues, PRs, merges, or cloud state"
(src: .agents/skills/repo-terminal-operator/SKILL.md `does not create repositories, issues, PRs, merges, or cloud state`), and rule
15 adds that the branch path "publishes a review branch but still cannot create
or merge a PR"
(src: .agents/skills/repo-terminal-operator/SKILL.md `still cannot create or merge a PR`). This is the only module in the
operator that mutates anything outside its own state directory.

## Two request shapes

Both are literal-typed rather than free-form. The main-branch request fixes the
target endpoint (src: .agents/skills/repo-terminal-operator/forgejo-git-handoff.ts `base_url: "http://127.0.0.1:3000";`), the remote name
(src: .agents/skills/repo-terminal-operator/forgejo-git-handoff.ts `remote_name: "forgejo";`), the destination ref
(src: .agents/skills/repo-terminal-operator/forgejo-git-handoff.ts `target_ref: "refs/heads/main";`), and three safety switches that can
only hold one value each
(src: .agents/skills/repo-terminal-operator/forgejo-git-handoff.ts `preserve_origin: true;`) and
(src: .agents/skills/repo-terminal-operator/forgejo-git-handoff.ts `force_push: false;`). The PR-branch request differs by declaring itself
create-only (src: .agents/skills/repo-terminal-operator/forgejo-git-handoff.ts `create_only: true;`) with a variable target ref.

(inferred) Encoding the switches as literal types rather than booleans means a
force push is not a runtime decision that could be flipped by a caller — it is
unrepresentable in the request the function accepts.

## The sequence

Every git invocation goes through the bounded runner with a per-stage timeout —
sixty seconds for the push and ten for everything else
(src: .agents/skills/repo-terminal-operator/forgejo-git-handoff.ts `timeoutMs: id === "push" ? 60_000 : 10_000,`) — and a stage counts as
successful only if the process was reaped, the timer cleared, both streams
drained and no cleanup errors remain
(src: .agents/skills/repo-terminal-operator/forgejo-git-handoff.ts `result.cleanupErrors.length === 0;`). Failure throws a typed error
naming the stage (src: .agents/skills/repo-terminal-operator/forgejo-git-handoff.ts `-failed`).

1. **HEAD before** must equal the expected head
   (src: .agents/skills/repo-terminal-operator/forgejo-git-handoff.ts `expected-head-mismatch`).
2. **Remote reconciliation** — an existing `forgejo` remote is reused only if its
   URL is identical (src: .agents/skills/repo-terminal-operator/forgejo-git-handoff.ts `remote-url-conflict`), otherwise it is added
   (src: .agents/skills/repo-terminal-operator/forgejo-git-handoff.ts `remoteAction = "reused";`). `origin` is read first so it can be
   compared later.
3. **HEAD again** immediately before pushing
   (src: .agents/skills/repo-terminal-operator/forgejo-git-handoff.ts `head-drift-before-push`).
4. **Create-only guard**, for the branch path only: the ref name is validated by
   git itself (src: .agents/skills/repo-terminal-operator/forgejo-git-handoff.ts `"check-ref-format",`) and the remote ref must not already
   exist (src: .agents/skills/repo-terminal-operator/forgejo-git-handoff.ts `target-ref-exists`).
5. **Push** an explicit `<sha>:<ref>` refspec rather than a branch name
   (src: .agents/skills/repo-terminal-operator/forgejo-git-handoff.ts `${request.git.expected_head}:${request.git.target_ref}`), with the branch
   path adding a lease that asserts absence
   (src: .agents/skills/repo-terminal-operator/forgejo-git-handoff.ts `--force-with-lease=${request.git.target_ref}:`).
6. **Readback** — the remote ref is re-read and must equal the pushed hash
   (src: .agents/skills/repo-terminal-operator/forgejo-git-handoff.ts `remote-head-mismatch`).
7. **HEAD after** must be unchanged
   (src: .agents/skills/repo-terminal-operator/forgejo-git-handoff.ts `head-drift-after-push`) and `origin` must be byte-identical to what
   it was (src: .agents/skills/repo-terminal-operator/forgejo-git-handoff.ts `origin-mutated`).

(inferred) Step 5's empty-lease trick deserves note: `--force-with-lease=<ref>:`
with no expected value asserts the ref does *not* exist, which turns a create-only
intent into something the remote enforces rather than something the client
merely checked a moment earlier.

## Failure handling

If anything after the remote was added fails, the remote is removed again
(src: .agents/skills/repo-terminal-operator/forgejo-git-handoff.ts `"remote-remove-rollback",`), and a rollback that itself fails is
reported with the original error preserved as the cause
(src: .agents/skills/repo-terminal-operator/forgejo-git-handoff.ts `remote-rollback-failed`). A reused remote is left alone.

Any credential embedded in a URL is redacted from diagnostics before it can reach
a receipt or a log
(src: .agents/skills/repo-terminal-operator/forgejo-git-handoff.ts `.replace(/(https?:\/\/)[^/@\s]+@/g, "$1<redacted>@")`), and details are
truncated (src: .agents/skills/repo-terminal-operator/forgejo-git-handoff.ts `.slice(0, 1000);`).

## Receipts

Success returns a typed receipt per path
(src: .agents/skills/repo-terminal-operator/forgejo-git-handoff.ts `schema_version: "forgejo-git-handoff-receipt@v1";`) and
(src: .agents/skills/repo-terminal-operator/forgejo-git-handoff.ts `schema_version: "forgejo-pr-branch-handoff-receipt@v1";`), each restating
the invariants it upheld
(src: .agents/skills/repo-terminal-operator/forgejo-git-handoff.ts `origin_unchanged: true;`) and carrying the per-stage record
(src: .agents/skills/repo-terminal-operator/forgejo-git-handoff.ts `cleanup_complete: boolean;`).

## The CLI and its bootstrap binding

`forgejo-git-handoff-cli.ts` accepts a packet that extends the request with three
extra blocks (src: .agents/skills/repo-terminal-operator/forgejo-git-handoff-cli.ts `type Packet = ForgejoHandoffRequest & {`): a `bindings` block naming the
bootstrap request, an `execution_policy` that pins the network scope
(src: .agents/skills/repo-terminal-operator/forgejo-git-handoff-cli.ts `network_scope: "loopback-only";`) with cloud and GitHub disabled, and a
declared next mode
(src: .agents/skills/repo-terminal-operator/forgejo-git-handoff-cli.ts `| "repo-local/execute-forgejo-pr-branch-handoff";`).

Before any git runs it: requires the exact four-argument form
(src: .agents/skills/repo-terminal-operator/forgejo-git-handoff-cli.ts `expected --workspace-root <root> --request <packet>`); resolves both paths
through `realpathSync` and refuses one that escapes the workspace
(src: .agents/skills/repo-terminal-operator/forgejo-git-handoff-cli.ts `request escapes workspace`); bounds the packet size
(src: .agents/skills/repo-terminal-operator/forgejo-git-handoff-cli.ts `request is not bounded`); rejects a schema that is neither handoff
contract (src: .agents/skills/repo-terminal-operator/forgejo-git-handoff-cli.ts `request schema is not an admitted Git handoff contract`); and validates the
packet against the workspace contract script under a bounded process
(src: .agents/skills/repo-terminal-operator/forgejo-git-handoff-cli.ts `schema-validation-failed`).

**The bootstrap binding** is the part that ties this push to a repository that
was actually created. The referenced bootstrap request must resolve inside the
workspace (src: .agents/skills/repo-terminal-operator/forgejo-git-handoff-cli.ts `bootstrap request escapes workspace`), its bytes must hash to the
declared digest
(src: .agents/skills/repo-terminal-operator/forgejo-git-handoff-cli.ts `bootstrap request bytes changed`), and its schema, request id and
repository name must all agree with the handoff packet
(src: .agents/skills/repo-terminal-operator/forgejo-git-handoff-cli.ts `bootstrap identity differs from Git handoff`).

Only then is the handoff executed, and the printed receipt is the transport
receipt **plus** the request's own reference and digest
(src: .agents/skills/repo-terminal-operator/forgejo-git-handoff-cli.ts `request_sha256: sha256(bytes),`) and two re-asserted policy fields
(src: .agents/skills/repo-terminal-operator/forgejo-git-handoff-cli.ts `github_enabled: false,`). Any failure prints a typed error object instead
(src: .agents/skills/repo-terminal-operator/forgejo-git-handoff-cli.ts `schema_version: "forgejo-git-handoff-error@v1",`) carrying the failure
reason and exits non-zero
(src: .agents/skills/repo-terminal-operator/forgejo-git-handoff-cli.ts `process.exitCode = 2;`).

(inferred) So the final receipt binds three identities at once: the commit being
published, the request that asked for it, and the bootstrap that created the
destination. A reader can therefore check that a push corresponds to a specific
approved request without trusting the pusher's narrative.

The corresponding Bun tests are named by the quality profile
(src: .agents/skills/repo-terminal-operator/task-quality-contract.ts `"tests/forgejo/repo-local-git-handoff.test.ts",`) and live in the enclosing
workspace; see [validation matrix](../ci/validation-matrix.md).
