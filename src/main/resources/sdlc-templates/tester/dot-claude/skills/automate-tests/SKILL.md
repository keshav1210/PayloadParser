---
name: automate-tests
description: Turn written test cases into automated tests with the project's test framework, following its existing structure, then run them and record where each one lives. Use when asked to automate test cases or write automated UI, API or end-to-end tests for a story.
argument-hint: "<test case IDs, a TC file or a story ID>"
disable-model-invocation: true
context: fork
agent: test-automation
---

# Automate test cases

{{#if workspace}}
> Workspace: first decide which service this is about (ask if unclear), then run every git, build and
> test command inside that service's folder (`git -C <service> …`, `cd <service> && …`), as described in
> `.claude/rules/workspace.md`.

{{/if}}Cases to automate: $ARGUMENTS

If nothing was given, reply asking which test cases to automate, and stop.

1. Read the test cases in `docs/sdlc/testing/test-cases/`. Skip cases marked "Manual only" and say why they
   were skipped. If a case is too vague to automate (missing data or expected result), list it instead of
   guessing.
2. Find the test setup: the rules in `.claude/rules/testing/`, the existing automated tests, their helpers,
   page objects, fixtures and test data builders. Reuse them; don't create a parallel structure.
3. Write the tests as described in your instructions, one automated test per test case, named or tagged with
   the case ID.
4. Run the new tests. Fix problems in the tests themselves. If a test fails because the product behaves wrongly,
   leave the test failing, don't change product code, and collect the evidence for a bug report.
5. In the test case file, set each case's Automation line to `Automated in <path>`. Update the "Automated test"
   column in `docs/sdlc/testing/traceability-matrix.md`.

Reply with: tests created (file · test name · case ID) · run result · product bugs found, with evidence, for
`/bug-report` · cases skipped and why.
