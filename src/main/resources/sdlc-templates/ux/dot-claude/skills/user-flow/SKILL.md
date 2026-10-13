---
name: user-flow
description: Design the user flow for a feature before it's built - entry points, steps and decisions, every screen state (empty, loading, error, success), copy, validation and edge cases - saved in docs/sdlc/design/flows/. Use after requirements are written and before implementation of anything with a user interface.
argument-hint: "<REQ ID, story or feature>"
disable-model-invocation: true
---

# Design a user flow

Feature: $ARGUMENTS

If nothing was given, ask which feature or requirement to design, and stop.

## 1. Understand the job

- Read the requirement and its acceptance criteria in `docs/sdlc/02-requirements/` (or the brief the user
  points to), `docs/sdlc/00-project-overview.md` for the users, and `docs/sdlc/design/design-guidelines.md`.
- Find the existing screens and components the flow will use or sit next to, so it matches what users already
  know. Reuse existing components and patterns; say where a new one is needed and why.
- Ask the user up to 3 questions that change the flow: which users, which device, what happens today.

## 2. Design the flow

- Entry points: how users get here.
- The happy path as numbered steps: what the user sees, what they do, what the system does.
- Decisions and branches, and every way out (cancel, back, undo).
- For each screen: the states (first use and empty, loading, partial, error, success, no permission) and what
  each shows.
- Copy: headings, button labels, help text and every error message (what happened and what to do).
- Validation rules and when they run, with the exact messages.
- Edge cases: long text, many items, slow network, double submit, session expiry.
- Accessibility basics: labels, focus order after each action, keyboard use, announcements for changes.

Draw the flow as a Mermaid flowchart in the document so it renders on GitHub and in most editors.

## 3. Write and link it

Create `docs/sdlc/design/flows/FLOW-<short-name>.md` from `docs/sdlc/design/flows/_template-flow.md`. Link the
requirement ID, and map each acceptance criterion to the step that satisfies it; list any criterion the flow
doesn't cover yet.

Reply with the file path, the steps, the open questions and new components needed. Suggest the next step{{#if dev}}:
`/design` for the technical design or `/implement`{{/if}}{{#if tester}}{{#unless dev}}: `/test-cases`{{/unless}}{{/if}}.
