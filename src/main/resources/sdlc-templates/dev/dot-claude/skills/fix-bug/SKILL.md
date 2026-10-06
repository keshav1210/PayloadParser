---
name: fix-bug
description: Fix a bug by reproducing it, finding the root cause, adding a test that fails without the fix, and making the smallest correct change. Use when the user asks to fix a bug, an error or a failing test.
argument-hint: "<bug ID, error message or description>"
disable-model-invocation: true
---

# Fix a bug

{{#if workspace}}
> Workspace: first decide which service this is about (ask if unclear), then run every git, build and
> test command inside that service's folder (`git -C <service> …`, `cd <service> && …`), as described in
> `.claude/rules/workspace.md`.

{{/if}}Bug: $ARGUMENTS

If nothing was given, ask for the bug ID, error message or steps to reproduce, and stop.

## 1. Understand it

- If it's an ID, read the bug report (in `docs/sdlc/testing/bugs/` if that folder exists, or the tracker
  link the user gave). Note the expected and actual behaviour and the steps to reproduce.
- Read stack traces and logs the user provided. Find the code involved.

## 2. Reproduce it

Write an automated test that reproduces the bug and fails. If that isn't practical (UI-only, environment
issue), describe exact manual steps and confirm what you observe. Don't fix what you can't reproduce or
explain; tell the user what you found instead and ask for more detail.

## 3. Find the root cause

Trace why it happens, not just where it shows up. If the cause isn't clear after reading the code involved,
hand the investigation to the `debugger` agent with the error, the trace and your reproduction. Explain the
cause in 2-3 sentences with `file:line`. Check whether the same mistake exists elsewhere (Grep for the
pattern) and mention any other places.

## 4. Fix it

- Make the smallest change that fixes the cause. Don't refactor around it.
- Run the reproduction test (it must pass now) and the existing tests for the area, using the `test-runner`
  agent. Show the command and the result summary. Never change a test's expectations just to make it pass unless the test itself was wrong,
  and then say so.

## 5. Report

Reply with: root cause · the fix (files changed) · the test that proves it · test results · other places with
the same problem · anything that needs a follow-up. If a bug report file exists, update its status to Fixed
with the root cause and the fix.
