---
type: Component
title: Evidence-cost cache and trusted collector — two separate dataflows
description: The projection-only cache that turns hash-bound cost observations into a content-addressed ledger, the production-only collector that physically measures wall and CPU time, and the missing bridge between their incompatible observation schemas.
tags: [terminal-operator, measurement, content-addressing, cost]
node_kind: RepoDoc
ingest_lane: concept
repo: arm-d/agent-skills-repo
covers: [evidence-cost-cache, evidence-cost-collector, cost-axes, content-addressed-ledger]
libraries: [bun, typescript]
generated_by: claude-code+claude-opus-5
generated_at: null
---

# Evidence-cost cache and trusted collector

Two modules with similar names do different jobs and **do not chain**. Read the
final section before assuming a pipeline exists.

## Dataflow A — the cache projector

A cache request is projection-only by type
(src: .agents/skills/repo-terminal-operator/evidence-cost-cache.ts `mode: "project-only";`) and must hash-bind everything it refers to:
source inputs (src: .agents/skills/repo-terminal-operator/evidence-cost-cache.ts `evidence-cost-source-inputs-invalid`) with unique ids
(src: .agents/skills/repo-terminal-operator/evidence-cost-cache.ts `evidence-cost-source-input-ids-not-unique`), a plan with an intent slice
matching a fixed pattern
(src: .agents/skills/repo-terminal-operator/evidence-cost-cache.ts `evidence-cost-intent-slice-invalid`), combinations with unique ids
(src: .agents/skills/repo-terminal-operator/evidence-cost-cache.ts `evidence-cost-combination-ids-not-unique`), and stages whose declared
source inputs actually exist
(src: .agents/skills/repo-terminal-operator/evidence-cost-cache.ts `evidence-cost-stage-source-input-unknown`) and are all consumed
(src: .agents/skills/repo-terminal-operator/evidence-cost-cache.ts `evidence-cost-source-input-unbound`). Activation must stay off
(src: .agents/skills/repo-terminal-operator/evidence-cost-cache.ts `evidence-cost-activation-must-remain-disabled`).

The request is canonicalised and published before anything is classified
(src: .agents/skills/repo-terminal-operator/evidence-cost-cache.ts `evidence-cost-canonical-request-publication-mismatch`), and the plan may
not be empty (src: .agents/skills/repo-terminal-operator/evidence-cost-cache.ts `evidence-cost-plan-empty`).

`materializeStage` is the gate on incoming cost data. It reopens the referenced
observation by digest and requires an **exact** key set
(src: .agents/skills/repo-terminal-operator/evidence-cost-cache.ts `"claim_boundary",`), then requires four fields to match exactly:
schema (src: .agents/skills/repo-terminal-operator/evidence-cost-cache.ts `observation.schema_version !== "repo-evidence-cost-observation@v1"`),
status, the claim boundary
(src: .agents/skills/repo-terminal-operator/evidence-cost-cache.ts `"external-hash-bound-observation/unadmitted-collector"`), and the stage's
own evidence digest and toolchain
(src: .agents/skills/repo-terminal-operator/evidence-cost-cache.ts `-binding-mismatch`).

Stage parsing is exact rather than tolerant. Each stage must declare a fixed key
set including an oracle relation
(src: .agents/skills/repo-terminal-operator/evidence-cost-cache.ts `"oracle_relation",`) whose value is drawn from a closed list
(src: .agents/skills/repo-terminal-operator/evidence-cost-cache.ts `-oracle-relation`), and a toolchain object with exactly three fields
(src: .agents/skills/repo-terminal-operator/evidence-cost-cache.ts `exactKeys(toolchain, ["runtime", "version", "command"], `) — runtime,
version and a bounded argv
(src: .agents/skills/repo-terminal-operator/evidence-cost-cache.ts `command: strings(toolchain.command, `). The toolchain is therefore part of
the identity, not metadata.

The cache key is the digest of the stage plus its provenance trace
(src: .agents/skills/repo-terminal-operator/evidence-cost-cache.ts `const key = sha256(JSON.stringify(stableIdentity));`), so a hit means "the
same stage under the same plan and the same inputs", never "the same command".
Entries are `repo-evidence-cost-cache-entry@v1`
(src: .agents/skills/repo-terminal-operator/evidence-cost-cache.ts `schema_version: "repo-evidence-cost-cache-entry@v1",`) and hits are
classified three ways
(src: .agents/skills/repo-terminal-operator/evidence-cost-cache.ts `type CacheStatus = "miss" | "persistent-hit" | "cross-combination-hit";`).

