---
name: implement
description: Implement a user story or change following the agreed requirements and design, with tests, and prove it works by running the build and tests. Use when the user asks to build or implement a story or feature.
argument-hint: "<story ID, REQ ID or description>"
disable-model-invocation: true
---

# Implement

{{#if workspace}}
> Workspace: first decide which service this is about (ask if unclear), then run every git, build and
> test command inside that service's folder (`git -C <service> …`, `cd <service> && …`), as described in
> `.claude/rules/workspace.md`.

{{/if}}Work item: $ARGUMENTS

If nothing was given, ask what to implement, and stop.

## 1. Know exactly what "done" means

- Read the story and its acceptance criteria in `docs/sdlc/02-requirements/`, and any design or ADRs linked
  from it. Without written criteria, list the criteria you'll work to and ask the user to confirm them first.
- Read the code you'll change and its existing tests. Check "Where new code goes" in
  `docs/sdlc/01-folder-structure.md` before creating files.

## 2. Plan briefly

Tell the user, in a few lines, which files you'll create or change and how each acceptance criterion will be
met and tested. If the plan touches more than about 8 files, changes a public API or database schema, or adds
a dependency, wait for the user to agree before writing code.

## 3. Build it

- Follow `CLAUDE.md`, `.claude/rules/coding-standards.md` and the patterns in the surrounding code.
- Write tests alongside the code: at least one per acceptance criterion, plus the error cases.
- Keep the change focused. If you spot an unrelated problem, note it for the report instead of fixing it.

## 4. Prove it

- Run the build and the tests with the `test-runner` agent, which uses the commands in `CLAUDE.md` and keeps
  long output out of the conversation. Run the new tests and the existing tests for the area you changed; run
  the full suite if it's quick.
- If something fails, fix it and run again. Don't weaken, skip or delete tests to make them pass.
- If you can't run the tests (missing tools, services or credentials), say so clearly and list exactly what
  the user should run.

## 5. Report with evidence

Finish with:

1. **Acceptance criteria**: a table of criterion · how it's met (file:line) · test that proves it · result.
2. **Test run**: the command you ran and the summary lines of its output (passed / failed / skipped).
3. **Files changed**: one line each.
4. **Done checklist**: tests pass · no secrets or debug code · docs updated if the API, setup or architecture
   changed · no unrelated changes.
5. **Follow-ups**: anything noticed but not done.

Update the story's status in the requirement file to "In progress", or "Done" when every criterion passes.
Don't commit or push unless the user asks.
