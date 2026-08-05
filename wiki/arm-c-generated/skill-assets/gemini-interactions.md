---
type: Component
title: gemini_interactions skill asset
description: The quarantined Gemini Interactions asset — its ten cases, why the only real-agent measurement failed, and which gates still consume it while it is not production routable.
tags: [skill-assets, quarantine, gemini]
node_kind: RepoDoc
ingest_lane: concept
repo: local/agent-skills-repo
commit: 5d3c42f
covers: [gemini-interactions-asset, quarantine, real-driver-ablation]
libraries: []
generated_by: claude-code+opus (skill-bettor openwiki port)
generated_at: null
---

# `gemini_interactions`

The asset that teaches an agent to write current Gemini Interactions API code and to refuse the
legacy chat/session forms. It is **quarantined**: recorded as not routable to production
(src: skills/gemini_interactions/status.json `"status": "quarantined",`) as of
(src: skills/gemini_interactions/status.json `"decision_date": "2026-07-27",`).

Files: `skills/gemini_interactions/skills.md` (nine lines, four route signals),
`references/deploy_guide.md` (Layer 3), `cases.json` (ten cases), `status.json`.

## What it asserts

The behaviour it encodes is a syntax migration, expressed identically in the cases and in the
zero-LLM runner's rule table: TypeScript must import the current client
(src: scripts/interactions_patch_assert_runner.py `r"import\s+\{\s*GoogleGenAI\s*\}\s+from\s+['\"]@google/genai['\"]"`)
and Python must use the current entrypoint
(src: scripts/interactions_patch_assert_runner.py `r"from\s+google\s+import\s+genai", r"genai\.Client\(", r"\.interactions\.create\("`),
while the legacy forms are forbidden
(src: scripts/interactions_patch_assert_runner.py `"must_not_match": [r"\.startChat\(", r"new\s+GeminiChat\(", r"Interactions\.createSession\("],`).

## The ten cases

Five positive (`happy-client-create`, `happy-streaming`, `happy-migration`, `happy-tool-call`,
`happy-compliance-review`) and five negative (`negative-angular-ui`, `negative-vue-widget`,
`negative-static-extract`, `negative-cloud-deploy`, `negative-general-python`), satisfying the 5+/5+
baseline in [Skill asset contract](contract.md).

The negatives are constructed as forbidden-word assertions: the Angular case asks for Angular work
(src: skills/gemini_interactions/cases.json `Build an Angular component library with route animations.`)
while forbidding the word itself (src: skills/gemini_interactions/cases.json `"FORBID:Angular"`).

(inferred) That construction is the recorded reason one of the quarantine findings exists: it cannot
distinguish "the skill correctly stayed out of the way" from "the agent refused to do the user's
actual job", because both produce output without the word. A negative case should assert the *absence
of skill artefacts*, not the absence of the user's own domain vocabulary.

## Why it is quarantined

`scripts/real_driver_ablation.py` is the only script here that runs a real agent, and its one recorded
execution failed (src: data/verification_runs/gemini_interactions_real_driver_2026-07-27.json `"decision": "A2_FAIL_DO_NOT_PROMOTE",`).
The run used `gpt-5.6-sol` resolved from session metadata, 10 cases × 3 runs × 2 arms = 60 case runs
(src: data/verification_runs/gemini_interactions_real_driver_2026-07-27.json `"total_case_runs": 60,`).

| Measure | Value |
|---|---|
| preregistered threshold | 0.20 (src: data/verification_runs/gemini_interactions_real_driver_2026-07-27.json `"preregistered_delta_threshold": 0.2,`) |
| raw delta | 0.1333 |
| normalized delta | 0.10 (src: data/verification_runs/gemini_interactions_real_driver_2026-07-27.json `"normalized_delta": 0.1,`) |
| agent failures | 4 timeouts (src: data/verification_runs/gemini_interactions_real_driver_2026-07-27.json `"agent_failures": 4,`) |
| runtime metadata | incomplete (src: data/verification_runs/gemini_interactions_real_driver_2026-07-27.json `"metadata_complete": false,`) |

Normalization is stated rather than assumed
(src: data/verification_runs/gemini_interactions_real_driver_2026-07-27.json `"normalization": "A case pass requires regex checks to pass and agent exit_code to equal zero; four timed-out partial outputs are failures.",`),
and the fourth failure reason is an independence defect, not a scoring one
(src: skills/gemini_interactions/status.json `The completed run shared a repository cwd across samples; agent-created files were visible to later cases, so independence was contaminated.`).

The status file also forbids a fourth attempt on the same plan
(src: skills/gemini_interactions/status.json `do not rerun this plan a fourth time.`).

(inferred) The most valuable thing in this record is that the driver was fixed *after* the run rather
than the numbers being re-cut: the shared-cwd defect became the `ephemeral-temp` guarantee now asserted
by `tests/test_real_driver_ablation.py`. A failing measurement that changes the instrument is worth more
than a passing one that does not — see [Ablation and benchmark](../validation/ablation-and-benchmark.md).

## Quarantine is a record, not a control

Nothing enforces it. `status.json` is read by no script (see the last section of
[Skill asset contract](contract.md)), and the asset remains the **default input** of three gates that
run inside `git_gate.py`:

- `scripts/local_regex_runner.py` defaults to its cases
  (src: scripts/local_regex_runner.py `parser.add_argument("--cases", default=ROOT / "skills/gemini_interactions/cases.json", type=Path)`)
  and reports `case_count=10 total_trials=50 zero_llm_api_calls=0`;
- `scripts/ablation_engine.py` defaults to the same file
  (src: scripts/ablation_engine.py `parser.add_argument("--cases", default=ROOT / "skills" / "gemini_interactions" / "cases.json", type=Path)`)
  and reports `delta=0.50`;
- `scripts/no_ops_purger.py` defaults to its `skills.md`
  (src: scripts/no_ops_purger.py `parser.add_argument("--skill", default=ROOT / "skills/gemini_interactions/skills.md", type=Path)`).

Its content also drives `scripts/synthetic_case_generator.py`, whose 117 fixtures encode the same rule
set — see [Synthetic corpus](../validation/synthetic-corpus.md).

(inferred) So a green `git_gate.py` includes three green results *for a quarantined asset*. That is not
a contradiction as long as the reader knows what those runners measure: they simulate an agent, so
they can only prove the case corpus and rule table are self-consistent. The quarantine is about what a
real agent does, which only the real-driver path can observe.

## Narrow validation

```sh
python3 scripts/local_regex_runner.py
python3 scripts/ablation_engine.py
python3 scripts/interactions_patch_assert_runner.py
```

## Related

- [Skill asset contract](contract.md) · [Ablation and benchmark](../validation/ablation-and-benchmark.md)
- [Test map](../testing/test-map.md) — the seven invariants the real-driver test suite pins.
- [Production bottlenecks](../nonofficial/production-bottlenecks.md) — why this is the repository's only real-agent evidence.
