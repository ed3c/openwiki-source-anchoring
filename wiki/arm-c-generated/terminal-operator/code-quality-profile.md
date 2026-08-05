---
type: Contract
title: Code-quality profile
description: The eight-stage task-quality contract — four phases of typed lint, format, typecheck, dependency boundaries and bounded Bun suites — its SHA-256 profile seal, and why it records coverage as not-selected on purpose.
tags: [terminal-operator, code-quality, receipts]
node_kind: RepoDoc
ingest_lane: concept
repo: local/agent-skills-repo
commit: 5d3c42f
covers: [task-quality-contract, profile-seal, stage-receipts]
libraries: [eslint, prettier, typescript, dependency-cruiser]
generated_by: claude-code+opus (skill-bettor openwiki port)
generated_at: null
---

# Code-quality profile

The first gate of a terminal run. Its command is a single fixed argv
(src: .agents/skills/repo-terminal-operator/task-quality-contract.ts `".agents/skills/repo-terminal-operator/repo-code-quality.ts",`), which
executes the eight-stage contract and prints one `repo-terminal-code-quality-receipt@v1` document
(src: .agents/skills/repo-terminal-operator/task-quality-runner.ts `schema_version: "repo-terminal-code-quality-receipt@v1";`).

## The eight stages, in four phases

| Phase | Stage | cwd | Tool |
|---|---|---|---|
| 1 | `typed-eslint` | adapter | `eslint --config eslint.config.mjs --no-warn-ignored <lint sources>` |
| 1 | `format-check` | adapter | `prettier --check <format sources>` |
| 2 | `strict-typecheck` | adapter | `tsc --noEmit -p tsconfig.repo-terminal.json` |
| 2 | `dependency-boundaries` | adapter | `depcruise --config dependency-cruiser.cjs --output-type err <cli entrypoints>` |
| 3 | `focused-tests` | workspace | `bun test` over seven suites |
| 3 | `evidence-cache-tests` | workspace | `bun test tests/skills/repo-evidence-cost-cache.test.ts` |
| 3 | `ownership-tests` | workspace | `bun test tests/skills/repo-owned-stream-drain.test.ts` |
| 4 | `forgejo-handoff-tests` | workspace | `bun test` over three Forgejo suites |

Phase numbers are the concurrency plan the operator's own contract describes — four bounded static
stages in parallel, then the behaviour suites only if every static stage passed
(src: .agents/skills/repo-terminal-operator/SKILL.md `runs the bounded focused terminal behavior suites only when every static stage`).

The three source lists are explicit file enumerations, not globs — the typed set is the base, lint adds
the test files, and format adds the profile JSON, the SKILL markdown and 40 schema files
(src: .agents/skills/repo-terminal-operator/task-quality-contract.ts `const formatSources = [`).

(inferred) Enumerating every path instead of globbing means a new module is invisible to the toolchain
until someone adds it to these lists — a cost paid deliberately so the stage command is a *fixed* argv
that can be hashed and compared. A glob would make the profile hash depend on the filesystem, and the
seal below would stop meaning anything.

## The profile seal

The stage definitions are hashed
(src: .agents/skills/repo-terminal-operator/task-quality-contract.ts `.update(JSON.stringify(TASK_QUALITY_STAGE_DEFINITIONS))`) and the
receipt must carry that hash
(src: .agents/skills/repo-terminal-operator/task-quality-contract.ts `if (value.profile_sha256 !== taskQualityProfileSha256())`). Changing a
timeout, a flag or a file in any list changes the hash, so a receipt produced under a different profile
cannot be replayed as evidence for this one.

## What the receipt must contain

`taskQualityReceiptErrors` rejects a receipt unless, per stage, the id, phase, cwd and full argv match
the definition and the outcome is clean
(src: .agents/skills/repo-terminal-operator/task-quality-contract.ts `if (JSON.stringify(value.command) !== JSON.stringify(expected.command))`),
with four process-hygiene booleans required true
(src: .agents/skills/repo-terminal-operator/task-quality-contract.ts `"stderr_consumed",`) and no cleanup errors.

**A test stage must report a test count.** For any stage whose command is `bun test`, a receipt without
a positive `test_cases` fails (src: .agents/skills/repo-terminal-operator/task-quality-contract.ts `(typeof value.test_cases !== "number" || value.test_cases < 1)`),
which the operator's contract states as a rule
(src: .agents/skills/repo-terminal-operator/SKILL.md `exit code zero without an observed`).

(inferred) That is the sharpest rule in the file. A test runner given a path that matches nothing exits
zero, and every other assertion here would still hold — so "zero exit" and "tests ran" are different
claims, and only the observed count separates them.

The wrapper is checked too: the outer gate result must itself be clean and name the same command
(src: .agents/skills/repo-terminal-operator/small-loop-gate-contract.ts `failures.push("inner command");`), and the receipt
must be the last JSON line of stdout
(src: .agents/skills/repo-terminal-operator/small-loop-gate-contract.ts `const line = result.stdout.trim().split(/\r?\n/u).filter(Boolean).at(-1);`).

## Coverage is deliberately not claimed

The receipt must say coverage was not selected and must name where coverage is instead adjudicated
(src: .agents/skills/repo-terminal-operator/task-quality-contract.ts `coverage.next_mode !== "production-use/writer-entrypoint"`), and the
operator's contract explains the choice
(src: .agents/skills/repo-terminal-operator/SKILL.md `and routes coverage/race/leak admission to`).

(inferred) Most of what this operator does happens in subprocesses, so a line-coverage number over the
parent would be dominated by code that never executes in-process — a high figure that means nothing and a
low one that means nothing either. Refusing to emit the number, and pointing at the profile that does
adjudicate race, leak and silent-failure behaviour, is the honest version of the same signal.

## Related

- [Production profiles and evidence](production-profiles-and-evidence.md) — the gate this one unlocks.
- [Packet and preflight](packet-and-preflight.md) · [Shared primitives](shared-primitives.md)
- [Test map](../testing/test-map.md) — none of these Bun suites exist in this checkout.
