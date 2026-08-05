---
type: Contract
title: Skill asset contract
description: The mandatory shape of a skills/<slug>/ asset, every baseline scripts/validator.py enforces on cases.json, the four route signals the linters require, and which promotion records actually control anything.
tags: [skill-assets, contract, validation]
node_kind: RepoDoc
ingest_lane: concept
repo: local/agent-skills-repo
commit: 5d3c42f
covers: [skill-asset-contract, behavior-cases, progressive-disclosure]
libraries: []
generated_by: claude-code+opus (skill-bettor openwiki port)
generated_at: null
---

# Skill asset contract

A skill asset is a directory under `skills/`. Two exist: `gemini_interactions` and
`autoresearch_composer`. Everything the generic validators know about an asset comes from three glob
patterns, so those three things are the contract.

## Mandatory shape

| Path | Required by | Checked how |
|---|---|---|
| `skills/<slug>/skills.md` | `validate_progressive_disclosure.py`, `skill_description_linter.py`, `no_op_pruner.py`, `github_skill_harvester.py` | globbed as `skills/*/skills.md` (src: scripts/skill_description_linter.py `for path in sorted((ROOT / "skills").glob("*/skills.md")):`) |
| `skills/<slug>/cases.json` | `validator.py`, `validate_skills_baseline.py` | globbed as `skills/*/cases.json` (src: scripts/validator.py `paths = sorted((ROOT / "skills").glob("*/cases.json"))`) |
| `skills/<slug>/references/` | `validate_progressive_disclosure.py` | directory existence (src: scripts/validate_progressive_disclosure.py `failures.append("missing references directory")`) |

An empty glob is a failure, not a pass
(src: scripts/validator.py `print("FAIL: no skills/*/cases.json files found", file=sys.stderr)`), so a
new asset cannot be half-added.

## `skills.md`: four route signals, no filler

The root skill file is a routing card, not a manual. Two independent gates require the same four
markers (src: scripts/validate_progressive_disclosure.py `REQUIRED_ROOT_SIGNALS = ("WHY:", "HOW:", "WHEN:", "WHEN NOT:")`),
and the linter additionally caps length at 200 words and bans five fluff phrases
(src: scripts/skill_description_linter.py `FORBIDDEN = ("please", "recommended", "should", "easy to use", "best practice")`),
failing on `len(words) > 200 or missing or fluff`
(src: scripts/skill_description_linter.py `if len(words) > 200 or missing or fluff:`).

Deployment or credential detail may not appear in the root file
(src: scripts/validate_progressive_disclosure.py `failures.append("deployment detail leaked into root skill")`),
which is enforced by a pattern matching AWS/GCP credential names and bare IPv4 addresses
(src: scripts/validate_progressive_disclosure.py `NOISE = re.compile(r"\b(?:AWS_ACCESS_KEY|GOOGLE_APPLICATION_CREDENTIALS|[0-9]{1,3}(?:\.[0-9]{1,3}){3})\b")`).
The root must instead point at Layer 3
(src: scripts/validate_progressive_disclosure.py `REQUIRED_ROUTES = (r"references/",)`).

(inferred) The word cap and the fluff list are doing the same job from two directions: a skill card is
loaded into every routing decision, so its cost is paid on every task while its value is paid only
when it matches. Phrases like "best practice" consume that budget without changing any routing
outcome — which is why they are banned outright rather than merely discouraged.

Both current assets satisfy this by being tiny — `skills/gemini_interactions/skills.md` is nine lines
(src: skills/gemini_interactions/skills.md `WHY: Generate or audit Gemini Interactions API code when the task asks for that API.`).

## `cases.json`: the behaviour baseline

`scripts/validator.py` is the single definition of a valid case file, reused by
`validate_skills_baseline.py` and `check_autoresearch_lifecycle.py` by direct import
(src: scripts/validate_skills_baseline.py `import validator`).

Per file:

- root must be a JSON array (src: scripts/validator.py `fail(f"{path}: root must be a JSON array")`);
- **10 to 20** cases (src: scripts/validator.py `if not 10 <= len(cases) <= 20:`);
- at least five positive and five negative
  (src: scripts/validator.py `fail(f"{path}: expected 5+ positive and 5+ negative cases")`);
- no two prompts more than 85% similar
  (src: scripts/validator.py `if SequenceMatcher(None, prompts[left], prompts[right]).ratio() > 0.85:`).

Per case, four fields are required — `id`, `prompt`, `should_trigger`, `expected_checks`
(src: scripts/validator.py `for field in ("id", "prompt", "should_trigger", "expected_checks"):`) — and
a check that matches everything is rejected
(src: scripts/validator.py `WEAK_PATTERNS = {"", ".*", ".+", "^.*$", "^.+$"}`).

`expected_checks` entries are regular expressions; a `FORBID:` prefix inverts the assertion when the
runners evaluate them (src: scripts/local_regex_runner.py `if pattern.startswith("FORBID:"):`). See
[Behavioral eval and judge](../validation/behavioral-eval-and-judge.md).

(inferred) The near-duplicate ratio is the load-bearing rule of the whole file. Ten cases that are the
same sentence with a different noun measure prompt templating, not behaviour — precisely the defect
that `synthetic_case_quality_report.py` later measures at repository scale and calls
`quality_status=insufficient`. See [Synthetic corpus](../validation/synthetic-corpus.md).

## `references/`: Layer 3

Everything the router does not need on every task goes here and is loaded only after the route
matched (src: skills/gemini_interactions/references/deploy_guide.md `This reference is Layer 3. Load it only after the root skill route has matched`).
Nothing validates the *content* of a reference file; only its directory's existence and the root's
pointer to it are checked.

## Promotion state is not `status.json`

`skills/gemini_interactions/status.json` exists; `skills/autoresearch_composer/` has no equivalent.
That asymmetry is real and load-bearing:

- **`status.json` is inert.** No gate creates it, and no gate reads it. It records a decision
  (src: skills/gemini_interactions/status.json `"production_routable": false,`) that nothing enforces.
  Adding one to a new skill controls nothing.
- **The enforced record is in `data/lifecycle/`.** `autoresearch_composer`'s status lives in the
  registry (src: data/lifecycle/skill_optimization_registry.json `"current_status": "production-seed-candidate",`)
  and its promotion decision in the promotion record, both asserted by a gate
  (src: scripts/check_lifecycle_datasets.py `failures.append("promotion record must remain candidate_until_human_admit")`).

So when adding a skill: `skills.md`, `cases.json` and `references/` make it *valid*; a registry row,
dataset version, dated eval run, promotion record, privacy entry and drift row make it *governed*
(src: openwiki/nonofficial/structured-lifecycle-data.md `For every new optimized skill, add exactly one registry row, at least one Golden`).
A `status.json` makes it *annotated*, and nothing more.

## Narrow validation

```sh
python3 scripts/validator.py
python3 scripts/validate_progressive_disclosure.py
python3 scripts/skill_description_linter.py
```

Observed at `5d3c42f`: `PASS: validated 2 skill case file(s)`.

## Related

- [gemini_interactions](gemini-interactions.md) — the quarantined asset.
- [autoresearch_composer](autoresearch-composer.md) — the production-seed candidate.
- [Static validators](../validation/static-validators.md) — every gate named above, in one place.
- [Asset lifecycle map](../nonofficial/asset-lifecycle-map.md) — the five phases an asset passes through.
- [Stateful workflow](../nonofficial/stateful-workflow.md) — the S1–S7 authoring state graph.
