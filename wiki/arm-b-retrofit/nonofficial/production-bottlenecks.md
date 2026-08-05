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
(src: scripts/interactions_patch_assert_runner.py `Zero-LLM regex assert runner for post-cutoff Gemini Interactions syntax.`),
and the 117 is hard-coded as the pass condition
(src: scripts/interactions_patch_assert_runner.py `telemetry["total_cases_evaluated"] != 117`). It proves that
117 generated fixtures still match their expected patterns with zero API calls. It does not prove that
an agent writes better code with the skill loaded.

`plan-package.compat.yaml` records the same limit twice, deliberately:
(src: plan-package.compat.yaml `p11_current_scope: local-zero-llm-regex-canary`) and
(src: plan-package.compat.yaml `synthetic_case_quality_status: insufficient`).
`scripts/synthetic_case_quality_report.py` measures why without claiming more
(src: scripts/synthetic_case_quality_report.py `Report P11 synthetic case corpus quality without upgrading canary truth.`) —
running it prints 117 cases across 10 unique scenarios, 2 unique
expected-check sets, 0 negative cases, and a maximum template similarity ratio of `0.9969`. A corpus
that near-identical measures template fidelity, not capability.

The only real-agent measurement this repository holds is a failure:
`data/verification_runs/gemini_interactions_real_driver_2026-07-27.json` records
(src: data/verification_runs/gemini_interactions_real_driver_2026-07-27.json `A2_FAIL_DO_NOT_PROMOTE`),
which is why `skills/gemini_interactions/status.json` reads
(src: skills/gemini_interactions/status.json `"status": "quarantined",`). Its first stated reason is that
the measured effect missed its preregistered bar
(src: skills/gemini_interactions/status.json `below the preregistered 0.20 threshold`). See
[gemini_interactions](../skill-assets/gemini-interactions.md).

## root-local-runtime: the toolchain is pinned to one machine

Several contracts are written as absolute paths on a single workstation rather than as portable
references. This is a **root-local-runtime** dependency:

- `scripts/validate_commit_message.py` requires `Plan-Package:`, `Small-Loop:` and `Final-Repo:` to
  equal paths derived from `workspace_root()`, whose final fallback is a literal path
  (src: scripts/validate_commit_message.py `return Path("<host-repo>")`).
- `data/prompt_trace/prompt_trace_dataset.json` carries absolute `*_abs` paths pointing outside this
  directory (src: data/prompt_trace/prompt_trace_dataset.json `"<host-repo>/.gitignore"`),
  and `data/commit_lineage/gcr_molecular_commits.json` points outside the workspace entirely
  (src: data/commit_lineage/gcr_molecular_commits.json `"<external-workspace>/gemini_research/gcr/`).
- `scripts/check_autoresearch_lifecycle.py` resolves its source skill two levels above the repository
  (src: scripts/check_autoresearch_lifecycle.py `SOURCE_SKILL = PROJECT_ROOT / ".claude" / "skills" / "autoresearch-composer" / "SKILL.md"`),
  so the gate's cross-check silently reduces in scope when that tree is absent.
- This directory is not its own Git repository — `scripts/git_gate.py` says so in its own comment
  (src: scripts/git_gate.py `this repository has no .git of its own`). `scripts/validate_molecular_commit_lineage.py
  --require-current-history` therefore audits whichever enclosing repository contains it, and fails in a
  detached copy (src: scripts/validate_molecular_commit_lineage.py `--audit-protected-history requires --repo-root or a discoverable Git root`).

Consequence: a clean-room clone cannot reproduce the commit-governance and prompt-trace claims without
being handed those roots explicitly.

## The vendored operator cannot run here

`.agents/skills/repo-terminal-operator/` is ~9.7k lines of Bun TypeScript (`wc -l` over its `*.ts`
files totals 9689) with no `package.json`, no `tsconfig.json` and no local test suite — an `ls` of that
directory returns only `*.ts` sources, `SKILL.md` and three `*.profile.json` files. Its own skill file
routes admission evidence through a sibling tree that is not in this checkout
(src: .agents/skills/repo-terminal-operator/SKILL.md `bun run ../../skills/repo-neural-perception/scripts/writer-contained-production-profile.ts`)
and names that tree as its upstream SSOT
(src: .agents/skills/repo-terminal-operator/SKILL.md `SSOT: skills/repo-neural-perception/references/production-use.md`),
while `ls skills/` shows only `autoresearch_composer` and `gemini_interactions`. It is vendored source,
not runnable evidence. See [Terminal operator overview](../terminal-operator/overview.md).

