---
type: Contract
title: Plan-package contract and compatibility gate
description: How PROJECT-SSOT.md, plan-package.compat.yaml and .plan-package.lock.yaml pin this repository's shape, and exactly what scripts/check_plan_package_compat.py verifies — including the gate-receipt mode that its own git gate cannot currently satisfy.
tags: [contract, provenance, gate]
node_kind: RepoDoc
ingest_lane: concept
repo: arm-d/agent-skills-repo
covers: [plan-package, provenance-lock, compatibility-gate]
libraries: [python]
generated_by: claude-code+claude-opus-5
generated_at: null
---

# Plan-package contract and compatibility gate

Three declarative files pin what this repository must contain and what it must
never contain, and one script checks that the tree still matches them.

## The three declarations

`PROJECT-SSOT.md` is prose plus key-value header. It names the originating plan
(src: PROJECT-SSOT.md `plan_name: unknown-discovery-gcr-order`), the root kind
(src: PROJECT-SSOT.md `root_kind: final-repo`), and a Contract section whose
clauses are the source of most invariants documented across this wiki — for
example that "Every production file must trace to an intent slice, route, draft
template, validator, and molecular commit"
(src: PROJECT-SSOT.md `Every production file must trace to an intent slice`).

`plan-package.compat.yaml` is the machine-checked manifest. It carries counted
facts (src: plan-package.compat.yaml `molecular_commit_count: 10`), status words
that gates re-assert (src: plan-package.compat.yaml `synthetic_case_quality_status: insufficient`),
and the forbidden-path list
(src: plan-package.compat.yaml `final_repo_forbidden_paths: small-loop,packets,templates/skill-defense-governance`).

`.plan-package.lock.yaml` is the provenance lock. It pins the frozen source
conversation (src: .plan-package.lock.yaml `source_conversation: <home>/antigravity/gemini_research/gcr/047d548af8f8e34c-conversation.md`),
its digest (src: .plan-package.lock.yaml `frozen_source_sha256: 8fe152eb94179a56b6bd1b43a40c50690741ddf2ebc3a95c6b7b5e05776372a4`),
and the final-repo policy (src: .plan-package.lock.yaml `final_repo_small_loop_policy: forbidden`).
The same digest appears in the compat manifest, so the two files must agree
(src: plan-package.compat.yaml `frozen_source_sha256: 8fe152eb94179a56b6bd1b43a40c50690741ddf2ebc3a95c6b7b5e05776372a4`).

## What the gate checks

`scripts/check_plan_package_compat.py` parses the manifest with a deliberately
tiny reader that splits each line on the first `": "`
(src: scripts/check_plan_package_compat.py `key, value = raw.split(": ", 1)`) and then
asserts a large conjunction. Three families of check matter:

1. **Required paths.** A literal list of **77** repository-relative files must
   all exist, from `PROJECT-SSOT.md` through every gate script, every dataset and
   both skill assets; anything missing is reported by name
   (src: scripts/check_plan_package_compat.py `FAIL: missing required path(s)`).
2. **Forbidden paths.** The same three small-loop directories are re-checked here
   (src: scripts/check_plan_package_compat.py `FAIL: final repo contains small-loop path(s)`).
3. **Pinned manifest values.** Each key is compared to a literal, for instance
   (src: scripts/check_plan_package_compat.py `manifest.get("project_template_file_count") != "86"`)
   and (src: scripts/check_plan_package_compat.py `manifest.get("lineage_edge_count") != "92"`).
   Changing a count in the YAML without changing the script fails the gate, and
   vice versa.

It then re-runs seven sub-gates as subprocesses and requires each one's exact
success line, such as (src: scripts/check_plan_package_compat.py `"PASS: openwiki usage and lifecycle wiring" not in openwiki.stdout`).
Only when the whole conjunction holds does it print
(src: scripts/check_plan_package_compat.py `PASS: plan package compatibility`).

## The gate-receipt mode, and why it does not currently work

To avoid running those sub-gates twice, the script accepts `--gate-receipt`
(src: scripts/check_plan_package_compat.py `parser.add_argument("--gate-receipt", type=Path)`)
and reuses the stdout captured inside a
[`git-gate-receipt@0.1.0`](../governance/git-gate.md) file. `load_gate_receipt`
is strict: the receipt must be a private regular file
(src: scripts/check_plan_package_compat.py `gate receipt must be a private regular file`),
its recorded `input_state_sha256` must equal a freshly recomputed hash of the
tree (src: scripts/check_plan_package_compat.py `!= input_state_sha256(root)`), each
entry's stdout digest must match its stdout
(src: scripts/check_plan_package_compat.py `hashlib.sha256(gate["stdout"].encode()).hexdigest()`),
and specific literals must appear in specific streams
(src: scripts/check_plan_package_compat.py `GIT_GATE_EXPECTATIONS`).

**This path cannot be satisfied by this repository's own git gate.**
`GIT_GATE_ORDER` here lists 23 entries and includes
`scripts/validate_molecular_commit_lineage.py`
(src: scripts/check_plan_package_compat.py `"scripts/validate_molecular_commit_lineage.py",`),
while `GATES` in `scripts/git_gate.py` has 22 and deliberately excludes that
validator (src: scripts/git_gate.py `is deliberately NOT gated here`). The receipt
loader compares both the count and the exact ordered list
(src: scripts/check_plan_package_compat.py `!= GIT_GATE_ORDER`), so a real receipt is
rejected as (src: scripts/check_plan_package_compat.py `gate receipt contract or input state mismatch`).
(inferred) Treat `--gate-receipt` as a stale seam: it was written against a gate
list that has since dropped one entry, and a future change should either restore
lineage validation to `GATES` — which the note in `git_gate.py` argues against —
or shrink `GIT_GATE_ORDER` to 22. Until then, run the gate without a receipt and
accept the duplicate sub-gate execution.

## How it is invoked

There is a one-line wrapper (src: scripts/test_plan_package_compat.sh `python3 "$ROOT/scripts/check_plan_package_compat.py" "$@"`),
which simply forwards its arguments. Neither the wrapper nor the Python gate is
referenced by `.githooks/pre-push`, by `GATES`, or by any workflow — this is a
**manual-only** check, and the
[validation matrix](../ci/validation-matrix.md) records it as such. `README.md`
lists it in the usage block as `python3 scripts/check_plan_package_compat.py`
(src: README.md `python3 scripts/check_plan_package_compat.py`).

## Validation

```sh
python3 scripts/check_plan_package_compat.py     # expect: PASS: plan package compatibility
```

Related: [git gate](../governance/git-gate.md) for the receipt producer,
[commit lineage](../governance/commit-lineage.md) for the excluded validator,
[evidence and promotion policy](evidence-and-promotion-policy.md) for the status
words this manifest pins.
