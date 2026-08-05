---
type: Architecture
title: Terminal operator — contract, module map and runtime boundary
description: The 47-module Bun/TypeScript operator vendored under .agents/skills, its packet-in receipt-out contract, how its modules layer, and precisely which parts can and cannot execute from this checkout.
tags: [terminal-operator, architecture, contracts, bun]
node_kind: RepoDoc
ingest_lane: concept
repo: arm-d/agent-skills-repo
covers: [terminal-operator, module-map, runtime-boundary, generated-core]
libraries: [bun, typescript]
generated_by: claude-code+claude-opus-5
generated_at: null
---

# Terminal operator — contract, module map and runtime boundary

## What it is

A single skill directory containing 47 TypeScript modules, three gate profiles
and a generated-core manifest. Its job is narrow: "Apply one typed terminal slice
inside this repository and own its code-quality and production-use verification"
(src: .agents/skills/repo-terminal-operator/SKILL.md `Apply one typed terminal slice inside this repository`), invoked when an
upstream skill delegates a packet
(src: .agents/skills/repo-terminal-operator/SKILL.md `delegates a terminal-slice-packet@v2 to agent-skills-repo`).

`SKILL.md` is not prose guidance; it is a numbered contract of fifteen rules that
the code implements. Several are directly checkable against source, and each is
covered on the page that owns the implementing module.

## The contract in five clauses that matter most

1. **Packets are typed, not interpolated.** Rule 3 is absolute
   (src: .agents/skills/repo-terminal-operator/SKILL.md `never interpolate a packet into a shell string`), and every runner
   takes an argv array.
2. **Two independent verdicts.** Rule 5 requires code-quality and production-use
   to run separately (src: .agents/skills/repo-terminal-operator/SKILL.md `independently`), and rule 6 forbids a
   preflight from standing in for writer safety
   (src: .agents/skills/repo-terminal-operator/SKILL.md `A preflight PASS must emit the next writer-production mode and cannot admit writer safety.`).
3. **The operator never admits.** Rule 7 is the boundary of the whole component
   (src: .agents/skills/repo-terminal-operator/SKILL.md `Do not admit, merge, release, or rewrite Git history.`).
4. **Async is a state machine, not a dispatcher.** Rule 9 lists what the
   lifecycle does *not* do (src: .agents/skills/repo-terminal-operator/SKILL.md `It does not launch an Agent, mutate the live checkout, admit a result, publish Git state, or enable background production.`),
   and rule 10 keeps queue refs advisory until a dispatcher passes admission
   (src: .agents/skills/repo-terminal-operator/SKILL.md `until that dispatcher passes production admission, queue refs remain advisory`).
5. **Missing measurements stay missing.** Rule 12 forbids relabelling and
   requires unavailable axes to stay unset
   (src: .agents/skills/repo-terminal-operator/SKILL.md `Bun I/O operation counts are diagnostic and MUST NOT be relabelled as bytes`).

## Module map by layer

| Layer | Modules | Anchor | Page |
|---|---|---|---|
| OS primitives | `writer-native-library.ts`, `writer-native.ts`, `bounded-subprocess.ts` | (src: .agents/skills/repo-terminal-operator/task-quality-contract.ts `/writer-native-library.ts`) | [writer publication](writer-publication.md) |
| Durable publication | `writer-publication*.ts`, `anchored-artifact-read.ts`, `writer-entrypoint.ts` | (src: .agents/skills/repo-terminal-operator/task-quality-contract.ts `/writer-publication.ts`) | [writer publication](writer-publication.md) |
| Packet + loop | `repo-adapter.ts`, `repo-preflight*.ts`, `small-loop-*.ts` | (src: .agents/skills/repo-terminal-operator/task-quality-contract.ts `/small-loop-receipt.ts`) | [preflight and small loop](preflight-and-small-loop.md) |
| Static quality | `task-quality-contract.ts`, `task-quality-runner.ts`, `repo-code-quality.ts` | (src: .agents/skills/repo-terminal-operator/task-quality-contract.ts `/task-quality-runner.ts`) | [task quality](task-quality.md) |
| Durable async state | `async-job-lifecycle*.ts`, `async-admission-*.ts` | (src: .agents/skills/repo-terminal-operator/task-quality-contract.ts `/async-admission-verifier.ts`) | [async lifecycle](async-lifecycle-and-admission.md) |
| Worker + projection | `async-worker-carrier*.ts`, `async-progress-store.ts`, `async-control-plane*.ts` | (src: .agents/skills/repo-terminal-operator/task-quality-contract.ts `/async-progress-store.ts`) | [worker and control plane](async-worker-and-control-plane.md) |
| Cost evidence | `evidence-cost-cache*.ts`, `evidence-cost-collector*.ts` | (src: .agents/skills/repo-terminal-operator/task-quality-contract.ts `/evidence-cost-collector.ts`) | [evidence cost](evidence-cost.md) |
| Git publication | `forgejo-git-handoff*.ts` | (src: .agents/skills/repo-terminal-operator/task-quality-contract.ts `/forgejo-git-handoff.ts`) | [forgejo handoff](forgejo-handoff.md) |
| Journeys | `production-*.ts`, `writer-production-*.ts` | (src: .agents/skills/repo-terminal-operator/production-journey.ts `repo-terminal-production-journey-receipt@v1`) | [production journeys](production-journeys.md) |

