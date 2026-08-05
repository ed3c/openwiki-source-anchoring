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

---

## Arm C: the convention is worth about 41%, the gate the rest

| | arm A | arm B, gate-driven | arm C, convention only |
|---|---|---|---|
| anchors | 0 | 486 | **590** |
| anchor rate | 0.0% | **100%** | **27.2%** / 41.3% excl. inherited |
| invalid | — | 0 | 2, both circular |
| entrypoint coverage | 30/32 | 32/32 | **32/32** |
| gate | exit 2 | **exit 0** | exit 2 |
| cost | not recorded | ~2.88M tokens | 563K tokens, 74 min, incl. generation |

Arm C wrote more anchors than arm B and reached less than half the rate, because it never ran
the gate. Its checker counted anchors written; the gate reports claims still unanchored.

**What this licenses:** the numbers reported for arm B are properties of the gate-driven loop,
not of the anchor convention. Adopting the convention alone should be expected to land near 41%.

**What it does not:** arm C has no QA measurement — the holdout was spent on A versus B and
reusing it would void it. The 30 public questions exist for this and have not been run, so
nothing here says whether arm C is more *useful* than arm A, only that it is less anchored than
arm B.

### The coverage squeeze did not appear, and that is weaker evidence than it looks

Arm C covered 32/32 entrypoints against arm A's 30/32, wrote 20% more words, and reported
*"Nothing ran out."* Its six `what_was_cut` entries are reasoned deferrals recorded as Backlog
items rather than silent narrowing.

But arm A came from an earlier session and a different model generation, so this is not a
single-variable comparison. The honest statement is that **no squeeze was observed under arm C's
conditions** — not that the prior is refuted.

### Seven target defects the earlier arms missed

Arm C, running cold, recorded seven defects in the target that neither arm A nor the anchoring
pass caught. The sharpest: the commit gate's `GATES` list has 22 entries while the compatibility
guard's `GIT_GATE_ORDER` has 23, so the receipt fast path **cannot accept any receipt this
repository's own gate produces**.

It also observed a side effect nobody had noticed: creating `openwiki/quickstart.md` is what
flips the target's `check_openwiki.py` from failing to passing, which unblocks its commit gate.
**Arm A's target had been sitting in a failed gate state throughout this work.**

### Two independent confirmations

Arm C's two invalid anchors both point into `openwiki/nonofficial/` — the wiki's own output. The
appendix forbids exactly that as circular evidence, and arm C's checker had no such rule, so it
self-reported zero bad anchors. **A rule stated in the prompt and absent from the tool is decided
by the tool.**

And arm C's notes independently derive that a checker must compare `(src:` occurrences against
regex matches or a malformed anchor vanishes silently — the same silent-pass hole found and
fixed earlier here, reached by an agent that had never seen the finding. That makes it **a
property of the anchor form**, not a bug that was once fixed.

---

## Four arms on the public set: the markers do nothing, and the best arm is the least anchored

| | anchor rate | PASS | PASS+PARTIAL | *"wiki does not say"* |
|---|---|---|---|---|
| A baseline | 0% | 23.3% | 56.7% | 10 |
| B anchored, gate-driven | **100%** | 40.0% | 66.7% | 6 |
| **Bs** B with markers deleted | 0% | **40.0%** | 56.7% | 5 |
| C anchored while writing | 27.2% | **46.7%** | **86.7%** | **1** |

### The stripped arm settles the mechanism question

Arm Bs is arm B with all 486 `(src: …)` markers mechanically removed and **nothing else changed**.
Its PASS count is identical: 12 of 30.

So the gain over baseline is not the citations. It is the content the author wrote *while looking
for* citations — exact error strings, observed exit codes, threshold values. The marker is what
falls out of the process, not what does the work.

The two arms differ on 8 individual questions, netting +10pp for B on PASS+PARTIAL. At n=30 with
no repeats, a three-question swing is noise and is not claimed as an effect.

### Anchor rate and usefulness run in opposite directions here

Arm C has a quarter of arm B's anchor rate and beats it on PASS, on PASS+PARTIAL, and most
sharply on questions the wiki simply could not answer — 1 against 6. Arm A left 10 unanswerable.

The plausible mechanism is that arm C applied the verification discipline **while writing every
page**, so every page got read-the-source treatment, whereas arm B only revisited claims the gate
flagged and left the rest of arm A's prose untouched.

**What this does not license:** the conclusion that gate-driven iteration is harmful. Arms B and C
differ in two ways at once — retrofit versus fresh authoring, and gate versus no gate — and
nothing here separates them. The untested cell is fresh authoring *with* the gate, which is where
both lines of evidence point.

### Consequence for how these numbers should be read

Anchor rate is a **process** measure: did the author do the verification work. It is
deterministic, cheap and reproducible, and it says nothing about whether the result helps a
reader. On this data it is negatively associated with the reader-facing measures. It belongs in a
diagnostic table, not in a headline, and an earlier version of this repository had that the wrong
way round.

---

## The corrections, adjudicated blind

The 53 corrections were the weakest link here: identified, applied and reported by the same
agents. Twenty-two were re-adjudicated by fresh agents that read only source.

