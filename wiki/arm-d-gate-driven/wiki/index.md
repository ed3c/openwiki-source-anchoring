# Files

- [The openwiki contract — which documentation is gate-pinned](openwiki-contract.md) - How check_openwiki.py and openwiki.yaml turn documentation into a checked artifact, which pages are pinned by literal, which by existence, and which page may never be edited by hand.
- [Wiki-to-graph sync — Markdown, event log, graph projection](wiki-graph-sync.md) - The local-first event-sourced projection from openwiki Markdown into a node/edge/chunk graph with license provenance, its schema contract, the opt-in external Graph DB writer, and the gate that re-runs the whole thing into a temp directory.
