---
type: Reference
title: Static Skill Validators
description: The five non-behavioral validators, the behavior-preserving no-op purger, and which of them prove only their selftest under git_gate.
tags: [validation, static-analysis]
node_kind: RepoDoc
ingest_lane: concept
repo: local/agent-skills-repo
covers: [static-validation, no-op-pruning, selftest-only-gates]
libraries: []
generated_by: claude-code+opus (skill-bettor openwiki port)
generated_at: null
---

# Static Skill Validators

Text-only checks. None of them runs an agent; all of them run in the default chain, which lists them
by path (src: scripts/git_gate.py `"scripts/skill_description_linter.py",`).

| Script | Rejects |
|---|---|
| `validator.py` | a `cases.json` violating the [baseline](../skill-assets/contract.md) — count (src: scripts/validator.py `expected 10-20 cases`), fields (src: scripts/validator.py `missing field:`), weak checks (src: scripts/validator.py `has weak expected check`), polarity (src: scripts/validator.py `expected 5+ positive and 5+ negative cases`), near-duplicates (src: scripts/validator.py `near-duplicate prompts`) above a 0.85 similarity ratio (src: scripts/validator.py `.ratio() > 0.85`) |
| `validate_skills_baseline.py` | the same, but git-scoped (src: scripts/validate_skills_baseline.py `Git-aware GCR baseline validator for modified skill case assets`) — it reuses this same `validator.py` check function (src: scripts/validate_skills_baseline.py `validator.validate_cases(path)`); see the fallback rule below |
| `skill_description_linter.py` | a description that is not a dense route boundary: over 200 words (src: scripts/skill_description_linter.py `len(words) > 200`), missing a required marker (src: scripts/skill_description_linter.py `REQUIRED = ("WHY:", "HOW:", "WHEN:", "WHEN NOT:")`), or carrying fluff (src: scripts/skill_description_linter.py `FORBIDDEN = ("please", "recommended", "should", "easy to use", "best practice")`) |
| `validate_progressive_disclosure.py` | reference-grade detail left inside the router instead of `references/` — the router must route there (src: scripts/validate_progressive_disclosure.py `REQUIRED_ROUTES = (r"references/",)`), the directory must exist (src: scripts/validate_progressive_disclosure.py `missing references directory`), and deployment noise must not leak up (src: scripts/validate_progressive_disclosure.py `deployment detail leaked into root skill`) |
| `validate_goal_constraints.py` | brittle step lists where goal/constraint phrasing is required (src: scripts/validate_goal_constraints.py `Validate that skill instructions use goal/constraints instead of brittle steps`), reported as (src: scripts/validate_goal_constraints.py `sequential workflow traces`), bilingual: `Step 1` (src: scripts/validate_goal_constraints.py `r"step\s*\d+",`) and `第一步` alike (src: scripts/validate_goal_constraints.py `r"第一步",`) |
| `validate_commit_message.py` | a commit message missing any of the 11 traceability fields in `REQUIRED_FIELDS`, from (src: scripts/validate_commit_message.py `"Intent-Slice:",`) through (src: scripts/validate_commit_message.py `"Dataflow:",`) — see [Molecular commit lineage](../governance/molecular-commit-lineage.md) |
| `github_skill_harvester.py` | nothing; it reports metrics (`skill_count`, `suspected_ai`) (src: scripts/github_skill_harvester.py `PASS: harvested skill_count=`) with no network access (src: scripts/github_skill_harvester.py `Harvest local skill asset metrics without network access`) |

## `validate_skills_baseline.py` scoping, and its no-Git fallback (src: scripts/validate_skills_baseline.py `not a git repository`)

`modified_case_files()` runs `git status --porcelain` in the repository root
(src: scripts/validate_skills_baseline.py `["git", "status", "--porcelain"],`) and keeps lines matching
`^[AM\s]{1,2}\s+(skills/.*/cases\.json)$` (src: scripts/validate_skills_baseline.py `CASE_PATH = re.compile(r"^[AM\s]{1,2}\s+(skills/.*/cases\.json)$")`) — added or modified case files only.

Three outcomes, and the third is the one to know:

1. **Git available, case files modified** → validate exactly those.
2. **Git available, nothing modified** → `main()` falls back to `all_case_files()`
   (src: scripts/validate_skills_baseline.py `if not paths:`).
