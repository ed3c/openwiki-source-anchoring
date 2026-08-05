---
type: Component
title: Skill-asset validators and no-op scanners
description: The seven deterministic checks that decide whether a skills/*/skills.md prompt asset and its cases.json behaviour corpus are shaped well enough to be evaluated at all.
tags: [validation, skill-assets, gate]
node_kind: RepoDoc
ingest_lane: concept
repo: arm-d/agent-skills-repo
covers: [skill-asset-validation, behavior-cases, progressive-disclosure, no-op-pruning]
libraries: [python]
generated_by: claude-code+claude-opus-5
generated_at: null
---

# Skill-asset validators and no-op scanners

Seven scripts guard the shape of the two assets under `skills/`. All are members
of [`GATES`](git-gate.md) and all run with no arguments by default.

## Behaviour-case baseline

`scripts/validator.py` is the canonical case validator
(src: scripts/validator.py `Validate skill cases.json files with the GCR minimum baseline.`).
It globs `skills/*/cases.json` (src: scripts/validator.py `(ROOT / "skills").glob("*/cases.json")`)
and enforces, per file:

- every case carries `id`, `prompt`, `should_trigger` and `expected_checks`
  (src: scripts/validator.py `for field in ("id", "prompt", "should_trigger", "expected_checks")`);
- corpus size between 10 and 20 (src: scripts/validator.py `expected 10-20 cases, got`);
- at least five positive and five negative cases
  (src: scripts/validator.py `expected 5+ positive and 5+ negative cases`);
- no check pattern that matches everything — the weak set is
  (src: scripts/validator.py `WEAK_PATTERNS = {"", ".*", ".+", "^.*$", "^.+$"}`);
- no two prompts more than 85 % similar under `SequenceMatcher`
  (src: scripts/validator.py `.ratio() > 0.85`).

(inferred) The last two rules are the interesting ones. A weak `expected_checks`
pattern would make every ablation delta look perfect, and near-duplicate prompts
would inflate a corpus without adding discriminating power; both are the classic
ways a behaviour suite becomes decorative. The validator refuses them at the
cheapest possible point, before any evaluation runs.

`scripts/validate_skills_baseline.py` is a thin git-aware wrapper around the same
function (src: scripts/validate_skills_baseline.py `import validator`). It asks
`git status --porcelain` for modified case files
(src: scripts/validate_skills_baseline.py `["git", "status", "--porcelain"]`), and because
this checkout has no repository of its own it hits the tolerated branch
(src: scripts/validate_skills_baseline.py `if "not a git repository" in result.stderr:`),
falls back to every case file, and reports the mode it used
(src: scripts/validate_skills_baseline.py `mode={'all' if args.all else 'git-diff-or-all'}`).

## Prompt-asset shape

`scripts/skill_description_linter.py` enforces four route markers and a length
cap: the markers are (src: scripts/skill_description_linter.py `REQUIRED = ("WHY:", "HOW:", "WHEN:", "WHEN NOT:")`),
the fluff list is (src: scripts/skill_description_linter.py `FORBIDDEN = ("please", "recommended", "should", "easy to use", "best practice")`),
and any asset over 200 words fails
(src: scripts/skill_description_linter.py `if len(words) > 200 or missing or fluff:`).

`scripts/validate_progressive_disclosure.py` checks the layering: the same four
root signals (src: scripts/validate_progressive_disclosure.py `REQUIRED_ROOT_SIGNALS = ("WHY:", "HOW:", "WHEN:", "WHEN NOT:")`),
a route to a deeper layer (src: scripts/validate_progressive_disclosure.py `REQUIRED_ROUTES = (r"references/",)`),
an existing `references` directory
(src: scripts/validate_progressive_disclosure.py `failures.append("missing references directory")`), and no leaked
deployment or credential detail — the noise regex covers access keys, credential
paths and bare IPv4 (src: scripts/validate_progressive_disclosure.py `NOISE = re.compile(r"\b(?:AWS_ACCESS_KEY|GOOGLE_APPLICATION_CREDENTIALS|[0-9]{1,3}(?:\.[0-9]{1,3}){3})\b")`),
reported as (src: scripts/validate_progressive_disclosure.py `deployment detail leaked into root skill`).

`scripts/validate_goal_constraints.py` rejects brittle step-by-step prompts. It
requires goal and constraint blocks
(src: scripts/validate_goal_constraints.py `REQUIRED_BLOCKS = ("GOAL:", "CONSTRAINTS:")`), bans ordinal
sequencing in English and Chinese
(src: scripts/validate_goal_constraints.py `r"step\s*\d+"`) — the list includes
(src: scripts/validate_goal_constraints.py `r"\b首先\b"`) — and requires two named constraint
families in the constraints section
(src: scripts/validate_goal_constraints.py `MANDATORY_CONSTRAINTS = (`). Given no path arguments it
runs its own good/bad fixtures instead
(src: scripts/validate_goal_constraints.py `raise AssertionError("bad fixture unexpectedly passed")`), which is why it is
still meaningful inside the argument-less gate loop.

## No-op scanning and pruning

`scripts/no_op_pruner.py` is the detector: a fixed phrase list
(src: scripts/no_op_pruner.py `NO_OPS = ("clean code", "easy to read", "best practice", "highly recommended", "please")`)
scanned case-insensitively over every `skills/*/skills.md`, failing with the
offending file and phrase (src: scripts/no_op_pruner.py `FAIL: no-op prompt phrases found`).

`scripts/no_ops_purger.py` is the behaviour-preserving remover. It expands the
list with regexes including Chinese equivalents
(src: scripts/no_ops_purger.py `r"最佳實踐"`), then removes a candidate line only if a
scoring function does not regress
(src: scripts/no_ops_purger.py `if current_rate >= baseline:`). The score itself is a stand-in
that merely checks for one token
(src: scripts/no_ops_purger.py `if "Interactions" not in skill_content:`). (inferred) That makes
the purger an *architecture* for safe pruning rather than a working optimiser —
the guard loop is real, the objective it guards is a placeholder, and anyone
wiring in a real evaluator only has to replace `run_p2_evaluation`. The script
reports what it would remove without writing
(src: scripts/no_ops_purger.py `PASS: no-ops purge checked purged_count=`).

`scripts/github_skill_harvester.py` measures assets rather than gating them. It
computes Shannon entropy per file
(src: scripts/github_skill_harvester.py `entropy -= p * math.log2(p)`), a no-op density, and a
heuristic verdict (src: scripts/github_skill_harvester.py `"is_suspected_ai_generated": word_count > 500 or (entropy < 4.5 and no_ops_density > 0.05)`),
scanning in a thread pool (src: scripts/github_skill_harvester.py `with ThreadPoolExecutor(max_workers=max_workers) as executor:`).
Despite its name it makes no network call — it only globs the local tree
(src: scripts/github_skill_harvester.py `workspace.glob("skills/*/skills.md")`).

## Focused tests and validation

`tests/test_skill_asset_governance.py::test_static_defense_scripts_pass` invokes
each of these scripts with no arguments and requires exit zero. Nothing asserts
their *failure* behaviour except the two self-testing validators.

```sh
python3 scripts/validator.py --json
python3 scripts/validate_progressive_disclosure.py --json
python3 scripts/validate_goal_constraints.py        # runs its own good/bad fixtures
```

Assets under review: [gemini-interactions](../skills/gemini-interactions.md) and
[autoresearch-composer](../skills/autoresearch-composer.md).
