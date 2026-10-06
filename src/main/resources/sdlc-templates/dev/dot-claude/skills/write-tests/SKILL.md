---
name: write-tests
description: Add missing automated tests for existing code (a class, function, file or module), covering normal behaviour, edge cases and errors, in the project's own test style. Use when asked to add tests, improve coverage, or test existing code.
argument-hint: "<file, class, function or module>"
---

# Write tests for existing code

{{#if workspace}}
> Workspace: first decide which service this is about (ask if unclear), then run every git, build and
> test command inside that service's folder (`git -C <service> …`, `cd <service> && …`), as described in
> `.claude/rules/workspace.md`.

{{/if}}Target: $ARGUMENTS

If no target was given, ask what to test, and stop. Change only test files.

## 1. Learn what to test and how

- Read the target code and what calls it, so you know its intended behaviour, not just what the code does.
  Requirements in `docs/sdlc/02-requirements/` help when they exist.
- Read the existing tests for this area and one or two nearby test files. Use the same framework, folder,
  naming, assertion style, fixtures and mocking approach.

## 2. List the cases first

Show a short list of the behaviours you'll test before writing:

- the normal cases;
- boundaries: empty, null or missing values, zero, maximum sizes, first and last items;
- invalid input and error paths;
- permissions or state rules, if any.

Skip cases already covered by existing tests.

## 3. Write and run

- One behaviour per test, with a name that says what's expected. Test through the public interface.
- Mock only what's slow or external (network, time, randomness, third-party services), the way the project
  already does.
- Run the new tests, using the `test-runner` agent to keep output short.

## 4. If a test reveals a bug

Don't change production code to make a test pass. Report the bug with the failing test, the expected and the
actual result, and ask how to proceed (fix it now with `/fix-bug`, or mark the test as a known failure the way
the framework allows).

## 5. Report

Tests added (file and test names) · behaviours covered · test run result · bugs found · cases you skipped and why.
