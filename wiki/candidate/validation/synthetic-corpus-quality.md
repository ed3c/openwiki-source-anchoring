---
type: Reference
title: Synthetic Corpus Quality
description: Why a 117/117 green canary coexists with quality_status=insufficient, and what the quality report measures that the canary cannot.
tags: [synthetic-cases, corpus-quality]
node_kind: RepoDoc
ingest_lane: concept
repo: local/agent-skills-repo
covers: [synthetic-corpus, canary-limits, non-promotion]
libraries: []
generated_by: claude-code+opus (skill-bettor openwiki port)
generated_at: null
---

# Synthetic Corpus Quality

This repository holds a 117-case corpus that passes 117/117 and simultaneously declares itself
insufficient. Both statements are true and neither is a bug.

## The corpus

`scripts/synthetic_case_generator.py` deterministically produces 117 Interactions-API regex fixtures and
hard-fails on any other size
(src: scripts/synthetic_case_generator.py `FAIL: production P11 matrix must contain exactly 117 cases`);
it reports `synthetic_cases=117 typescript=59 python=58`
(src: scripts/synthetic_case_generator.py `PASS: generated synthetic_cases={len(cases)} typescript=`).
`scripts/interactions_patch_assert_runner.py` evaluates them and reports
`total_cases_evaluated=117 passed_cases=117 success_rate=1.0 zero_llm_api_calls=0`
(src: scripts/interactions_patch_assert_runner.py `"PASS: interactions regex assertions "`).

`zero_llm_api_calls=0` is the honest label, not a boast: the canary is a pure regex exercise.

## What the quality report measures

`scripts/synthetic_case_quality_report.py` re-loads the generator
(src: scripts/synthetic_case_quality_report.py `cases = load_generator().generate_cases(117)`)
and analyses the corpus it produced, reporting:

| Metric | Value | What it says |
|---|---|---|
| `case_count` | 117 | size |
| `unique_scenarios` | 10 | the corpus expresses 10 distinct situations |
| `unique_expected_check_sets` | 2 | only two distinct assertions across all 117 cases |
| `negative_cases` | 0 | **nothing tests non-activation** |
| `max_template_similarity_ratio` | 0.9969 | two prompts are 99.7% identical after normalization |
| `quality_status` | `insufficient` | the verdict |

`max_template_similarity_ratio` is computed with the same `SequenceMatcher` the case validator uses to
reject near-duplicates above 0.85 — see [Skill asset contract](../skill-assets/contract.md). At 0.9969
this corpus is far past that line. It is not 117 cases; it is roughly 10 cases with 117 spellings.

`negative_cases: 0` is the more consequential number. A corpus with no negatives cannot distinguish an
asset that fires correctly from an asset that fires always.

## Why the gate passes anyway

`synthetic_case_quality_report.py` exits 0 and prints
`PASS: synthetic case quality perceived quality_status=insufficient …`
(src: scripts/synthetic_case_quality_report.py `"PASS: synthetic case quality perceived "`) — the verdict
is computed and then merely printed
(src: scripts/synthetic_case_quality_report.py `stats["quality_status"] = "insufficient" if insufficient_reasons else "admissible-candidate"`).
It is a **reporting** gate: its
job is to make the corpus's weakness visible on every run, not to block on it. Blocking would create
pressure to inflate the number; reporting keeps the honest label attached to it.

The same label is carried in the machine-readable contract, twice:

```yaml
p11_current_scope: local-zero-llm-regex-canary
synthetic_case_quality_status: insufficient
real_synthetic_generation_gate_required: true
```

`PROJECT-SSOT.md` states the consequence in prose: *"The current P11 117/117 result is scoped to local
zero-LLM regex canary truth; real synthetic case quality remains insufficient until a persisted admitted
corpus and quality gates exist."*

## What would make it sufficient

`real_synthetic_generation_gate_required: true` names the missing piece. Concretely:

1. negative cases, so non-activation is measurable at all;
2. more than two distinct `expected_checks` sets, so the corpus tests more than one assertion;
3. template similarity brought under the 0.85 line the hand-written corpora already respect;
4. a persisted, human-admitted corpus rather than one regenerated from a template each run;
5. a quality gate that blocks rather than reports, once 1–4 hold.

Until then, `interactions_patch_assert_runner.py` proves nothing about the skill, and less than it looks:
it never reads the generator's `expected_checks`, matching instead against its own hard-coded rule table
(src: scripts/interactions_patch_assert_runner.py `RULES = {`), and the "agent" it evaluates is a
constant string that ignores the prompt
(src: scripts/interactions_patch_assert_runner.py `def patched_agent(_prompt: str, language: str) -> str:`).
All 117 cases therefore reduce to two fixed snippets checked against two fixed rule sets.
See [Production bottlenecks](../nonofficial/production-bottlenecks.md).

## Validation

```sh
python3 scripts/synthetic_case_generator.py
python3 scripts/synthetic_case_quality_report.py
python3 scripts/interactions_patch_assert_runner.py
```
