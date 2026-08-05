<div align="right">

**English** · [繁體中文](README.zh-TW.md)

</div>

# Making a generated code wiki checkable: what actually helps a reader, and what only looks like it does

A generated wiki states a great many specific things about a codebase and almost none of them
can be checked. This measures what happens when you force the author to check them — and, more
usefully, **which part of that forcing does the work**.

Four arms, one question set, one blind judge.

| | anchors | anchor rate | **QA PASS** | PASS+PARTIAL | *"the wiki does not say"* |
|---|---|---|---|---|---|
| **A** baseline, official pipeline | 0 | 0% | 23.3% | 56.7% | 10 / 30 |
| **B** anchored afterwards, gate-driven | 312 | **100%** | 40.0% | 66.7% | 6 |
| **Bs** arm B with every marker deleted | 0 | 0% | **40.0%** | 56.7% | 5 |
| **C** anchored while writing, no gate | 590 | 41.3% | **46.7%** | **86.7%** | **1** |
| **D** anchored while writing, **with the gate** | **1053** | **100%** | not measured | — | — |

Rates use `--exclude nonofficial`. Fourteen pages in every arm are the repository's own
hand-written documentation, not output of the pipeline under test. They stay on disk — five
scripts require them and a reader receives them — but scoring the pipeline against a denominator
containing them is a category error. **Measured set and delivered set are different sets**, and an
earlier version of this page mixed them: arm B was allowed to anchor those pages and arms C and D
were not, so three arms carried three denominators. Every figure here is recomputable with the
command above; the raw output is in [`data/arm-comparison.json`](data/arm-comparison.json).

Two things fall out, and both cut against the obvious reading.

**The citation markers contribute nothing to correctness.** Deleting all 486 of arm B's
`(src: …)` markers — changing nothing else — left its PASS rate **exactly** where it was, 12 of
30. The gain over baseline is entirely the *content* the anchoring process added, not the
markers it left behind. Forcing an author to go find a verbatim quote makes them read the source
and write down what they find; the quote itself is a by-product.

**Anchor rate is not a quality measure.** Arm C reaches 41% and still beats arm B's 100% on every
reader-facing measure. Anchor rate says whether the author did the verification work, not whether
the result helps anyone, and on this data the two run in opposite directions.

**And the gate is nearly free.** Arm D is arm C's procedure with the gate loop added — same cold
start, same target, 24 gate runs. It reached 100% with zero invalid anchors, full entrypoint
coverage, and **more** output than arm C: 50 pages against 48, 36,730 words against 35,530, for
590K tokens against 563K. Five percent more cost for the difference between 41% and 100%, with no
sign of the scope-narrowing a prior measurement warns about. What the gate caught, in its own
author's words, was "a real defect" every time: six quotes that did not literally exist in the
source, headings and table rows it had not realised were claims, and quotes whose inner
parenthesis truncated the anchor.

> Anchor rate is a **process** metric. It belongs in a dashboard, not in a headline.

## What forcing verification actually found

Arm A passed everything the official procedure checks — three review subagents, zero broken
links, `status: success` — and contained **53 statements that contradict the source**. Nothing in
that pipeline ever compares a sentence to the file it describes, so this class of defect is
outside its range rather than missed by it.

One miscount had spread to ten pages, into frontmatter, headings and a mermaid diagram. Ten pages
agreeing is not ten pieces of evidence; it is one, repeated.

Arm C, run cold and independently, found **seven more** the earlier arms missed — including a
gate list of 22 entries against a guard expecting 23, so the repository's fast path cannot accept
any receipt its own gate produces.

**These 53 were author-reported, and 22 have now been adjudicated blind.** Fresh agents reading
only source, shown the two competing statements with verdict words stripped and the order
shuffled, upheld the correction 21 times, split once, and **overturned none**. Blinding was only
partial — the corrected half is systematically more detailed — and there were zero abstentions
across 22, both of which are reasons to read a clean sweep carefully. Details and limits in
[`FINDINGS.md`](FINDINGS.md).

## The measurement

The public 30 come from a 60-question bank written by four agents reading **only** source, with
every wiki and review transcript out of bounds. Split mechanically by sorted id. Answered by
agents given one wiki and forbidden the source. Graded by a judge shown four anonymous answers
per question with the labels rotated per batch, returning only PASS/PARTIAL/FAIL. Totals computed
by script; the judge never saw one.

An earlier run of the held-out 30, comparing A against B only, gave 30.0% against 43.3%. It is in
[`qa/holdout-result.json`](qa/holdout-result.json) and is spent.

**`n = 30`, single run, no repeats.** Differences of one to three questions are inside the noise
and are not claimed as effects. The 16.7-point A-to-B gap and the 23.4-point A-to-C gap are
large enough to discuss; the 3-question PARTIAL/FAIL difference between B and Bs is not.

## What this licenses

| observation | conclusion permitted |
|---|---|
| B and Bs identical on PASS | the markers do not drive correctness; the added content does |
| C best on every reader measure with the lowest anchor rate | anchor rate is not a quality measure |
| C's *"wiki does not say"* count of 1 against A's 10 | verification discipline applied **while writing** produces a far more complete wiki than the same discipline applied afterwards |
| 53 contradictions found only by trying to anchor | the official gates cannot see confidently-wrong content |

