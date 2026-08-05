# Reproduction Guide

This repository has three different reproduction targets. Do not treat them as equivalent.

1. **Harness reproduction:** verify the public auditor, resource boundaries, retry loop, claim-preservation guard, and deterministic receipts.
2. **Arm reproduction:** recompute every published per-arm number from the vendored target. Deterministic, no model access, run in CI on every push.
3. **Experiment reproduction:** regenerate every stochastic arm, answer, and adjudication from the original target and host pipeline.

The first two are public and automated. Full experiment regeneration remains unavailable because some original upstream artifacts and exact model execution details are not public.

## Arm reproduction

```sh
bun run harness/src/audit_arms.ts
```

Exit 0 means every arm reproduces the numbers in [`FINDINGS.md`](FINDINGS.md); exit 2 names the field that moved.

The five arms are audited against [`repo-snapshot/`](repo-snapshot/), a desensitized copy of the immutable snapshot they were measured against. Until 2026-08-05 that tree was absent and the numbers could not be checked at all — worse, checking them against the real target produced eleven invalid anchors that were artifacts of publication itself: the quoted text had been desensitized while the file it quotes had not. A quote that names a placeholder cannot occur in a file that holds the real string, so publication manufactured defects that read exactly like wiki defects.

`repo-snapshot/SNAPSHOT-MANIFEST.json` therefore carries both hashes per file: `sha256` of the published bytes and `source_sha256` of the studied bytes. The transformation is auditable rather than asserted.

**This tree is evidence, not a runnable repository.** Its own acceptance was measured on both sides: four of its five gates behave identically after desensitization, and `check_plan_package_compat.py` does not, because it compares an absolute path as an identity string rather than opening it. That delta is recorded under `acceptance_delta` in the manifest instead of being smoothed over.

## Requirements

- Linux or macOS with a POSIX shell
- Bun `1.3.13`, pinned in [`.bun-version`](.bun-version)
- Git

No package installation or model API is required for deterministic reproduction.

## Fast path

```sh
git clone https://github.com/ed3c/openwiki-source-anchoring.git
cd openwiki-source-anchoring
git checkout <reviewed-commit-sha>

bun --version
sh harness/selftest.sh
sh reproduction/recompute.sh
```

Expected final lines:

```text
selftest: PASS(valid/hollow/malformed/symlink/limits/final-retry/claim-preservation/breaker controls)
reproduction: PASS (protocol, fixtures, and receipts match)
```

The first command runs adversarial behavior controls. The second verifies the public protocol hash, fixture hashes, expected receipt hashes, and byte-for-byte regenerated receipts.

## Deterministic bundle

The bundle under [`reproduction/`](reproduction/) contains:

```text
protocol-v1.md                 frozen public protocol
protocol-v1.sha256             protocol content hash
provenance.json                scope and known provenance gaps
target-fixture/                public deterministic target
wiki-fixture/                  positive wiki
wiki-hollow/                   hollow-anchor negative control
expected-receipts/             frozen JSON outputs and hash manifest
recompute.sh                   one-command regeneration
reports/TEMPLATE.md            external reproduction report template
```

Protocol v1 is a public protocol for the deterministic harness and future replications. It is **not** a retroactive preregistration of the original model experiment.

## Auditor exit codes

| Exit | Meaning |
|---:|---|
| `0` | Complete audit; all thresholds pass |
| `2` | Complete audit; one or more evidence thresholds fail |
| `3` | Audit incomplete because an input or resource boundary was reached |
| `64` | Usage, path, or packet-contract error |

An exit-`3` receipt contains:

```json
{
  "complete": false,
  "status": "incomplete"
}
```

It must never be counted as PASS or merged as a valid receipt.

## Configurable resource boundaries

Defaults are frozen in [`reproduction/protocol-v1.md`](reproduction/protocol-v1.md). Override them with CLI flags or matching `OPENWIKI_*` environment variables:

```sh
bun run harness/src/audit_wiki.ts wiki target \
  --max-files 50000 \
  --max-file-bytes 8388608 \
  --max-total-bytes 268435456 \
  --max-page-bytes 2097152 \
  --max-anchors-per-page 10000 \
  --max-claims-per-page 10000 \
  --max-depth 64 \
  --timeout-ms 30000
```

The auditor streams directory entries, does not follow directory symlinks, validates UTF-8 strictly, checks real paths before reading an anchor target, and fails closed when a configured boundary is reached.

## Claim-preservation guard

A mutation-sensitive claim may carry a stable marker:

```html
<!-- claim-id: stable-id -->
```

`trigger.sh` inventories markers before the first mutation. After every retry, the same ID must be:

- present with the same block (`preserved`);
- present with changed text (`corrected`); or
- absent only when the packet declares an explicit withdrawal with a non-empty reason.

Example packet disposition:

```json
{
  "claim_dispositions": [
    {
      "claim_id": "obsolete-claim",
      "disposition": "withdrawn",
      "reason": "the referenced behavior no longer exists"
    }
  ]
}
```

Pages without explicit IDs remain compatible and use the word floor as a coarse fallback. Word count alone is not claim-preservation proof.

## Direct fixture commands

Positive control:

```sh
bun run harness/src/audit_wiki.ts \
  reproduction/wiki-fixture \
  reproduction/target-fixture
```

Expected exit: `0`.

Hollow-anchor control:

```sh
bun run harness/src/audit_wiki.ts \
  reproduction/wiki-hollow \
  reproduction/target-fixture
```

Expected exit: `2`, with `quote not found in that file`.

Resource-boundary control:

```sh
bun run harness/src/audit_wiki.ts \
  reproduction/wiki-fixture \
  reproduction/target-fixture \
  --max-page-bytes 16
```

Expected exit: `3`, `complete: false`, and `limit_failure.key: max_page_bytes`.

## What can be reproduced publicly

- deterministic harness receipts and their hashes;
- valid, hollow, malformed, symlink, circular-evidence, Unicode-path, invalid-UTF-8, depth, file-size, page-size, and anchor-count controls;
- final-retry success and final-retry invalid-anchor behavior;
- stable claim-ID preservation and explicit withdrawal behavior;
- public QA aggregate counts from published per-question verdict files;
- stored arm comparisons derived from already-published data.

## What cannot currently be regenerated cleanly

- the original private target repository from this repository alone;
- the complete host pipeline and hidden dependencies;
- Arm A from an exactly pinned authoring model and session;
- every model answer and judge output from immutable model snapshots, seeds, and sampling parameters;
- the historical private threshold-freezing commit;
- an externally validated universal Agent hiring benchmark.

These are hard reproduction boundaries. Report **harness reproduced** rather than **experiment reproduced** unless the missing inputs are supplied.

## External report

Use [`reproduction/reports/TEMPLATE.md`](reproduction/reports/TEMPLATE.md). Record at minimum:

```text
Reviewer:
Date:
Repository commit:
Operating system:
Bun version:
Command:
Exit code:
Observed final line or receipt hash:
Expected result:
Difference, if any:
```

A failed reproduction is useful evidence when it includes the exact commit, complete output, and smallest failing case. Remove secrets and proprietary source before posting.
