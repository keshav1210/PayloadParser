---
name: tech-debt-scan
description: Find and rank the riskiest technical debt by combining how often code changes, how complex it is and how well it's tested, plus TODOs, duplication and outdated patterns, and write a prioritised list to docs/sdlc/tech-debt.md. Use when planning refactoring, asked where the code is weakest, or before a big change.
argument-hint: "[folder or area to focus on]"
disable-model-invocation: true
---

# Technical debt scan

{{#if workspace}}
> Workspace: first decide which service this is about (ask if unclear), then run every git, build and
> test command inside that service's folder (`git -C <service> …`, `cd <service> && …`), as described in
> `.claude/rules/workspace.md`.

{{/if}}Focus: $ARGUMENTS (if empty: the whole codebase).

Don't change code in this command.

## 1. Gather signals

- **Change frequency**: files changed most often in the last 12 months:
  `git log --since="12 months ago" --format= --name-only | sort | uniq -c | sort -rn | head -40`
  (skip this signal if the project isn't a git repository, and say so).
- **Size and complexity**: very long files, classes and functions, deep nesting, functions with many
  parameters or branches.
- **Tests**: source files with no matching tests; areas with known bugs.
- **Markers**: `TODO`, `FIXME`, `HACK`, `XXX`, and code marked deprecated.
- **Duplication**: near-identical blocks in several places.
- **Outdated patterns**: deprecated APIs, old framework idioms, dependencies far behind (point to
  `/check-dependencies` for the details).

## 2. Rank by risk

The riskiest debt is code that changes often, is hard to understand and isn't tested. Score each candidate on
those three and on its business importance (from the project overview and requirements). Ignore ugly code
that nobody touches unless it's dangerous.

## 3. Write `docs/sdlc/tech-debt.md`

A table, highest risk first: area · files · problem · evidence (change count, size, missing tests) · impact if
left · effort (S / M / L) · suggested first step. Then 3 quick wins and the one larger item worth planning.
Keep earlier entries a person wrote, and mark resolved items as done instead of deleting them.

Reply with the top 5 items and the file path.