Selection works by building the candidate entry first
(src: .agents/skills/repo-terminal-operator/evidence-cost-cache.ts `const candidate = cacheEntryBytes(identity, canonicalRequestSha256);`) and then
comparing it against what already exists: a match found within the same run is a
`cross-combination-hit`
(src: .agents/skills/repo-terminal-operator/evidence-cost-cache.ts `cacheStatus = "cross-combination-hit";`), a match found on disk from an
earlier run is a `persistent-hit`
(src: .agents/skills/repo-terminal-operator/evidence-cost-cache.ts `cacheStatus = "persistent-hit";`), and anything else is a miss that gets
published. Every reuse re-validates the stored bytes against the recomputed
identity and key
(src: .agents/skills/repo-terminal-operator/evidence-cost-cache.ts `function validateCacheEntry(`), so a hand-edited entry cannot be reused.
(inferred) Because the key covers the plan, the source inputs, the toolchain and
the evidence digest, a "hit" is a statement about provenance rather than about
having run the same command — which is why the three outcomes are distinguished
in the completion counts at all.

The run
ends with a ledger (src: .agents/skills/repo-terminal-operator/evidence-cost-cache.ts `schema_version: "repo-evidence-cost-ledger@v1",`) whose
publication is verified
(src: .agents/skills/repo-terminal-operator/evidence-cost-cache.ts `evidence-cost-ledger-publication-mismatch`) and a completion carrying the
four counts (src: .agents/skills/repo-terminal-operator/evidence-cost-cache.ts `cross_combination_hits: number;`) and no eligibility
(src: .agents/skills/repo-terminal-operator/evidence-cost-cache.ts `admission_eligible: false;`).

Crucially the ledger labels its own trust level
(src: .agents/skills/repo-terminal-operator/evidence-cost-cache.ts `cost_claim_boundary: "external-hash-bound-observation/unadmitted-collector",`), which is
what `SKILL.md` rule 11 means by treating it as projected evidence with
`asserted_*` axis names
(src: .agents/skills/repo-terminal-operator/SKILL.md `name its aggregate axes `).

## Dataflow B — the trusted collector

The collector only runs behind an explicit activation environment variable
(src: .agents/skills/repo-terminal-operator/evidence-cost-collector-cli.ts `const ACTIVATION_ENV = "REPO_EVIDENCE_COLLECTOR_PRODUCTION";`), matching its
profile (src: .agents/skills/repo-terminal-operator/evidence-cost-collector.production.profile.json `"mode": "production-only",`). Its own
implementation bundle is enumerated and hash-bound
(src: .agents/skills/repo-terminal-operator/evidence-cost-collector.ts `export const EVIDENCE_COST_COLLECTOR_BUNDLE_REFS = [`) — including three
files from the enclosing workspace
(src: .agents/skills/repo-terminal-operator/evidence-cost-collector.ts `skills/repo-neural-perception/scripts/owned-process-preload.cjs`).

Before measuring it verifies the canonical request is genuinely canonical
(src: .agents/skills/repo-terminal-operator/evidence-cost-collector.ts `collector-canonical-request-not-canonical`) and content-addressed
(src: .agents/skills/repo-terminal-operator/evidence-cost-collector.ts `collector-canonical-content-address-mismatch`), that the repository head
matches (src: .agents/skills/repo-terminal-operator/evidence-cost-collector.ts `collector-repo-head-mismatch`), that the stage evidence is a
passing typed receipt
(src: .agents/skills/repo-terminal-operator/evidence-cost-collector.ts `collector-stage-evidence-not-passing-typed-receipt`), and that the
executable exists and hashes
(src: .agents/skills/repo-terminal-operator/evidence-cost-collector.ts `collector-executable-not-bounded-regular-file`).

The execution receipt records everything about the run, and its `failure_kind` is
derived from the first violated condition
(src: .agents/skills/repo-terminal-operator/evidence-cost-collector.ts `? "repository-head-drift"`). Three honesty rules are encoded directly
in it:

- **CPU is mandatory on success.** A passing run without CPU numbers throws
  (src: .agents/skills/repo-terminal-operator/evidence-cost-collector.ts `collector-cpu-measurement-missing-after-pass`), and the axis records
  its scope (src: .agents/skills/repo-terminal-operator/evidence-cost-collector.ts `scope: "direct-child",`).
- **I/O counts are not bytes.** The receipt states so as a field
  (src: .agents/skills/repo-terminal-operator/evidence-cost-collector.ts `bytes_available: false,`), and the observation keeps the byte axis
  unset (src: .agents/skills/repo-terminal-operator/evidence-cost-collector.ts `io: { status: "not-selected", read_bytes: null, write_bytes: null },`).
- **What was not sealed is named.** The stage's source closure is explicitly
  out of scope with a reason
  (src: .agents/skills/repo-terminal-operator/evidence-cost-collector.ts `collector binds its own bundle and executable; the stage worktree/source closure is not sealed`).

Missing axes are enumerated rather than implied
(src: .agents/skills/repo-terminal-operator/evidence-cost-collector.ts `? ["io-bytes", "llm-tokens"]`), and precondition failures are persisted
separately (src: .agents/skills/repo-terminal-operator/evidence-cost-collector.ts `schema_version: "repo-evidence-cost-collector-precondition-failure@v1",`).

