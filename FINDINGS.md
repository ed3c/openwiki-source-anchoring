<div align="right">

**English** · [繁體中文](FINDINGS.zh-TW.md)

</div>

# Findings

## The pipeline's own gates cannot see the defect this measures

The baseline passed everything the official procedure checks. Three review subagents ran,
`skeleton_critic` reached no unresolved items, the `wiki_question_finder` /
`wiki_answer_verifier` loop converged, `finalize` reported zero broken links and zero
degraded diagrams. `.last-update.json` records `status: success`.

**53 of its statements contradict the source code.**

That is not a failure of the gates; it is outside their range. They ask *can the wiki answer
this question*. A confident wrong answer passes that test, because the test never opens the
file the answer is about. The full inventory is [`data/false-claims.json`](data/false-claims.json).

### One miscount reached ten pages, and agreement is not corroboration

The push gate runs **22** gates. The wiki said **23** — on ten pages, in frontmatter, in
section headings, and inside a mermaid diagram.

The cause is mundane: `GATES` in `git_gate.py` is a list literal with a comment block inside
it, and eye-counting overshoots. `ast.literal_eval` gives 22.

What matters is the propagation. Nothing in the pipeline compares one page against another,
so a single miscount replicates into every page that mentions it — and afterwards **ten pages
agreeing looks like ten pieces of evidence**. It is one, repeated.

### The errors are mostly not typos

Representative, each verified against source during the pass:

| the wiki said | the source says |
|---|---|
| the lineage validator runs by default in the commit gate | `git_gate.py` carries `# scripts/validate_molecular_commit_lineage.py is deliberately NOT gated here.` and the script is absent from `GATES` |
| a required literal lives at `check_openwiki.py:73` | line 73 is a different entry entirely; the literal is elsewhere in the file |
| `final_repo_small_loop_policy: forbidden` is recorded in `plan-package.compat.yaml` | that key does not appear in that file at all |
| the policy key lives in `openwiki/openwiki.yaml` | no such file exists; the path is one directory deeper |
| the gate pins these six counts | it compares four of them and never reads the other two |
| the checker requires two `cases.json` files to be identical | it compares **parsed JSON**, so reformatting either file still passes |
| the ablation checker verifies these five table values | it tests five *different* conditions and never reads three of the values named |
| a skill's promotion status lives in its `status.json` | that skill has no `status.json`; the status is in a lifecycle registry |
| a line is dropped only when the score is unchanged | the code reads `if current_rate >= baseline:` |

Every one is plausible, specific, and the kind of thing an agent would act on.

---

## The QA holdout: 30.0% → 43.3%

Thirty questions, run once, from a 60-question bank written by four agents reading **only**
source with both the wiki and the review transcripts explicitly out of bounds. Split
mechanically by sorted id, odd to holdout. Answered by agents that could read one wiki and
were forbidden the source. Graded blind, alpha/beta alternating per batch, against acceptance
criteria fixed when the question was written. Scored by script arithmetic.

| | baseline | candidate |
|---|---|---|
| PASS | 9/30 (30.0%) | **13/30 (43.3%)** |
| PASS + PARTIAL | 50.0% | **66.7%** |
| answered "the wiki does not say this" | **12** | **6** |

Eight questions changed verdict: seven toward the anchored wiki, one away.

### The clearest single result links a corrected falsehood to a corrected answer

On `gates-03` the baseline arm failed and the judge, who did not know which arm it was
grading, wrote:

> *confidently wrong: it denies the question's premise and asserts the script IS gate #21 in
> `git_gate.py`'s GATES list, contradicting the exclusion*

That is one of the 53 corrections — the validator that the source explicitly says is not
gated. The chain from *a false claim was removed* to *an agent stopped answering confidently
wrong* is **observed here, not inferred**.

### One question got worse, and the reason generalises

`gates-01` fell PASS → PARTIAL: the anchored rewrite dropped a branch the original mentioned.
Making a sentence checkable means rewriting it, and a rewrite can drop something that was
already true. This is a cost of the method, not an anomaly, and it will recur.

### "The wiki does not say" halved without being asked

The anchoring pass was never instructed to add coverage. It went from 12 unanswerable
questions to 6 anyway. Forcing each claim to face its source appears to make the surrounding
page more answerable as a side effect — plausible, unproven, and worth isolating later.

---

## What this does and does not license

| observation | conclusion permitted |
|---|---|
| 0 → 486 anchors, none invalid | claims in this wiki are now mechanically falsifiable |
| 53 contradictions found while anchoring | the official gates cannot detect confidently-wrong content; a wiki can pass all three and still mislead |
| holdout 30.0% → 43.3%, blind | the anchored wiki is measurably more useful to an agent **on this repository, at n=30, once** |
| "does not say" 12 → 6 | anchoring improved answerability, mechanism unknown |
| one verdict regression | rewriting for verifiability can lose information |
| coverage 30/32 → 32/32 | achieved partly **for free** via anchor paths — the two metrics share evidence and are not independent |

**Not licensed by anything here:**

- That anchoring an existing wiki beats regenerating one. There is no regeneration arm. The
  constraint against regenerating comes from a prior measurement on a *different* repository
  with a *different* anchor form ([`data/prior-anchoring-squeezes-breadth.md`](data/prior-anchoring-squeezes-breadth.md)).
- That any of this transfers to a repository with real history. The target is synthetic —
  generated by the same system that documented it, no `.git` of its own.
- That carrying lessons between rounds causes the improvement. 189 citations across 24 agents
  show the lessons were *used*; there is no unseeded arm to show they *helped*.
- Anything about upstream's own binary. It was never installed; this line of work exists to
  run the official procedure on a CLI subscription with no API key.

---

## The prior that shaped the design, and why it did not recur

A measured A/B on this pipeline a month earlier — same repository, same pin, one variable —
found that adding a claim contract drove fabrication to zero **and cut round-1 coverage from
6 pages to 3**, for +4 points and 40% more authoring time. Anchoring is a per-claim cost, and
a bounded author absorbs a cost increase by narrowing scope.

Two countermeasures shipped because of it: the coverage threshold ships *alongside* the anchor
requirement rather than after it, and anchoring runs as an update over finished pages rather
than as a fresh generation.

Coverage rose here (30/32 → 32/32) and no page lost words. That is consistent with the
countermeasures working and is **not evidence that they did** — an update pass over an
existing page has nothing to drop, so the failure mode was structurally unavailable. The
absence of a squeeze in a setup that cannot squeeze proves nothing, and is recorded that way.