**Not licensed:** that iterating a gate to zero is harmful. Arms B and C differ in **two** ways —
retrofit versus fresh authoring, and gate versus no gate — and the evidence separates neither. The
untested cell is fresh authoring **with** the gate, which is where both lines of evidence point
and which nothing here has run.

Also not licensed: anything about a repository with real history. The target is synthetic,
generated by the same system that documented it.

## What is here

| path | what |
|---|---|
| [`LICENSE`](LICENSE) | MIT. The wikis describe a third-party repository; the licence covers this repository's own output |
| [`THRESHOLDS.md`](THRESHOLDS.md) | the six thresholds and the commit that fixed them **before** any number existed |
| [`METHOD.md`](METHOD.md) | how each arm was produced, which models were pinned, what cannot be reproduced from here |
| [`STAGES.md`](STAGES.md) | the reasoning stages, and the things that were not anticipated |
| [`FINDINGS.md`](FINDINGS.md) | the false claims with the source contradicting each, and per-result limits |
| [`wiki/arm-a-baseline/`](wiki/arm-a-baseline/) | the official pipeline's output, unmodified |
| [`wiki/arm-b-retrofit/`](wiki/arm-b-retrofit/) | arm A after a gate-driven anchoring pass |
| [`wiki/arm-b-stripped/`](wiki/arm-b-stripped/) | arm B with every marker mechanically removed |
| [`wiki/arm-c-generated/`](wiki/arm-c-generated/) | a cold run anchoring during generation, no gate |
| [`wiki/arm-d-gate-driven/`](wiki/arm-d-gate-driven/) | the same, with the gate loop |
| [`harness/`](harness/) | the gate, its wrapper, the breaker, the dispatch packets, the author-side appendix, the fixtures |
| [`qa/`](qa/) | the bank, its split, and both runs' per-question verdicts |
| [`data/`](data/) | the false-claim inventory, per-arm audits, arm C's receipts, the prior that shaped the design |

## The anchor

```
(src: scripts/git_gate.py `lineage manifest must be staged`)
```

A repository-relative path and a substring **copied** from that file, checked by literal match. No
line numbers: the official prompt asks for stable paths over line numbers and is right — a line
number is stale after the next commit while the quote is the evidence itself.

Author-side rules, including why rationale is exempt and marked `(inferred)`, are in
[`harness/anchor-extension.md`](harness/anchor-extension.md). It is an appendix: **no official
prompt byte was modified**.

**What the gate checks is lexical, not evidentiary.** It verifies that the quoted string occurs
verbatim in the named file. It does **not** verify that the quote supports the sentence it sits
in, and a block counts as anchored once it carries one well-formed anchor even if other
statements in that block are unsupported. Earlier wording here called this "anchor correctness
100%", which invites exactly the wrong reading. It is **anchor lexical validity**. Establishing
evidentiary correctness would need claim segmentation, claim-to-anchor mapping and an entailment
check, none of which this harness does.

```sh
sh harness/selftest.sh                                        # run this first
bun run harness/src/audit_wiki.ts wiki/arm-d-gate-driven <target-repo> --exclude nonofficial
```

Both run on a blank Ubuntu runner in CI. They did not, for several commits: the published
scripts pointed at a path this layout does not have, so the self-test printed failures and exited
without anyone noticing — **the repository shipped exactly the silently-passing gate it argues
against.** CI exists so that cannot recur quietly.

`selftest.sh` is worth reading first. A verifier that cannot separate a *hollow* anchor — real
path, quote that is not in that file — from a real one is a shell, and every number it prints is
decoration. The fixture asserts the failure *reason*, not just the exit code.

Arm C reached that conclusion independently: its notes record that a checker must compare `(src:`
occurrences against regex matches or a malformed anchor vanishes silently. It had never seen that
finding, which makes it a property of the anchor form rather than a one-off bug.

## Limits

- **`n = 30`, one run, no repeats.** Directional. No variance estimate, no inter-judge agreement.
- **22 of the 53 corrections were adjudicated blind**, 21 upheld and none overturned; the other 31
  remain author-reported. Blinding was partial and there were zero abstentions — see FINDINGS.
- **The question bank is model-written**, including its acceptance criteria. No human audited all 60.
- **Arm A predates the others** by a session and a model generation, so A-versus-C is not a clean
  single-variable comparison.
- **The target is synthetic** and has no organic git history.
- **The authoring model was not pinned.** Only the QA layer records fixed models.
- **The gate defines its own denominator.** What counts as a claim is a heuristic in
  `audit_wiki.ts`; changing it changes every rate on this page.
- **Anchor validity is lexical.** The gate proves a quote exists in a file, not that it supports
  the sentence around it.
- **The threshold-freezing commit is not in this repository.** It lives in the private host
  repository, so an outside reviewer cannot verify the ordering claim — see
  [`THRESHOLDS.md`](THRESHOLDS.md).
- **Single-run equality is not equivalence.** Arms B and Bs matching at 12 of 30 is one
  observation, not a demonstration that the markers have no effect; that would need repeats and a
  predeclared equivalence margin.

Paths are desensitised: `<target-repo>`, `<host-repo>`, `<sandbox>`, `<home>`. Relative references
the wikis make to their own generating repository are left as written — they are part of the
artifact under study, and rewriting them would alter what was measured.
