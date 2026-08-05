---
type: Contract
title: Packet and preflight
description: The terminal-slice-packet v1/v2 shape and the eight preflight checks that must all pass before any gate runs — target repo, entrypoint containment, expected HEAD, live lease, allowed paths, hash-bound claim set and TDD receipts.
tags: [terminal-operator, preflight, contract]
node_kind: RepoDoc
ingest_lane: concept
repo: local/agent-skills-repo
commit: 5d3c42f
covers: [terminal-slice-packet, preflight-checks, write-lease]
libraries: []
generated_by: claude-code+opus (skill-bettor openwiki port)
generated_at: null
---

# Packet and preflight

A terminal slice is authorised by a JSON packet, and `repo-preflight.ts` decides whether that
authorisation is still valid. Every check returns the same triple — id, status, detail
(src: .agents/skills/repo-terminal-operator/repo-preflight.ts `export type PreflightCheck = { id: string; status: "passed" | "failed"; detail: string };`)
— so the receipt is a flat list a reader can scan.

## The packet

Two versions are accepted (src: .agents/skills/repo-terminal-operator/repo-preflight.ts `schema_version: "terminal-slice-packet@v1" | "terminal-slice-packet@v2";`).
V1 carries the target repo, an entrypoint argv, allowed paths and a write lease with an expiry and an
expected HEAD. V2 adds two evidence bindings: a hash-pinned claim set
(src: .agents/skills/repo-terminal-operator/repo-preflight.ts `claim_set?: { ref: string; sha256: string };`)
and an agentic-execution block naming red/green TDD receipts and minimal-diff assertions
(src: .agents/skills/repo-terminal-operator/repo-preflight.ts `tdd: { red_receipt: string; green_receipt: string; tests_immutable_during_green: boolean };`).

The runner needs more fields than preflight does, and refuses a packet missing any of them
(src: .agents/skills/repo-terminal-operator/small-loop-runner.ts `throw new Error("terminal packet is missing runner fields");`).

## The eight checks

| id | Passes when |
|---|---|
| `input-contract` | an external schema validator exits 0 for the detected version |
| `input-readable` | the file parses to a non-array object |
| `target-repo` | the packet's target resolves to this operator's own repository |
| `entrypoint-reachable` | `bun run <script>`, real path inside the workspace, regular file |
| `expected-head` | the packet's head equals `git rev-parse HEAD` |
| `live-lease` | the expiry parses and is in the future |
| `allowed-paths` | no path is absolute or escapes the output repo |
| `claim-set` / `agentic-tdd-receipt` | v2 evidence bindings hold; **automatically pass on v1** |

Version detection defaults to v1 rather than failing
(src: .agents/skills/repo-terminal-operator/repo-preflight.ts `const schema = raw?.schema_version === "terminal-slice-packet@v2" ? "terminal-slice-packet@v2" : "terminal-slice-packet@v1";`),
and the two v2 checks short-circuit as passes for v1
(src: .agents/skills/repo-terminal-operator/repo-preflight-evidence.ts `if (packet.schema_version !== "terminal-slice-packet@v2" || !packet.claim_set) return result("claim-set", true, "not required by v1");`).

(inferred) Reporting a v1 packet's evidence checks as `passed: "not required by v1"` rather than
omitting them keeps the receipt's shape constant across versions — a consumer counting eight passes does
not have to know which schema produced them. The cost is that "passed" here means "not applicable",
which is why the detail string carries the reason.

## Containment is checked twice: by path and by realpath

The containment predicate rejects an escaping relative path
(src: .agents/skills/repo-terminal-operator/repo-preflight.ts `return !isAbsolute(local) && local !== ".." && !local.startsWith(`) and every
path check is applied both to the resolved path and to its `realpathSync` form
(src: .agents/skills/repo-terminal-operator/repo-preflight-evidence.ts `if (!contained(realpathSync(workspaceRoot), realpathSync(claimSetPath))) throw new Error("claim-set realpath escapes workspace");`).

(inferred) One check without the other is defeatable: a lexical check alone is bypassed by a symlink
inside the tree pointing out of it, and a realpath-only check accepts `../../x` when it happens to
resolve back inside. Doing both is the cheap way to close the pair.

The entrypoint is constrained to a fixed argv prefix
(src: .agents/skills/repo-terminal-operator/repo-preflight.ts `return failed("entrypoint-reachable", "entrypoint must begin with bun run <script>");`),
so a packet cannot smuggle an arbitrary command through it.

## The claim set is bound three ways

`claimSetCheck` requires the file's SHA-256 to equal the packet's, an external validator to exit 0, and
the claim ids in the file to equal the packet's list *in order*
(src: .agents/skills/repo-terminal-operator/repo-preflight-evidence.ts `return JSON.stringify(claimSet.claims.map((claim) => claim.claim_id)) === JSON.stringify(expected);`),
combined in one predicate
(src: .agents/skills/repo-terminal-operator/repo-preflight-evidence.ts `return actualSha === expectedSha && exitStatus === 0 && idsMatch;`).

(inferred) The hash alone would prove the file did not change; the id list alone would prove the packet
and file agree on scope. Together they prove the packet is authorising *these* claims from *this* file —
the property that makes a later receipt attributable.

## The TDD receipt must describe a real red-then-green

Six conditions must hold at once
(src: .agents/skills/repo-terminal-operator/repo-preflight-evidence.ts `return receipt.terminal_slice_id === packet.terminal_slice_id`): the
receipt names the same slice, red failed *as expected*, no test file changed during green
(src: .agents/skills/repo-terminal-operator/repo-preflight-evidence.ts `&& receipt.red?.status === "failed-as-expected" && receipt.red.test_files_changed_during_green === false`),
green passed, the diff stayed inside allowed paths with no unrelated refactors, the packet asserts test
immutability, and — the sharp one — the red and green receipt paths must be identical
(src: .agents/skills/repo-terminal-operator/repo-preflight-evidence.ts `&& receipt.minimal_diff.unrelated_refactors === false && paths[0] === paths[1]`).

(inferred) Requiring one file for both phases is what makes "the tests did not change" checkable. Two
separate receipts could each be internally consistent while describing different test files; a single
document that records both states cannot.

## Where it is invoked

`repo-adapter.ts --preflight` for the standalone gate, and twice inside `--run` — see the ordering
invariants in [Terminal operator overview](overview.md). Failed checks become receipt failures with a
`policy` kind (src: .agents/skills/repo-terminal-operator/small-loop-receipt.ts `export function preflightFailures(checks: PreflightCheck[]): Failure[] {`).

## Related

- [Code-quality profile](code-quality-profile.md) — the first gate preflight unlocks.
- [Production profiles and evidence](production-profiles-and-evidence.md) — what the second gate must produce.
- [Shared primitives](shared-primitives.md) — the subprocess contract every gate result is judged against.
