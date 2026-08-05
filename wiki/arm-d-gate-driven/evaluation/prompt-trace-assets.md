---
type: DataContract
title: Prompt trace assets and input-to-terminal traceability
description: The three-slot prompt trace dataset, its privacy contract, the sha256-bound path from the originating conversation to terminal artifacts, and the gate that can verify seven intent slices against real Git subjects.
tags: [traceability, prompts, privacy, gate]
node_kind: RepoDoc
ingest_lane: concept
repo: arm-d/agent-skills-repo
covers: [prompt-trace, input-to-terminal-trace, trace-privacy]
libraries: [python, git]
generated_by: claude-code+claude-opus-5
generated_at: null
---

# Prompt trace assets and input-to-terminal traceability

## What is being traced

`PROJECT-SSOT.md` requires commit messages to preserve three distinct prompt
contexts (src: PROJECT-SSOT.md `fixed_prompt_context, iteration_auto_context, emergent_prompt_context`).
`data/prompt_trace/` is where those three slots become data, and
`scripts/check_prompt_trace_assets.py` is the gate over them
(src: scripts/check_prompt_trace_assets.py `Validate prompt trace assets, golden evals, and OpenWiki display.`).

The dataset must hold exactly three records, one per slot
(src: scripts/check_prompt_trace_assets.py `prompt trace dataset must contain exactly 3 seed records`), and the slot set
is fixed (src: scripts/check_prompt_trace_assets.py `REQUIRED_SLOTS = {"fixed_prompt", "iteration_auto_prompt", "emergent_prompt"}`).
Five selection actors must be declared
(src: scripts/check_prompt_trace_assets.py `REQUIRED_ACTORS = {"codex", "agy", "external-verify", "judge-loop-chooser", "openwiki"}`),
and each record must name its evidence gate and its training eligibility
(src: scripts/check_prompt_trace_assets.py `prompt trace evidence gate mismatch:`) with a fixed value
(src: scripts/check_prompt_trace_assets.py `!= "metadata-only-local"`).

## The privacy contract

Three conditions are asserted together: no cloud upload
(src: scripts/check_prompt_trace_assets.py `prompt trace cloud_upload_allowed must be false`), no storage of raw
external model output
(src: scripts/check_prompt_trace_assets.py `prompt trace must not store raw external model outputs`), and training use
gated on a human (src: scripts/check_prompt_trace_assets.py `model_training_use must require human admit`).
(inferred) Storing *metadata about* prompts rather than the prompts themselves is
what makes the corpus safe to commit at all; the gate exists so that the safe
shape cannot drift into an unsafe one by accident.

## The input-to-terminal trace

One structured object connects the originating conversation to terminal
artifacts. It is bound by id (src: scripts/check_prompt_trace_assets.py `input trace must bind the primary GCR input id`),
by content digest
(src: scripts/check_prompt_trace_assets.py `input trace must carry a sha256 of frozen input content`), and by a bounded
excerpt of the source (src: scripts/check_prompt_trace_assets.py `input trace must expose a bounded source-content excerpt`).
The three directory roots it must show are plan package, small loop and final
repo (src: scripts/check_prompt_trace_assets.py `input trace directory roots must show plan package, small loop, and final repo`).

An `auto_prompt_snapshot` records four measured signals whose values are pinned
(src: scripts/check_prompt_trace_assets.py `"next_conditional_edge": "production-equivalence-improved -> human-admit-surface",`).
Exactly seven intent/commit/terminal mappings must exist
(src: scripts/check_prompt_trace_assets.py `input trace must expose exactly 7 legacy intent/commit/terminal mappings`) covering
consecutive slices (src: scripts/check_prompt_trace_assets.py `intent/commit mapping slices must cover GCR-SLICE-01..07`),
each with a 40-hex sha, a repository name and non-empty terminal artifacts
(src: scripts/check_prompt_trace_assets.py `intent mapping has no terminal artifacts:`).

## The two optional verification modes

Both extra checks are opt-in through explicit absolute-path flags parsed by hand
(src: scripts/check_prompt_trace_assets.py `--workspace-root must be an existing absolute plan-truth workspace`) and
(src: scripts/check_prompt_trace_assets.py `--commit-repo must be an existing absolute Git repository`).

With `--workspace-root`, the gate hashes the frozen input and compares it to the
recorded digest (src: scripts/check_prompt_trace_assets.py `input trace sha256 does not match frozen small-loop content`),
regenerates the current loop auto-prompt into a temp file and requires each
measured signal to still appear
(src: scripts/check_prompt_trace_assets.py `current loop auto-prompt missing measured signal:`), and requires every
listed terminal artifact to exist
(src: scripts/check_prompt_trace_assets.py `intent mapping terminal artifact missing:`).

With `--commit-repo`, each mapping's commit subject is read from Git and compared
(src: scripts/check_prompt_trace_assets.py `intent mapping Git subject mismatch:`), with a name check to stop the
wrong repository being handed in
(src: scripts/check_prompt_trace_assets.py `explicit commit repo name mismatch:`).

(inferred) Without either flag the gate verifies only internal consistency —
shapes, counts and pinned strings. That is the mode CI would run in, and it is
worth knowing that the strongest claims on this page are only actually proven
when a human passes the two paths. The
[validation matrix](../ci/validation-matrix.md) records that no hook or workflow
passes them.

## The golden eval and the display page

`data/prompt_trace/golden_prompt_trace_eval.json` must hold exactly three cases
(src: scripts/check_prompt_trace_assets.py `golden prompt trace eval must contain exactly 3 cases`) with fixed ids
(src: scripts/check_prompt_trace_assets.py `expected_cases = {"prompt-slot-separation", "adversarial-selection-contract", "training-privacy-contract"}`),
all PASS (src: scripts/check_prompt_trace_assets.py `golden prompt trace case must be PASS:`), and the privacy case
must keep both switches off
(src: scripts/check_prompt_trace_assets.py `training privacy case must forbid raw external outputs`).

Finally, nineteen literals must appear in
`openwiki/nonofficial/prompt-trace-assets.md`
(src: scripts/check_prompt_trace_assets.py `required_literals = [`), including a Mermaid marker
(src: scripts/check_prompt_trace_assets.py `"flowchart LR",`) and the exact Git command a reader is expected to
run (src: scripts/check_prompt_trace_assets.py `git log --all --format='%H%x09%s%x09%b' --grep='Intent-Slice: GCR-SLICE-'`).
That page is therefore gate-pinned content — see the
[openwiki contract](../wiki/openwiki-contract.md).

## Validation

```sh
python3 scripts/check_prompt_trace_assets.py
python3 scripts/check_prompt_trace_assets.py --workspace-root <abs> --commit-repo <abs>
```
