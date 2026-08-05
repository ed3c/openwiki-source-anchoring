---
type: Reference
title: Data Authority
description: Which artifact is authoritative for which fact, who may write it, how it is regenerated, and whether a claim is verifiable in this checkout or only a recorded receipt.
tags: [provenance, ownership]
node_kind: RepoDoc
ingest_lane: concept
repo: local/agent-skills-repo
covers: [state-ownership, evidence-provenance, regeneration]
libraries: []
generated_by: claude-code+opus (skill-bettor openwiki port)
generated_at: null
---

# Data Authority

(inferred) There is no single "the data is SSOT" rule here, and assuming one leads to real mistakes.
Authority is per-domain. `PROJECT-SSOT.md` states the wiki case explicitly
(src: PROJECT-SSOT.md `Wiki-to-Graph sync is local-first Event Sourcing`):

> Wiki-to-Graph sync is local-first Event Sourcing: Markdown is human SSOT, event log is audit trail,
> graph JSON is default projection, external Graph DB write is opt-in.

So for the wiki plane, Markdown is upstream of the JSON — the opposite of the lifecycle plane, where
JSON is upstream of the Markdown.

## Ownership table

| Domain | Authority | Who may write | Regeneration |
|---|---|---|---|
| `skills/*/skills.md`, `skills/*/cases.json` | human SSOT | author | none; validated only |
| `skills/*/status.json` | the human promotion decision | human | none — and no gate reads it *(inferred: no file under `scripts/` references it)* |
| `data/lifecycle/**` | machine SSOT for lifecycle facts | author edits the JSON | drives its Markdown view |
| `openwiki/structured-lifecycle-data.md` | **generated projection** | `render_lifecycle_openwiki.py --write` only (src: scripts/render_lifecycle_openwiki.py `parser.add_argument("--write", action="store_true")`) | must stay byte-equal to `--stdout` |
| every other `openwiki/**/*.md` | human SSOT | author | none |
| `data/wiki_graph/event_log.jsonl` | audit trail | `sync_wiki_to_graph.py` | **fully overwritten** each run (src: scripts/sync_wiki_to_graph.py `args.event_log.write_text(`) |
| `data/wiki_graph/sample_graph.json` | projection | `sync_wiki_to_graph.py` | **fully overwritten** each run (src: scripts/sync_wiki_to_graph.py `args.graph_out.write_text(`) |
| `data/verification_runs/**` | immutable receipt of a completed run | human, only by adding a new dated file | never edited in place |
| `data/semantic_arbitration_claims.json` | **mutable candidate-claim registry** | human/agent as claim status changes | validated by `semantic_arbitration_report.py` (src: scripts/semantic_arbitration_report.py `CLAIMS = ROOT / "data" / "semantic_arbitration_claims.json"`) |
| `data/prompt_trace/**` | trace dataset + golden eval | human/agent | governed by `data/lifecycle/trace_privacy_classification.json`, read by the lifecycle gate (src: scripts/check_lifecycle_datasets.py `read_json("data/lifecycle/trace_privacy_classification.json")`) |
| `data/commit_lineage/gcr_molecular_commits.json` | compensating lineage ledger | human | validated, not regenerated (src: scripts/validate_molecular_commit_lineage.py `"data" / "commit_lineage" / "gcr_molecular_commits.json"`) |

Three of those rows are routinely conflated and are worth separating explicitly:

- A **verification run** is a receipt. It records what a completed run measured, is dated in its
  filename, and is never edited — a new finding means a new file.
- The **semantic arbitration claims** file is not a receipt. It is a live registry whose entries carry
  status, and `semantic_arbitration_report.py` reports
  `semantic_arbitration_status=candidate_until_human_admit`
  (src: scripts/semantic_arbitration_report.py `semantic_arbitration_status=candidate_until_human_admit`)
  — *(inferred)* precisely because entries can still change.
- **Prompt traces** are neither. They are a dataset with their own privacy classification and their own
  external-revalidation rules, re-checked against frozen inputs only when
  `check_prompt_trace_assets.py` is given `--workspace-root` / `--commit-repo`
  (src: scripts/check_prompt_trace_assets.py `if flag not in {"--workspace-root", "--commit-repo"}:`).

## Evidence origin: three tiers

Every claim in this wiki falls into one of three tiers. Pages state which one applies.

| Tier | Meaning | Example |
|---|---|---|
| **verifiable in this checkout** | a command here reproduces it | `python3 scripts/eval_autoresearch_composer.py --dataset data/autoresearch_golden/pr_golden_set.json` prints `PASS: autoresearch eval suite cases=4 passed=4 mode=local cloud_judge_enabled=false` and exits 0 (observed 2026-08-04) |
| **receipt / data claim only** | recorded by a past run; this checkout does not replay it | `A2_FAIL_DO_NOT_PROMOTE` in the real-driver verification run (src: data/verification_runs/gemini_interactions_real_driver_2026-07-27.json `"decision": "A2_FAIL_DO_NOT_PROMOTE"`) |
| **requires explicit external input** | needs a workspace or Git root that is not here | `validate_molecular_commit_lineage.py --require-current-history` |

*(inferred)* The third tier matters more than it looks. This directory **is not its own Git repository**.
Running a history audit here walks up to whatever enclosing repository contains it and audits *that*
repository's commits; in a detached copy it fails with
`--audit-protected-history requires --repo-root or a discoverable Git root`
(src: scripts/validate_molecular_commit_lineage.py `--audit-protected-history requires --repo-root or a discoverable Git root`).
*(inferred)* Any history result must name which repository was actually audited. Even the default lineage
validation is not fully self-contained: it dereferences the ledger's absolute external
`verification_run_abs` (src: scripts/validate_molecular_commit_lineage.py `payload.get("verification_run_abs")`).

Several datasets likewise carry absolute paths outside this tree
(`loop_wiki/evolve-unknown-discovery-plan-truth/...`, `<home>/...`), so a clean-room clone cannot
reproduce those claims without being handed the roots. See
[Production bottlenecks](../nonofficial/production-bottlenecks.md).

## Regeneration commands

```sh
python3 scripts/render_lifecycle_openwiki.py --write    # lifecycle display page
python3 scripts/sync_wiki_to_graph.py                   # event log + graph projection
```

*(inferred)* Both are *author* actions. Their gate counterparts (`check_lifecycle_datasets.py`,
`check_wiki_graph_sync.py`) verify without writing, which is why they are safe inside
[the gate chain](defense-gate-chain.md) and the write commands are not.
