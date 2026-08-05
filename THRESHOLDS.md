<div align="right">

**English** · [繁體中文](THRESHOLDS.zh-TW.md)

</div>

# Thresholds, fixed before the first measurement

Committed as `21374d6` on 2026-08-04, titled *"freeze thresholds and baseline before any
measurement"*, in the same commit as the untouched baseline snapshot. Every number below
existed before any of them had been computed.

The order matters more than the values. A threshold chosen after seeing a result gets chosen
wherever the result landed, with a plausible reason attached — that moves the *judgement*
rather than the metric, and afterwards it is invisible. Publishing the thresholds without the
commit that fixed them would be exactly the unverifiable claim this repository criticises
elsewhere.

## The six

| # | metric | baseline | threshold | judged by |
|---|---|---|---|---|
| 1 | anchor rate — share of eligible claims carrying a valid anchor | 0.0% | **≥ 85%** | script |
| 2 | **anchor correctness** | n/a (no anchors) | **100%**, zero tolerance | script |
| 3 | entrypoint coverage | 30/32 | **≥ 30/32** | script |
| 4 | QA holdout PASS rate | 30.0% | **≥ baseline + 10pp** | fresh judge, blind |
| 5 | degraded pages | n/a | **≤ 5**, each recorded for human review | script |
| 6 | verifiable share — eligible claims / (eligible + `(inferred)`) | — | **≥ 40%** | script |

## Rules attached to them at freeze time

**Raise only, never lower.** Threshold 3 was later raised from 90% to the measured baseline of
30/32 once that value was known. No threshold was ever lowered, and lowering one to fit a
result would void the run rather than pass it.

**Threshold 2 points the opposite way to the rest.** Every other metric rewards writing more.
This one punishes writing carelessly. An anchor that names a real file but does not support the
sentence it sits in is worse than no anchor, because it makes a reader stop checking.

**Threshold 6 is the counterweight to threshold 1.** Rationale is exempt from anchoring by
design — demand an anchor for every "why" and the wiki degrades into an API reference. Six
bounds how much of a page may be exempt, so the exemption cannot swallow the page.

**Green is a candidate, not a merge.** All six passing means the artifact is eligible for human
review. It has never meant ship.

## Recorded amendments

| when | what | why it is legitimate |
|---|---|---|
| before measuring | threshold 3 raised 90% → 30/32 | the baseline turned out to already exceed the proposed floor; raising is allowed, and leaving it low would have let the new arm regress silently |
| before measuring | the anchor **form** changed from `path:line` to `path` + verbatim quote | the official prompt this port may not edit instructs *"prefer stable paths and symbol names over line numbers"*; the threshold **values** were untouched |
| after measuring | one published claim **withdrawn** | see [`FINDINGS.md`](FINDINGS.md) — an early conclusion that the update-mode arm had survived the coverage squeeze was withdrawn once it was clear that setup is structurally incapable of exhibiting it |

## What is deliberately not a threshold

**Length.** The anchored wiki is 19.2% longer, and nothing gates that. It is a real cost —
this wiki is read into an agent's context, so every added word is paid on every read — and it
was noticed after the freeze. It is recorded as a gap rather than retrofitted, because adding a
seventh threshold after seeing results is the exact move the freeze exists to prevent. It
belongs in the next preregistration, not this one.

## How each arm scored against them

| # | metric | arm A | arm B | arm C |
|---|---|---|---|---|
| 1 | anchor rate ≥ 85% | 0.0% ✗ | **100% ✓** | 27.2% ✗ |
| 2 | anchor correctness 100% | n/a | **✓** | 99.7% ✗ |
| 3 | entrypoint coverage ≥ 30/32 | 30/32 ✓ | **32/32 ✓** | **32/32 ✓** |
| 4 | QA holdout ≥ baseline +10pp | — | **+13.3pp ✓** | not measured |
| 5 | degraded pages ≤ 5 | n/a | **0 ✓** | 0 ✓ |
| 6 | verifiable share ≥ 40% | — | **96.7% ✓** | 95.1% ✓ |

Only arm B passes. Arm C was measured against the same thresholds it was never given feedback
against — it never ran the gate — which is the finding rather than a mark against it.

Threshold 4 has no arm C entry and cannot get one: the holdout was spent on A versus B, and
reusing it would void the number for every arm. The public half of the bank exists for this.

## What an outside reviewer cannot check

Commit `21374d6` lives in the **private host repository**, not here, so nobody outside can
resolve it. The ordering claim on this page is therefore **not externally verifiable**, and
saying so is better than implying otherwise by citing a hash that leads nowhere.

There is also a wording conflict this page carried: it said every number existed before any was
computed, and separately that threshold 3 was raised to the measured baseline of 30/32 **after**
that baseline was known. Both are true, and the second is a legitimate baseline-relative rule —
but the first sentence, stated flatly, was wrong. Threshold 3 is a **relative** floor fixed after
one measurement; the other five are absolute and predate all of them.

Closing this properly needs a preregistration directory published here with its own hash and a
signed release, not a reference to a commit only the author can see.
