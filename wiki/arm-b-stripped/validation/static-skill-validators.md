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
by path.

| Script | Rejects |
|---|---|
| `validator.py` | a `cases.json` violating the [baseline](../skill-assets/contract.md) — count, fields, weak checks, polarity, near-duplicates above a 0.85 similarity ratio |
| `validate_skills_baseline.py` | the same, but git-scoped — it reuses this same `validator.py` check function; see the fallback rule below |
| `skill_description_linter.py` | a description that is not a dense route boundary: over 200 words, missing a required marker, or carrying fluff |
| `validate_progressive_disclosure.py` | reference-grade detail left inside the router instead of `references/` — the router must route there, the directory must exist, and deployment noise must not leak up |
| `validate_goal_constraints.py` | brittle step lists where goal/constraint phrasing is required, reported as, bilingual: `Step 1` and `第一步` alike |
| `validate_commit_message.py` | a commit message missing any of the 11 traceability fields in `REQUIRED_FIELDS`, from through — see [Molecular commit lineage](../governance/molecular-commit-lineage.md) |
| `github_skill_harvester.py` | nothing; it reports metrics (`skill_count`, `suspected_ai`) with no network access |

## `validate_skills_baseline.py` scoping, and its no-Git fallback

`modified_case_files()` runs `git status --porcelain` in the repository root
 and keeps lines matching
`^[AM\s]{1,2}\s+(skills/.*/cases\.json)$` — added or modified case files only.

Three outcomes, and the third is the one to know:

1. **Git available, case files modified** → validate exactly those.
2. **Git available, nothing modified** → `main()` falls back to `all_case_files()`
.
3. **No Git work tree** → `git status` fails with `not a git repository`; `modified_case_files()`
   returns an empty list rather than raising,
   and the same fallback validates **every**
   `skills/*/cases.json`.

Outcome 3 is the normal case for this directory, which has no `.git` of its own. It fails safe — a
detached copy validates more, not less — but it means the reported mode
(`mode=git-diff-or-all`) is printed from a single branch on `--all` alone
 and so does
not tell you which path was taken. Any other `git status` failure is
re-raised as a `RuntimeError`;
only the not-a-repository case is tolerated.

`--all` forces outcome 1's scope to the full set explicitly
.

## Two of them prove less than their name suggests

`scripts/git_gate.py` invokes every gate as `python3 <gate>` with **no arguments**
, a shape its own source comment
records.

- `validate_commit_message.py` normally takes a message file (that is how `.githooks/commit-msg` calls
  it).
  Argument-less, it runs its selftest.
- `validate_goal_constraints.py` behaves the same way,
  and its selftest is a good/bad fixture pair.

So a green `git_gate.py` proves those two
scripts still work — not that a real commit message or skill
file passed them. The commit hook is where the real check happens, and the hook is opt-in per clone
(`git config core.hooksPath .githooks`). This is recorded in
[Production bottlenecks](../nonofficial/production-bottlenecks.md).

## no_op_pruner and no_ops_purger

`NO_OPS_PATTERNS` is a bilingual list of prompt filler — `clean code`, `easy to read`, `high quality`,
`robust architecture`, `best practice`, `beautiful code`, `please`, `highly recommended`
, and the
Chinese equivalents `優雅`, `乾淨`, `高質量`, `最佳實踐`, `請確保`, `易讀`, `健壯`
. They are matched as case-insensitive regexes, not
literals.

`no_op_pruner.py` reports matches without changing anything,
against a shorter literal list of its own.
`no_ops_purger.py` can remove them, and its
mechanism is the interesting part: for each candidate line it builds the text *without* that line and
re-scores it with `run_p2_evaluation()`. The line is dropped **only if the score does not
drop**. A
phrase that looks like filler but actually carries behavior stays.

(inferred) That is the difference between pruning and deletion: the purger is not allowed to trade
behavior for token count — no source line states that intent, it is read off the score guard above.
Its current report is `purged_count=0 tokens_saved=0` — the observed stdout of an argument-less run,
whose format string is —
which is the correct outcome for prompts that have already been cleaned.

## Validation

```sh
python3 scripts/validator.py
python3 scripts/validate_skills_baseline.py --all
python3 scripts/no_op_pruner.py           # dry run, reports only
python3 scripts/validate_commit_message.py <message-file>   # the real check, not the selftest
```