Almost everything durable funnels through one function: the lifecycle
(src: .agents/skills/repo-terminal-operator/async-job-lifecycle.ts `import { publishWriterArtifact } from "./writer-publication";`), the progress
store (src: .agents/skills/repo-terminal-operator/async-progress-store.ts `import { publishWriterArtifact } from "./writer-publication";`), the cache
(src: .agents/skills/repo-terminal-operator/evidence-cost-cache.ts `import { publishWriterArtifact } from "./writer-publication";`) and the
admission facade all publish through it. (inferred) That single choke point is
what lets one page state the durability guarantees for the entire subsystem —
and it means a regression in the writer is a regression everywhere at once.

## The runtime boundary — what runs here and what does not

**Tracked in this checkout.** All 47 modules, the two gate profiles
(src: .agents/skills/repo-terminal-operator/code-quality.profile.json `"schema_version": "repo-gate-profile@v1",`), the collector's
production profile
(src: .agents/skills/repo-terminal-operator/evidence-cost-collector.production.profile.json `"activation_env": "REPO_EVIDENCE_COLLECTOR_PRODUCTION=1",`), and
`generated-core/manifest.json`.

**Not in this checkout.** The commands and imports those files point at. The
production-use profile invokes a script two levels above the repository root
(src: .agents/skills/repo-terminal-operator/production-use.profile.json `"../../skills/repo-neural-perception/scripts/writer-contained-production-profile.ts"`);
the small-loop runner imports an owned-command helper from the same absent tree
(src: .agents/skills/repo-terminal-operator/small-loop-runner.ts `from "../../../../../skills/repo-neural-perception/scripts/owned-profile-command"`);
preflight validates packets with a workspace contract script
(src: .agents/skills/repo-terminal-operator/repo-preflight.ts `runtime/contracts/validate-packet.ts`); and every Bun test named by
the quality contract lives outside too
(src: .agents/skills/repo-terminal-operator/task-quality-contract.ts `"../../../../tests/skills/repo-terminal-task-quality.test.ts",`). This
repository contains only `skills/autoresearch_composer` and
`skills/gemini_interactions`, no `repo-neural-perception`, no `runtime/`, and no
`tests/skills/`.

Consequence: `bun run repo-adapter.ts --describe` and `--selftest` read only
local profiles and can run here; `--preflight` and `--run` cannot complete,
because they shell out to the absent workspace. The
[validation matrix](../ci/validation-matrix.md) records this per command.

## The generated-core manifest

`generated-core/manifest.json` declares a derived-core schema
(src: .agents/skills/repo-terminal-operator/generated-core/manifest.json `"schema_version": "repo-neural-perception-derived-core@v1",`) and one field, a
bundle digest (src: .agents/skills/repo-terminal-operator/generated-core/manifest.json `"ssot_bundle_sha256"`). `SKILL.md` rule 2
requires verifying that bundle before editing
(src: .agents/skills/repo-terminal-operator/SKILL.md `generated-core bundle before editing`).

**No code in this repository reads or verifies it.** The only two files that
mention `generated-core` at all are `SKILL.md` and the manifest itself; nothing
in `task-quality-contract.ts`'s source lists includes it, and no Python gate
touches `.agents/`. (inferred) It is an inbound provenance stamp — the upstream
`repo-neural-perception` bundle it was derived from — and verifying it is
currently a human step performed with the tools of the enclosing workspace. A
drifting manifest would be silent here.

## Related

Start at [preflight and small loop](preflight-and-small-loop.md) for the
execution path a packet actually takes.
