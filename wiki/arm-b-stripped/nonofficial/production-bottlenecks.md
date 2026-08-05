---
type: Reference
title: Production Bottlenecks
description: The known limits of this repository's evidence — what the green gates do not prove, where the runtime is pinned to one machine, and the documentation debt that is tracked rather than hidden.
tags: [limits, debt]
node_kind: RepoDoc
ingest_lane: concept
repo: local/agent-skills-repo
covers: [evidence-limits, runtime-portability, documentation-debt]
libraries: []
generated_by: claude-code+opus (skill-bettor openwiki port)
generated_at: null
---

# Production Bottlenecks

Every gate in this repository can be green while the claims it is supposed to support remain weak. This
page names each gap so a reader does not mistake a passing run for a stronger claim than it makes.
`PROJECT-SSOT.md` states the general form: *"External claims remain candidate until verified or
human-admitted."*

## Evidence is local-zero-LLM-regex-canary, not behavior

The headline telemetry — `total_cases_evaluated=117 passed_cases=117 zero_llm_api_calls=0` — comes from
a runner whose own one-line summary of itself is a regex assert pass
,
and the 117 is hard-coded as the pass condition
. It proves that
117 generated fixtures still match their expected patterns with zero API calls. It does not prove that
an agent writes better code with the skill loaded.

`plan-package.compat.yaml` records the same limit twice, deliberately:
 and
.
`scripts/synthetic_case_quality_report.py` measures why without claiming more
 —
running it prints 117 cases across 10 unique scenarios, 2 unique
expected-check sets, 0 negative cases, and a maximum template similarity ratio of `0.9969`. A corpus
that near-identical measures template fidelity, not capability.

The only real-agent measurement this repository holds is a failure:
`data/verification_runs/gemini_interactions_real_driver_2026-07-27.json` records
,
which is why `skills/gemini_interactions/status.json` reads
. Its first stated reason is that
the measured effect missed its preregistered bar
. See
[gemini_interactions](../skill-assets/gemini-interactions.md).

## root-local-runtime: the toolchain is pinned to one machine

Several contracts are written as absolute paths on a single workstation rather than as portable
references. This is a **root-local-runtime** dependency:

- `scripts/validate_commit_message.py` requires `Plan-Package:`, `Small-Loop:` and `Final-Repo:` to
  equal paths derived from `workspace_root()`, whose final fallback is a literal path
.
- `data/prompt_trace/prompt_trace_dataset.json` carries absolute `*_abs` paths pointing outside this
  directory,
  and `data/commit_lineage/gcr_molecular_commits.json` points outside the workspace entirely
.
- `scripts/check_autoresearch_lifecycle.py` resolves its source skill two levels above the repository
,
  so the gate's cross-check silently reduces in scope when that tree is absent.
- This directory is not its own Git repository — `scripts/git_gate.py` says so in its own comment
. `scripts/validate_molecular_commit_lineage.py
  --require-current-history` therefore audits whichever enclosing repository contains it, and fails in a
  detached copy.

Consequence: a clean-room clone cannot reproduce the commit-governance and prompt-trace claims without
being handed those roots explicitly.

## The vendored operator cannot run here

`.agents/skills/repo-terminal-operator/` is ~9.7k lines of Bun TypeScript (`wc -l` over its `*.ts`
files totals 9689) with no `package.json`, no `tsconfig.json` and no local test suite — an `ls` of that
directory returns only `*.ts` sources, `SKILL.md` and three `*.profile.json` files. Its own skill file
routes admission evidence through a sibling tree that is not in this checkout

and names that tree as its upstream SSOT
,
while `ls skills/` shows only `autoresearch_composer` and `gemini_interactions`. It is vendored source,
not runnable evidence. See [Terminal operator overview](../terminal-operator/overview.md).

## Gates that do less than their name suggests

- `scripts/validate_goal_constraints.py` and `scripts/validate_commit_message.py` run **argument-less**
  inside `scripts/git_gate.py`,
  which exercises only their selftest path — the file's own comment calls that path
. A green git_gate does not
  mean a real commit message or skill file was validated.
- `scripts/git_gate.py` runs each entry of its `GATES` list as a subprocess
. That list has 22 entries — a list
  length, not a literal in the file — and does not include `scripts/check_plan_package_compat.py`,
  `scripts/check_prompt_trace_assets.py`, `scripts/sync_wiki_to_graph.py`, or
  `scripts/real_driver_ablation.py`, all four of which exist under `scripts/`.
- The two lists disagree: `scripts/check_plan_package_compat.py` still expects a 23-entry order that
  includes `scripts/validate_molecular_commit_lineage.py`, and rejects any receipt whose gate count
  differs.
  It passes today only because that receipt is optional
.
- `.github/workflows/weekly_audit.yml` runs only the deterministic `scripts/ablation_engine.py`
, never
  the real-driver ablation.
- No gate reads `skills/gemini_interactions/status.json`; grepping `scripts/`, `.githooks/` and
  `.github/` for that filename returns nothing. Quarantine is a recorded decision
, not an enforced control.

Full table in [Entrypoint matrix](../operations/entrypoint-matrix.md).

## Adversarial review is pending, not absent-therefore-fine

`scripts/semantic_arbitration_report.py` reports `executed_adversarial_reviews=3` and
`pending_adversarial_reviews=3` with a status it prints unconditionally
. The
repository's own rule is that an actor that did not run is surfaced as a gate rather than inferred as
success.
See [Semantic arbitration](../validation/semantic-arbitration.md).

## documentation debt

This wiki was regenerated by the **skill-bettor repo-wiki control plane** — the host-native port of the
OpenWiki official procedure — replacing a previous hand-maintained set. Two items of documentation debt
are outstanding:

1. **`scripts/check_openwiki.py` carries a stale expected value.** It requires the
   `code-call-lifecycle.md` page to contain a 157/157 count
,
   while the authoritative verification receipt reports 235
.
   That page quotes the stale expectation explicitly and states the true counts;
   the one-value correction to the gate has not been made because a documentation run does not modify
   source. See [Code call lifecycle](code-call-lifecycle.md).
2. **Depth is uneven.** `scripts/real_driver_ablation.py` is 426 lines and describes itself as
;
   `scripts/validate_molecular_commit_lineage.py` is 585 lines and describes itself as
.
   Both, and the TypeScript module bodies, were read
   at CLI, structure and exported-surface level rather than in full. Pages derived from them state
   contracts and invariants, not line-level behavior. The full list is in the Backlog of
   [Quickstart](../quickstart.md).
