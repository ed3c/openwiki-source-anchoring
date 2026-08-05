<div align="right">

**English** · [繁體中文](METHOD.zh-TW.md)

</div>

# How each arm was produced

Both wikis document the same repository at the same commit. Only the second one was anchored.

---

## Where the pipeline came from

This line of work started from one instruction:

> Take the prompts and usage from `<projects>/openwiki` and rewrite `kb-ingest` and the
> `repo-wiki-converge` skill back to the official design. Interrogate the correct way to use
> openwiki, then migrate it to Claude Code and Codex CLI with **NO API KEY**.

"No API key" is the constraint that shapes everything else. The upstream `openwiki` CLI was
never installed and no provider key was ever set. The official prompts are extracted verbatim
from the upstream repository by a generator, and the **executing agent is the host CLI session
itself** — the same subscription an engineer already uses interactively.

That has a cost worth stating: this cannot show whether either wiki resembles what upstream's
own binary would emit. It can only show what the official *procedure* produces when a host
session runs it.

---

## Arm A — baseline (`wiki/arm-a-baseline/`)

### Prompt integrity

The official prompts are not paraphrased, summarised, or hand-copied. A generator extracts
them byte-for-byte from the upstream source into a directory that holds **upstream bytes only**
— seven assets, no hand-written file, not even a note. A `--check` mode re-extracts and diffs,
so "the prompt text is byte-identical to upstream" is a falsifiable claim rather than a promise.

Everything this port adds lives in a separate directory as appendices. The anchoring rules in
[`harness/anchor-extension.md`](harness/anchor-extension.md) are one of them. **No official
byte was edited to produce either arm.**