Each record was split into its two competing statements — what the page said, and what it was
changed to — with every verdict word stripped and the order shuffled by index parity, so the
adjudicator was not told which was which. Adjudicators were instructed to default to
`CANNOT_DETERMINE`, that "both partly right" was a legitimate verdict, and to state how the
statement they rejected could still be defensible.

| outcome | count |
|---|---|
| correction upheld | **21** |
| original upheld | **0** |
| both partly right | 1 |
| neither | 0 |
| could not determine | 0 |

**No sampled correction was overturned.** The one split verdict concerns a claim that was right
in direction and over-stated in scope, not one that was false.

The evidence is specific — exact line numbers, `grep -n` output, runtime stdout from actually
executing the gates — and the notes do argue the losing side. One of them surfaces a defect
nobody had recorded: a genuine `git_gate.py` receipt carries 22 gates, while
`check_plan_package_compat.py` tests `expected_gate_count` against a 23-entry list, so a real
receipt fails that check.

### Two reasons to read this result with care

**Blinding was only partial.** The corrected half of each pair is systematically more detailed,
because it was written after someone read the source. An adjudicator could plausibly infer which
was which from specificity alone — and that heuristic correlates with being right, so it cannot
be separated from the verdict. Each adjudicator did produce independent source evidence, which
mitigates the leak without closing it.

**Zero abstentions across 22, all at high confidence**, despite an explicit instruction to
abstain when the source is silent. That is the profile of either a genuinely clear-cut sample or
an instrument that does not discriminate. The quoted evidence argues for the first. A 22-for-22
sweep should still be read as what it is.

**n = 22 of 53.** The defensible statement is that most corrections hold and none of those
sampled was overturned — not that all 53 are correct. Full records, including the sampling rule,
are in [`data/correction-adjudication.json`](data/correction-adjudication.json).

---

## Arm D, and a denominator that had been wrong

Arm D is arm C's procedure with the gate loop added — cold start, target prepared identically,
gate run 24 times.

| measured with `--exclude nonofficial` | pages | anchors | invalid | anchor rate | coverage | cost |
|---|---|---|---|---|---|---|
| A baseline | 31 | 0 | 0 | 0.0% | 93.8% | not recorded |
| B retrofit | 31 | 312 | 0 | **100%** | 100% | ~2.88M tokens |
| Bs stripped | 31 | 0 | 0 | 0.0% | 96.9% | — |
| C fresh, no gate | 35 | 590 | 2 | 41.3% | 100% | 563K / 74 min |
| **D fresh + gate** | 37 | **1053** | **0** | **100%** | **100%** | **590K / 79 min** |

Every column above except cost is recomputed on each push by `harness/src/audit_arms.ts` against
[`repo-snapshot/`](repo-snapshot/) and compared to `harness/arms-baseline.json`. Before 2026-08-05
these were numbers a reader had to take on trust: the target was not in the repository, and the
CI step that claimed to audit the arms only checked that five directories existed.

**Five percent more cost for the difference between 41% and 100%**, and arm D wrote *more* than
arm C — 50 pages against 48, 36,730 words against 35,530 — so the scope-narrowing the prior warns
about did not appear even under gate pressure, which is the condition the prior is about.

It also corrects an earlier claim here: the retrofit's 2.88M was expensive because it used two
dozen parallel agents each re-reading the source, not because verification is inherently costly.
The loop is a deterministic check inside one session and is nearly free.

### What the gate caught that the author could not

Arm D's own notes: quotes whose inner parenthesis truncated the anchor, headings and table rows it
had not realised count as claims, and **six quotes that did not literally exist in the source** —
line-wrapped text, TypeScript object keys without quotes, a colon where the source has a question
mark. Its verdict on all of them: "every one was a real defect". A checker that counts anchors
written passes every one of these silently.

### The denominator was wrong, and this is the correction

Arm B's instructions did not forbid editing the repository's own hand-written `nonofficial/`
pages, so it anchored them: **174 of its 486 anchors were there.** Arms C and D were told to
preserve those pages and anchored none. Three arms, three denominators, and the figures published
earlier here mixed them.

Every rate above uses `--exclude nonofficial`. Those fourteen pages are hand-written repository
documentation, not output of the pipeline under test, so scoring the pipeline against a
denominator containing them is a category error. They cannot be deleted either — five scripts
hard-require them, `check_openwiki.py` in 28 places — and a reader genuinely receives them.
**Measured set and delivered set are different sets.**

Corrected: arm B has **312** anchors, not 486. Arm D reaches **100%**, not the 59.8% its global
figure showed — all 80 of its unanchored claims were in pages it had been forbidden to touch. The
directions are unchanged; the magnitudes were not.

The exclusion is a flag on the gate rather than a convention, because a convention is exactly what
failed here.

### Arm D has no QA number

The public 30 were spent across four arms. Giving arm D a comparable figure means re-running all
five, which has not been done. Nothing here says whether arm D helps a reader more than arm C —
only that it is more anchored, equally covered, and slightly larger, for five percent more.
