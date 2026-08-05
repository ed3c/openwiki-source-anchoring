---
type: Component
title: Evidence cost
description: The cost-cache projector and the trusted collector — content-addressed requests, axis statuses that refuse to fake a zero, hard-coded admission ineligibility, and the unclosed v1-to-v2 observation seam between the two.
tags: [terminal-operator, cost, measurement, claim-boundary]
node_kind: RepoDoc
ingest_lane: concept
repo: local/agent-skills-repo
commit: 5d3c42f
covers: [evidence-cost, claim-boundary, cost-axes]
libraries: [bun]
generated_by: claude-code+opus (skill-bettor openwiki port)
generated_at: null
---

# Evidence cost

Two modules answer "what did this evidence cost to produce?" at two different trust levels. They do not
currently connect.

| Module | Runs | Emits | Claim boundary |
|---|---|---|---|
| `evidence-cost-cache.ts` | in the normal loop | `repo-evidence-cost-ledger@v1`, cache entries | `external-hash-bound-observation/unadmitted-collector` |
| `evidence-cost-collector.ts` | only under an env switch | `repo-evidence-cost-observation@v2` and three other receipts | `trusted-direct-process-collector/axis-scoped` |

## Axis statuses: measured, not-selected, not-applicable

Both modules use a three-valued status per cost axis
(src: .agents/skills/repo-terminal-operator/evidence-cost-cache.ts `type AxisStatus = "measured" | "not-selected" | "not-applicable";`)
and enforce the pairing in both directions — a measured axis must carry values, and an unmeasured one
must carry nulls (src: .agents/skills/repo-terminal-operator/evidence-cost-cache.ts `throw new Error(`).
The collector emits explicit nulls for what it did not measure
(src: .agents/skills/repo-terminal-operator/evidence-cost-collector.ts `io: { status: "not-selected", read_bytes: null, write_bytes: null },`).

(inferred) This is the whole design in one rule. A cost report that writes `0` for an axis it never
measured is indistinguishable from one that measured zero, and any aggregate built on it is quietly
wrong. Making "not measured" a first-class value costs a field and removes an entire class of false
precision — which is also why the operator's contract forbids relabelling Bun I/O *operation counts* as
bytes (src: .agents/skills/repo-terminal-operator/SKILL.md `Bun I/O operation counts are diagnostic and MUST NOT be relabelled as bytes`).

## The projector

`projectEvidenceCostCache` refuses activation drift up front — both external switches must be off
(src: .agents/skills/repo-terminal-operator/evidence-cost-cache.ts `throw new Error("evidence-cost-activation-must-remain-disabled");`) — and
validates a large request: unique source-input ids
(src: .agents/skills/repo-terminal-operator/evidence-cost-cache.ts `throw new Error("evidence-cost-source-input-ids-not-unique");`), unique
combination ids, unique stage ids
(src: .agents/skills/repo-terminal-operator/evidence-cost-cache.ts `throw new Error(`), every stage's source input known
(src: .agents/skills/repo-terminal-operator/evidence-cost-cache.ts `throw new Error("evidence-cost-stage-source-input-unknown");`) and every
declared input actually used
(src: .agents/skills/repo-terminal-operator/evidence-cost-cache.ts `throw new Error("evidence-cost-source-input-unbound");`).

It then publishes a **canonical content-addressed request**, re-opens it, and refuses to continue if the
republished bytes differ
(src: .agents/skills/repo-terminal-operator/evidence-cost-cache.ts `throw new Error("evidence-cost-canonical-request-publication-mismatch");`).
Stage evidence must be a passing typed receipt
(src: .agents/skills/repo-terminal-operator/evidence-cost-cache.ts `throw new Error(`), a cache entry is only reused after every binding is
reopened (src: .agents/skills/repo-terminal-operator/evidence-cost-cache.ts `throw new Error(`), and the final ledger is verified after
publication (src: .agents/skills/repo-terminal-operator/evidence-cost-cache.ts `throw new Error("evidence-cost-ledger-publication-mismatch");`).

