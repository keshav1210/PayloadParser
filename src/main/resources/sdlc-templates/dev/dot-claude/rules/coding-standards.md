---
paths:
  - "src/**"
  - "app/**"
  - "lib/**"
  - "packages/**"
  - "cmd/**"
  - "internal/**"
  - "pkg/**"
---

# Coding standards

These apply whenever you write or change code. The project's existing style wins over anything here: match
the naming, structure and patterns already used in the surrounding code.

## Design

- Put code where similar code already lives (see "Where new code goes" in `docs/sdlc/01-folder-structure.md`).
- Keep functions small and focused. Prefer clear names over comments that explain unclear code.
- Don't duplicate logic. Reuse an existing helper or service; if a similar one exists, extend it.
- Handle errors deliberately: no empty catch blocks, no swallowed errors. Use the project's error format.
- Validate input at the boundary (controllers, handlers, message consumers), not deep inside.
- Don't add a dependency when the standard library or an existing dependency does the job. If one is needed,
  ask first and say why.

## Changes

- Change only what the task needs. No drive-by refactoring, renaming or reformatting of unrelated code.
- Keep public APIs, database schemas and config keys backwards compatible unless the task says otherwise.
- Remove code you made unused. Don't leave commented-out code or debug output.
- Don't hard-code environment-specific values (URLs, credentials, file paths); use configuration.

## Tests

- New behaviour needs tests. A bug fix needs a test that fails without the fix.
- Test behaviour, not implementation details. One reason to fail per test; clear names.
- Use the test framework and style already in the project.

## Comments and docs

- Comment the "why", not the "what": business rules, workarounds and non-obvious decisions.
- Update `docs/sdlc/06-api-and-data.md` when you change an API or data model, and
  `docs/sdlc/03-architecture.md` when you change how modules fit together.
