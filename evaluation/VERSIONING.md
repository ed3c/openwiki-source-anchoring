# Task and Result Versioning

Version independently:

- manifest schema;
- task-bank schema;
- task-bank content hash;
- prompt and configuration hashes;
- result schema;
- analysis code;
- source repository snapshot;
- generated documentation output.

A changed acceptance criterion creates a new task-bank version. A spent public or holdout split is never reset by renaming it. A corrected raw record is appended with supersession metadata; it is not silently overwritten. Derived summaries identify every input hash used to compute them.