Its output is explicitly not admissible
(src: .agents/skills/repo-terminal-operator/evidence-cost-cache.ts `admission_eligible: false;`).

## The collector

`evidence-cost-collector.ts` is the trusted measurer and is fenced behind an environment switch
(src: .agents/skills/repo-terminal-operator/evidence-cost-collector.production.profile.json `"activation_env": "REPO_EVIDENCE_COLLECTOR_PRODUCTION=1",`).
Before measuring anything it re-opens the plan, the canonical request
(src: .agents/skills/repo-terminal-operator/evidence-cost-collector.ts `throw new Error("collector-canonical-request-not-canonical");`), the
repository HEAD (src: .agents/skills/repo-terminal-operator/evidence-cost-collector.ts `throw new Error("collector-repo-head-mismatch");`), each
source's cleanliness against that HEAD
(src: .agents/skills/repo-terminal-operator/evidence-cost-collector.ts `collector-source-dirty-against-head:`), the executable's digest
(src: .agents/skills/repo-terminal-operator/evidence-cost-collector.ts `if (!digest) throw new Error("collector-executable-hash-missing");`) and the
stage's typed passing evidence
(src: .agents/skills/repo-terminal-operator/evidence-cost-collector.ts `throw new Error("collector-stage-evidence-not-passing-typed-receipt");`).

It measures wall time and direct-child CPU only, and an unavailable CPU reading is a failure rather than
a zero (src: .agents/skills/repo-terminal-operator/evidence-cost-collector.ts `throw new Error("collector-cpu-measurement-missing-after-pass");`).
It publishes four content-addressed documents — request, execution
(src: .agents/skills/repo-terminal-operator/evidence-cost-collector.ts `schema_version: "repo-evidence-cost-collector-execution@v1",`), an
axis-scoped observation, and either a completion or a precondition failure
(src: .agents/skills/repo-terminal-operator/evidence-cost-collector.ts `schema_version: "repo-evidence-cost-collector-precondition-failure@v1",`).
Every one of them carries `admission_eligible: false`
(src: .agents/skills/repo-terminal-operator/evidence-cost-collector.ts `admission_eligible: false as const,`), which the operator's contract
explains as a standing condition
(src: .agents/skills/repo-terminal-operator/SKILL.md `while I/O bytes or LLM tokens are missing.`).

The stage's source closure is also declared out of scope
(src: .agents/skills/repo-terminal-operator/SKILL.md `collector HEAD proves its own bundle, not every file the stage may read.`).

## The seam between them is open

The projector accepts exactly one observation schema and one claim boundary
(src: .agents/skills/repo-terminal-operator/evidence-cost-cache.ts `observation.schema_version !== "repo-evidence-cost-observation@v1" ||`)
(src: .agents/skills/repo-terminal-operator/evidence-cost-cache.ts `"external-hash-bound-observation/unadmitted-collector" ||`), while the
collector produces the *next* version with a *different* boundary
(src: .agents/skills/repo-terminal-operator/evidence-cost-collector.ts `schema_version: "repo-evidence-cost-observation@v2",`)
(src: .agents/skills/repo-terminal-operator/evidence-cost-collector.ts `claim_boundary: "trusted-direct-process-collector/axis-scoped",`).

Nothing in this repository consumes a v2 observation. The relationship is one-way and unfinished: the
collector can produce trusted measurements that the cache cannot ingest.

(inferred) That is a version skew mid-migration, and it is visible only because both sides name their
claim boundary in data. The boundary strings are doing real work here — they stop a trusted measurement
from being silently accepted by a projector whose ledger is labelled *unadmitted*, which would have
upgraded the ledger's claim without anyone deciding to.

## Evidence status

Neither module runs in this checkout, and the profile's test targets
(`tests/skills/repo-evidence-cost-collector.production.test.ts` and its sibling) do not exist. Contracts
here are read from source.

## Related

- [Shared primitives](shared-primitives.md) · [Async production](async-production.md)
- [Production profiles and evidence](production-profiles-and-evidence.md) — the third profile file.
