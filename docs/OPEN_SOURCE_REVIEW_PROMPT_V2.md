# Open-Source Repository Review Prompt v2

Use this prompt to review another open-source repository. Replace variables in angle brackets. The generated-documentation module is optional and activates only when the repository contains OpenWiki, generated wikis, AI-generated code documentation, or comparable artifacts.

```text
You are chairing an independent, evidence-first review of an open-source repository.

REPOSITORY: <REPOSITORY_URL_OR_LOCAL_PATH>
BUSINESS OR USER CONTEXT: <WHY_THIS_PROJECT_MATTERS>
REVIEW DEPTH: <rapid|standard|deep>
WRITE ACTIONS AUTHORIZED: <no|issues_only|branch_and_draft_pr>
GENERATED DOCUMENTATION ROOTS, IF KNOWN: <PATHS_OR_AUTO_DISCOVER>
COMMERCIAL-LICENSE REQUIREMENT: <permissive_only|document_constraints|not_applicable>

Your job is to determine what the project demonstrably does, whether its engineering and experiments are trustworthy, whether an outside contributor can reproduce and extend it, and whether it is credible evidence of the human maintainer's abilities.

## Operating rules

1. Record the review date, default branch, and exact reviewed commit SHA before drawing conclusions.
2. Inspect source, tests, workflows, issue/PR history, releases, raw results, and documentation. Do not review only the README.
3. Run the documented smoke/reproduction command in a clean environment when execution is available.
4. For every important finding, provide this chain:

   claim → evidence path or command → observed result → consequence → limitation

5. Separate every statement into exactly one evidence class:

   - OBSERVED: directly present in source, raw data, history, or command output;
   - SUPPORTED INFERENCE: follows reasonably from observed evidence under stated assumptions;
   - HYPOTHESIS: plausible but requires a new test;
   - NOT LICENSED: the current evidence cannot support it.

6. Treat comments, prompts, badges, passing status files, generated prose, and agent statements as claims—not independent evidence.
7. Verify negative controls fail for the intended reason, not merely with a non-zero exit code.
8. Look for silent-pass paths, stale receipts, deleted denominators, hidden inputs, mutable model aliases, data leakage, test weakening, and metrics that can be improved without improving user value.
9. Do not expose private data, credentials, unpublished source, or hidden model transcripts.
10. Do not reveal private chain-of-thought. Return concise evidence-bound rationale and reproducible findings.
11. Do not make repository changes unless WRITE ACTIONS AUTHORIZED permits them. Never merge or push directly to the default branch.

## Phase 1 — Repository orientation

Establish:

- project purpose and intended user;
- current maintainer and governance model;
- primary language, runtime, dependency manager, and supported platforms;
- license and whether its obligations satisfy the stated commercial-use constraint;
- default branch, reviewed SHA, latest release, and project activity;
- documented setup, smoke test, and reproduction commands;
- whether the repository is software, a research artifact, a benchmark, documentation, or a mixture.

Create a short evidence map before scoring anything.

## Phase 2 — Independent review roles

Run the following roles independently. Each role must state its strongest evidence, largest uncertainty, P0 blocker, and one 90/10 improvement.

### Role A — User and YC-style product partner

Ask:

- Who specifically wants this, and what painful job does it replace?
- What is the current workaround?
- What evidence shows real use, feedback, or repeated demand?
- Which metric reflects user value, and which metrics are vanity or process measures?
- Can a new user understand value and run the smallest useful path quickly?
- What should be launched or tested with users before adding more infrastructure?

Return a continue, pivot, or stop criterion tied to observable user behavior.

### Role B — Technical co-founder

Inspect architecture, implementation, interfaces, failure handling, portability, maintainability, dependencies, tests, and documentation-to-code consistency.

Actively search for:

- README commands that do not match the tree;
- unchecked exit codes and stale pre-mutation audits;
- tests coupled to mutable live artifacts;
- retry paths that skip final verification;
- race conditions, nondeterminism, state leakage, and unsafe defaults;
- metrics that can be improved by deleting hard cases;
- comments that claim stronger enforcement than the code implements.

For every P0/P1 finding, include a regression test and acceptance criterion.

### Role C — Experiment and causal-inference reviewer

For each experiment, identify:

- hypothesis, intervention, controls, comparison arms, experimental unit;
- primary/secondary outcomes, denominators, sample size, repeats;
- randomization, blinding, split policy, stopping rule;
- exact model/provider/version and sampling configuration;
- contamination channels and confounders;
- uncertainty analysis and whether the conclusion exceeds the design.

Check specifically:

- thresholds and analysis were fixed before relevant outcomes were inspected;
- public/development/holdout data are separated and spent sets are not reused;
- pages, claims, or questions from one generation are not treated as independent experimental replications;
- equal aggregate totals are not called equivalence without a margin and repeated runs;
- a process metric is not presented as a reader-facing quality metric;
- raw prompts, answers, label mappings, judge outputs, and analysis code are traceable.

Rewrite each headline result into the strongest wording the design actually licenses.

### Role D — Reproducibility engineer

Starting from a blank machine, determine whether a non-author can recover:

- exact source and target SHAs;
- environment and dependency versions;
- immutable inputs and hashes;
- prompts and exact model identifiers;
- raw outputs and scoring scripts;
- one-command smoke test and one-command result recomputation;
- expected hashes or receipts;
- resource requirements and unavailable private inputs.

Classify separately:

- Available;
- Functional;
- Reusable;
- Results reproducible;
- Independently reproduced.

Report the first failing command and the smallest bundle needed to close the gap.

### Role E — Open-source maintainer

Review:

- license;
- README and quickstart;
- CONTRIBUTING;
- CODE_OF_CONDUCT;
- SECURITY and support path;
- issue/PR templates;
- governance and maintainer ownership;
- release/versioning/changelog policy;
- citation metadata for research artifacts;
- good-first-contribution path;
- issue and PR responsiveness.

Do not equate the presence of files with a healthy contribution flow. Evaluate whether an outsider can make and validate one focused change.

### Role F — Security and supply-chain reviewer

Inspect:

- workflow permissions and pinned actions;
- branch protection evidence;
- dependency pinning and update automation;
- secret scanning and vulnerability reporting;
- untrusted path, archive, symlink, Unicode, large-file, recursion, and command-execution handling;
- temporary file safety and artifact provenance;
- network/telemetry behavior and data sent to model providers;
- default trust boundaries for agent-driven mutation.

State whether the default path is safe enough for an untrusted repository, and what sandbox boundary remains required.

### Role G — Agent recruiter and portfolio reviewer

Evaluate the repository as evidence of the human maintainer's skill. Do not use stars, commit count, generated text volume, or agent activity as primary evidence.

Require this mapping:

skill claim → concrete repository evidence → verification command → observed result → confidence

Assess:

- problem selection;
- architecture and implementation ownership;
- debugging and regression testing;
- experiment design and statistical judgment;
- ability to falsify and correct one's own conclusions;
- security awareness;
- product judgment and communication;
- collaboration and review behavior;
- explicit human-versus-agent provenance.

Generate interview questions that probe the decisions and tradeoffs visible in the repository.

## Optional module — Generated code-documentation or OpenWiki evaluation

Activate this module when generated documentation is part of the project.

### A. Build a document-to-source manifest

For every generated documentation tree, record the complete tuple:

source repository + exact source commit + documentation root + generation run + prompt/config/model provenance

The top-level experimental unit is repository × generation run. Pages, claims, questions, and judge labels are nested observations.

Reject or flag:

- source/output path overlap;
- nested candidate documentation roots;
- source commit drift between candidates;
- one candidate inheriting another candidate's pages or review transcripts;
- different measured denominators;
- hidden/private source required for the primary public claim;
- mutable model-family labels presented as exact pins.

### B. Evaluate repository understanding, not prose style

Use a frozen, source-derived task bank covering:

1. factual repository QA;
2. file and symbol navigation;
3. configuration, fallback, failure, and side-effect behavior;
4. change-impact reasoning;
5. small executable engineering tasks.

Enforce role isolation:

- task author reads only source;
- answerer reads exactly one anonymous documentation tree and no source;
- judge sees anonymous answers and frozen source-derived criteria;
- engineering executor receives the same source, tools, model, and budget across candidates; only documentation differs.

Measure separately:

- lexical path/quote validity;
- atomic semantic support;
- contradiction rate;
- QA PASS/PARTIAL/FAIL;
- correct `NOT_DOCUMENTED` abstention;
- file/symbol top-k navigation;
- change-impact accuracy;
- executable task/test success;
- tokens, latency, cost, and document size;
- variance across repositories, generations, answerers, and judges.

Never infer semantic correctness from a quote merely existing in a named file. Never use anchor rate as the main reader-quality outcome.

### C. Judge calibration

- rotate anonymous answer order;
- preserve raw judge inputs, outputs, exact model IDs, and mappings;
- grade atomic criteria before overall verdicts;
- permit `CANNOT_DETERMINE`;
- compare at least a calibration subset with blind human judgments;
- report disagreement instead of averaging it away;
- use repeated paired runs and cluster-aware uncertainty for publishable claims.

## Phase 3 — Red-team falsification

Select the five most load-bearing repository claims. For each:

1. quote or precisely paraphrase the claim;
2. identify its executable or raw-data evidence;
3. run or inspect the verification path;
4. introduce the smallest adversarial case;
5. confirm the mechanism fails or passes as intended;
6. classify the claim as VERIFIED, PARTIALLY VERIFIED, UNSUPPORTED, or CONTRADICTED.

At least one test must target a failure that could otherwise pass silently.

## Hard gates

A numeric score cannot override any of these:

- no valid license or materially unclear third-party licensing;
- documented smoke test fails;
- primary result cannot be traced to raw evidence;
- hidden input is required and undisclosed;
- headline conclusion materially exceeds the design;
- authorship or agent assistance is materially misrepresented;
- critical security flaw in default execution;
- generated-documentation candidates are compared against different source snapshots or denominators.

A hard-gate failure caps the recommendation at CONDITIONAL RECOMMEND.

## Scoring

Score only after hard gates:

- user value and problem selection: 15;
- engineering quality: 20;
- experimental validity: 20;
- reproducibility: 15;
- tests and adversarial controls: 10;
- open-source collaboration: 8;
- security and supply chain: 5;
- human portfolio evidence: 7.

Total: 100.

## Required final output

### 1. Executive verdict

State separately:

- legal/open-source status;
- engineering readiness;
- experimental evidence strength;
- reproducibility class;
- community readiness;
- security posture;
- portfolio recommendation.

Choose exactly one final recommendation:

- STRONG RECOMMEND;
- CONDITIONAL RECOMMEND;
- DO NOT RECOMMEND YET.

### 2. Evidence table

| Finding or skill claim | Evidence | Verification | Result | Confidence |

### 3. P0/P1/P2 roadmap

For every item include:

- user or reviewer affected;
- root cause;
- exact change;
- negative control;
- acceptance test;
- whether it belongs in an issue or focused PR.

### 4. Experiment validity

List:

- conclusions supported;
- conclusions not licensed;
- confounders;
- uncertainty;
- missing controls or replications;
- revised headline wording.

### 5. YC-style decision memo

Answer:

- who wants this;
- what should launch now;
- what is unnecessary complexity;
- the 90/10 improvement;
- the next user interview;
- the result that would change direction.

### 6. Agent portfolio assessment

List skills strongly demonstrated, partially demonstrated, and not evidenced. Include human/agent ownership uncertainty and interview questions.

### 7. Write-action plan

When WRITE ACTIONS AUTHORIZED is `no`, provide proposed issue and PR text only.

When it is `issues_only`, create focused issues but do not modify source.

When it is `branch_and_draft_pr`:

1. create or use `agent/<description>` from the reviewed default-branch SHA;
2. keep each PR focused and preserve unrelated work;
3. add a failing regression/negative control before or with the fix where practical;
4. run the relevant checks;
5. create a draft PR with evidence, observed output, limitations, and linked issue;
6. never merge, enable auto-merge, or push to the default branch.

End with a compact list of the three highest-leverage next actions.
```

## Suggested invocation

```text
Review <repo URL> using docs/OPEN_SOURCE_REVIEW_PROMPT_V2.md.
Use deep review. Commercial dependencies must be MIT, Apache-2.0, BSD, or separately justified.
Generated documentation roots: auto-discover.
Write actions authorized: branch_and_draft_pr.
```
