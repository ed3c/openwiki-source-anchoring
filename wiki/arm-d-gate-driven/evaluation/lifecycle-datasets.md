---
type: DataContract
title: Structured lifecycle datasets and their generated display layer
description: The data/lifecycle JSON files that are the structured SSOT for skill promotion state, the deterministic renderer that projects them into Markdown, and the gate that requires the two to be byte-identical.
tags: [datasets, lifecycle, promotion, generated-docs]
node_kind: RepoDoc
ingest_lane: concept
repo: arm-d/agent-skills-repo
covers: [lifecycle-datasets, generated-display-layer, promotion-record, drift-metrics]
libraries: [python]
generated_by: claude-code+claude-opus-5
generated_at: null
---

# Structured lifecycle datasets and their generated display layer

## The shape of the idea

Six files under `data/lifecycle/` plus one trace file hold the promotion state of
every managed skill; one script projects them into Markdown; one gate proves the
Markdown was not written by hand. The renderer states the rule at the top of its
own output — the structured SSOT lives under `data/lifecycle/` and the page "must
not invent numbers that are absent from those files"
(src: scripts/render_lifecycle_openwiki.py `numbers that are absent from those files.`).

(inferred) This is the only place in the repository where documentation is
*generated* rather than checked, and the difference is deliberate: a table of
counts is exactly the kind of prose that rots silently, so it is compiled from
data and diffed instead of reviewed.

## The datasets

| File | Content | Anchor |
|---|---|---|
| `skill_optimization_registry.json` | the managed skills and their status | (src: scripts/render_lifecycle_openwiki.py `data/lifecycle/skill_optimization_registry.json`) |
| `golden_dataset_versions.json` | dataset versions and case counts | (src: scripts/render_lifecycle_openwiki.py `-> data/lifecycle/golden_dataset_versions.json`) |
| `eval_runs/autoresearch_composer_2026-07-23.json` | one dated run summary | (src: scripts/render_lifecycle_openwiki.py `-> data/lifecycle/eval_runs/autoresearch_composer_2026-07-23.json`) |
| `promotion_records.json` | promotion state and its human-admit binding | (src: scripts/render_lifecycle_openwiki.py `-> data/lifecycle/promotion_records.json`) |
| `trace_privacy_classification.json` | per-dataset cloud policy | (src: scripts/render_lifecycle_openwiki.py `-> data/lifecycle/trace_privacy_classification.json`) |
| `dataset_drift_history.jsonl` | per-version drift rows | (src: scripts/render_lifecycle_openwiki.py `-> data/lifecycle/dataset_drift_history.jsonl`) |
| `data/autoresearch_traces/failure_trace_samples.jsonl` | recorded failing traces | (src: scripts/check_lifecycle_datasets.py `data/autoresearch_traces/failure_trace_samples.jsonl`) |

## The renderer

`scripts/render_lifecycle_openwiki.py` reads all six and emits Markdown
(src: scripts/render_lifecycle_openwiki.py `Render OpenWiki lifecycle Markdown from structured lifecycle datasets.`),
building a dataflow block, a registry table, a dataset-version table, a dated
eval-run row, a trace-privacy table, a promotion-record table and a drift table.
It has three modes: `--write` overwrites the page
(src: scripts/render_lifecycle_openwiki.py `PASS: rendered lifecycle openwiki`), `--stdout` prints it, and the
default compares (src: scripts/render_lifecycle_openwiki.py `FAIL: lifecycle openwiki is not generated from structured data`).
The default mode is the one `GATES` runs, so a hand-edited page fails the push
hook.

Its closing section defines the extension contract for a new skill: exactly one
registry row, at least one dataset version, one dated eval run, one promotion
record, trace privacy entries and one drift row
(src: scripts/render_lifecycle_openwiki.py `and one drift-history row. Then expose the same IDs in openwiki and make`).

## The gate

`scripts/check_lifecycle_datasets.py` validates the data and the projection
together (src: scripts/check_lifecycle_datasets.py `Validate structured lifecycle datasets and their OpenWiki display layer.`).
The strongest assertion is byte equality between the committed page and a fresh
render (src: scripts/check_lifecycle_datasets.py `structured lifecycle openwiki must equal renderer output`) — which is
why `openwiki/nonofficial/structured-lifecycle-data.md` must never be edited by
hand or by a documentation pass; see the
[openwiki contract](../wiki/openwiki-contract.md).

Beyond that it pins:

- the registry to a single managed skill in a single status
  (src: scripts/check_lifecycle_datasets.py `autoresearch_composer status must be production-seed-candidate`);
- dataset versions to exact case counts
  (src: scripts/check_lifecycle_datasets.py `"autoresearch-nightly-golden@2026-07-23": 3,`);
- the eval-run summary field by field
  (src: scripts/check_lifecycle_datasets.py `"failure_trace_samples": 2,`);
- the promotion record's status and human gate
  (src: scripts/check_lifecycle_datasets.py `promotion record must remain candidate_until_human_admit`);
- the *binding* that a human would sign, which must be prepared but unsigned
  (src: scripts/check_lifecycle_datasets.py `human_admit_binding must be prepared_unsigned before human admit`), must bind
  all four plan-package inputs
  (src: scripts/check_lifecycle_datasets.py `human_admit_binding must bind all plan-package input ids`), and must name the
  route and both edge ids
  (src: scripts/check_lifecycle_datasets.py `human_admit_binding must bind final lineage edge id`), with its dataset
  versions and commit matching the record itself
  (src: scripts/check_lifecycle_datasets.py `human_admit_binding molecular_commit must match promotion record`);
- privacy at both levels
  (src: scripts/check_lifecycle_datasets.py `trace privacy root cloud_upload_allowed must be false`);
- drift rows, including that the route distribution sums to the case count
  (src: scripts/check_lifecycle_datasets.py `drift route_distribution must sum to case_count:`);
- failure traces as genuinely failing and local
  (src: scripts/check_lifecycle_datasets.py `failure trace must be FAIL and local-only:`);
- and sixteen literals in the rendered page
  (src: scripts/check_lifecycle_datasets.py `required_literals = [`).

(inferred) The human-admit binding is the most interesting artefact here: it
pre-computes everything a human would have to check — datasets, commit, inputs,
route, lineage edge — and then refuses to be anything but unsigned. The machine
prepares the decision; it may not make it. That is the
[promotion policy](../architecture/evidence-and-promotion-policy.md) in data form.

## Validation

```sh
python3 scripts/render_lifecycle_openwiki.py            # default mode: compare, do not write
python3 scripts/check_lifecycle_datasets.py             # PASS: lifecycle datasets and openwiki display
python3 scripts/render_lifecycle_openwiki.py --write    # only after the data changed
```