3. **No Git work tree** → `git status` fails with `not a git repository`; `modified_case_files()`
   returns an empty list rather than raising (src: scripts/validate_skills_baseline.py `if "not a git repository" in result.stderr:`),
   and the same fallback validates **every**
   `skills/*/cases.json` (src: scripts/validate_skills_baseline.py `sorted((ROOT / "skills").glob("*/cases.json"))`).

Outcome 3 is the normal case for this directory, which has no `.git` of its own. It fails safe — a
detached copy validates more, not less — but it means the reported mode
(`mode=git-diff-or-all`) is printed from a single branch on `--all` alone
(src: scripts/validate_skills_baseline.py `mode={'all' if args.all else 'git-diff-or-all'}`) and so does
not tell you which path was taken. Any other `git status` failure is
re-raised as a `RuntimeError` (src: scripts/validate_skills_baseline.py `raise RuntimeError(result.stderr.strip() or "git status failed")`);
only the not-a-repository case is tolerated.

`--all` forces outcome 1's scope to the full set explicitly
(src: scripts/validate_skills_baseline.py `all_case_files() if args.all else modified_case_files()`).

## Two of them prove less than their name suggests

`scripts/git_gate.py` invokes every gate as `python3 <gate>` with **no arguments**
(src: scripts/git_gate.py `[sys.executable, str(root / gate)],`), a shape its own source comment
records (src: scripts/git_gate.py `GATES invokes every gate with no arguments`).

- `validate_commit_message.py` normally takes a message file (that is how `.githooks/commit-msg` calls
  it (src: .githooks/commit-msg `python3 "$ROOT/scripts/validate_commit_message.py" "$1"`)).
  Argument-less, it runs its selftest (src: scripts/validate_commit_message.py `if not argv or argv == ["--selftest"]:`).
- `validate_goal_constraints.py` behaves the same way (src: scripts/validate_goal_constraints.py `if not args.paths:`),
  and its selftest is a good/bad fixture pair (src: scripts/validate_goal_constraints.py `raise AssertionError("bad fixture unexpectedly passed")`).

So a green `git_gate.py` (src: scripts/git_gate.py `PASS: git gate defenses passed`) proves those two
scripts still work — not that a real commit message or skill
file passed them. The commit hook is where the real check happens, and the hook is opt-in per clone
(`git config core.hooksPath .githooks`) (src: README.md `git config core.hooksPath .githooks`). This is recorded in
[Production bottlenecks](../nonofficial/production-bottlenecks.md).

## no_op_pruner and no_ops_purger

`NO_OPS_PATTERNS` is a bilingual list of prompt filler — `clean code`, `easy to read`, `high quality`,
`robust architecture`, `best practice`, `beautiful code`, `please`, `highly recommended`
(src: scripts/no_ops_purger.py `r"robust\s+architecture",`), and the
Chinese equivalents `優雅`, `乾淨`, `高質量`, `最佳實踐`, `請確保`, `易讀`, `健壯`
(src: scripts/no_ops_purger.py `r"最佳實踐",`). They are matched as case-insensitive regexes, not
literals (src: scripts/no_ops_purger.py `re.search(pattern, line, re.IGNORECASE)`).

`no_op_pruner.py` reports matches without changing anything (src: scripts/no_op_pruner.py `Dry-run no-op phrase detector for skill prompts`),
against a shorter literal list of its own (src: scripts/no_op_pruner.py `NO_OPS = ("clean code", "easy to read", "best practice", "highly recommended", "please")`).
`no_ops_purger.py` can remove them, and its
mechanism is the interesting part: for each candidate line it builds the text *without* that line and
re-scores it with `run_p2_evaluation()` (src: scripts/no_ops_purger.py `current_rate = run_p2_evaluation(candidate_text)`). The line is dropped **only if the score does not
drop** (src: scripts/no_ops_purger.py `if current_rate >= baseline:`). A
phrase that looks like filler but actually carries behavior stays.

(inferred) That is the difference between pruning and deletion: the purger is not allowed to trade
behavior for token count — no source line states that intent, it is read off the score guard above.
Its current report is `purged_count=0 tokens_saved=0` — the observed stdout of an argument-less run,
whose format string is (src: scripts/no_ops_purger.py `PASS: no-ops purge checked purged_count=`) —
which is the correct outcome for prompts that have already been cleaned.

## Validation

```sh
python3 scripts/validator.py
python3 scripts/validate_skills_baseline.py --all
python3 scripts/no_op_pruner.py           # dry run, reports only
python3 scripts/validate_commit_message.py <message-file>   # the real check, not the selftest
```
