<div align="right">

**English** · [繁體中文](README.zh-TW.md)

</div>

# Anchoring a generated code wiki: which half of the mechanism does the work?

A generated wiki says a lot of specific things about a codebase, and almost none of them can be
checked. Making them checkable takes two parts — a convention telling the author what an anchor
is, and a gate telling the author which claims still lack one.

**Three arms separate them.** The convention alone reaches about 41%. The gate-driven loop takes
it to 100%. That split is the result; the rest of this repository is how it was measured and why
each number can be trusted.

| | **A · baseline** | **B · retrofit** | **C · generated** |
|---|---|---|---|
| how it was made | official pipeline, no anchoring | A, edited page by page **under the gate** | the modified skill, **cold run**, convention wired in, gate never run |
| anchors | 0 | 486 | **590** |
| invalid anchors | — | 0 | 2, both circular |
| **anchor rate** | 0.0% | **100%** | **27.2%** (41.3% excluding pages it inherited) |
| entrypoint coverage | 30/32 | 32/32 | **32/32** |
| pages · words | 44 · 29,451 | 44 · 35,113 | 48 · 35,530 |
| gate | exit 2 | **exit 0** | exit 2 |
| cost | not recorded | ~2.88M subagent tokens | **563K tokens, 74 min**, including generation |

Arm C wrote **more** anchors than arm B and landed at less than half the rate. The difference is
not effort. Arm B received, every round, a mechanical list of which claims still lacked an
anchor, and iterated until that list was empty. Arm C never ran the gate — it built its own
checker, and that checker counted anchors *written* rather than claims *still unanchored*, so it
had no way to see what it had missed.

> A convention tells an author what good looks like. Only a gate tells them where they are not
> there yet. Wiring in the first without the second buys about 41% of the result.

## What anchoring found that the pipeline could not

Arm A passed every gate the official procedure has — three review subagents, zero broken links,
`status: success` — and contained **53 statements that contradict the source**. Nothing in the
pipeline compares a sentence to the file it describes, so that class of defect is outside its
range rather than missed by it.

One miscount had propagated to ten pages, into frontmatter, headings, and a mermaid diagram.
Ten pages agreeing is not ten pieces of evidence; it is one, repeated.

Arm C, run cold and independently, found **seven more** defects that none of the earlier arms
recorded — including a gate list of 22 entries against a compatibility guard expecting 23, which
means the repository's fast path cannot accept any receipt its own gate produces.

## Does it help a reader?

A blind holdout, run **once**: 30 questions written from source by authors forbidden to read any
wiki, answered by agents forbidden to read the source, graded by a judge who saw anonymous
paired answers and never touched a total.

| | arm A | arm B |
|---|---|---|
| PASS | 9/30 (30.0%) | **13/30 (43.3%)** |
| PASS + PARTIAL | 50.0% | **66.7%** |
| answered "the wiki does not say this" | 12 | **6** |

The clearest single case: on one question the judge, not knowing which arm it was grading, called
arm A's answer *"confidently wrong"* for asserting that a script sits in a gate list its own
source comment says it is deliberately excluded from. That sentence is one of the 53 corrections.
The chain from *a false claim was removed* to *an agent stopped answering confidently wrong* is
observed here, not inferred.

**One question got worse.** An anchored rewrite dropped a branch the original mentioned.
Rewriting a sentence to make it checkable can lose something that was already true.

**Arm C has no QA number.** The holdout was spent comparing A against B, and re-running it on a
third arm would make it meaningless. The 30 held-back public questions in [`qa/`](qa/) exist for
exactly this and have not been run.

## What is here

| path | what |
|---|---|
| [`LICENSE`](LICENSE) | MIT. The wikis describe a third-party repository; the licence covers this repository's own output |
| [`THRESHOLDS.md`](THRESHOLDS.md) | the six thresholds and the commit that fixed them **before** any number existed |
| [`METHOD.md`](METHOD.md) | how each of the three arms was produced, which models were pinned, what cannot be reproduced from here |
| [`STAGES.md`](STAGES.md) | the reasoning stages that produced the difference, and the things that were not anticipated |
| [`FINDINGS.md`](FINDINGS.md) | the false claims with the source that contradicts each, and what each result does and does not license |
| [`wiki/arm-a-baseline/`](wiki/arm-a-baseline/) | the official pipeline's output, unmodified |
| [`wiki/arm-b-retrofit/`](wiki/arm-b-retrofit/) | arm A after a gate-driven anchoring pass |
| [`wiki/arm-c-generated/`](wiki/arm-c-generated/) | a cold run of the modified skill, anchoring during generation |
| [`harness/`](harness/) | the gate, its engine wrapper, the circuit breaker, the dispatch packets, the author-side appendix, and the fixtures that prove the gate is not a shell |
| [`qa/`](qa/) | the 60-question bank, its public/holdout split, and the per-question verdicts |
| [`data/`](data/) | the false-claim inventory, per-arm audits, arm C's per-page receipts, and the prior that shaped the design |

## The anchor

```
(src: scripts/git_gate.py `lineage manifest must be staged`)
```

A repository-relative path and a substring **copied** from that file, checked by literal match.
Deliberately no line numbers: the official prompt instructs *"prefer stable paths and symbol
names over line numbers"*, and it is right — a line number is stale after the next commit while
the quote is the evidence itself.

Rules for authors, including why rationale is exempt and marked `(inferred)` instead, are in
[`harness/anchor-extension.md`](harness/anchor-extension.md). It is an appendix: **no official
prompt byte was modified**.

## Running the gate

```sh
bun run harness/audit_wiki.ts wiki/arm-c-generated <target-repo>   # exit 0 green, 2 below threshold
sh harness/selftest.sh                                             # the gate must catch a hollow anchor
```

`selftest.sh` is the part worth reading first. A verifier that cannot separate a *hollow* anchor —
real path, quote that is not in that file — from a real one is a shell, and every number it prints
is decoration. The fixture asserts the failure *reason*, not just the exit code.

Arm C reached the same conclusion independently: its notes record that a checker must compare
`(src:` occurrences against regex matches, or a malformed anchor vanishes silently. It had never
seen that finding. It is a property of the anchor form, not a one-off bug.

## Limits, stated up front

- **Arm A and arm C are not a clean single-variable comparison.** Arm A came from an earlier
  session and a different model generation. No coverage squeeze was observed under arm C's
  conditions; that is not the same as the prior being wrong.
- **The target is synthetic.** A repository generated by the same system that documented it,
  with no organic git history. Nothing here extrapolates to a repository with a decade of commits
  until that is run.
- **Arm C has no QA measurement**, and the holdout cannot be reused.
- **The question bank is model-written.** Four source-only agents; no human audited all 60.
- **`n = 30`, one run.** Directional, not a result.
- **The authoring model was not pinned.** Only the QA layer records fixed models. See
  [`METHOD.md`](METHOD.md#models).

Paths are desensitised: `<target-repo>`, `<host-repo>`, `<sandbox>`, `<home>`.

## What was *not* rewritten

The wiki pages contain relative references to directories of the repository that generated the
target. They appear identically across arms, they are part of the artifact under study, and
rewriting them would alter the object being measured and break the diff. Machine-specific paths —
home directory, user name, absolute locations — are replaced. Internal directory names the wiki
itself documents are left as the pipeline wrote them.