A distilled predecessor existed and was retired: it had compressed the official instruction
into "≤8 pages, 800–1200 words", which is the *opposite* of the official rule (*"do not target
a page count or page length"*), and had dropped all three review gates in the process. That
retirement is why prompt integrity is enforced by a generator now rather than by discipline.

### Generation

The session read `init.system.md`, its paired user prompt, and the local appendices, then
followed the official Init workflow step by step:

1. Build the map first; write a skeleton file before any prose.
2. Rank components; ranking controls exploration order, never whether something is covered.
3. **`skeleton_critic`** — a hard-isolated subprocess that must map the repository
   *independently before it is allowed to read the skeleton*. Reviewing the skeleton inside
   the same session does not work: a session anchored on its own skeleton cannot see what the
   skeleton omits. Every returned request becomes a TODO; the critic is re-invoked exactly
   once and never a third time.
4. Fill every page. A passing mention or a directory listing is not coverage.
5. **`wiki_question_finder`** — separate subprocess, reads **only source**, never the wiki, so
   its questions cannot be shaped to suit what happens to be written.
6. **`wiki_answer_verifier`** — separate subprocess, reads **only a snapshot of the wiki**,
   never the source, so it cannot answer from the code and call the wiki adequate.
   Batches of 2–3 launched concurrently per wave; PARTIAL/FAIL repaired, then only those ids
   re-verified.
7. Deterministic post-processing: mermaid validation with in-place degradation, directory
   index generation, internal link checking with broken links marked rather than removed,
   and a run metadata file.

The read boundaries in steps 3, 5 and 6 are enforced by **process isolation**, not by
instructions. A subagent told not to look at something, in a session that can see it, is not
a boundary.

### Result

44 pages. Three gates satisfied, zero broken links, zero half-written pages, run status
success — and 53 statements that contradict the source, which no step above can detect,
because no step compares a sentence to the file it describes.

---

## Arm B — anchored (`wiki/arm-b-retrofit/`)

**Update, not regeneration.** Arm B starts as a byte copy of arm A and is edited in place.
Regenerating would have discarded a 93.8%-coverage artifact that already passed three gates,
and would have confounded "anchoring" with "a second roll of the generation dice". The
constraint traces to a measured prior in
[`data/prior-anchoring-squeezes-breadth.md`](data/prior-anchoring-squeezes-breadth.md).

### Per-page procedure

Each page is handled by one agent that receives:

| input | source |
|---|---|
| the page, and only that page | it may edit nothing else |
| **its unanchored claims** | emitted by the gate, never self-reported |
| the anchor contract | [`harness/PROMPT.md`](harness/PROMPT.md) and [`harness/anchor-extension.md`](harness/anchor-extension.md), **by pointer** |
| accumulated lessons | discoveries returned by earlier runs |

The contract is passed by pointer rather than pasted. A driver handed a full declarative
contract reads it as a specification and does not act — a failure mode already recorded in
this codebase before this experiment.

The agent then rewrites each unanchorable claim. Where the claim is merely undocumented, it
gains an anchor. **Where the claim turns out to be false, the sentence is rewritten to the true
fact and anchored to that** — which is how all 53 corrections were found. Rewriting to the
truth adds words, so it never conflicts with the rule below.

Before returning, the agent re-runs the gate and confirms its page appears in neither
`invalid_anchors` nor `unanchored_claims`.

### Constraints enforced mechanically, not by instruction

- **Word count may not drop.** Deleting an unanchorable sentence raises the anchor rate by
  shrinking its denominator — the cheapest possible cheat, and it must be blocked rather than
  discouraged.
- **Rationale is exempt**, marked `(inferred)`, and excluded from the anchor-rate denominator.
- **No anchor into the wiki's own output.** The target contains both a copy of this wiki and
  the review transcripts; anchoring there is circular and is a hard failure.
- **Retry budget 3, then degrade** — the page is kept, the unresolved items are recorded for
  human review, and the page is never deleted or rolled back.

### The three runs

| run | pages | lessons carried in | new lessons out | corrections found |
|---|---|---|---|---|
| 1 | 4 | 4 seeds written by hand | 18 | 2 |
| 2 | 5 heaviest remaining | 17 | 5 | 9 |
| 3 | 24 remaining | 19 | 67 | 42 |

Each run is: one audit agent → N page agents in parallel → one audit agent. Page agents within
a run receive a **frozen** copy of the lesson list, so a run has no internal ordering
dependence; lessons cross between runs, not within one.

Runs 2 and 3 were preceded by fixing what run 1 exposed in the gate itself — the circular
evidence hole before run 2, the malformed-anchor and pseudo-anchor holes before run 3. The gate
was repaired between runs, never during one.

### Models

**Honest gap.** The page agents inherited the session model — an Opus-class model — and were
**not pinned**. Only the QA layer records fixed models. Anyone reproducing this should pin the
authoring model too; a different model here plausibly yields a different anchor count and a
different correction count, and this repository cannot separate those.

---

## The QA measurement

Fully pinned, unlike the above. See [`qa/holdout-result.json`](qa/holdout-result.json):

```json
{"finder_model":"sonnet","answerer_model":"sonnet","judge_model":"opus",
 "split_rule":"sort by id, even index -> public, odd index -> holdout","holdout_runs":1}
```

Four finder agents wrote 15 questions each from source, with the wiki and the review
transcripts explicitly out of bounds. The bank was split by sorted id — even to
[`qa/bank-public.json`](qa/bank-public.json), kept for future iteration; odd to
[`qa/bank-holdout.json`](qa/bank-holdout.json), marked `spent: true` because re-running it on
an iterated wiki makes the number meaningless.

Each holdout question was answered twice, once per arm, by agents that could read one wiki and
not the source. A judge graded anonymous alpha/beta pairs with the mapping alternating per
batch, and returned only PASS/PARTIAL/FAIL. Totals were computed by script; the judge never
saw one.

---

## What cannot be reproduced from this repository alone

- **The target repository is not published here.** Both wikis describe it; anchors reference
  its paths. Without it the gate can be read but not run against real content.
- **The host pipeline lives elsewhere.** This repository publishes the anchoring layer, not
  the openwiki port that produced arm A.
- **Arm A cannot be regenerated from here.** The official prompt assets are upstream's and are
  extracted by a generator that is not part of this publication.

What *is* reproducible here: the gate, its self-test, the circuit breaker, the question bank,
and every number reported — all of them recomputable from the two published wikis.

---

## Arm C — anchored during generation (`wiki/arm-c-generated/`)

**Cold run of the modified skill.** The anchoring appendix is referenced at the skill's
generation step, so this arm produces anchors while writing rather than acquiring them
afterwards. It is the configuration anyone adopting the appendix would actually be running.

### Isolation

The target is a **copy** of the repository. Two paths that would have leaked arm A were removed
from it before the run: the 42 review transcripts under `.openwiki-review/`, which contain arm
A's skeleton and its QA questions, and arm A's eight generated section directories,
`quickstart.md`, `index.md` and run metadata. `openwiki/nonofficial/` was kept — those pages are
the repository's own hand-written content and arm A had them too, so removing them would have
broken comparability rather than protected it.

The generating agent was forbidden to read arm A's copy or the sandbox, and **its prompt carried
none of this work's findings** — not the gate count, not the 53 corrections, not the fact that
the anchor form works. It was given the skill, the target, and the boundaries.

### What it did

It completed the whole Init workflow: preflight, evidence gate, skeleton, `skeleton_critic`
twice, 26 pages, an unknown-unknown pass, `wiki_question_finder` once, `wiki_answer_verifier`
across four batches and three retry waves to 10/10, quickstart, skeleton deletion, finalize.
`stopped_because` records *"Nothing ran out."*

It wrote 590 anchors and 77 `(inferred)` markers, and verified them with a checker it wrote
itself, re-run after every page.

### The result, and what it means

| | arm B, gate-driven retrofit | arm C, convention-only generation |
|---|---|---|
| anchors written | 486 | **590** |
| anchor rate | **100%** | **27.2%** (41.3% excluding inherited pages) |
| invalid anchors | 0 | 2 |

Arm C wrote more anchors and reached less than half the rate. The cause is visible in its own
notes: it never ran the gate. Its checker counted anchors *written*; the gate reports claims
*still unanchored*. Those are different questions, and only the second one tells an author where
they are not finished.

**So the appendix buys about 41% and the gate-driven loop buys the rest.** The skill as modified
wires in the author-side convention and not the mechanical feedback, which makes it half a
mechanism. That is a defect in the skill, not in this run.

Both invalid anchors point into `openwiki/nonofficial/` — the wiki's own output, which the
appendix explicitly forbids as circular evidence. Arm C's checker had no such rule and therefore
self-reported zero bad anchors. A rule stated in the prompt and absent from the tool is decided
by the tool.

### Independently rediscovered

Arm C's notes record that a checker must compare `(src:` occurrences against regex matches,
because a malformed anchor otherwise disappears silently. That is the same silent-pass hole this
work found and fixed, reached by an agent that had never seen the finding — which makes it a
property of the anchor form rather than a one-off bug.

### On the coverage squeeze

The prior predicts that paying the anchoring cost during generation makes a bounded author
narrow scope. Arm C covered 32/32 entrypoints against arm A's 30/32, wrote 20% more words, and
completed. The six entries in its `what_was_cut` are reasoned deferrals recorded as Backlog
items, not silent narrowing.

**This is not a clean refutation.** Arm A came from an earlier session and a different model
generation, so the honest statement is that no squeeze was observed under arm C's conditions.

### Side effect worth knowing

Creating `openwiki/quickstart.md` is what flips the target's own `check_openwiki.py` from failing
to passing, which unblocks its commit gate. Arm A's target had been sitting in a failed gate
state for the duration of this work.

### Cost

563K subagent tokens and 74 minutes for generation *and* measurement, against roughly 2.88M for
the retrofit across three workflows. On this target, anchoring while writing is substantially
cheaper than anchoring afterwards — but the retrofit is what reached 100%, so the two are not
interchangeable at equal quality.
