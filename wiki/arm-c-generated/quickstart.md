---
type: Guide
title: Quickstart
description: Entry point for the agent-skills-repo wiki — what the repository is, how its five layers connect, a task-routing table from change area to page, source entrypoint, focused test and narrowest validation command, and the accepted backlog.
tags: [quickstart, navigation, task-routing]
node_kind: RepoDoc
ingest_lane: concept
repo: local/agent-skills-repo
commit: 5d3c42f
covers: [wiki-navigation, task-routing, repo-archetype]
libraries: []
generated_by: claude-code+opus (skill-bettor openwiki port)
generated_at: null
---

# Quickstart

`agent-skills-repo` is a **skill-asset governance seed**: two prompt-shaped skill assets, about 30
deterministic Python scripts that refuse to let them drift, the structured JSON evidence those scripts
read and re-derive, a vendored Bun/TypeScript terminal operator that cannot execute from this checkout,
and this wiki — which the scripts treat as a gated contract surface, not as prose.

Nothing here trains, serves, or calls a model by default. Every default-path command is deterministic
and offline.

Start here if you are about to change something. `nonofficial/README.md` is the second, gate-required
entry and indexes the hand-written pages.

## The map

| Layer | Path | Page |
|---|---|---|
| Skill assets | `skills/<slug>/` | [Skill asset contract](skill-assets/contract.md) |
| Defense chain | `scripts/`, `.githooks/`, `.github/workflows/` | [Defense gate chain](architecture/defense-gate-chain.md) · [Entrypoint matrix](operations/entrypoint-matrix.md) |
| Structured evidence | `data/` | [Structured lifecycle datasets](lifecycle/structured-datasets.md) · [Data authority](architecture/data-authority.md) |
| Terminal operator | `.agents/skills/repo-terminal-operator/` | [Terminal operator overview](terminal-operator/overview.md) |
| Wiki as contract | `openwiki/` | [Non-official provenance map](nonofficial/provenance.md) |

Read [Repository architecture](architecture/overview.md) first for how the layers relate, and
[Production bottlenecks](nonofficial/production-bottlenecks.md) before quoting any number here as a
capability claim.

## First commands

```sh
git config core.hooksPath .githooks
python3 scripts/git_gate.py                    # the 22-gate local chain
python3 scripts/check_plan_package_compat.py   # the strictest guard; nothing runs it automatically
python3 -m pytest -q                           # three test modules
```

## Task routing

| I want to change… | Read | Source entrypoint / symbols | Focused test | Narrowest validation |
|---|---|---|---|---|
| a skill's behaviour cases | [Skill asset contract](skill-assets/contract.md) | `scripts/validator.py::validate_cases` | `test_skill_asset_governance.py::test_static_defense_scripts_pass` | `python3 scripts/validator.py` |
| a skill's routing card | [Skill asset contract](skill-assets/contract.md) | `skill_description_linter.py`, `validate_progressive_disclosure.py::validate_skill` | same | `python3 scripts/validate_progressive_disclosure.py --json` |
| the Gemini asset or its quarantine | [gemini_interactions](skill-assets/gemini-interactions.md) | `skills/gemini_interactions/`, `status.json` | `test_p11_synthetic_and_zero_llm_telemetry` | `python3 scripts/local_regex_runner.py` |
| the autoresearch asset or its state graph | [autoresearch_composer](skill-assets/autoresearch-composer.md) | `skills/autoresearch_composer/references/state_graph.md` | `test_autoresearch_eval_suite.py` | `python3 scripts/check_autoresearch_lifecycle.py` |
| the gate list or the receipt | [Defense gate chain](architecture/defense-gate-chain.md) | `git_gate.py::GATES`, `input_state_sha256` | `test_static_defense_scripts_pass` | `python3 scripts/git_gate.py` |
| a static linter's rules | [Static validators](validation/static-validators.md) | `scripts/validate_goal_constraints.py::validate_text` | — | `python3 scripts/validate_goal_constraints.py <file>` |
| the golden datasets or the judge | [Behavioral eval and judge](validation/behavioral-eval-and-judge.md) | `eval_autoresearch_composer.py::deterministic_guardrails` | `test_autoresearch_eval_suite.py` | `python3 scripts/eval_autoresearch_composer.py --dataset data/autoresearch_golden/pr_golden_set.json` |
| the A/B or benchmark numbers | [Ablation and benchmark](validation/ablation-and-benchmark.md) | `ablation_engine.py::evaluate`, `benchmark_runner.py::run_matrix` | `test_real_driver_ablation.py` | `python3 scripts/ablation_engine.py` |
| the real-agent driver | [Ablation and benchmark](validation/ablation-and-benchmark.md) | `real_driver_ablation.py::invoke`, `resolve_model` | `test_real_driver_ablation.py` | `python3 -m pytest -q tests/test_real_driver_ablation.py` |
| the 117-case corpus | [Synthetic corpus](validation/synthetic-corpus.md) | `synthetic_case_generator.py::generate_cases` | `test_p11_synthetic_and_zero_llm_telemetry` | `python3 scripts/synthetic_case_quality_report.py` |
| a claim's grading or adversarial review | [Semantic arbitration](validation/semantic-arbitration.md) | `semantic_arbitration_report.py::validate_claim` | — | `python3 scripts/semantic_arbitration_report.py` |
| lifecycle data or promotion state | [Structured lifecycle datasets](lifecycle/structured-datasets.md) | `check_lifecycle_datasets.py::main`, `render_lifecycle_openwiki.py::render` | `test_autoresearch_eval_and_trace_gates_pass` | `python3 scripts/render_lifecycle_openwiki.py --write && python3 scripts/check_lifecycle_datasets.py` |
| commit messages or lineage | [Molecular commit lineage](governance/molecular-commit-lineage.md) | `validate_commit_message.py::validate_text`, `validate_molecular_commit_lineage.py::validate_three_surface_ledger` | `test_molecular_commit_lineage_selftest_passes` | `python3 scripts/validate_molecular_commit_lineage.py --selftest` |
| the manifest or required paths | [Plan-package compatibility](governance/plan-package-compat.md) | `check_plan_package_compat.py::main` | `test_skill_asset_structure` | `python3 scripts/check_plan_package_compat.py` |
| a hook or workflow | [Entrypoint matrix](operations/entrypoint-matrix.md) | `.githooks/`, `.github/workflows/` | — | `python3 scripts/git_gate.py` |
| any wiki page | [Data authority](architecture/data-authority.md) · [Non-official provenance map](nonofficial/provenance.md) | `sync_wiki_to_graph.py::event_for_file` | `test_wiki_graph_sync_gate_passes` | `python3 scripts/check_openwiki.py && python3 scripts/check_wiki_graph_sync.py` |
| the wiki→graph projection | [Wiki graph sync architecture](nonofficial/wiki-graph-sync-architecture.md) · [Schema standards](nonofficial/schema-standards.md) | `sync_wiki_to_graph.py::project_graph` | `test_wiki_graph_sync_gate_passes` | `python3 scripts/check_wiki_graph_sync.py` |
| prompt-trace data | [Prompt trace assets](nonofficial/prompt-trace-assets.md) | `check_prompt_trace_assets.py::main` | — | `python3 scripts/check_prompt_trace_assets.py` |
| anything under `.agents/` | [Terminal operator overview](terminal-operator/overview.md) | `repo-adapter.ts`, `small-loop-runner.ts` | none in this checkout | none — it cannot run here |

