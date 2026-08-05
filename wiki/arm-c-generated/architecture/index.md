# Files

- [Data authority](data-authority.md) - Which artifact in this repository is hand-written, which is generated, and which is generated and then byte-compared — plus the regeneration command and the current authority drift for each.
- [Defense gate chain](defense-gate-chain.md) - How scripts/git_gate.py composes 22 local gates, hashes the repository before and after to prove the run was side-effect free, and emits a typed receipt — including the 22-vs-23 drift that makes the receipt fast path unusable today.
- [Repository architecture](overview.md) - What agent-skills-repo is — a skill-asset governance seed whose five layers are skill assets, deterministic gates, structured evidence data, a vendored terminal operator, and this gate-pinned wiki.