## Gates that do less than their name suggests

- `scripts/validate_goal_constraints.py` and `scripts/validate_commit_message.py` run **argument-less**
  inside `scripts/git_gate.py` (src: scripts/git_gate.py `GATES invokes every gate with no arguments`),
  which exercises only their selftest path — the file's own comment calls that path
  (src: scripts/git_gate.py `schema check that never walks history at all`). A green git_gate does not
  mean a real commit message or skill file was validated.
- `scripts/git_gate.py` runs each entry of its `GATES` list as a subprocess
  (src: scripts/git_gate.py `[sys.executable, str(root / gate)],`). That list has 22 entries — a list
  length, not a literal in the file — and does not include `scripts/check_plan_package_compat.py`,
  `scripts/check_prompt_trace_assets.py`, `scripts/sync_wiki_to_graph.py`, or
  `scripts/real_driver_ablation.py`, all four of which exist under `scripts/`.
- The two lists disagree: `scripts/check_plan_package_compat.py` still expects a 23-entry order that
  includes `scripts/validate_molecular_commit_lineage.py`, and rejects any receipt whose gate count
  differs (src: scripts/check_plan_package_compat.py `payload.get("expected_gate_count") != len(GIT_GATE_ORDER)`).
  It passes today only because that receipt is optional
  (src: scripts/check_plan_package_compat.py `if args.gate_receipt else None`).
- `.github/workflows/weekly_audit.yml` runs only the deterministic `scripts/ablation_engine.py`
  (src: .github/workflows/weekly_audit.yml `- run: python scripts/ablation_engine.py`), never
  the real-driver ablation.
- No gate reads `skills/gemini_interactions/status.json`; grepping `scripts/`, `.githooks/` and
  `.github/` for that filename returns nothing. Quarantine is a recorded decision
  (src: skills/gemini_interactions/status.json `"production_routable": false,`), not an enforced control.

Full table in [Entrypoint matrix](../operations/entrypoint-matrix.md).

## Adversarial review is pending, not absent-therefore-fine

`scripts/semantic_arbitration_report.py` reports `executed_adversarial_reviews=3` and
`pending_adversarial_reviews=3` with a status it prints unconditionally
(src: scripts/semantic_arbitration_report.py `semantic_arbitration_status=candidate_until_human_admit`). The
repository's own rule is that an actor that did not run is surfaced as a gate rather than inferred as
success (src: PROJECT-SSOT.md `absent agy findings are surfaced as a gate, not inferred as success`).
See [Semantic arbitration](../validation/semantic-arbitration.md).

## documentation debt

This wiki was regenerated by the **skill-bettor repo-wiki control plane** — the host-native port of the
OpenWiki official procedure — replacing a previous hand-maintained set. Two items of documentation debt
are outstanding:

1. **`scripts/check_openwiki.py` carries a stale expected value.** It requires the
   `code-call-lifecycle.md` page to contain a 157/157 count
   (src: scripts/check_openwiki.py `gcr_molecular_commits.json: protected_history=157 compensated=157 failed=0 schema=v0.2`),
   while the authoritative verification receipt reports 235
   (src: data/verification_runs/gcr_three_surface_commit_traceability_2026-07-27.json `"commit_count": 235,`).
   That page quotes the stale expectation explicitly and states the true counts;
   the one-value correction to the gate has not been made because a documentation run does not modify
   source. See [Code call lifecycle](code-call-lifecycle.md).
2. **Depth is uneven.** `scripts/real_driver_ablation.py` is 426 lines and describes itself as
   (src: scripts/real_driver_ablation.py `Run a real agent command against the same cases with and without skill context.`);
   `scripts/validate_molecular_commit_lineage.py` is 585 lines and describes itself as
   (src: scripts/validate_molecular_commit_lineage.py `Validate the compensating lineage ledger for GCR molecular commits.`).
   Both, and the TypeScript module bodies, were read
   at CLI, structure and exported-surface level rather than in full. Pages derived from them state
   contracts and invariants, not line-level behavior. The full list is in the Backlog of
   [Quickstart](../quickstart.md).