## Concepts worth knowing before editing

- **Generated vs hand-written.** `openwiki/nonofficial/structured-lifecycle-data.md` is a build artifact
  compared byte-for-byte against its renderer; `index.md` files are generated after each wiki run.
  See [Data authority](architecture/data-authority.md).
- **The gate must not change the tree.** `git_gate.py` hashes the working tree before and after and
  exits 125 on any difference.
- **Evidence is graded.** `candidate_until_human_admit`, `quality_status=insufficient` and
  `pending_adversarial_reviews=3` are asserted values, not defects to be cleaned up.
- **Two gates run selftests only.** `validate_goal_constraints.py` and `validate_commit_message.py` get
  no arguments inside the chain. See [Static validators](validation/static-validators.md).

## Known drifts recorded, not hidden

| Drift | Where |
|---|---|
| `git_gate.py` has 22 gates; `check_plan_package_compat.py` expects 23, so `--gate-receipt` cannot accept any receipt this repo produces | [Defense gate chain](architecture/defense-gate-chain.md) |
| `check_openwiki.py` still expects `protected_history=157` where the ledger says 235 | [Molecular commit lineage](governance/molecular-commit-lineage.md) |
| the lifecycle registry points at a pre-relocation wiki path, and the renderer copies it verbatim | [Data authority](architecture/data-authority.md) |
| the cost cache accepts observation `@v1` while the collector emits `@v2`; nothing consumes `@v2` | [Evidence cost](terminal-operator/evidence-cost.md) |
| the compatibility guard's 77 required paths cover nothing under `.agents/` | [Plan-package compatibility](governance/plan-package-compat.md) |

## Backlog

Accepted deferrals from this documentation run, each with its reason:

1. **Wiki→graph projection and schema standards have no root page.**
   `nonofficial/wiki-graph-sync-architecture.md` and `nonofficial/schema-standards.md` already own them
   and are pinned by `scripts/check_wiki_graph_sync.py`; duplicating them would create two sources for
   one contract. Routed from the table above instead.
2. **Line-level behaviour of the largest modules is not documented.**
   `async-worker-carrier.ts` (1,219 lines), `evidence-cost-cache.ts` (920) and
   `evidence-cost-collector.ts` (769) were read at contract, schema, error-taxonomy and exported-surface
   level. Their pages state invariants and failure modes, not statement-by-statement behaviour, because
   the code cannot execute here and no test exercises it — every claim would be unverifiable inference.
3. **The 129 committed artifacts under `artifacts/repo-terminal-operator/` are described but not
   individually catalogued** (src: artifacts/repo-terminal-operator/production-journey.receipt.json `"evidence_scope": "deterministic-preflight-entrypoint",`).
   They are historical receipts nothing here reads or regenerates; see
   [Production profiles and evidence](terminal-operator/production-profiles-and-evidence.md).
4. **`data/commit_lineage/gcr_molecular_commits.json` (228 KB, 235 entries) is documented by schema and
   invariant, not entry by entry.** The entries describe commits in another workspace that this
   checkout cannot resolve.
