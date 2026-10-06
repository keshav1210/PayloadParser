---
name: sdlc-status
description: Show how complete the project's SDLC docs are (which sections are filled, inferred or still empty) and suggest what to do next. Use when asked about the status of the docs, what is missing, or what to do next with the kit.
allowed-tools: Read Grep Glob
---

# SDLC status

Don't edit any files.

1. Find every Markdown file in `docs/sdlc/` (skip files starting with `_`, which are templates) plus
   `CLAUDE.md`.
2. In each, use Grep to count sections with `<!-- FILL` (empty) and `<!-- INFERRED` (unconfirmed). Count the
   remaining `##` sections as filled.
3. List research reports in `docs/sdlc/research/` with their dates. Flag reports older than 6 months as
   possibly outdated.
4. If `docs/sdlc/02-requirements/` or `docs/sdlc/testing/` exist, list each feature or test plan with the
   status shown in its file.

Reply with:

- A table: doc · filled · inferred · empty, sorted with the least complete docs first.
- The empty sections that would help Claude most if filled. Purpose, users, scope, build commands and
  "where new code goes" matter most.
- 1-3 next steps, such as "run /sdlc-init" or "confirm the inferred tech stack".
