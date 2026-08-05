# Reproduction Guide

This repository has two different reproduction targets. Do not treat them as equivalent.

1. **Harness reproduction:** verify that the public auditor, fixtures, retry loop, and negative controls behave as documented.
2. **Experiment reproduction:** regenerate all arms, model answers, and adjudications from the original target and host pipeline.

The first target is public and automated. The second is currently incomplete because required upstream artifacts and exact model execution details are not all public.

## Requirements

- Linux or macOS with a POSIX shell
- Bun `1.3.13`, pinned in [`.bun-version`](.bun-version)
- Git

No package installation is required for the auditor itself.

## Clean-room harness reproduction

```sh
git clone https://github.com/ed3c/openwiki-source-anchoring.git
cd openwiki-source-anchoring
git checkout <reviewed-commit-sha>

bun --version
sh harness/selftest.sh
```

Expected toolchain:

```text
1.3.13
```

Expected final test line:

```text
selftest: PASS(valid/hollow/malformed/symlink and breaker controls)
```

A valid reproduction report records the exact commit SHA, operating system, Bun version, command, exit code, and complete output.

## Run one fixture directly

Positive control:

```sh
bun run harness/src/audit_wiki.ts \
  harness/tests/fixtures/wiki-good \
  harness/tests/fixtures/target
```

Expected exit code: `0`.

Hollow-anchor negative control:

```sh
bun run harness/src/audit_wiki.ts \
  harness/tests/fixtures/wiki-hollow \
  harness/tests/fixtures/target
```

Expected exit code: `2`, with an invalid-anchor reason containing:

```text
quote not found in that file
```

The self-test also creates a temporary target containing a symlink that resolves outside the target root. The auditor must return exit `2` and report `symlink escapes target`.

## Audit a published arm

The public wiki output can be audited only when the corresponding target repository is available:

```sh
bun run harness/src/audit_wiki.ts \
  wiki/arm-d-gate-driven \
  /path/to/target-repository \
  --exclude nonofficial
```

The JSON receipt is written to stdout. Preserve the entire receipt and the target commit SHA.

## What can be recomputed from this repository

- Public QA aggregate counts from the published per-question verdict files
- Audit summaries and derived arm comparisons already stored under `data/`
- Harness behavior against the included deterministic fixtures
- Documentation and provenance gaps recorded in `METHOD.md`, `STAGES.md`, and `THRESHOLDS.md`

## What cannot currently be regenerated cleanly

- The original private target repository from the public repository alone
- The complete host pipeline and its hidden dependencies
- Arm A from an exactly pinned authoring model and session
- Model answers and judge outputs from exact immutable model snapshots, seeds, and sampling parameters
- The private threshold-freezing commit referenced by the study

These are reproduction blockers, not minor documentation omissions. A result should be classified as **harness reproduced** rather than **experiment reproduced** unless those inputs are supplied.

## Reproduction report template

```text
Reviewer:
Date:
Repository commit:
Target repository commit:
Operating system:
Bun version:
Command:
Exit code:
Observed output or receipt hash:
Expected result:
Difference, if any:
```

Open a reproduction issue when the result differs. Include the smallest failing fixture and remove secrets or proprietary source before posting.
