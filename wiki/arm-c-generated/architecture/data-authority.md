---
type: Architecture
title: Data authority
description: Which artifact in this repository is hand-written, which is generated, and which is generated and then byte-compared — plus the regeneration command and the current authority drift for each.
tags: [data, provenance, generated-artifacts]
node_kind: RepoDoc
ingest_lane: concept
repo: local/agent-skills-repo
commit: 5d3c42f
covers: [data-authority, generated-artifacts, regeneration]
libraries: []
generated_by: claude-code+opus (skill-bettor openwiki port)
generated_at: null
---

# Data authority

Editing the wrong file here is the most likely way to break a gate, because several Markdown and JSON
files are *build outputs* that merely look editable. This page is the ownership table.

## Authority classes

| Class | Meaning | Examples |
|---|---|---|
| **Hand-written SSOT** | a human edits it; gates read it | `data/lifecycle/*.json`, `data/prompt_trace/*`, `skills/*/skills.md`, `plan-package.compat.yaml` |
| **Generated, byte-compared** | a script writes it and a gate asserts byte equality | `openwiki/nonofficial/structured-lifecycle-data.md` |
| **Generated, overwritten** | a script rewrites it wholesale; no equality assertion | `data/wiki_graph/event_log.jsonl`, `data/wiki_graph/sample_graph.json`, `openwiki/**/index.md` |
| **Historical receipt** | written once by a run that no longer executes here | `artifacts/repo-terminal-operator/**`, `data/verification_runs/*` |

## Generated and byte-compared: the lifecycle display page

`openwiki/nonofficial/structured-lifecycle-data.md` is not documentation. It is rendered from the six
files under `data/lifecycle/` by a generator whose write target is hard-coded
(src: scripts/render_lifecycle_openwiki.py `target = ROOT / "openwiki" / "nonofficial" / "structured-lifecycle-data.md"`),
and a gate re-runs the generator and compares the bytes
(src: scripts/check_lifecycle_datasets.py `failures.append("structured lifecycle openwiki must equal renderer output")`).

Regenerate with `python3 scripts/render_lifecycle_openwiki.py --write`; verify with
`python3 scripts/check_lifecycle_datasets.py`. Never hand-edit it. The upstream data model is
[Structured lifecycle datasets](../lifecycle/structured-datasets.md).

### A live authority drift

The registry row that page renders still points at the pre-relocation wiki path
(src: data/lifecycle/skill_optimization_registry.json `"openwiki_page": "openwiki/autoresearch-composer-lifecycle.md"`).
The renderer copies that field verbatim into the table
(src: scripts/render_lifecycle_openwiki.py `skill.get('openwiki_page')`), so the generated page
advertises a path that does not exist — the real page is
`openwiki/nonofficial/autoresearch-composer-lifecycle.md`. Nothing fails, because
`check_lifecycle_datasets.py` asserts the *rendered string set*, not that the path resolves.

(inferred) This is exactly the failure mode a byte-comparison gate cannot catch: it proves the page
agrees with the data, never that the data is true. The fix belongs in the registry JSON, which would
then propagate through `--write`; correcting the Markdown alone would break the equality assertion on
the next run.

## Generated and overwritten: the graph projection

`scripts/sync_wiki_to_graph.py` walks every Markdown file under `openwiki/` and rewrites two files in
place (src: scripts/sync_wiki_to_graph.py `args.event_log.write_text(`), whose defaults are
`data/wiki_graph/event_log.jsonl` and `data/wiki_graph/sample_graph.json`
(src: scripts/sync_wiki_to_graph.py `default=ROOT / "data/wiki_graph/sample_graph.json"`). Adding or
editing any wiki page makes both stale until the sync runs.

The validating gate deliberately does not write into the repository — it runs the sync into a
temporary directory instead (src: scripts/check_wiki_graph_sync.py `with tempfile.TemporaryDirectory(prefix="wiki-graph-check-") as tmp:`),
which is what lets it sit inside `git_gate.py` without breaking the input-state guarantee described in
[Defense gate chain](defense-gate-chain.md). The architecture and schema of that projection are owned
by [Wiki graph sync architecture](../nonofficial/wiki-graph-sync-architecture.md) and
[Schema standards](../nonofficial/schema-standards.md).

