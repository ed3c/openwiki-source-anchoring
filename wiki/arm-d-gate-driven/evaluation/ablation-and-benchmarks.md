---
type: Component
title: Ablation engine, benchmark matrix and judge parser
description: The simulated A/B delta gate that decides whether a skill asset earns its place, the deterministic 100-task benchmark matrix, and the double-lock parser for LLM judge verdicts.
tags: [evaluation, ablation, benchmark, judge]
node_kind: RepoDoc
ingest_lane: concept
repo: arm-d/agent-skills-repo
covers: [ablation-gate, benchmark-matrix, judge-parser]
libraries: [python]
generated_by: claude-code+claude-opus-5
generated_at: null
---

# Ablation engine, benchmark matrix and judge parser

## The ablation gate

`scripts/ablation_engine.py` answers "does this asset change behaviour?" with a
deterministic A/B (src: scripts/ablation_engine.py `Deterministic local ablation runner for skill assets with regex telemetry.`).
For each case it scores a simulated agent twice, with and without the skill
(src: scripts/ablation_engine.py `with_skill = sum(score_case(case, True) for case in synthetic_cases) / len(synthetic_cases)`),
and the verdict is a single threshold
(src: scripts/ablation_engine.py `TARGET_DELTA = 0.05`) applied as
(src: scripts/ablation_engine.py `"verdict": "PASS" if delta > TARGET_DELTA else "FAIL"`), failing loudly
otherwise (src: scripts/ablation_engine.py `FAIL: ablation delta too small:`).

Scoring is asymmetric on purpose. With the skill, the regex result stands; without
it, a case that *should* have triggered is capped
(src: scripts/ablation_engine.py `return min(0.4, regex_score)`), while a negative case keeps its
score. (inferred) That cap encodes the belief the gate is testing — that the
absence of a skill should hurt only where the skill was supposed to fire — and it
is the reason a corpus with no negatives could not produce a meaningful delta.

The simulated agent branches per asset. For `autoresearch_composer` the
no-skill arm returns single-prompt shortcuts such as
(src: scripts/ablation_engine.py `/autoresearch:debug single prompt bug loop`), the with-skill negative arm
returns an explicit native-yield state graph
(src: scripts/ablation_engine.py `no slash command route selected; no contract generated`), and the
with-skill positive arm returns the full contract text
(src: scripts/ablation_engine.py `conditional_edge.S4.ablation_not_positive -> hard_gate FAIL`). For the default
asset it returns real current-API snippets
(src: scripts/ablation_engine.py `await ai.interactions.create({model: 'gemini-3.5-flash', input: 'hi'});`) versus
legacy text (src: scripts/ablation_engine.py `legacy startChat start_chat output`).

The telemetry it emits is what downstream gates consume — overall and
per-polarity rates plus case counts
(src: scripts/ablation_engine.py `"negative_with_skill_success_rate": round(negative_with_skill, 4),`).
[`check_autoresearch_lifecycle.py`](autoresearch-eval.md) re-runs it against the
composer corpus and requires five simultaneous conditions
(src: scripts/check_autoresearch_lifecycle.py `or telemetry.get("negative_with_skill_success_rate") != 1.0`).
The weekly workflow runs the default invocation on a schedule
(src: .github/workflows/weekly_audit.yml `run: python scripts/ablation_engine.py`).

`generate_cases` back-fills identifiers and a default check when a corpus omits
them (src: scripts/ablation_engine.py `enriched.setdefault("case_id", f"AB-{index:03d}")`); the default
pattern is a permissive alternation
(src: scripts/ablation_engine.py `GoogleGenAI|genai\.Client|interactions\.create`). (inferred) Relying on that
default would quietly weaken the gate, which is why
[`validator.py`](../governance/skill-asset-validators.md) refuses weak
`expected_checks` upstream instead.

## The benchmark matrix

`scripts/benchmark_runner.py` is a fixed-parameter matrix, not a measurement
(src: scripts/benchmark_runner.py `Deterministic benchmark matrix for skill quality deltas.`). It builds
100 tasks with a difficulty pattern
(src: scripts/benchmark_runner.py `"difficulty": "Hard" if index % 3 == 0 else "Medium"`) and computes each
cell from a base rate plus a group adjustment and a deterministic jitter
(src: scripts/benchmark_runner.py `adjustment = {"control": 0.0, "high_quality": 0.15, "low_quality": -0.20}[group]`),
crossing two models with two harnesses
(src: scripts/benchmark_runner.py `harnesses = ("Harness-A-Coding", "Harness-B-Productivity")`). It fails
unless the task count is 100, the high-quality delta clears 0.13, and the
low-quality delta is negative
(src: scripts/benchmark_runner.py `if report["task_count"] != 100 or report["delta_high_quality"] < 0.13 or report["delta_low_quality"] >= 0:`).
The exact deltas are pinned by test
(src: tests/test_skill_asset_governance.py `assert "delta_high_quality=0.15" in benchmark.stdout`).
(inferred) Read this as a shape check on the reporting pipeline — it proves the
matrix, aggregation and thresholds are wired, and it deliberately contains no
observed data.

## The judge parser

`scripts/llm_judge.py` parses a verdict that a model *would* return
(src: scripts/llm_judge.py `Local parser for LLM judge verdicts with XML-shield and double-lock semantics.`).
The shield wraps the response in tags before extraction
(src: scripts/llm_judge.py `payload = extract_json(f"<judge_output>{args.response}</judge_output>")`), the
extractor takes the first JSON object
(src: scripts/llm_judge.py `re.search(r"\{.*\}", text, flags=re.S)`) and rejects non-standard
constants such as `NaN` or `Infinity`
(src: scripts/llm_judge.py `non-standard JSON constant`); scores must be finite
(src: scripts/llm_judge.py `score must be finite`). The double lock then requires all three of
a PASS verdict, a score at or above the bar, and no breach phrase in the
reasoning (src: scripts/llm_judge.py `if verdict != "PASS" or score < 0.85 or "breach detected" in reasoning:`),
reported as (src: scripts/llm_judge.py `FAIL: double-lock judge rejection`). No network call
exists in the file — it defaults to a literal response
(src: scripts/llm_judge.py `parser.add_argument("--response", default=`).

## Validation

```sh
python3 scripts/ablation_engine.py --cases skills/autoresearch_composer/cases.json --json
python3 scripts/benchmark_runner.py
python3 scripts/llm_judge.py --response '{"verdict":"FAIL","score":0.2,"reasoning":"x"}'   # exits 2
```

Related: [regex canary](interactions-regex-canary.md),
[autoresearch eval](autoresearch-eval.md),
[real-driver ablation](real-driver-ablation.md).
