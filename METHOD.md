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

## Arm A — baseline (`wiki/baseline/`)

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

## Arm B — anchored (`wiki/candidate/`)

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

## Arm C — the configuration this repository does **not** contain

The port's skill was also modified: the anchoring appendix is now referenced at the generation
step, alongside the official system prompt and the other appendices. A fresh run of that skill
would therefore produce anchors **while writing**, rather than acquiring them afterwards.

**That path has never been executed.** The target's run metadata still records the baseline
run, unchanged. Everything measured here is arm B — a retrofit over finished pages.

The distinction is not cosmetic, and it inverts the most important prior in this repository:

| | arm B, measured | arm C, unmeasured |
|---|---|---|
| when the anchoring cost is paid | after the pages exist | while deciding what to write |
| what a bounded author can trade away | nothing — the pages are already written | **scope**, which is exactly what the prior says happens |
| coverage squeeze possible? | **structurally no** | **yes, and it was measured once at 6 pages → 3** |

So arm B did not survive the squeeze; it was **never exposed to it**. The +13.3pp measured here
belongs to the retrofit and does **not** transfer to a skill-generated wiki. Anyone wiring the
appendix into their generation step is entering the configuration
[`data/prior-anchoring-squeezes-breadth.md`](data/prior-anchoring-squeezes-breadth.md) warns
about, with no measurement of it in this repository — and should ship a coverage gate beside it
before believing any anchor-rate number it produces.

Measuring arm C means running the modified skill cold on the same target and comparing coverage
and cost against arm A. That has not been done.
