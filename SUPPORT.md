# Support

This project is a research artifact maintained on a best-effort basis.

## Use issues for

- reproducibility failures;
- minimal harness bugs;
- documentation errors;
- proposed fixtures or negative controls;
- experiment-design questions tied to a concrete claim;
- contributor onboarding blockers.

Include the exact commit, environment, command, exit code, and smallest relevant output.

## Do not use public issues for

- security vulnerabilities before coordinated disclosure;
- credentials, proprietary target code, private prompts, or personal data;
- general support for third-party agent CLIs;
- claims that cannot be connected to repository evidence.

See [`SECURITY.md`](SECURITY.md) for security reporting and [`REPRODUCE.md`](REPRODUCE.md) for the reproduction template.

## Response expectations

There is no service-level agreement. High-priority reports are those that show:

1. a documented command fails on a clean environment;
2. a negative control passes unexpectedly;
3. a receipt can be forged or becomes stale;
4. execution crosses the documented filesystem boundary;
5. a headline conclusion is contradicted by its raw data.

A complete minimal reproduction is more useful than urgency language without evidence.