### Stage progress binding and failure semantics

The request must name a progress record inside a fixed namespace
(src: .agents/skills/repo-terminal-operator/evidence-cost-collector.ts `collector-progress-namespace-invalid`) with an exact two-field shape
(src: .agents/skills/repo-terminal-operator/evidence-cost-collector.ts `exactKeys(progress, ["ref", "sha256"], "collector-stage-progress");`), and the timeout
must be an integer inside a bounded range
(src: .agents/skills/repo-terminal-operator/evidence-cost-collector.ts `collector-timeout-invalid`). The reopened progress record must then agree
on five things at once — schema, readiness, request id, combination and stage —
plus the digest of the stage request itself
(src: .agents/skills/repo-terminal-operator/evidence-cost-collector.ts `progress.stage_request_sha256 !== sha256(JSON.stringify(stage))`), or the run
stops with (src: .agents/skills/repo-terminal-operator/evidence-cost-collector.ts `collector-stage-progress-binding-mismatch`).

A run is `passed` only when the command exited cleanly, the ownership sentinel
and registry were consumed and removed, CPU was actually available, the head did
not drift and no cleanup error remains
(src: .agents/skills/repo-terminal-operator/evidence-cost-collector.ts `result.ownershipRegistryRemoved &&`). Otherwise the execution receipt is
still written, with the first matching cause recorded as its failure kind —
`timeout`, `cancelled`, `command-failed`, `repository-head-drift` or
`cleanup-failed` (src: .agents/skills/repo-terminal-operator/evidence-cost-collector.ts `: "cleanup-failed",`) — and **no observation is
published at all**, since observations are produced only on the passing branch
(src: .agents/skills/repo-terminal-operator/evidence-cost-collector.ts `if (passed) {`). (inferred) That asymmetry is deliberate: a failed run
leaves a full diagnostic record and zero cost evidence, so a timeout can never be
mistaken for a cheap stage.

(inferred) This is the most disciplined measurement code in the repository, and
its discipline is almost entirely about *refusing to overstate*: naming the CPU
scope, refusing to rename operation counts as bytes, and declaring the closure it
did not seal. A cost number here is deliberately narrow rather than impressive.

## The missing bridge

The two dataflows use incompatible observations:

| | cache accepts | collector produces |
|---|---|---|
| schema | `repo-evidence-cost-observation@v1` (src: .agents/skills/repo-terminal-operator/evidence-cost-cache.ts `!== "repo-evidence-cost-observation@v1"`) | `repo-evidence-cost-observation@v2` (src: .agents/skills/repo-terminal-operator/evidence-cost-collector.ts `schema_version: "repo-evidence-cost-observation@v2",`) |
| claim boundary | unadmitted collector (src: .agents/skills/repo-terminal-operator/evidence-cost-cache.ts `"external-hash-bound-observation/unadmitted-collector" ||`) | trusted direct process (src: .agents/skills/repo-terminal-operator/evidence-cost-collector.ts `claim_boundary: "trusted-direct-process-collector/axis-scoped",`) |
| extra fields | none — the key set is exact (src: .agents/skills/repo-terminal-operator/evidence-cost-cache.ts `"evidence_sha256",`) | `collector`, `stage_source_closure`, `admission_eligible` (src: .agents/skills/repo-terminal-operator/evidence-cost-collector.ts `stage_source_closure: execution.stage_source_closure,`) |

Because `materializeStage` uses an exact key comparison and a literal schema
check, a `@v2` observation fails it on three counts at once. **No adapter and no
consumer of collector output exists in this repository** — grep for the v2
schema string finds only the collector that writes it. `SKILL.md` rule 11 already
routes cache-side evidence "to the trusted collector node rather than foreground
admission" (src: .agents/skills/repo-terminal-operator/SKILL.md `rather than foreground admission`), which is the
integration this gap is waiting on. (inferred) Documenting the gap is the point:
someone reading the two modules in sequence would reasonably assume the collector
feeds the cache, and building on that assumption would fail at the first
`-binding-mismatch`.

## CLIs

Both take a single request path and a state root from the environment
(src: .agents/skills/repo-terminal-operator/evidence-cost-cache-cli.ts `const stateRoot = process.env.REPO_EVIDENCE_STATE_ROOT;`), and the collector
CLI carries the next-mode intent it is required to emit
(src: .agents/skills/repo-terminal-operator/evidence-cost-collector-cli.ts `"HARNESS-CROSS-CUTTING-EVIDENCE-COST-MEASUREMENT-COLLECTORS";`). The
production profile lists six safety classes it must cover
(src: .agents/skills/repo-terminal-operator/evidence-cost-collector.production.profile.json `"nested-receipt-tamper"`) and runs two Bun test files that live
outside this checkout
(src: .agents/skills/repo-terminal-operator/evidence-cost-collector.production.profile.json `"tests/skills/repo-evidence-cost-collector.production.test.ts",`).
