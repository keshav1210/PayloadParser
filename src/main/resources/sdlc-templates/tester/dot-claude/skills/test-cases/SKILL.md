---
name: test-cases
description: Design test cases for a user story from its acceptance criteria using equivalence partitions, boundary values, decision tables, state transitions and negative and permission cases, saved in docs/sdlc/testing/test-cases/. Use when asked for test cases, test scenarios or QA coverage of a story.
argument-hint: "<story ID or story text>"
context: fork
agent: test-designer
---

# Test cases

Story: $ARGUMENTS

If no story was given, reply asking for a story ID or the story text, and stop.

1. Find the story and its acceptance criteria in `docs/sdlc/02-requirements/`. If the argument is story text
   instead of an ID, work from that text. Read the test plan in `docs/sdlc/testing/test-plans/` if one exists,
   and `docs/sdlc/testing/test-strategy.md`.
2. Read the code behind the story where it helps: validation rules, limits, states and error messages make
   test cases precise.
3. Design the cases as described in your instructions. Every acceptance criterion needs at least one positive
   and one negative or boundary case.
4. Write `docs/sdlc/testing/test-cases/TC-<story ID>.md` from `_template-test-cases.md`. If the file already
   exists, add to it and keep the existing IDs.
5. Update `docs/sdlc/testing/traceability-matrix.md`: one row per criterion and test case.

Reply with: the file path · number of cases per criterion · cases recommended for automation · criteria that
are ambiguous or untestable, with a suggested rewrite · assumptions made.
