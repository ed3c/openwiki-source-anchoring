---
type: Reference
title: Static validators
description: The eight scripts that read skill files without executing anything — what each rejects, the environment variable that relocates its root, and which ones run selftest-only inside git_gate.
tags: [validation, linting, gates]
node_kind: RepoDoc
ingest_lane: concept
repo: local/agent-skills-repo
commit: 5d3c42f
covers: [static-validators, selftest-gates, root-override]
libraries: []
generated_by: claude-code+opus (skill-bettor openwiki port)
generated_at: null
---

# Static validators

Eight scripts read `skills/` and reject shapes. None executes an agent, and none writes. They are the
first eight entries of the gate chain (see [Defense gate chain](../architecture/defense-gate-chain.md)).

| Script | Reads | Rejects |
|---|---|---|
| `validator.py` | `skills/*/cases.json` | case-count, polarity balance, weak checks, near-duplicates |
| `validate_skills_baseline.py` | git-modified case files, else all | the same rules, scoped by `git status` |
| `skill_description_linter.py` | `skills/*/skills.md` | >200 words, missing route signals, fluff phrases |
| `validate_progressive_disclosure.py` | `skills/*/skills.md` + `references/` | missing signals, missing Layer 3, leaked deployment detail |
| `validate_goal_constraints.py` | files passed as argv | step-sequenced prose, missing GOAL/CONSTRAINTS |
| `no_op_pruner.py` | `skills/*/skills.md` | five no-op phrases, read-only |
| `no_ops_purger.py` | one `skills.md` | nothing; reports what a prune *would* remove |
| `github_skill_harvester.py` | `skills/*/skills.md` | nothing; emits per-file metrics |

## The four that actually reject

`validator.py` is the case-file baseline; its rules are enumerated in
[Skill asset contract](../skill-assets/contract.md). `validate_skills_baseline.py` reuses it by import
rather than reimplementing the rules
(src: scripts/validate_skills_baseline.py `import validator`), and narrows the file set to what git
reports as added or modified (src: scripts/validate_skills_baseline.py `CASE_PATH = re.compile(r"^[AM\s]{1,2}\s+(skills/.*/cases\.json)$")`).
When git is unavailable or nothing matched it falls back to the full set
(src: scripts/validate_skills_baseline.py `paths = all_case_files() if args.all else modified_case_files()`), and
a missing repository is tolerated rather than fatal
(src: scripts/validate_skills_baseline.py `if "not a git repository" in result.stderr:`).

(inferred) That fallback is why the "git-aware" scoping never weakens the gate: the degenerate path is
*more* work, not less. A diff-scoped linter that silently checks nothing when it cannot read the diff
is the usual version of this idea, and it is the one that fails open.

`skill_description_linter.py` and `validate_progressive_disclosure.py` overlap deliberately on the
four route signals but diverge on everything else — the linter owns length and fluff, the disclosure
validator owns the `references/` boundary and the credential-leak pattern. Both are detailed in
[Skill asset contract](../skill-assets/contract.md).

## The one that only ever runs its own selftest

`validate_goal_constraints.py` rejects step-sequenced instructions — it treats `step 1`, `firstly`,
`then`, `finally` and their Chinese equivalents as evidence that a brittle workflow was written where
a goal plus constraints belonged
(src: scripts/validate_goal_constraints.py `failures.append(f"sequential workflow traces: {sorted(set(found_sequences))}")`),
and requires two blocks (src: scripts/validate_goal_constraints.py `REQUIRED_BLOCKS = ("GOAL:", "CONSTRAINTS:")`)
plus two mandatory constraint categories
(src: scripts/validate_goal_constraints.py `(r"ssl|tls|protocol|secure", "SECURITY_PROTOCOL"),`).

It only checks files named on the command line
(src: scripts/validate_goal_constraints.py `parser.add_argument("paths", nargs="*", type=Path)`), and with
no arguments it runs its own good/bad fixture pair instead
(src: scripts/validate_goal_constraints.py `if not args.paths:`). `git_gate.py` invokes every gate with
no arguments, so **inside the gate chain this script validates two temporary fixtures and no repository
file at all**. The same is true of `validate_commit_message.py`
(src: scripts/validate_commit_message.py `if not argv or argv == ["--selftest"]:`).

(inferred) A selftest inside the gate chain is not worthless — it proves the checker still discriminates,
which is exactly the property a checker silently loses when someone loosens a regex. It is only
dangerous when its green line is read as "the repository's content was checked". Both scripts are
listed for that reason in [Production bottlenecks](../nonofficial/production-bottlenecks.md).

The fixtures are real: the bad one must fail and the good one must pass, or the selftest itself fails
(src: scripts/validate_goal_constraints.py `raise AssertionError("bad fixture unexpectedly passed")`).

## The three that report rather than reject

`no_op_pruner.py` scans for five padding phrases and fails if any is present
(src: scripts/no_op_pruner.py `NO_OPS = ("clean code", "easy to read", "best practice", "highly recommended", "please")`).
`no_ops_purger.py` goes further conceptually — it removes a candidate line only when a stand-in
evaluation does not regress (src: scripts/no_ops_purger.py `if current_rate >= baseline:`) — but that
evaluation is a two-branch stub keyed on one substring
(src: scripts/no_ops_purger.py `if "Interactions" not in skill_content:`), and `main()` discards the
purged text entirely, printing only counts
(src: scripts/no_ops_purger.py `_, purged_count, tokens_saved = purge_text(text)`). It never writes.

`github_skill_harvester.py` computes word count, no-op density and Shannon entropy per skill file
(src: scripts/github_skill_harvester.py `def calculate_entropy(text: str) -> float:`) and flags a
heuristic (src: scripts/github_skill_harvester.py `"is_suspected_ai_generated": word_count > 500 or (entropy < 4.5 and no_ops_density > 0.05),`).
Despite its name it never touches the network
(src: scripts/github_skill_harvester.py `"""Harvest local skill asset metrics without network access."""`).

(inferred) `no_ops_purger.py` is the clearest case in the repository of a mechanism that is right in
shape and hollow in substance: "delete a line only if the measured quality does not drop" is exactly
the correct rule, and the measurement behind it is a constant. It is safe today only because the
script cannot write.

## Relocatable roots

Four of these accept an environment variable instead of assuming the script's parent
(src: scripts/validator.py `ROOT = Path(os.environ.get("VALIDATOR_ROOT", Path(__file__).resolve().parents[1]))`)
— `VALIDATOR_ROOT`, `PROGRESSIVE_DISCLOSURE_ROOT`, `SKILL_DESCRIPTION_LINTER_ROOT`, and
`--repo-root`/`--workspace` flags on the two reporters. `validate_skills_baseline.py` and
`validate_goal_constraints.py` do not, so they always resolve against their own location.

## Narrow validation

```sh
python3 scripts/validator.py
python3 scripts/validate_skills_baseline.py --all
python3 scripts/validate_progressive_disclosure.py --json
python3 scripts/validate_goal_constraints.py skills/gemini_interactions/skills.md
```

The last command exercises the real path rather than the selftest — and will fail on the current
assets, which are written as WHY/HOW/WHEN cards rather than GOAL/CONSTRAINTS blocks.

## Related

- [Skill asset contract](../skill-assets/contract.md) · [Defense gate chain](../architecture/defense-gate-chain.md)
- [Behavioral eval and judge](behavioral-eval-and-judge.md) — the gates that execute cases.
- [Code call lifecycle](../nonofficial/code-call-lifecycle.md) — the values each of these currently reports.