**Staleness is not detected.** The temporary re-projection is discarded; the gate never compares it
with the committed artifacts. What it then checks on the checked-in files is *structural only* — the
schema version, that the log is non-empty, that each event carries the schema's required fields and
each event's licence block carries the required provenance fields, that the graph has the required
top-level keys, and that both retrieval contracts are enabled with external writes off
(src: scripts/check_wiki_graph_sync.py `failures.append(f"event missing field: {field}")`)
(src: scripts/check_wiki_graph_sync.py `failures.append("external graph write must be disabled by default")`).
Every event in the committed log also carries a fixed timestamp
(src: scripts/sync_wiki_to_graph.py `GENERATED_EVENT_TIMESTAMP = "2026-07-23T00:00:00Z"`) and whatever
`--commit-sha` the run was given, defaulting to a placeholder
(src: scripts/sync_wiki_to_graph.py `parser.add_argument("--commit-sha", default="local-dev")`).

So an `event_log.jsonl` describing pages that no longer exist — or missing pages that do — passes this
gate as long as its rows are well-formed. Only the CI job regenerates them
(src: .github/workflows/wiki_graph_sync.yml `python scripts/sync_wiki_to_graph.py \`).

(inferred) That is a deliberate consequence of the input-state rule rather than an oversight: a gate
that detected staleness by regenerating in place would mutate the tree and trip exit 125, and one that
compared byte-for-byte would fail on the commit sha alone, since the committed artifacts were produced
with a different `--commit-sha`. Freshness is therefore a CI property, not a local one — after editing
any wiki page, treat both graph artifacts as stale until that job runs.

`openwiki/**/index.md` files are likewise generated after each wiki run and must not be hand-written.

## Historical receipts

`artifacts/repo-terminal-operator/` holds 129 committed JSON files — 66
`writer-production-journey.*.receipt.json`, 24 `production-journey.*`, and per-run
valid/stale/malformed packet fixtures. No script in this repository writes, reads, expires or
validates them; the code that produced them cannot execute here. They are evidence of past runs, not
a live contract. See [Production profiles and evidence](../terminal-operator/production-profiles-and-evidence.md).

`data/verification_runs/` is similar in spirit but *is* consumed: the two GCR traceability runs are
re-checked by `scripts/validate_molecular_commit_lineage.py`, while
`gemini_interactions_real_driver_2026-07-27.json` is referenced only from
`skills/gemini_interactions/status.json` and by no gate at all — see
[gemini_interactions](../skill-assets/gemini-interactions.md).

## Artifacts pinned to one machine

Several SSOT files store absolute host paths. The commit-message validator falls back to a literal
workspace root (src: scripts/validate_commit_message.py `return Path("<host-repo>")`),
and both `data/commit_lineage/gcr_molecular_commits.json` and
`data/prompt_trace/prompt_trace_dataset.json` carry `*_abs` fields pointing outside this tree
(src: data/commit_lineage/gcr_molecular_commits.json `"small_loop_abs": "<host-repo>/prototype/unknown-discovery-gcr-order/agent-skills-repo/small-loop/"`).

(inferred) The paths are absolute because the claim they support is about a *specific* physical
workspace: a relative path would silently re-anchor to whatever tree the validator happened to run in,
which is the same class of bug that got the lineage validator removed from `GATES`. The cost is that
a clean-room clone cannot reproduce those claims; that cost is recorded as `root-local-runtime` in
[Production bottlenecks](../nonofficial/production-bottlenecks.md).

## Narrow validation

| If you changed | Run |
|---|---|
| `data/lifecycle/**` | `python3 scripts/render_lifecycle_openwiki.py --write && python3 scripts/check_lifecycle_datasets.py` |
| any `openwiki/**/*.md` | `python3 scripts/check_wiki_graph_sync.py` |
| `data/prompt_trace/**` | `python3 scripts/check_prompt_trace_assets.py` |
| `data/semantic_arbitration_claims.json` | `python3 scripts/semantic_arbitration_report.py` |
