# Deterministic Reproduction Bundle

Run from the repository root:

```sh
sh reproduction/recompute.sh
```

This bundle reproduces deterministic harness behavior only. It verifies protocol and fixture hashes, regenerates positive and hollow-anchor receipts, and compares them byte-for-byte with expected outputs.

It does not regenerate the original stochastic model experiment. See [`provenance.json`](provenance.json) and the repository-level [`REPRODUCE.md`](../REPRODUCE.md) for the exact boundary.
